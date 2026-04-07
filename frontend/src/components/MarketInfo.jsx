import "./MarketInfo.css";

export default function MarketInfo({ market, livePrice }) {
  if (!market) return null;
  const base = livePrice || market.price || 83241;
  const fmt  = (p) => base < 10 ? `$${p.toFixed(4)}` : `$${p.toLocaleString()}`;

  const stats = [
    { label: "Current Price",  value: fmt(base) },
    { label: "Strike Price",   value: fmt(base) },
    { label: "24h High",       value: fmt(base * 1.032) },
    { label: "24h Low",        value: fmt(base * 0.971) },
    { label: "Markets Open",   value: "3 active" },
    { label: "Min Trade",      value: "$1 USDC" },
    { label: "Max Trade",      value: "$1,000 USDC" },
    { label: "Payout Fee",     value: "2%" },
    { label: "SL Refund",      value: "20% of size" },
    { label: "TP Early Exit",  value: "180% of size" },
    { label: "Settlement",     value: "On-chain oracle" },
    { label: "Chain",          value: "predx-1 (Initia)" },
  ];

  return (
    <div className="minfo-wrap">
      <div className="minfo-header">
        <span className="minfo-title">{market.symbol}/USDC Market Info</span>
      </div>
      <div className="minfo-list">
        {stats.map((s) => (
          <div key={s.label} className="minfo-row">
            <span className="minfo-label">{s.label}</span>
            <span className="minfo-val">{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
