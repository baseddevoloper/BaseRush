// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IUniswapV3SwapRouterV2 {
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

interface IAerodromeRouterV2 {
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

contract UserTradeRouter is ReentrancyGuard {
    using SafeERC20 for IERC20;

    address public owner;
    address public feeTreasury;
    uint16 public feeBps;

    address public uniswapV3Router;
    address public aerodromeRouter;
    address public aerodromeFactory;
    uint24 public defaultUniswapPoolFee;

    event UserSwapExecuted(
        address indexed user,
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 minOut,
        uint256 amountOut,
        uint256 feeAmountOut,
        address recipient,
        uint8 venue
    );

    event OwnerUpdated(address indexed oldOwner, address indexed newOwner);
    event FeeConfigUpdated(address indexed feeTreasury, uint16 feeBps);
    event RouterConfigUpdated(address indexed uniswapV3Router, address indexed aerodromeRouter, address indexed aerodromeFactory, uint24 defaultUniswapPoolFee);
    event RescueTransfer(address indexed token, address indexed to, uint256 amount);

    error NotOwner();
    error InvalidAddress();
    error InvalidFeeBps();
    error InvalidAmount();
    error MissingRouter();
    error SwapOutTooLow();
    error NothingAfterFee();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(
        address _owner,
        address _feeTreasury,
        uint16 _feeBps,
        address _uniswapV3Router,
        address _aerodromeRouter,
        address _aerodromeFactory,
        uint24 _defaultUniswapPoolFee
    ) {
        if (_owner == address(0) || _feeTreasury == address(0)) revert InvalidAddress();
        if (_feeBps > 10_000) revert InvalidFeeBps();
        owner = _owner;
        feeTreasury = _feeTreasury;
        feeBps = _feeBps;
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

    function setRouterConfig(address newUniswapV3Router, address newAerodromeRouter, address newAerodromeFactory, uint24 newDefaultUniswapPoolFee) external onlyOwner {
        uniswapV3Router = newUniswapV3Router;
        aerodromeRouter = newAerodromeRouter;
        aerodromeFactory = newAerodromeFactory;
        if (newDefaultUniswapPoolFee > 0) defaultUniswapPoolFee = newDefaultUniswapPoolFee;
        emit RouterConfigUpdated(uniswapV3Router, aerodromeRouter, aerodromeFactory, defaultUniswapPoolFee);
    }

    function rescueToken(address token, address to, uint256 amount) external onlyOwner {
        if (to == address(0) || token == address(0)) revert InvalidAddress();
        IERC20(token).safeTransfer(to, amount);
        emit RescueTransfer(token, to, amount);
    }

    function swapUserTokens(address tokenIn, address tokenOut, uint256 amountIn, uint256 minOut, address recipient)
        external
        nonReentrant
        returns (uint256 amountOutAfterFee)
    {
        return _swapUserTokens(tokenIn, tokenOut, amountIn, minOut, recipient, defaultUniswapPoolFee, false, false);
    }

    function swapUserTokensWithOptions(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minOut,
        address recipient,
        uint24 uniPoolFee,
        bool aeroStable,
        bool useAerodrome
    ) external nonReentrant returns (uint256 amountOutAfterFee) {
        return _swapUserTokens(tokenIn, tokenOut, amountIn, minOut, recipient, uniPoolFee, aeroStable, useAerodrome);
    }

    function _swapUserTokens(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minOut,
        address recipient,
        uint24 uniPoolFee,
        bool aeroStable,
        bool useAerodrome
    ) internal returns (uint256 amountOutAfterFee) {
        if (tokenIn == address(0) || tokenOut == address(0) || recipient == address(0) || tokenIn == tokenOut) revert InvalidAddress();
        if (amountIn == 0) revert InvalidAmount();

        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
        uint256 amountOut = _swap(useAerodrome, tokenIn, tokenOut, amountIn, minOut, address(this), uniPoolFee, aeroStable);

        uint256 feeAmountOut = (amountOut * feeBps) / 10_000;
        amountOutAfterFee = amountOut - feeAmountOut;
        if (amountOutAfterFee == 0) revert NothingAfterFee();

        if (feeAmountOut > 0) IERC20(tokenOut).safeTransfer(feeTreasury, feeAmountOut);
        IERC20(tokenOut).safeTransfer(recipient, amountOutAfterFee);

        emit UserSwapExecuted(msg.sender, tokenIn, tokenOut, amountIn, minOut, amountOut, feeAmountOut, recipient, useAerodrome ? 1 : 0);
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
            IAerodromeRouterV2.Route[] memory routes = new IAerodromeRouterV2.Route[](1);
            routes[0] = IAerodromeRouterV2.Route({from: tokenIn, to: tokenOut, stable: aeroStable, factory: aerodromeFactory});
            uint256[] memory amounts = IAerodromeRouterV2(aerodromeRouter).swapExactTokensForTokens(amountIn, minOut, routes, recipient, block.timestamp);
            amountOut = amounts[amounts.length - 1];
        } else {
            if (uniswapV3Router == address(0)) revert MissingRouter();
            _approveIfNeeded(tokenIn, uniswapV3Router, amountIn);
            IUniswapV3SwapRouterV2.ExactInputSingleParams memory params = IUniswapV3SwapRouterV2.ExactInputSingleParams({
                tokenIn: tokenIn,
                tokenOut: tokenOut,
                fee: uniPoolFee == 0 ? defaultUniswapPoolFee : uniPoolFee,
                recipient: recipient,
                amountIn: amountIn,
                amountOutMinimum: minOut,
                sqrtPriceLimitX96: 0
            });
            amountOut = IUniswapV3SwapRouterV2(uniswapV3Router).exactInputSingle(params);
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
