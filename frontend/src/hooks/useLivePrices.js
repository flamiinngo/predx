import { useState, useEffect } from "react";

const FALLBACK = { BTC: 69428, ETH: 2140, INIT: 0.082 };

export function useLivePrices() {
  const [prices, setPrices] = useState(() =>
    Object.fromEntries(
      Object.entries(FALLBACK).map(([sym, price]) => [sym, {
        price,
        change: 0,
        formatted: sym === "INIT" ? `$${price.toFixed(3)}` : `$${(price/1000).toFixed(2)}k`,
      }])
    )
  );

  useEffect(() => {
    const fetchPrices = async () => {
      try {
        const [btcRes, ethRes, initRes] = await Promise.all([
          fetch("https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT"),
          fetch("https://api.binance.com/api/v3/ticker/24hr?symbol=ETHUSDT"),
          fetch("https://api.binance.com/api/v3/ticker/24hr?symbol=INITUSDT"),
        ]);
        const [btc, eth, init] = await Promise.all([btcRes.json(), ethRes.json(), initRes.json()]);

        setPrices({
          BTC: {
            price:     parseFloat(btc.lastPrice),
            change:    parseFloat(btc.priceChangePercent),
            formatted: `$${(parseFloat(btc.lastPrice)/1000).toFixed(2)}k`,
          },
          ETH: {
            price:     parseFloat(eth.lastPrice),
            change:    parseFloat(eth.priceChangePercent),
            formatted: `$${(parseFloat(eth.lastPrice)/1000).toFixed(2)}k`,
          },
          INIT: {
            price:     parseFloat(init.lastPrice),
            change:    parseFloat(init.priceChangePercent),
            formatted: `$${parseFloat(init.lastPrice).toFixed(3)}`,
          },
        });
      } catch (err) {
        console.warn("Price fetch failed:", err.message);
      }
    };

    fetchPrices();
    const id = setInterval(fetchPrices, 15000);
    return () => clearInterval(id);
  }, []);

  return prices;
}
