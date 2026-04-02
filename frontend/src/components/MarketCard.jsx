import { useCountdown } from "../hooks/useCountdown";
import "./MarketCard.css";

const SYMBOL_COLORS = { BTC: "#f7931a", ETH: "#627eea", INIT: "#6366f1" };

export default function MarketCard({ market, isSelected, onClick }) {
  const { symbol, price, higher, totalVolume, endTime } = market;
  const lower     = 100 - higher;
  const remaining = useCountdown(endTime);
  const color     = SYMBOL_COLORS[symbol] || "#6366f1";
  const fmt = (n) => n >= 1000 ? `$${(n/1000).toFixed(1)}k` : `$${n.toFixed(2)}`;

  return (
    <div className={`market-card ${isSelected ? "selected" : ""}`} onClick={onClick}>
      <div className="mc-top">
        <div className="mc-symbol">
          <span className="mc-dot" style={{ background: color }} />
          <span className="mc-name">{symbol}/USDC</span>
        </div>
        <span className="mc-countdown">{remaining}</span>
      </div>
      <div className="mc-price">{fmt(price)}</div>
      <div className="mc-bar-wrap">
        <div className="mc-bar">
          <div className="mc-bar-higher" style={{ width: `${higher}%` }} />
        </div>
        <div className="mc-bar-labels">
          <span className="higher-label">▲ {higher}%</span>
          <span className="lower-label">{lower}% ▼</span>
        </div>
      </div>
      <div className="mc-footer">
        <span className="mc-vol">Vol {fmt(totalVolume)}</span>
        <div className="mc-btns">
          <button className="mc-btn higher" onClick={(e) => { e.stopPropagation(); onClick(); }}>HIGHER</button>
          <button className="mc-btn lower"  onClick={(e) => { e.stopPropagation(); onClick(); }}>LOWER</button>
        </div>
      </div>
    </div>
  );
}
