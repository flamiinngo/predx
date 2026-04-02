import { useState } from "react";
import { useCountdown } from "../hooks/useCountdown";
import "./MarketRow.css";

const SYMBOLS = ["BTC", "ETH", "INIT"];
const TFS     = ["1m", "5m", "15m"];
const PRICES  = { BTC: 83241.50, ETH: 1842.30, INIT: 1.47 };
const COLORS  = { BTC: "#f7931a", ETH: "#627eea", INIT: "#6366f1" };

function MarketChip({ market, isSelected, onClick }) {
  const remaining = useCountdown(market.endTime);
  const lower = 100 - market.higher;
  return (
    <div className={`mchip ${isSelected ? "sel" : ""}`} onClick={onClick}>
      <div className="mchip-top">
        <div className="mchip-sym">
          <span className="mchip-dot" style={{ background: COLORS[market.symbol] }} />
          <span>{market.symbol}/USDC</span>
        </div>
        <span className="mchip-timer">{remaining}</span>
      </div>
      <div className="mchip-price">{market.symbol === "INIT" ? `$${PRICES[market.symbol].toFixed(2)}` : `$${(PRICES[market.symbol]/1000).toFixed(1)}k`}</div>
      <div className="mchip-bar">
        <div className="mchip-fill" style={{ width: `${market.higher}%` }} />
      </div>
      <div className="mchip-odds">
        <span className="odds-h">▲ {market.higher}%</span>
        <span className="odds-l">{lower}% ▼</span>
      </div>
      <div className="mchip-vol">Vol ${(market.vol/1000).toFixed(1)}k</div>
    </div>
  );
}

export default function MarketRow({ onSelect, selected }) {
  const [activeTF, setActiveTF] = useState("1m");
  const duration = { "1m": 60, "5m": 300, "15m": 900 };

  const markets = SYMBOLS.map((sym) => ({
    symbol:  sym,
    timeframe: activeTF,
    higher:  50 + Math.floor(Math.random() * 30),
    vol:     Math.floor(Math.random() * 80000) + 8000,
    endTime: Date.now() + duration[activeTF] * 1000,
    id:      `${sym}-${activeTF}`,
  }));

  return (
    <div className="market-row">
      <div className="mr-header">
        <div className="mr-title">
          <span className="live-dot" />
          Live Markets
        </div>
        <div className="tf-group">
          {TFS.map((tf) => (
            <button key={tf} className={`tf-btn ${activeTF === tf ? "on" : ""}`} onClick={() => setActiveTF(tf)}>{tf}</button>
          ))}
        </div>
      </div>
      <div className="mr-chips">
        {markets.map((m) => (
          <MarketChip
            key={m.id}
            market={m}
            isSelected={selected?.id === m.id}
            onClick={() => onSelect(m)}
          />
        ))}
      </div>
    </div>
  );
}
