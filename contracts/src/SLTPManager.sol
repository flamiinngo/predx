// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./OracleConsumer.sol";
import "./LPVault.sol";

interface IPositionManager {
    struct Position {
        uint256 id; address trader; uint256 marketId; bool higher;
        uint256 size; uint256 entryPrice; uint256 openTime;
        bool closed; bool won; uint256 payout;
        uint256 stopLossPrice; uint256 takeProfitPrice;
    }
    function getPosition(uint256 id) external view returns (Position memory);
    function closePosition(uint256 id, bool won, uint256 payout, string calldata reason) external;
}

contract SLTPManager {
    struct SLTPOrder {
        uint256 positionId;
        address trader;
        string  symbol;
        bool    higher;
        uint256 stopLossPrice;
        uint256 takeProfitPrice;
        bool    active;
    }

    address public owner;
    address public oracle;
    address public positionManager;
    address public vault;
    address public keeper;

    mapping(uint256 => SLTPOrder) public orders;
    uint256[] public activeOrderIds;
    mapping(uint256 => uint256) private orderIndex;

    uint256 public slPayoutBps = 2000;   // 20%
    uint256 public tpPayoutBps = 18000;  // 180%

    event OrderRegistered(uint256 indexed positionId, uint256 sl, uint256 tp);
    event StopLossTriggered(uint256 indexed positionId, uint256 currentPrice);
    event TakeProfitTriggered(uint256 indexed positionId, uint256 currentPrice);

    constructor(address _oracle, address _positionManager, address _vault) {
        owner           = msg.sender;
        oracle          = _oracle;
        positionManager = _positionManager;
        vault           = _vault;
        keeper          = msg.sender;
    }

    modifier onlyKeeper() {
        require(msg.sender == keeper || msg.sender == owner, "SLTP: not keeper");
        _;
    }

    function registerOrder(
        uint256 positionId, address trader, string calldata symbol,
        bool higher, uint256 slPrice, uint256 tpPrice
    ) external {
        require(msg.sender == positionManager, "SLTP: not PM");
        require(slPrice > 0 || tpPrice > 0, "SLTP: no SL or TP");
        orders[positionId] = SLTPOrder({
            positionId: positionId, trader: trader, symbol: symbol,
            higher: higher, stopLossPrice: slPrice, takeProfitPrice: tpPrice,
            active: true
        });
        orderIndex[positionId] = activeOrderIds.length;
        activeOrderIds.push(positionId);
        emit OrderRegistered(positionId, slPrice, tpPrice);
    }

    function checkAndExecute() external onlyKeeper {
        uint256 i = activeOrderIds.length;
        while (i > 0) {
            i--;
            uint256 posId = activeOrderIds[i];
            SLTPOrder storage o = orders[posId];
            if (!o.active) continue;
            uint256 price = OracleConsumer(oracle).getPrice(o.symbol);
            bool triggered; bool isSL;
            if (o.higher) {
                if (o.stopLossPrice > 0 && price <= o.stopLossPrice)     { triggered = true; isSL = true;  }
                else if (o.takeProfitPrice > 0 && price >= o.takeProfitPrice) { triggered = true; isSL = false; }
            } else {
                if (o.stopLossPrice > 0 && price >= o.stopLossPrice)     { triggered = true; isSL = true;  }
                else if (o.takeProfitPrice > 0 && price <= o.takeProfitPrice) { triggered = true; isSL = false; }
            }
            if (triggered) _execute(posId, o, price, isSL);
        }
    }

    function _execute(
        uint256 posId, SLTPOrder storage o,
        uint256 currentPrice, bool isSL
    ) internal {
        IPositionManager pm = IPositionManager(positionManager);
        IPositionManager.Position memory p = pm.getPosition(posId);
        if (p.closed) { _removeOrder(posId); return; }

        uint256 payout = isSL
            ? (p.size * slPayoutBps) / 10000
            : (p.size * tpPayoutBps) / 10000;

        string memory reason = isSL ? "stop_loss" : "take_profit";

        // vault pays directly to trader — no multi-hop
        LPVault(vault).coverPayout(payout, p.trader);

        // tell PM to close with payout=0 (already paid by vault)
        pm.closePosition(posId, !isSL, 0, reason);
        _removeOrder(posId);

        if (isSL) emit StopLossTriggered(posId, currentPrice);
        else      emit TakeProfitTriggered(posId, currentPrice);
    }

    function _removeOrder(uint256 posId) internal {
        orders[posId].active = false;
        uint256 idx  = orderIndex[posId];
        uint256 last = activeOrderIds[activeOrderIds.length - 1];
        activeOrderIds[idx] = last;
        orderIndex[last]    = idx;
        activeOrderIds.pop();
    }

    function setKeeper(address k) external {
        require(msg.sender == owner, "SLTP: not owner");
        keeper = k;
    }

    function setPayouts(uint256 sl, uint256 tp) external {
        require(msg.sender == owner, "SLTP: not owner");
        slPayoutBps = sl;
        tpPayoutBps = tp;
    }

    function getActiveOrderCount() external view returns (uint256) {
        return activeOrderIds.length;
    }
}
