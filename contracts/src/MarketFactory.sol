// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./OracleConsumer.sol";

contract MarketFactory {
    enum Timeframe { ONE_MIN, FIVE_MIN, FIFTEEN_MIN }

    struct Market {
        uint256 id;
        string  symbol;
        Timeframe timeframe;
        uint256 startTime;
        uint256 endTime;
        uint256 strikePrice;
        bool    settled;
        bool    higherWon;
        uint256 totalHigher;
        uint256 totalLower;
    }

    address public owner;
    address public positionManager;
    address public lpVault;
    address public oracle;
    address public settlementEngine;

    uint256 public nextMarketId = 1;
    mapping(uint256 => Market) public markets;
    mapping(string => mapping(uint256 => uint256)) public activeMarket;

    uint256[3] public durations = [1 minutes, 5 minutes, 15 minutes];

    event MarketCreated(uint256 indexed marketId, string symbol, Timeframe timeframe, uint256 startTime, uint256 endTime, uint256 strikePrice);
    event MarketSettled(uint256 indexed marketId, bool higherWon, uint256 settlementPrice);

    constructor(address _oracle) {
        owner  = msg.sender;
        oracle = _oracle;
    }

    modifier onlyOwner() { require(msg.sender == owner, "MF: not owner"); _; }
    modifier onlySettlement() { require(msg.sender == settlementEngine, "MF: not settlement"); _; }

    function setContracts(address _pm, address _vault, address _settlement) external onlyOwner {
        positionManager  = _pm;
        lpVault          = _vault;
        settlementEngine = _settlement;
    }

    function openMarket(string calldata symbol, Timeframe tf)
        external returns (uint256 marketId)
    {
        require(msg.sender == owner || msg.sender == settlementEngine, "MF: unauthorized");
        uint256 duration = durations[uint256(tf)];
        uint256 start    = block.timestamp;
        uint256 end      = start + duration;
        uint256 strike   = OracleConsumer(oracle).getPrice(symbol);
        require(strike > 0, "MF: bad oracle price");

        marketId = nextMarketId++;
        markets[marketId] = Market({
            id: marketId, symbol: symbol, timeframe: tf,
            startTime: start, endTime: end, strikePrice: strike,
            settled: false, higherWon: false, totalHigher: 0, totalLower: 0
        });
        activeMarket[symbol][uint256(tf)] = marketId;
        emit MarketCreated(marketId, symbol, tf, start, end, strike);
    }

    function recordPosition(uint256 marketId, bool higher, uint256 amount) external {
        require(msg.sender == positionManager, "MF: not PM");
        Market storage m = markets[marketId];
        require(!m.settled, "MF: settled");
        require(block.timestamp < m.endTime, "MF: expired");
        if (higher) { m.totalHigher += amount; } else { m.totalLower += amount; }
    }

    function settleMarket(uint256 marketId, bool higherWon, uint256 settlementPrice)
        external onlySettlement
    {
        Market storage m = markets[marketId];
        require(!m.settled, "MF: already settled");
        m.settled   = true;
        m.higherWon = higherWon;
        emit MarketSettled(marketId, higherWon, settlementPrice);
    }

    function getMarket(uint256 marketId) external view returns (Market memory) {
        return markets[marketId];
    }

    function getActiveMarketId(string calldata symbol, Timeframe tf)
        external view returns (uint256)
    {
        return activeMarket[symbol][uint256(tf)];
    }

    function getHigherProbability(uint256 marketId)
        external view returns (uint256 bps)
    {
        Market storage m = markets[marketId];
        uint256 total = m.totalHigher + m.totalLower;
        if (total == 0) return 5000;
        bps = (m.totalHigher * 10000) / total;
    }

    function getTimeRemaining(uint256 marketId) external view returns (uint256) {
        Market storage m = markets[marketId];
        if (block.timestamp >= m.endTime) return 0;
        return m.endTime - block.timestamp;
    }
}
