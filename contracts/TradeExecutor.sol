// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IUniswapV3SwapRouter {
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }

    function exactInputSingle(ExactInputSingleParams calldata params) external payable returns (uint256 amountOut);
}

interface IAerodromeRouter {
    struct Route {
        address from;
        address to;
        bool stable;
        address factory;
    }

    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        Route[] calldata routes,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts);
}

/**
 * @title TradeExecutor
 * @notice Real onchain trade executor for Base.
 *         Uses contract-held balances and performs swaps on Uniswap V3 or Aerodrome.
 *         Trading fee is cut onchain and transferred to feeTreasury.
 */
contract TradeExecutor is ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint8 internal constant SIDE_BUY = 0;
    uint8 internal constant SIDE_SELL = 1;

    address public owner;
    address public feeTreasury;
    uint16 public feeBps;

    address public immutable usdc;
    address public uniswapV3Router;
    address public aerodromeRouter;
    address public aerodromeFactory;
    uint24 public defaultUniswapPoolFee;

    event TradeExecuted(
        address indexed token,
        uint8 indexed side,
        uint256 amountIn,
        uint256 minOut,
        address indexed recipient,
        bytes32 orderId,
        uint256 feeUsdc,
        uint256 amountOut,
        uint8 venue,
        uint256 timestamp
    );

    event OwnerUpdated(address indexed oldOwner, address indexed newOwner);
    event FeeConfigUpdated(address indexed feeTreasury, uint16 feeBps);
    event RouterConfigUpdated(
        address indexed uniswapV3Router,
        address indexed aerodromeRouter,
        address indexed aerodromeFactory,
        uint24 defaultUniswapPoolFee
    );
    event RescueTransfer(address indexed token, address indexed to, uint256 amount);

    error NotOwner();
    error InvalidAddress();
    error InvalidFeeBps();
    error InvalidSide();
    error InvalidAmount();
    error InsufficientAmountAfterFee();
    error MissingRouter();
    error SwapOutTooLow();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(
        address _owner,
        address _feeTreasury,
        uint16 _feeBps,
        address _usdc,
        address _uniswapV3Router,
        address _aerodromeRouter,
        address _aerodromeFactory,
        uint24 _defaultUniswapPoolFee
    ) {
        if (_owner == address(0) || _feeTreasury == address(0) || _usdc == address(0)) revert InvalidAddress();
        if (_feeBps > 10_000) revert InvalidFeeBps();
        owner = _owner;
        feeTreasury = _feeTreasury;
        feeBps = _feeBps;
        usdc = _usdc;
        uniswapV3Router = _uniswapV3Router;
        aerodromeRouter = _aerodromeRouter;
        aerodromeFactory = _aerodromeFactory;
        defaultUniswapPoolFee = _defaultUniswapPoolFee == 0 ? 500 : _defaultUniswapPoolFee;
    }

    function setOwner(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert InvalidAddress();
        address old = owner;
        owner = newOwner;
        emit OwnerUpdated(old, newOwner);
    }

    function setFeeConfig(address newTreasury, uint16 newFeeBps) external onlyOwner {
        if (newTreasury == address(0)) revert InvalidAddress();
        if (newFeeBps > 10_000) revert InvalidFeeBps();
        feeTreasury = newTreasury;
        feeBps = newFeeBps;
        emit FeeConfigUpdated(newTreasury, newFeeBps);
    }

    function setRouterConfig(
        address newUniswapV3Router,
        address newAerodromeRouter,
        address newAerodromeFactory,
        uint24 newDefaultUniswapPoolFee
    ) external onlyOwner {
        uniswapV3Router = newUniswapV3Router;
        aerodromeRouter = newAerodromeRouter;
        aerodromeFactory = newAerodromeFactory;
        if (newDefaultUniswapPoolFee > 0) {
            defaultUniswapPoolFee = newDefaultUniswapPoolFee;
        }
        emit RouterConfigUpdated(uniswapV3Router, aerodromeRouter, aerodromeFactory, defaultUniswapPoolFee);
    }

    function rescueToken(address token, address to, uint256 amount) external onlyOwner {
        if (to == address(0) || token == address(0)) revert InvalidAddress();
        IERC20(token).safeTransfer(to, amount);
        emit RescueTransfer(token, to, amount);
    }

    /**
     * @notice Backward compatible entrypoint (default: Uniswap venue, default pool fee).
     * @dev amountIn is input token amount: BUY => USDC in, SELL => token in.
     */
    function executeTrade(
        address token,
        uint8 side,
        uint256 amountIn,
        uint256 minOut,
        address recipient,
        bytes32 orderId
    ) external onlyOwner nonReentrant returns (bool ok) {
        _executeTrade(token, side, amountIn, minOut, recipient, orderId, defaultUniswapPoolFee, false, false);
        return true;
    }

    /**
     * @notice Extended entrypoint with venue + route options.
     * @param useAerodrome false => Uniswap V3, true => Aerodrome
     */
    function executeTradeWithOptions(
        address token,
        uint8 side,
        uint256 amountIn,
        uint256 minOut,
        address recipient,
        bytes32 orderId,
        uint24 uniPoolFee,
        bool aeroStable,
        bool useAerodrome
    ) external onlyOwner nonReentrant returns (bool ok) {
        _executeTrade(token, side, amountIn, minOut, recipient, orderId, uniPoolFee, aeroStable, useAerodrome);
        return true;
    }

    function _executeTrade(
        address token,
        uint8 side,
        uint256 amountIn,
        uint256 minOut,
        address recipient,
        bytes32 orderId,
        uint24 uniPoolFee,
        bool aeroStable,
        bool useAerodrome
    ) internal {
        if (token == address(0) || token == usdc || recipient == address(0)) revert InvalidAddress();
        if (amountIn == 0) revert InvalidAmount();
        if (side != SIDE_BUY && side != SIDE_SELL) revert InvalidSide();

        uint256 feeUsdc = 0;
        uint256 amountOut = 0;

        if (side == SIDE_BUY) {
            // BUY: input is USDC from contract balance, fee is cut in USDC before swap.
            feeUsdc = (amountIn * feeBps) / 10_000;
            uint256 swapIn = amountIn - feeUsdc;
            if (swapIn == 0) revert InsufficientAmountAfterFee();

            if (feeUsdc > 0) IERC20(usdc).safeTransfer(feeTreasury, feeUsdc);
            amountOut = _swap(
                useAerodrome,
                usdc,
                token,
                swapIn,
                minOut,
                recipient,
                uniPoolFee,
                aeroStable
            );
        } else {
            // SELL: input is token from contract balance, output is USDC then fee cut from output.
            uint256 grossOut = _swap(
                useAerodrome,
                token,
                usdc,
                amountIn,
                minOut,
                address(this),
                uniPoolFee,
                aeroStable
            );
            feeUsdc = (grossOut * feeBps) / 10_000;
            amountOut = grossOut - feeUsdc;
            if (amountOut == 0) revert InsufficientAmountAfterFee();

            if (feeUsdc > 0) IERC20(usdc).safeTransfer(feeTreasury, feeUsdc);
            IERC20(usdc).safeTransfer(recipient, amountOut);
        }

        emit TradeExecuted(
            token,
            side,
            amountIn,
            minOut,
            recipient,
            orderId,
            feeUsdc,
            amountOut,
            useAerodrome ? 1 : 0,
            block.timestamp
        );
    }

    function _swap(
        bool useAerodrome,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minOut,
        address recipient,
        uint24 uniPoolFee,
        bool aeroStable
    ) internal returns (uint256 amountOut) {
        if (useAerodrome) {
            if (aerodromeRouter == address(0) || aerodromeFactory == address(0)) revert MissingRouter();
            _approveIfNeeded(tokenIn, aerodromeRouter, amountIn);

            IAerodromeRouter.Route[] memory routes = new IAerodromeRouter.Route[](1);
            routes[0] = IAerodromeRouter.Route({
                from: tokenIn,
                to: tokenOut,
                stable: aeroStable,
                factory: aerodromeFactory
            });

            uint256[] memory amounts = IAerodromeRouter(aerodromeRouter).swapExactTokensForTokens(
                amountIn,
                minOut,
                routes,
                recipient,
                block.timestamp
            );
            amountOut = amounts[amounts.length - 1];
        } else {
            if (uniswapV3Router == address(0)) revert MissingRouter();
            _approveIfNeeded(tokenIn, uniswapV3Router, amountIn);

            IUniswapV3SwapRouter.ExactInputSingleParams memory params = IUniswapV3SwapRouter.ExactInputSingleParams({
                tokenIn: tokenIn,
                tokenOut: tokenOut,
                fee: uniPoolFee == 0 ? defaultUniswapPoolFee : uniPoolFee,
                recipient: recipient,
                amountIn: amountIn,
                amountOutMinimum: minOut,
                sqrtPriceLimitX96: 0
            });
            amountOut = IUniswapV3SwapRouter(uniswapV3Router).exactInputSingle(params);
        }

        if (amountOut < minOut) revert SwapOutTooLow();
    }

    function _approveIfNeeded(address token, address spender, uint256 amount) internal {
        IERC20 erc20 = IERC20(token);
        uint256 current = erc20.allowance(address(this), spender);
        if (current >= amount) return;
        if (current > 0) erc20.forceApprove(spender, 0);
        erc20.forceApprove(spender, type(uint256).max);
    }
}


