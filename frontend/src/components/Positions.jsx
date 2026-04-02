import { useInterwovenKit } from "@initia/interwovenkit-react";
import { usePositions } from "../hooks/usePositions";
import { useUsername } from "../hooks/useUsername";
import "./Positions.css";

export default function Positions() {
  const { address } = useInterwovenKit();
  const { positions } = usePositions(address);
  const username = useUsername(address);
  if (!address) return null;
  const displayName = username || `${address?.slice(0,6)}...${address?.slice(-4)}`;

  return (
    <div className="positions-wrap">
      <div className="positions-header">
        <h3>Your Positions</h3>
        <span className="positions-user">{displayName}</span>
      </div>
      {positions.length === 0 ? (
        <div className="positions-empty">No open positions</div>
      ) : (
        <div className="positions-list">
          {positions.map((p) => (
            <div key={p.id} className="position-row">
              <div className="pos-left">
                <span className="pos-symbol">{p.symbol}</span>
                <span className={`pos-dir ${p.higher ? "higher" : "lower"}`}>
                  {p.higher ? "▲ HIGHER" : "▼ LOWER"}
                </span>
              </div>
              <div className="pos-mid">
                <span className="pos-size">${(p.size / 1e6).toFixed(2)}</span>
                {p.stopLossPrice > 0   && <span className="pos-sl">SL ${(p.stopLossPrice  / 1e18).toFixed(0)}</span>}
                {p.takeProfitPrice > 0 && <span className="pos-tp">TP ${(p.takeProfitPrice / 1e18).toFixed(0)}</span>}
              </div>
              <div className="pos-right">
                <span className={`pos-status ${p.closed ? (p.won ? "won" : "lost") : "open"}`}>
                  {p.closed ? (p.won ? "WON" : "LOST") : "OPEN"}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
