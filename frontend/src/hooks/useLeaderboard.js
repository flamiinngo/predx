import { useState, useEffect } from "react";
import { ethers } from "ethers";

const PM_ADDRESS   = import.meta.env.VITE_POSITION_MANAGER || "";
const RPC_URL      = import.meta.env.VITE_RPC_URL          || "http://localhost:8545";

const POSITION_CLOSED_TOPIC = ethers.id(
  "PositionClosed(uint256,address,bool,uint256,string)"
);
const POSITION_OPENED_TOPIC = ethers.id(
  "PositionOpened(uint256,address,uint256,bool,uint256,uint256,uint256,uint256)"
);

// Parse a PositionClosed log into { trader, won, payout }
function parseClosed(log, iface) {
  try {
    const parsed = iface.parseLog({ topics: log.topics, data: log.data });
    if (!parsed) return null;
    const trader = parsed.args[1];    // indexed address
    const won    = parsed.args[2];    // bool
    const payout = Number(parsed.args[3]) / 1e6; // USDC
    return { trader: trader.toLowerCase(), won, payout };
  } catch {
    return null;
  }
}

// Parse a PositionOpened log into { trader, size }
function parseOpened(log, iface) {
  try {
    const parsed = iface.parseLog({ topics: log.topics, data: log.data });
    if (!parsed) return null;
    const trader = parsed.args[1];
    const size   = Number(parsed.args[4]) / 1e6;
    return { trader: trader.toLowerCase(), size };
  } catch {
    return null;
  }
}

/**
 * Reads PositionOpened + PositionClosed events and aggregates by trader.
 * Returns a ranked list sorted by realised PnL (24h window used for "today").
 */
export function useLeaderboard() {
  const [rows,      setRows]      = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error,     setError]     = useState(null);

  useEffect(() => {
    if (!PM_ADDRESS) { setIsLoading(false); return; }

    const provider = new ethers.JsonRpcProvider(RPC_URL, new ethers.Network("predx-1", 674323531314972), { staticNetwork: new ethers.Network("predx-1", 674323531314972) });

    const ABI_CLOSED = [
      "event PositionClosed(uint256 indexed positionId, address indexed trader, bool won, uint256 payout, string reason)",
    ];
    const ABI_OPENED = [
      "event PositionOpened(uint256 indexed positionId, address indexed trader, uint256 indexed marketId, bool higher, uint256 size, uint256 entryPrice, uint256 slPrice, uint256 tpPrice)",
    ];
    const ifaceClosed = new ethers.Interface(ABI_CLOSED);
    const ifaceOpened = new ethers.Interface(ABI_OPENED);

    const load = async () => {
      try {
        // Fetch last 2000 blocks worth of events (plenty for testnet)
        const [closedLogs, openedLogs] = await Promise.all([
          provider.getLogs({
            address: PM_ADDRESS,
            topics:  [POSITION_CLOSED_TOPIC],
            fromBlock: 0,
            toBlock: "latest",
          }),
          provider.getLogs({
            address: PM_ADDRESS,
            topics:  [POSITION_OPENED_TOPIC],
            fromBlock: 0,
            toBlock: "latest",
          }),
        ]);

        // Aggregate: per trader → { totalVolume, wins, losses, realizedPnl }
        const stats = {};

        const ensure = (addr) => {
          if (!stats[addr]) {
            stats[addr] = { address: addr, volume: 0, wins: 0, losses: 0, pnl: 0, trades: 0 };
          }
        };

        for (const log of openedLogs) {
          const e = parseOpened(log, ifaceOpened);
          if (!e) continue;
          ensure(e.trader);
          stats[e.trader].volume += e.size;
          stats[e.trader].trades++;
        }

        for (const log of closedLogs) {
          const e = parseClosed(log, ifaceClosed);
          if (!e) continue;
          ensure(e.trader);
          if (e.won) {
            stats[e.trader].wins++;
            stats[e.trader].pnl += e.payout; // gross payout (includes original stake)
          } else {
            stats[e.trader].losses++;
            // Stake was already deducted from volume when opened — just track loss count
          }
        }

        // Build ranked rows
        const ranked = Object.values(stats)
          .map(s => ({
            ...s,
            totalTrades: s.trades,
            winPct:     s.trades > 0 ? Math.round((s.wins / s.trades) * 100) : 0,
            netPnl:     s.pnl - s.volume, // payout - staked = net profit
          }))
          .filter(s => s.trades > 0)
          .sort((a, b) => b.netPnl - a.netPnl)
          .slice(0, 20)
          .map((s, i) => ({ ...s, rank: i + 1 }));

        setRows(ranked);
      } catch (err) {
        setError(err.message);
        console.error("[Leaderboard] Failed:", err);
      } finally {
        setIsLoading(false);
      }
    };

    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, []);

  return { rows, isLoading, error };
}
