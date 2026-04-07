import { useState, useEffect } from "react";
import { useCountdown } from "../hooks/useCountdown";
import { useLivePrices } from "../hooks/useLivePrices";
import "./MarketRow.css";

const SYMBOLS   = ["BTC", "ETH", "INIT"];
const TFS       = ["1m", "5m", "15m"];
const COLORS    = { BTC: "#f7931a", ETH: "#627eea", INIT: "#6366f1" };
const DURATIONS = { "1m": 60, "5m": 300, "15m": 900 };

function MarketChip({ market, isSelected, onClick, price }) {
  const remaining = useCountdown(market.endTime);
  const lower     = 100 - market.higher;
  const fmt       = market.symbol === "INIT"
    ? `$${price.toFixed(3)}`
    : `$${(price/1000).toFixed(1)}k`;

  return (
    <div className={`mchip ${isSelected ? "sel" : ""}`} onClick={onClick}>
      <div className="mchip-top">
        <div className="mchip-sym">
          <span className="mchip-dot" style={{ background: COLORS[market.symbol] }} />
          <span>{market.symbol}/USDC</span>
        </div>
        <span className="mchip-timer">{remaining}</span>
      </div>
      <div className="mchip-price">{fmt}</div>
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
  const [activeTF, setActiveTF] = useState(selected?.timeframe || "1m");
  const livePrices = useLivePrices();

  const makeMarkets = (tf) => SYMBOLS.map((sym) => ({
    symbol:    sym,
    timeframe: tf,
    higher:    50 + Math.floor(Math.random() * 30),
    vol:       Math.floor(Math.random() * 80000) + 8000,
    endTime:   Date.now() + DURATIONS[tf] * 1000,
    id:        `${sym}-${tf}`,
  }));

  const [markets, setMarkets] = useState(() => makeMarkets(activeTF));

  const handleTF = (tf) => {
    setActiveTF(tf);
    const newMarkets = makeMarkets(tf);
    setMarkets(newMarkets);
    if (selected) {
      const match = newMarkets.find(m => m.symbol === selected.symbol);
      if (match) onSelect({ ...match, price: livePrices[match.symbol]?.price });
    }
  };

  useEffect(() => {
    const id = setInterval(() => setMarkets(makeMarkets(activeTF)), DURATIONS[activeTF] * 1000);
    return () => clearInterval(id);
  }, [activeTF]);

  return (
    <div className="market-row">
      <div className="mr-header">
        <div className="mr-title">
          <span className="live-dot" />
          Live Markets
        </div>
        <div className="tf-group">
          {TFS.map((tf) => (
            <button key={tf} className={`tf-btn ${activeTF === tf ? "on" : ""}`} onClick={() => handleTF(tf)}>
              {tf}
            </button>
          ))}
        </div>
      </div>
      <div className="mr-chips">
        {markets.map((m) => (
          <MarketChip
            key={m.id}
            market={m}
            price={livePrices[m.symbol]?.price || 0}
            isSelected={selected?.id === m.id}
            onClick={() => onSelect({ ...m, price: livePrices[m.symbol]?.price })}
          />
        ))}
      </div>
    </div>
  );
}
