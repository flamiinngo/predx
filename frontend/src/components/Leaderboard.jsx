import { useLeaderboard } from "../hooks/useLeaderboard";
import { useUsernameQuery } from "@initia/interwovenkit-react";
import "./Leaderboard.css";

const MEDALS = ["🥇", "🥈", "🥉"];

// Resolves .init username for one address
function TraderName({ address }) {
  const { data: username } = useUsernameQuery(address);
  const display = username || `${address.slice(0, 6)}...${address.slice(-4)}`;
  const isInit  = !!username;
  return (
    <span className={`lb-trader ${isInit ? "init-name" : "hex-name"}`}>
      {isInit && <span className="init-icon">◈</span>}
      {display}
    </span>
  );
}

function SkeletonRow() {
  return (
    <div className="lb-row skeleton">
      <span className="lb-rank">—</span>
      <div className="lb-skel-name" />
      <div className="lb-skel-stats" />
    </div>
  );
}

export default function Leaderboard() {
  const { rows, isLoading, error } = useLeaderboard();

  return (
    <div className="lb-page">
      {/* Hero header */}
      <div className="lb-hero">
        <div className="lb-hero-left">
          <h1 className="lb-title">Leaderboard</h1>
          <p className="lb-subtitle">
            Real-time PnL from on-chain events · .init names via Initia Username Registry
          </p>
        </div>
        <div className="lb-hero-badge">
          <span className="lb-badge-dot" />
          Live · predx-1
        </div>
      </div>

      {/* Table */}
      <div className="lb-card">
        <div className="lb-table-head">
          <span className="lb-th rank">#</span>
          <span className="lb-th name">Trader</span>
          <span className="lb-th">Trades</span>
          <span className="lb-th">Win %</span>
          <span className="lb-th">Volume</span>
          <span className="lb-th pnl">Net PnL</span>
        </div>

        <div className="lb-body">
          {isLoading && Array.from({ length: 7 }).map((_, i) => <SkeletonRow key={i} />)}

          {!isLoading && error && (
            <div className="lb-empty">
              <div style={{ fontSize:"24px", marginBottom:"8px" }}>⚠</div>
              <div style={{ color:"var(--text2)" }}>Could not load leaderboard</div>
              <div style={{ color:"var(--text3)", fontSize:"12px", marginTop:"4px" }}>{error}</div>
            </div>
          )}

          {!isLoading && !error && rows.length === 0 && (
            <div className="lb-empty">
              <div style={{ fontSize:"32px", marginBottom:"12px" }}>🏆</div>
              <div style={{ color:"var(--text)", fontWeight:600 }}>No trades yet</div>
              <div style={{ color:"var(--text3)", fontSize:"12px", marginTop:"4px" }}>
                Be the first — open a position on any market
              </div>
            </div>
          )}

          {!isLoading && rows.map((row) => {
            const isPositive = row.netPnl >= 0;
            return (
              <div key={row.address} className={`lb-row ${row.rank <= 3 ? "podium" : ""}`}>
                <span className="lb-rank">
                  {row.rank <= 3 ? MEDALS[row.rank - 1] : <span className="lb-num">{row.rank}</span>}
                </span>

                <div className="lb-name-cell">
                  <TraderName address={row.address} />
                  <span className="lb-addr-sub">{row.address.slice(0,6)}...{row.address.slice(-4)}</span>
                </div>

                <span className="lb-stat">{row.totalTrades}</span>

                <span className={`lb-stat win ${row.winPct >= 60 ? "hot" : ""}`}>
                  {row.winPct}%
                  {row.winPct >= 60 && <span className="fire-icon" title="On fire">🔥</span>}
                </span>

                <span className="lb-stat vol">${row.volume.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>

                <span className={`lb-pnl ${isPositive ? "pos" : "neg"}`}>
                  {isPositive ? "+" : ""}{row.netPnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer note */}
      <div className="lb-footer">
        <span>Powered by Initia · On-chain data from predx-1 EVM</span>
        <span>Usernames: Initia Username Registry (initiation-2 L1)</span>
      </div>
    </div>
  );
}
