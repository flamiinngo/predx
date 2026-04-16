// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./MarketFactory.sol";
import "./LPVault.sol";
import "./OracleConsumer.sol";

interface IPositionManagerSE {
    struct Position {
        uint256 id; address trader; uint256 marketId; bool higher;
        uint256 size; uint256 entryPrice; uint256 openTime;
        bool closed; bool won; uint256 payout;
        uint256 stopLossPrice; uint256 takeProfitPrice;
    }
    function getPosition(uint256 id) external view returns (Position memory);
    function closePosition(uint256 id, bool won, uint256 payout, string calldata reason) external;
    function getTraderPositions(address trader) external view returns (uint256[] memory);
    function transferLoserFundsToVault(uint256 amount, address vaultAddr) external;
}

contract SettlementEngine {
    address public owner;
    address public factory;
    address public positionManager;
    address public vault;
    address public oracle;
    address public keeper;

    mapping(uint256 => uint256[]) public marketPositions;

    event MarketSettled(uint256 indexed marketId, string symbol, bool higherWon, uint256 settlementPrice, uint256 totalPayout, uint256 winnerCount);
    event NextMarketOpened(uint256 indexed newMarketId, string symbol);

    constructor(address _factory, address _positionManager, address _vault, address _oracle) {
        owner           = msg.sender;
        factory         = _factory;
        positionManager = _positionManager;
        vault           = _vault;
        oracle          = _oracle;
        keeper          = msg.sender;
    }

    modifier onlyKeeper() { require(msg.sender == keeper || msg.sender == owner, "SE: not keeper"); _; }

    function setKeeper(address k) external { require(msg.sender == owner, "SE: not owner"); keeper = k; }

    function registerPosition(uint256 marketId, uint256 positionId) external {
        require(msg.sender == positionManager, "SE: not PM");
        marketPositions[marketId].push(positionId);
    }

    function settle(uint256 marketId) external onlyKeeper {
        _settle(marketId);
    }

    function _settle(uint256 marketId) internal {
        MarketFactory mf = MarketFactory(factory);
        MarketFactory.Market memory m = mf.getMarket(marketId);
        require(!m.settled, "SE: already settled");
        require(block.timestamp >= m.endTime, "SE: not expired");

        uint256 finalPrice = OracleConsumer(oracle).getPrice(m.symbol);
        bool higherWon     = finalPrice > m.strikePrice;
        mf.settleMarket(marketId, higherWon, finalPrice);

        uint256 winnerPool  = higherWon ? m.totalHigher : m.totalLower;
        uint256 loserPool   = higherWon ? m.totalLower  : m.totalHigher;
        uint256 totalPayout;
        uint256 winnerCount;

        IPositionManagerSE pm = IPositionManagerSE(positionManager);
        uint256[] storage posIds = marketPositions[marketId];

        for (uint256 i; i < posIds.length; i++) {
            IPositionManagerSE.Position memory p = pm.getPosition(posIds[i]);
            if (p.closed) continue;
            bool won = (p.higher == higherWon);
            uint256 payout;
            if (won && winnerPool > 0) {
                payout       = (p.size * (m.totalHigher + m.totalLower)) / winnerPool;
                totalPayout += payout;
                winnerCount++;
                LPVault(vault).coverPayout(payout, p.trader);
            }
            pm.closePosition(posIds[i], won, 0, "settlement");
        }

        if (loserPool > 0) {
            IPositionManagerSE(positionManager).transferLoserFundsToVault(loserPool, vault);
            LPVault(vault).receiveLoserFunds(loserPool);
        }

        emit MarketSettled(marketId, m.symbol, higherWon, finalPrice, totalPayout, winnerCount);

        uint256 newId = mf.openMarket(m.symbol, m.timeframe);
        emit NextMarketOpened(newId, m.symbol);
    }

    function settleExpiredMarkets() external onlyKeeper {
        MarketFactory mf = MarketFactory(factory);
        string[3] memory symbols = ["BTC", "ETH", "INIT"];
        for (uint256 s; s < 3; s++) {
            for (uint256 t; t < 3; t++) {
                uint256 mid = mf.getActiveMarketId(symbols[s], MarketFactory.Timeframe(t));
                if (mid == 0) continue;
                MarketFactory.Market memory m = mf.getMarket(mid);
                if (!m.settled && block.timestamp >= m.endTime) {
                    _settle(mid);
                }
            }
        }
    }

    function bootstrapMarkets() external {
        require(msg.sender == owner, "SE: not owner");
        MarketFactory mf = MarketFactory(factory);
        string[3] memory symbols = ["BTC", "ETH", "INIT"];
        for (uint256 s; s < 3; s++) {
            for (uint256 t; t < 3; t++) {
                mf.openMarket(symbols[s], MarketFactory.Timeframe(t));
            }
        }
    }
}
