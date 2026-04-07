// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract OracleConsumer {
    address public owner;
    mapping(string => uint256) public fallbackPrices;

    constructor() {
        owner = msg.sender;
        fallbackPrices["BTC"]  = 69000 * 1e18;
        fallbackPrices["ETH"]  = 2100  * 1e18;
        fallbackPrices["INIT"] = 82    * 1e15;
    }

    modifier onlyOwner() { require(msg.sender == owner, "Oracle: not owner"); _; }

    function updatePrices(uint256 btc, uint256 eth, uint256 init) external onlyOwner {
        fallbackPrices["BTC"]  = btc;
        fallbackPrices["ETH"]  = eth;
        fallbackPrices["INIT"] = init;
    }

    function setPrice(string calldata symbol, uint256 price) external onlyOwner {
        fallbackPrices[symbol] = price;
    }

    function getPrice(string calldata symbol) external view returns (uint256) {
        uint256 p = fallbackPrices[symbol];
        require(p > 0, "Oracle: no price");
        return p;
    }

    function getPriceWithTimestamp(string calldata symbol)
        external view returns (uint256 price, uint256 timestamp)
    {
        return (fallbackPrices[symbol], block.timestamp);
    }
}
