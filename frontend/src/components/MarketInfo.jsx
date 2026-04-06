import "./MarketInfo.css";

const BASE = { BTC: 83241, ETH: 1842, INIT: 1.47 };

export default function MarketInfo({ market }) {
  if (!market) return null;
  const base = BASE[market.symbol] || 0;
  const fmtP = (p) => base < 10 ? `$${p.toFixed(4)}` : `$${p.toLocaleString()}`;

  const stats = [
    { label: "Strike Price",   value: fmtP(base) },
    { label: "24h High",       value: fmtP(base * 1.032) },
    { label: "24h Low",        value: fmtP(base * 0.971) },
    { label: "24h Volume",     value: "$" + (Math.random() * 5 + 1).toFixed(2) + "M" },
    { label: "Open Interest",  value: "$" + (Math.random() * 800 + 200).toFixed(0) + "K" },
    { label: "Markets Open",   value: "3 active" },
    { label: "Min Trade",      value: "$1 USDC" },
    { label: "Max Trade",      value: "$1,000 USDC" },
    { label: "Payout Fee",     value: "2%" },
    { label: "Settlement",     value: "On-chain oracle" },
  ];

  return (
    <div className="minfo-wrap">
      <div className="minfo-header">
        <span className="minfo-title">{market.symbol}/USDC Info</span>
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
