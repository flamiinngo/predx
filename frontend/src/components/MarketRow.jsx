import { useState, useEffect } from "react";
import { useCountdown }  from "../hooks/useCountdown";
import { useLivePrices } from "../hooks/useLivePrices";
import { useMarkets }    from "../hooks/useMarkets";
import { calcLiveOdds }  from "../hooks/useLiveOdds";
import { useTick }       from "../hooks/useTick";
import "./MarketRow.css";

const TFS    = ["1m", "5m", "15m"];
const COLORS = { BTC: "#f7931a", ETH: "#627eea", INIT: "#6366f1" };

function MarketChip({ market, isSelected, onClick, price }) {
  useTick(1000); // re-render every second so odds move with time
  const remaining  = useCountdown(market.endTime);
  const liveHigher = calcLiveOdds({
    baseOdds:    market.higher,
    livePrice:   price,
    strikePrice: market.strikePrice,
    endTime:     market.endTime,
    startTime:   market.startTime,
  });
  const higher = liveHigher.toFixed(0);
  const lower  = (100 - liveHigher).toFixed(0);
  const vol       = market.vol > 0 ? `$${market.vol.toFixed(1)}k` : "$0.0k";
  const fmt       = market.symbol === "INIT"
    ? `$${price.toFixed(3)}`
    : `$${(price / 1000).toFixed(1)}k`;

  return (
    <div className={`mchip ${isSelected ? "sel" : ""}`} onClick={onClick}>
      <div className="mchip-top">
        <div className="mchip-sym">
          <span className="mchip-dot" style={{ background: COLORS[market.symbol] }} />
          <span>{market.symbol}/USDC</span>
        </div>
        <span className="mchip-timer" style={{ color: remaining === "0:00" ? "#f85149" : "#3fb950" }}>
          {remaining}
        </span>
      </div>
      <div className="mchip-price">{fmt}</div>
      <div className="mchip-bar">
        <div className="mchip-fill" style={{ width: `${liveHigher}%` }} />
      </div>
      <div className="mchip-odds">
        <span className="odds-h">▲ {higher}%</span>
        <span className="odds-l">{lower}% ▼</span>
      </div>
      <div className="mchip-vol">Vol {vol}</div>
    </div>
  );
}

export default function MarketRow({ onSelect, selected }) {
  const [activeTF, setActiveTF] = useState(selected?.timeframe || "1m");
  const livePrices = useLivePrices();
  const markets    = useMarkets(activeTF);

  // Auto-select first market as soon as chain data arrives
  useEffect(() => {
    if (markets.length === 0) return;
    // Always keep selected market in sync with latest chain data (refreshed marketId)
    const current = selected?.symbol
      ? markets.find(m => m.symbol === selected.symbol)
      : markets[0];
    const target = current || markets[0];
    onSelect({ ...target, price: livePrices[target.symbol]?.price });
  }, [markets]);

  const handleTF = (tf) => {
    setActiveTF(tf);
  };

  return (
    <div className="market-row">
      <div className="mr-header">
        <div className="mr-title">
          <span className="live-dot" />
          Live Markets
        </div>
        <div className="tf-group">
          {TFS.map((tf) => (
            <button
              key={tf}
              className={`tf-btn ${activeTF === tf ? "on" : ""}`}
              onClick={() => handleTF(tf)}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>
      <div className="mr-chips">
        {markets.length === 0 ? (
          <div style={{ color: "#4a5568", padding: "20px", fontSize: "13px" }}>
            Loading markets from chain...
          </div>
        ) : (
          markets.map((m) => (
            <MarketChip
              key={m.id}
              market={m}
              price={livePrices[m.symbol]?.price || 0}
              isSelected={selected?.symbol === m.symbol}
              onClick={() => onSelect({ ...m, price: livePrices[m.symbol]?.price })}
            />
          ))
        )}
      </div>
    </div>
  );
}
