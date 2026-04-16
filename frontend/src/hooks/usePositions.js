import { useState, useEffect, useRef } from "react";
import { ethers } from "ethers";

const PM_ABI = [
  "function getTraderPositions(address) external view returns (uint256[])",
  "function getPosition(uint256) external view returns (tuple(uint256 id,address trader,uint256 marketId,bool higher,uint256 size,uint256 entryPrice,uint256 openTime,bool closed,bool won,uint256 payout,uint256 stopLossPrice,uint256 takeProfitPrice))",
];
const FACTORY_ABI = [
  "function getMarket(uint256) external view returns (tuple(uint256 id,string symbol,uint8 timeframe,uint256 startTime,uint256 endTime,uint256 strikePrice,bool settled,bool higherWon,uint256 totalHigher,uint256 totalLower))",
  "function nextMarketId() external view returns (uint256)",
];
const USDC_ABI = ["function balanceOf(address) external view returns (uint256)"];
const TF_LABELS = { 0: "1m", 1: "5m", 2: "15m" };

export function usePositions(address) {
  const [positions, setPositions] = useState([]);
  const [balance,   setBalance]   = useState(null);
  const seenSettled = useRef(new Set());

  useEffect(() => {
    if (!address || !/^0x[0-9a-fA-F]{40}$/.test(address)) { setPositions([]); setBalance(null); return; }
    const PM      = import.meta.env.VITE_POSITION_MANAGER || "";
    const FACTORY = import.meta.env.VITE_FACTORY          || "";
    const USDC    = import.meta.env.VITE_USDC             || "";
    const RPC     = import.meta.env.VITE_RPC_URL          || "http://localhost:8545";
    if (!PM || !FACTORY) return;

    const provider = new ethers.JsonRpcProvider(RPC, new ethers.Network("predx-1", 674323531314972), { staticNetwork: new ethers.Network("predx-1", 674323531314972) });
    const pm       = new ethers.Contract(PM,      PM_ABI,      provider);
    const factory  = new ethers.Contract(FACTORY, FACTORY_ABI, provider);
    const usdc     = new ethers.Contract(USDC,    USDC_ABI,    provider);

    const load = async () => {
      // Guard: ethers resolves non-hex strings as ENS names — abort early
      if (!/^0x[0-9a-fA-F]{40}$/.test(address)) return;
      try {
        // Balance
        const bal = await usdc.balanceOf(address);
        setBalance(Number(bal) / 1e6);

        // All positions — take last 20 to ensure we show recent ones
        const allIds = await pm.getTraderPositions(address);
        console.log("[positions] address:", address, "ids:", allIds.map(String));
        const recent = [...allIds].slice(-20).reverse();

        const loaded = (await Promise.all(recent.map(async (id) => {
          try {
            const p = await pm.getPosition(id);
            const marketId = Number(p.marketId);
            if (marketId === 0) return null;

            const m = await factory.getMarket(marketId);
            if (!m || !m.symbol) return null;

            const justSettled = p.closed && !seenSettled.current.has(id.toString());
            if (p.closed) seenSettled.current.add(id.toString());

            const size        = Number(p.size) / 1e6;
            const totalHigher = Number(m.totalHigher) / 1e6;
            const totalLower  = Number(m.totalLower)  / 1e6;
            const totalPool   = totalHigher + totalLower;
            const winnerPool  = p.higher ? totalHigher : totalLower;
            const payout = (p.won && winnerPool > 0)
              ? (size * totalPool) / winnerPool
              : 0;

            return {
              id:          p.id.toString(),
              symbol:      m.symbol,
              timeframe:   TF_LABELS[Number(m.timeframe)] || "5m",
              higher:      p.higher,
              size,
              closed:      p.closed,
              won:         p.won,
              payout,
              entryPrice:  Number(p.entryPrice) / 1e18,
              endTime:     Number(m.endTime) * 1000,
              strikePrice: Number(m.strikePrice) / 1e18,
              justSettled,
              stopLossPrice:   Number(p.stopLossPrice),
              takeProfitPrice: Number(p.takeProfitPrice),
            };
          } catch (e) {
            console.warn("Position fetch failed for id", id.toString(), e.message);
            return null;
          }
        }))).filter(Boolean);

        setPositions(loaded);
      } catch (err) {
        console.error("Positions load failed:", err);
      }
    };

    load();
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, [address]);

  return { positions, balance };
}
