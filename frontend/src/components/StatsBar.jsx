import { useLivePrices } from "../hooks/useLivePrices";
import "./StatsBar.css";

const STATS = [
  { label: "24h Volume", value: "$4.82M", change: "+12.4%" },
  { label: "Open Interest", value: "$1.24M", change: "+3.1%" },
  { label: "Active Markets", value: "9", change: null },
  { label: "Total Traders", value: "1,847", change: "+24" },
  { label: "LP TVL", value: "$892K", change: "+5.2%" },
  { label: "Protocol Fees", value: "$9,640", change: "+8.1%" },
];

export default function StatsBar() {
  return (
    <div className="stats-bar">
      {STATS.map((s) => (
        <div key={s.label} className="stat-item">
          <span className="stat-label">{s.label}</span>
          <div className="stat-row">
            <span className="stat-val">{s.value}</span>
            {s.change && (
              <span className={`stat-chg ${s.change.startsWith("+") ? "up" : "dn"}`}>
                {s.change}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
