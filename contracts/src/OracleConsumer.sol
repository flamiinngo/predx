// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @dev Initia ConnectOracle precompile interface (Band Protocol native price feeds)
/// Address obtained via: GET ${REST_URL}/minievm/evm/v1/connect_oracle
interface IConnectOracle {
    struct Price {
        uint256 price;      // raw price value
        uint256 timestamp;  // unix seconds
        uint64  height;     // block height of last update
        uint64  nonce;      // update nonce
        uint64  decimal;    // decimal places (normalize to 18)
        uint64  id;         // feed identifier
    }
    function get_price(string memory pair_id) external view returns (Price memory);
    function get_prices(string[] memory pair_ids) external view returns (Price[] memory);
}

/// @title OracleConsumer
/// @notice Price oracle for PredX markets.
///         Primary source: Initia native ConnectOracle precompile (Band Protocol).
///         Fallback source: keeper-pushed prices (used on local dev chains where
///         the native oracle precompile is not deployed).
/// @dev After deployment on an Initia rollup, call setConnectOracle() with the
///      address returned by GET ${REST_URL}/minievm/evm/v1/connect_oracle
contract OracleConsumer {
    address public owner;

    /// @notice Initia ConnectOracle precompile address — set after deploy via REST query
    address public connectOracle;

    /// @notice Max age (seconds) before a native oracle price is considered stale
    uint256 public staleness = 120;

    /// @notice Keeper-maintained fallback prices (18 decimals) for local dev / oracle downtime
    mapping(string => uint256) public fallbackPrices;

    /// @notice Pair IDs used for each symbol in ConnectOracle (Band Protocol format)
    mapping(string => string) public pairIds;

    event ConnectOracleSet(address indexed oracle);
    event FallbackPriceSet(string symbol, uint256 price);
    event StalenessUpdated(uint256 newStaleness);

    constructor() {
        owner = msg.sender;
        // Sensible bootstrap prices (keeper overwrites these within seconds)
        fallbackPrices["BTC"]  = 83_000 * 1e18;
        fallbackPrices["ETH"]  =  1_800 * 1e18;
        fallbackPrices["INIT"] =     15 * 1e17; // $1.50

        // Band Protocol / ConnectOracle pair IDs
        pairIds["BTC"]  = "BTC/USD";
        pairIds["ETH"]  = "ETH/USD";
        pairIds["INIT"] = "INIT/USD";
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Oracle: not owner");
        _;
    }

    // ─── Admin ────────────────────────────────────────────────────────────────

    /// @notice Point to the Initia ConnectOracle precompile on this rollup.
    ///         Query: curl ${REST_URL}/minievm/evm/v1/connect_oracle
    function setConnectOracle(address _oracle) external onlyOwner {
        connectOracle = _oracle;
        emit ConnectOracleSet(_oracle);
    }

    /// @notice Override pair ID for a symbol (e.g. "INIT" -> "INIT/USD")
    function setPairId(string calldata symbol, string calldata pair) external onlyOwner {
        pairIds[symbol] = pair;
    }

    function setStaleness(uint256 s) external onlyOwner {
        staleness = s;
        emit StalenessUpdated(s);
    }

    // ─── Keeper fallback ──────────────────────────────────────────────────────

    /// @notice Keeper pushes Binance prices here — used when native oracle unavailable
    function updatePrices(uint256 btc, uint256 eth, uint256 init) external onlyOwner {
        fallbackPrices["BTC"]  = btc;
        fallbackPrices["ETH"]  = eth;
        fallbackPrices["INIT"] = init;
    }

    function setPrice(string calldata symbol, uint256 price) external onlyOwner {
        fallbackPrices[symbol] = price;
        emit FallbackPriceSet(symbol, price);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Oracle: zero address");
        owner = newOwner;
    }

    // ─── Price reads ──────────────────────────────────────────────────────────

    /// @notice Returns the latest price for a symbol in 1e18 (wei) scale.
    ///         Tries Initia native ConnectOracle first; falls back to keeper price.
    function getPrice(string calldata symbol) external view returns (uint256) {
        uint256 native = _tryNativePrice(symbol);
        if (native > 0) return native;
        uint256 fb = fallbackPrices[symbol];
        require(fb > 0, "Oracle: no fallback price");
        return fb;
    }

    /// @notice Returns price + timestamp. Timestamp is oracle update time if native,
    ///         otherwise block.timestamp.
    function getPriceWithTimestamp(string calldata symbol)
        external view returns (uint256 price, uint256 timestamp)
    {
        if (connectOracle != address(0)) {
            string memory pair = pairIds[symbol];
            if (bytes(pair).length > 0) {
                try IConnectOracle(connectOracle).get_price(pair)
                    returns (IConnectOracle.Price memory p)
                {
                    if (p.price > 0) {
                        uint256 normalized = _normalize(p.price, p.decimal);
                        if (block.timestamp - p.timestamp <= staleness) {
                            return (normalized, p.timestamp);
                        }
                    }
                } catch {}
            }
        }
        return (fallbackPrices[symbol], block.timestamp);
    }

    /// @notice Returns true when the native ConnectOracle is live and fresh for this symbol
    function isNativeActive(string calldata symbol) external view returns (bool) {
        return _tryNativePrice(symbol) > 0;
    }

    /// @notice Returns which source is powering prices: "native" or "fallback"
    function oracleSource(string calldata symbol) external view returns (string memory) {
        return _tryNativePrice(symbol) > 0 ? "native" : "fallback";
    }

    // ─── Internal helpers ─────────────────────────────────────────────────────

    function _tryNativePrice(string calldata symbol) internal view returns (uint256) {
        if (connectOracle == address(0)) return 0;
        string memory pair = pairIds[symbol];
        if (bytes(pair).length == 0) return 0;
        try IConnectOracle(connectOracle).get_price(pair)
            returns (IConnectOracle.Price memory p)
        {
            if (p.price == 0) return 0;
            if (block.timestamp - p.timestamp > staleness) return 0;
            return _normalize(p.price, p.decimal);
        } catch {
            return 0;
        }
    }

    /// @dev Normalize from oracle decimal to 18 decimals
    function _normalize(uint256 price, uint64 decimal) internal pure returns (uint256) {
        if (decimal == 18) return price;
        if (decimal < 18)  return price * (10 ** (18 - decimal));
        return price / (10 ** (decimal - 18));
    }
}
