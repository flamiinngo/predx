import { useInterwovenKit } from "@initia/interwovenkit-react";
import { usePositions } from "../hooks/usePositions";
import { useUsername } from "../hooks/useUsername";
import "./Positions.css";

export default function Positions() {
  const { address } = useInterwovenKit();
  const { positions } = usePositions(address);
  const username = useUsername(address);
  const displayName = username || (address ? `${address.slice(0,6)}...${address.slice(-4)}` : null);

  return (
    <div className="positions-wrap">
      <div className="positions-header">
        <span className="pos-title">Positions</span>
        {displayName && <span className="pos-user">{displayName}</span>}
      </div>
      {!address ? (
        <div className="pos-empty">Connect wallet to view positions</div>
      ) : positions.length === 0 ? (
        <div className="pos-empty">No open positions</div>
      ) : (
        <div className="pos-list">
          {positions.map((p) => (
            <div key={p.id} className="pos-row">
              <span className="pos-sym">{p.symbol}</span>
              <span className={`pos-dir ${p.higher ? "h" : "l"}`}>{p.higher ? "▲ H" : "▼ L"}</span>
              <span className="pos-size">${(p.size / 1e6).toFixed(0)}</span>
              {p.stopLossPrice > 0   && <span className="pos-sl">SL</span>}
              {p.takeProfitPrice > 0 && <span className="pos-tp">TP</span>}
              <span className={`pos-status ${p.closed ? (p.won ? "won" : "lost") : "open"}`}>
                {p.closed ? (p.won ? "WON" : "LOST") : "LIVE"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
