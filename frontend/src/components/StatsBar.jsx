import { useStats } from "../hooks/useStats";
import "./StatsBar.css";

function fmt(val, prefix = "$") {
  if (val === null || val === undefined) return "—";
  if (val >= 1_000_000) return `${prefix}${(val / 1_000_000).toFixed(2)}M`;
  if (val >= 1_000)     return `${prefix}${(val / 1_000).toFixed(1)}K`;
  return `${prefix}${val.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export default function StatsBar() {
  const stats = useStats();

  const items = [
    {
      label: "LP TVL",
      value: fmt(stats.tvl),
      tag:   stats.tvl !== null ? "live" : null,
    },
    {
      label: "Total Deposited",
      value: fmt(stats.totalDeposited),
      tag:   stats.totalDeposited !== null ? "live" : null,
    },
    {
      label: "Active Markets",
      value: stats.activeMarkets !== null ? String(stats.activeMarkets) : "—",
      tag:   stats.activeMarkets !== null ? "live" : null,
    },
    {
      label: "Total Trades",
      value: stats.totalTrades !== null
        ? stats.totalTrades.toLocaleString()
        : "—",
      tag:   stats.totalTrades !== null ? "live" : null,
    },
    {
      label: "Protocol",
      value: "predx-1",
      tag:   "Initia EVM",
    },
    {
      label: "Oracle",
      value: "ConnectOracle",
      tag:   "Band Protocol",
    },
  ];

  return (
    <div className="stats-bar">
      {items.map((s) => (
        <div key={s.label} className="stat-item">
          <span className="stat-label">{s.label}</span>
          <div className="stat-row">
            <span className="stat-val">{s.value}</span>
            {s.tag && (
              <span className={`stat-tag ${s.tag === "live" ? "live" : "info"}`}>
                {s.tag === "live" ? "● live" : s.tag}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
