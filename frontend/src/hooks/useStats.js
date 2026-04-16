import { useState, useEffect } from "react";
import { ethers } from "ethers";

const VAULT_ABI = [
  "function getVaultBalance() external view returns (uint256)",
  "function totalDeposited() external view returns (uint256)",
  "function totalShares() external view returns (uint256)",
  "function getLPBalance(address) external view returns (uint256)",
];
const FACTORY_ABI = [
  "function nextMarketId() external view returns (uint256)",
  "function getMarket(uint256) external view returns (tuple(uint256 id,string symbol,uint8 timeframe,uint256 startTime,uint256 endTime,uint256 strikePrice,bool settled,bool higherWon,uint256 totalHigher,uint256 totalLower))",
];
const PM_ABI = [
  "function nextPositionId() external view returns (uint256)",
];

const VAULT   = import.meta.env.VITE_VAULT           || "";
const FACTORY = import.meta.env.VITE_FACTORY         || "";
const PM      = import.meta.env.VITE_POSITION_MANAGER|| "";
const RPC_URL = import.meta.env.VITE_RPC_URL         || "http://localhost:8545";

export function useStats() {
  const [stats, setStats] = useState({
    tvl:         null,
    totalDeposited: null,
    activeMarkets: null,
    openPositions: null,
    totalTrades:   null,
    volume24h:     null,
  });

  useEffect(() => {
    if (!VAULT && !FACTORY) return;
    const provider = new ethers.JsonRpcProvider(RPC_URL, new ethers.Network("predx-1", 674323531314972), { staticNetwork: new ethers.Network("predx-1", 674323531314972) });
    const vault    = VAULT   ? new ethers.Contract(VAULT,   VAULT_ABI,   provider) : null;
    const factory  = FACTORY ? new ethers.Contract(FACTORY, FACTORY_ABI, provider) : null;
    const pm       = PM      ? new ethers.Contract(PM,      PM_ABI,      provider) : null;

    const load = async () => {
      try {
        const [
          vaultBal,
          totalDep,
          nextMkt,
          nextPos,
        ] = await Promise.allSettled([
          vault?.getVaultBalance(),
          vault?.totalDeposited(),
          factory?.nextMarketId(),
          pm?.nextPositionId(),
        ]);

        const tvl    = vaultBal.status === "fulfilled" ? Number(vaultBal.value) / 1e6 : null;
        const dep    = totalDep.status === "fulfilled" ? Number(totalDep.value) / 1e6 : null;
        const mktCnt = nextMkt.status  === "fulfilled" ? Number(nextMkt.value) - 1    : null;
        const trades = nextPos.status  === "fulfilled" ? Number(nextPos.value) - 1    : null;

        // Count active (non-settled) markets
        let activeMarkets = 0;
        if (factory && mktCnt !== null) {
          const checks = [];
          for (let i = Math.max(1, mktCnt - 30); i <= mktCnt; i++) {
            checks.push(factory.getMarket(i).catch(() => null));
          }
          const mkts = await Promise.all(checks);
          activeMarkets = mkts.filter(m => m && !m.settled).length;
        }

        setStats({
          tvl,
          totalDeposited: dep,
          activeMarkets,
          totalTrades: trades,
          volume24h: dep,          // proxy: total deposited ≈ lifetime volume
          openPositions: null,
        });
      } catch (err) {
        console.error("[Stats]", err);
      }
    };

    load();
    const id = setInterval(load, 15_000);
    return () => clearInterval(id);
  }, []);

  return stats;
}
