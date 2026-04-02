import { useState, useEffect } from "react";
import "./RecentTrades.css";

const BASE = { BTC: 83241, ETH: 1842, INIT: 1.47 };
const NAMES = ["sola.init","wolf.init","apex.init","0x3f..4d","moon.init","byte.init","chad.init","0xa1..2b"];

function genTrades(base) {
  return Array.from({ length: 12 }, (_, i) => ({
    id:     i,
    trader: NAMES[Math.floor(Math.random() * NAMES.length)],
    dir:    Math.random() > 0.5 ? "higher" : "lower",
    size:   Math.floor(Math.random() * 200 + 10),
    price:  +(base + (Math.random() - 0.5) * base * 0.005).toFixed(2),
    ago:    Math.floor(Math.random() * 55) + "s",
  }));
}

export default function RecentTrades({ market }) {
  const [trades, setTrades] = useState(() => genTrades(BASE[market?.symbol] || 100));

  useEffect(() => {
    const id = setInterval(() => {
      setTrades(prev => {
        const base = BASE[market?.symbol] || 100;
        const newTrade = {
          id:     Date.now(),
          trader: NAMES[Math.floor(Math.random() * NAMES.length)],
          dir:    Math.random() > 0.5 ? "higher" : "lower",
          size:   Math.floor(Math.random() * 200 + 10),
          price:  +(base + (Math.random() - 0.5) * base * 0.005).toFixed(2),
          ago:    "just now",
        };
        return [newTrade, ...prev.slice(0, 11)];
      });
    }, 2500);
    return () => clearInterval(id);
  }, [market?.symbol]);

  return (
    <div className="recent-trades">
      <div className="rt-title">Recent Trades</div>
      <div className="rt-head">
        <span>Trader</span>
        <span>Side</span>
        <span>Size</span>
        <span>Time</span>
      </div>
      <div className="rt-list">
        {trades.map((t) => (
          <div key={t.id} className="rt-row">
            <span className="rt-trader">{t.trader}</span>
            <span className={`rt-dir ${t.dir}`}>{t.dir === "higher" ? "▲ H" : "▼ L"}</span>
            <span className="rt-size">${t.size}</span>
            <span className="rt-ago">{t.ago}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
