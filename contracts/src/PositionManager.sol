// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./MarketFactory.sol";

contract PositionManager {
    using SafeERC20 for IERC20;

    struct Position {
        uint256 id;
        address trader;
        uint256 marketId;
        bool    higher;
        uint256 size;
        uint256 entryPrice;
        uint256 openTime;
        bool    closed;
        bool    won;
        uint256 payout;
        uint256 stopLossPrice;
        uint256 takeProfitPrice;
    }

    address public owner;
    address public factory;
    address public sltp;
    address public vault;
    address public settlementEngine;
    IERC20  public usdc;

    uint256 public nextPositionId = 1;
    mapping(uint256 => Position) public positions;
    mapping(address => uint256[]) public traderPositions;

    uint256 public minSize = 1e6;
    uint256 public maxSize = 1000e6;
    uint256 public feeBps  = 200;

    event PositionOpened(uint256 indexed positionId, address indexed trader, uint256 indexed marketId, bool higher, uint256 size, uint256 entryPrice, uint256 slPrice, uint256 tpPrice);
    event PositionClosed(uint256 indexed positionId, address indexed trader, bool won, uint256 payout, string reason);

    constructor(address _usdc, address _factory) {
        owner   = msg.sender;
        usdc    = IERC20(_usdc);
        factory = _factory;
    }

    modifier onlyOwner() { require(msg.sender == owner, "PM: not owner"); _; }
    modifier onlyAuthorized() {
        require(msg.sender == settlementEngine || msg.sender == sltp, "PM: not authorized");
        _;
    }

    function setContracts(address _sltp, address _vault, address _settlement) external onlyOwner {
        sltp             = _sltp;
        vault            = _vault;
        settlementEngine = _settlement;
    }

    function openPosition(
        uint256 marketId,
        bool    higher,
        uint256 size,
        uint256 slPrice,
        uint256 tpPrice
    ) external returns (uint256 positionId) {
        require(size >= minSize && size <= maxSize, "PM: invalid size");
        MarketFactory mf = MarketFactory(factory);
        MarketFactory.Market memory m = mf.getMarket(marketId);
        require(!m.settled, "PM: market settled");
        require(block.timestamp < m.endTime, "PM: market expired");

        usdc.safeTransferFrom(msg.sender, address(this), size);
        uint256 fee     = (size * feeBps) / 10000;
        usdc.safeTransfer(vault, fee);
        uint256 netSize = size - fee;

        positionId = nextPositionId++;
        positions[positionId] = Position({
            id: positionId, trader: msg.sender, marketId: marketId,
            higher: higher, size: netSize, entryPrice: m.strikePrice,
            openTime: block.timestamp, closed: false, won: false, payout: 0,
            stopLossPrice: slPrice, takeProfitPrice: tpPrice
        });
        traderPositions[msg.sender].push(positionId);
        mf.recordPosition(marketId, higher, netSize);

        if ((slPrice > 0 || tpPrice > 0) && sltp != address(0)) {
            ISLTPManager(sltp).registerOrder(positionId, msg.sender, m.symbol, higher, slPrice, tpPrice);
        }

        ISettlementEngine(settlementEngine).registerPosition(marketId, positionId);
        emit PositionOpened(positionId, msg.sender, marketId, higher, netSize, m.strikePrice, slPrice, tpPrice);
    }

    function closePosition(uint256 positionId, bool won, uint256 payoutAmount, string calldata reason)
        external onlyAuthorized
    {
        Position storage p = positions[positionId];
        require(!p.closed, "PM: already closed");
        p.closed = true;
        p.won    = won;
        p.payout = payoutAmount;
        // Vault pays winners directly via coverPayout() — don't double-transfer
        if (payoutAmount > 0) usdc.safeTransfer(p.trader, payoutAmount);
        emit PositionClosed(positionId, p.trader, won, payoutAmount, reason);
    }

    function transferLoserFundsToVault(uint256 amount, address vaultAddr) external onlyAuthorized {
        require(amount > 0, "PM: zero amount");
        usdc.safeTransfer(vaultAddr, amount);
    }

    function getPosition(uint256 id) external view returns (Position memory) {
        return positions[id];
    }

    function getTraderPositions(address trader) external view returns (uint256[] memory) {
        return traderPositions[trader];
    }

    function getOpenPositions(address trader) external view returns (uint256[] memory openIds) {
        uint256[] storage all = traderPositions[trader];
        uint256 count;
        for (uint256 i; i < all.length; i++) {
            if (!positions[all[i]].closed) count++;
        }
        openIds = new uint256[](count);
        uint256 j;
        for (uint256 i; i < all.length; i++) {
            if (!positions[all[i]].closed) openIds[j++] = all[i];
        }
    }
}

interface ISLTPManager {
    function registerOrder(uint256 positionId, address trader, string calldata symbol, bool higher, uint256 sl, uint256 tp) external;
}

interface ISettlementEngine {
    function registerPosition(uint256 marketId, uint256 positionId) external;
}
