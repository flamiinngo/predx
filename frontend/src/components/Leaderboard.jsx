import "./Leaderboard.css";

const TRADERS = [
  { rank: 1,  name: "sola.init",   pnl: "+$4,821", pct: "+24.1%", trades: 47, win: 72 },
  { rank: 2,  name: "wolf.init",   pnl: "+$3,204", pct: "+18.7%", trades: 31, win: 68 },
  { rank: 3,  name: "apex.init",   pnl: "+$2,891", pct: "+15.2%", trades: 62, win: 65 },
  { rank: 4,  name: "0x3f..4d",    pnl: "+$1,947", pct: "+12.4%", trades: 28, win: 61 },
  { rank: 5,  name: "moon.init",   pnl: "+$1,640", pct: "+11.8%", trades: 19, win: 63 },
  { rank: 6,  name: "byte.init",   pnl: "+$1,102", pct: "+9.3%",  trades: 44, win: 57 },
  { rank: 7,  name: "chad.init",   pnl: "+$891",   pct: "+7.1%",  trades: 33, win: 55 },
];

const MEDALS = ["🥇", "🥈", "🥉"];

export default function Leaderboard() {
  return (
    <div className="lb-wrap">
      <div className="lb-header">
        <span className="lb-title">Top Traders</span>
        <span className="lb-sub">24h PnL</span>
      </div>
      <div className="lb-list">
        {TRADERS.map((t) => (
          <div key={t.rank} className={`lb-row ${t.rank <= 3 ? "top" : ""}`}>
            <span className="lb-rank">
              {t.rank <= 3 ? MEDALS[t.rank - 1] : t.rank}
            </span>
            <span className="lb-name">{t.name}</span>
            <div className="lb-right">
              <span className="lb-pnl">{t.pnl}</span>
              <span className="lb-pct">{t.pct}</span>
              <span className="lb-win">{t.win}% win</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
