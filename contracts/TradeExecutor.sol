// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title TradeExecutor
 * @notice MVP executor for Base. This contract records offchain-quoted trades
 *         and is callable only by the backend owner signer.
 */
contract TradeExecutor {
    address public owner;
    address public feeTreasury;
    uint16 public feeBps;

    event TradeExecuted(
        address indexed token,
        uint8 indexed side,
        uint256 amountUsdc,
        uint256 minOut,
        address indexed recipient,
        bytes32 orderId,
        uint256 feeUsdc,
        uint256 timestamp
    );

    event OwnerUpdated(address indexed oldOwner, address indexed newOwner);
    event FeeConfigUpdated(address indexed feeTreasury, uint16 feeBps);

    error NotOwner();
    error InvalidAddress();
    error InvalidFeeBps();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(address _owner, address _feeTreasury, uint16 _feeBps) {
        if (_owner == address(0) || _feeTreasury == address(0)) revert InvalidAddress();
        if (_feeBps > 10_000) revert InvalidFeeBps();
        owner = _owner;
        feeTreasury = _feeTreasury;
        feeBps = _feeBps;
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

    /**
     * @dev MVP: emits execution event used by backend indexing.
     *      Swap routing can be added in next phase (Uniswap/Aerodrome integration).
     */
    function executeTrade(
        address token,
        uint8 side,
        uint256 amountUsdc,
        uint256 minOut,
        address recipient,
        bytes32 orderId
    ) external onlyOwner returns (bool ok) {
        uint256 feeUsdc = (amountUsdc * feeBps) / 10_000;
        emit TradeExecuted(
            token,
            side,
            amountUsdc,
            minOut,
            recipient,
            orderId,
            feeUsdc,
            block.timestamp
        );
        return true;
    }
}
