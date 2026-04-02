// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IInitiaOracle {
    function getPrice(string calldata denom)
        external view returns (uint256 price, uint256 timestamp);
}

contract OracleConsumer {
    address public constant ORACLE_PRECOMPILE =
        0x0000000000000000000000000000000000000066;

    address public owner;
    uint256 public maxStaleness = 60;
    mapping(string => uint256) public fallbackPrices;

    constructor() {
        owner = msg.sender;
        fallbackPrices["BTC"]  = 83000 * 1e18;
        fallbackPrices["ETH"]  = 1800  * 1e18;
        fallbackPrices["INIT"] = 15    * 1e17;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Oracle: not owner");
        _;
    }

    function _precompileAvailable() internal view returns (bool) {
        uint256 size;
        address target = ORACLE_PRECOMPILE;
        assembly { size := extcodesize(target) }
        return size > 0;
    }

    function getPrice(string calldata symbol)
        external view returns (uint256)
    {
        if (_precompileAvailable()) {
            try IInitiaOracle(ORACLE_PRECOMPILE).getPrice(symbol)
                returns (uint256 _price, uint256 _timestamp)
            {
                if (_price > 0 && block.timestamp - _timestamp <= maxStaleness) {
                    return _price;
                }
            } catch {}
        }
        uint256 fb = fallbackPrices[symbol];
        require(fb > 0, "Oracle: no fallback price");
        return fb;
    }

    function getPriceWithTimestamp(string calldata symbol)
        external view returns (uint256 price, uint256 timestamp)
    {
        if (_precompileAvailable()) {
            try IInitiaOracle(ORACLE_PRECOMPILE).getPrice(symbol)
                returns (uint256 _price, uint256 _ts)
            {
                if (_price > 0) return (_price, _ts);
            } catch {}
        }
        return (fallbackPrices[symbol], block.timestamp);
    }

    function setFallbackPrice(string calldata symbol, uint256 price)
        external onlyOwner
    {
        fallbackPrices[symbol] = price;
    }

    function setMaxStaleness(uint256 seconds_) external onlyOwner {
        maxStaleness = seconds_;
    }
}
