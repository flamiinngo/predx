import { useState, useEffect } from "react";

const BASE = { BTC: 83241.50, ETH: 1842.30, INIT: 1.47 };

export function useLivePrices() {
  const [prices, setPrices] = useState(() =>
    Object.fromEntries(
      Object.entries(BASE).map(([sym, price]) => [
        sym,
        {
          price,
          change: (Math.random() - 0.5) * 4,
          formatted: sym === "INIT"
            ? `$${price.toFixed(2)}`
            : `$${(price / 1000).toFixed(2)}k`,
        },
      ])
    )
  );

  useEffect(() => {
    const id = setInterval(() => {
      setPrices((prev) => {
        const next = { ...prev };
        for (const sym of Object.keys(next)) {
          const chg   = (Math.random() - 0.49) * BASE[sym] * 0.0003;
          const price = next[sym].price + chg;
          next[sym] = {
            price,
            change: ((price - BASE[sym]) / BASE[sym]) * 100,
            formatted: sym === "INIT"
              ? `$${price.toFixed(3)}`
              : `$${(price / 1000).toFixed(2)}k`,
          };
        }
        return next;
      });
    }, 2000);
    return () => clearInterval(id);
  }, []);

  return prices;
}
