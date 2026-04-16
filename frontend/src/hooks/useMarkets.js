import { useState, useEffect } from "react";
import { ethers } from "ethers";

const FACTORY_ABI = [
  "function getActiveMarketId(string symbol, uint8 tf) external view returns (uint256)",
  "function getMarket(uint256 id) external view returns (tuple(uint256 id,string symbol,uint8 timeframe,uint256 startTime,uint256 endTime,uint256 strikePrice,bool settled,bool higherWon,uint256 totalHigher,uint256 totalLower))",
  "function getHigherProbability(uint256 marketId) external view returns (uint256 bps)",
];

const SYMBOLS   = ["BTC", "ETH", "INIT"];
const TF_INDEX  = { "1m": 0, "5m": 1, "15m": 2 };
const TF_SECS   = { "1m": 60, "5m": 300, "15m": 900 };
const FACTORY   = import.meta.env.VITE_FACTORY || "";
const RPC_URL   = import.meta.env.VITE_RPC_URL || "http://localhost:8545";

// Virtual liquidity smoothing — prevents one trade from dominating odds.
// Works like Polymarket's CPMM: we pretend each side has at least VIRTUAL_USD
// of backing, so displayed odds stay near 50/50 until real volume dominates.
const VIRTUAL_USD = 500e6; // $500 virtual liquidity (in USDC 6-dec units)

export function useMarkets(activeTF) {
  const [markets, setMarkets] = useState([]);

  useEffect(() => {
    if (!FACTORY) return;
    const provider = new ethers.JsonRpcProvider(RPC_URL, new ethers.Network("predx-1", 674323531314972), { staticNetwork: new ethers.Network("predx-1", 674323531314972) });
    const factory  = new ethers.Contract(FACTORY, FACTORY_ABI, provider);

    const load = async () => {
      const tfIdx = TF_INDEX[activeTF] ?? 0;
      const results = await Promise.all(
        SYMBOLS.map(async (sym) => {
          try {
            const mid = await factory.getActiveMarketId(sym, tfIdx);
            if (mid === 0n) return null;
            const m = await factory.getMarket(mid);

            // Virtual-liquidity smoothed probability (like Polymarket CPMM)
            // Adds $500 virtual backing evenly to both sides so small real
            // positions don't push odds to extremes.
            const rawH  = Number(m.totalHigher);
            const rawL  = Number(m.totalLower);
            const vH    = rawH + VIRTUAL_USD / 2;
            const vL    = rawL + VIRTUAL_USD / 2;
            const smoothedBps = Math.round((vH / (vH + vL)) * 10000);

            const endTime   = Number(m.endTime) * 1000;
            const duration  = (TF_SECS[activeTF] || 60) * 1000;
            const startTime = endTime - duration;
            return {
              id:          `${sym}-${activeTF}`,
              symbol:      sym,
              timeframe:   activeTF,
              marketId:    mid.toString(),
              endTime,
              startTime,
              duration,
              higher:      smoothedBps / 100,
              vol:         (rawH + rawL) / 1e6,
              settled:     m.settled,
              strikePrice: Number(m.strikePrice) / 1e18,
            };
          } catch {
            return null;
          }
        })
      );
      setMarkets(results.filter(Boolean));
    };

    load();
    const id = setInterval(load, 10000); // refresh every 10s
    return () => clearInterval(id);
  }, [activeTF]);

  return markets;
}
