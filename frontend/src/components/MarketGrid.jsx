import { useState } from "react";
import MarketCard from "./MarketCard";
import "./MarketGrid.css";

const SYMBOLS    = ["BTC", "ETH", "INIT"];
const TIMEFRAMES = ["1m", "5m", "15m"];
const MOCK_PRICES = { BTC: 83241.50, ETH: 1842.30, INIT: 1.47 };

export default function MarketGrid({ onSelect, selected }) {
  const [activeTF, setActiveTF] = useState("1m");

  const markets = SYMBOLS.map((sym) => ({
    symbol:      sym,
    timeframe:   activeTF,
    price:       MOCK_PRICES[sym],
    higher:      52 + Math.floor(Math.random() * 20),
    totalVolume: Math.floor(Math.random() * 50000) + 5000,
    endTime:     Date.now() + (activeTF === "1m" ? 60 : activeTF === "5m" ? 300 : 900) * 1000,
  }));

  return (
    <div className="market-grid-wrap">
      <div className="market-grid-header">
        <h2 className="section-title">Live Markets</h2>
        <div className="tf-tabs">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf}
              className={`tf-tab ${activeTF === tf ? "active" : ""}`}
              onClick={() => setActiveTF(tf)}
            >{tf}</button>
          ))}
        </div>
      </div>
      <div className="market-grid">
        {markets.map((m) => (
          <MarketCard
            key={`${m.symbol}-${m.timeframe}`}
            market={m}
            isSelected={selected?.symbol === m.symbol && selected?.timeframe === m.timeframe}
            onClick={() => onSelect(m)}
          />
        ))}
      </div>
    </div>
  );
}
