import { useState, useEffect } from "react";
import { ethers } from "ethers";

const ORACLE_ABI = [
  "function getPrice(string) external view returns (uint256)"
];
const ORACLE  = import.meta.env.VITE_ORACLE  || "0xfb98bf3418eb41b008ca7621db973ec364a06cf7";
const RPC_URL = import.meta.env.VITE_RPC_URL || "http://localhost:8545";
const SYMBOLS = ["BTC", "ETH", "INIT"];

function fmt(sym, price) {
  if (sym === "INIT") return `$${price.toFixed(4)}`;
  if (price >= 1000)  return `$${(price / 1000).toFixed(1)}k`;
  return `$${price.toFixed(2)}`;
}

export function useLivePrices() {
  const [prices, setPrices] = useState({});
  const [prev,   setPrev]   = useState({});

  useEffect(() => {
    const provider = new ethers.JsonRpcProvider(RPC_URL, new ethers.Network("predx-1", 674323531314972), { staticNetwork: new ethers.Network("predx-1", 674323531314972) });
    const oracle   = new ethers.Contract(ORACLE, ORACLE_ABI, provider);

    const load = async () => {
      try {
        const results = await Promise.all(
          SYMBOLS.map(async (sym) => {
            const p = await oracle.getPrice(sym);
            return [sym, Number(p) / 1e18];
          })
        );
        setPrev(old => {
          const next = {};
          for (const [sym, price] of results) {
            const oldPrice = old[sym]?.price || price;
            const change   = oldPrice > 0 ? ((price - oldPrice) / oldPrice) * 100 : 0;
            next[sym] = {
              price,
              formatted: fmt(sym, price),
              change,
            };
          }
          setPrices(next);
          return next;
        });
      } catch (err) {
        console.error("Price load failed:", err.message);
      }
    };

    load();
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, []);

  return prices;
}
