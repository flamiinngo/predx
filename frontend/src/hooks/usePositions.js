import { useState, useEffect } from "react";
import { ethers } from "ethers";
const PM_ABI = [
  "function getOpenPositions(address) external view returns (uint256[])",
  "function getPosition(uint256) external view returns (tuple(uint256 id,address trader,uint256 marketId,bool higher,uint256 size,uint256 entryPrice,uint256 openTime,bool closed,bool won,uint256 payout,uint256 stopLossPrice,uint256 takeProfitPrice))"
];
const FACTORY_ABI = [
  "function getMarket(uint256) external view returns (tuple(uint256 id,string symbol,uint8 timeframe,uint256 startTime,uint256 endTime,uint256 strikePrice,bool settled,bool higherWon,uint256 totalHigher,uint256 totalLower))"
];
export function usePositions(address) {
  const [positions, setPositions] = useState([]);
  useEffect(() => {
    if (!address) { setPositions([]); return; }
    const PM      = import.meta.env.VITE_POSITION_MANAGER || "";
    const FACTORY = import.meta.env.VITE_FACTORY          || "";
    const RPC     = import.meta.env.VITE_RPC_URL           || "http://localhost:8545";
    if (!PM || !FACTORY) return;
    const provider = new ethers.JsonRpcProvider(RPC);
    const pm       = new ethers.Contract(PM,      PM_ABI,      provider);
    const factory  = new ethers.Contract(FACTORY, FACTORY_ABI, provider);
    const load = async () => {
      try {
        const ids = await pm.getOpenPositions(address);
        const loaded = await Promise.all(ids.map(async (id) => {
          const p = await pm.getPosition(id);
          const m = await factory.getMarket(p.marketId);
          return {
            id:              p.id.toString(),
            symbol:          m.symbol,
            higher:          p.higher,
            size:            p.size.toString(),
            closed:          p.closed,
            won:             p.won,
            stopLossPrice:   p.stopLossPrice.toString(),
            takeProfitPrice: p.takeProfitPrice.toString(),
          };
        }));
        setPositions(loaded);
      } catch (err) { console.error("Positions load failed:", err); }
    };
    load();
    const id = setInterval(load, 10000);
    return () => clearInterval(id);
  }, [address]);
  return { positions };
}
