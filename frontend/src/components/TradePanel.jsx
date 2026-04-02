import { useState } from "react";
import { useInterwovenKit } from "@initia/interwovenkit-react";
import { useAutosign } from "../hooks/useAutosign";
import { useTrade } from "../hooks/useTrade";
import "./TradePanel.css";

export default function TradePanel({ market }) {
  const { isConnected, connect } = useInterwovenKit();
  const { autosignEnabled, enableAutosign } = useAutosign();
  const { openPosition, isLoading }         = useTrade();

  const [direction, setDirection] = useState("higher");
  const [size, setSize]           = useState("");
  const [slPrice, setSlPrice]     = useState("");
  const [tpPrice, setTpPrice]     = useState("");
  const [showSLTP, setShowSLTP]   = useState(false);

  const handleTrade = async () => {
    if (!market || !size) return;
    await openPosition({
      marketId: market.id || 1,
      higher:   direction === "higher",
      size:     parseFloat(size),
      slPrice:  slPrice ? parseFloat(slPrice) : 0,
      tpPrice:  tpPrice ? parseFloat(tpPrice) : 0,
    });
  };

  if (!market) return (
    <div className="trade-panel empty">
      <div className="empty-state">
        <div className="empty-icon">↗</div>
        <p>Select a market to trade</p>
      </div>
    </div>
  );

  const estPayout = size ? (parseFloat(size) * 1.96).toFixed(2) : "—";

  return (
    <div className="trade-panel">
      <div className="tp-header">
        <span className="tp-title">{market.symbol}/USDC</span>
        <span className="tp-tf">{market.timeframe}</span>
      </div>

      {isConnected && !autosignEnabled && (
        <div className="autosign-banner">
          <span>Enable auto-signing for instant trades</span>
          <button onClick={enableAutosign}>Enable</button>
        </div>
      )}

      <div className="direction-tabs">
        <button className={`dir-btn higher ${direction === "higher" ? "active" : ""}`} onClick={() => setDirection("higher")}>▲ HIGHER</button>
        <button className={`dir-btn lower  ${direction === "lower"  ? "active" : ""}`} onClick={() => setDirection("lower")}>▼ LOWER</button>
      </div>

      <div className="tp-field">
        <label>Amount (USDC)</label>
        <div className="input-wrap">
          <input type="number" placeholder="0.00" value={size} onChange={(e) => setSize(e.target.value)} min="1" max="1000" />
          <span className="input-suffix">USDC</span>
        </div>
        <div className="quick-amounts">
          {[10, 25, 50, 100].map((n) => (
            <button key={n} onClick={() => setSize(String(n))}>${n}</button>
          ))}
        </div>
      </div>

      <button className="sltp-toggle" onClick={() => setShowSLTP(!showSLTP)}>
        {showSLTP ? "▲" : "▼"} Stop Loss / Take Profit
      </button>

      {showSLTP && (
        <div className="sltp-fields">
          <div className="tp-field">
            <label>Stop Loss Price</label>
            <div className="input-wrap">
              <input type="number" placeholder={direction === "higher" ? `below ${market.price?.toFixed(2)}` : `above ${market.price?.toFixed(2)}`} value={slPrice} onChange={(e) => setSlPrice(e.target.value)} />
              <span className="input-suffix">USD</span>
            </div>
          </div>
          <div className="tp-field">
            <label>Take Profit Price</label>
            <div className="input-wrap">
              <input type="number" placeholder={direction === "higher" ? `above ${market.price?.toFixed(2)}` : `below ${market.price?.toFixed(2)}`} value={tpPrice} onChange={(e) => setTpPrice(e.target.value)} />
              <span className="input-suffix">USD</span>
            </div>
          </div>
        </div>
      )}

      <div className="tp-summary">
        <div className="summary-row"><span>Est. payout</span><span className="summary-val">${estPayout}</span></div>
        <div className="summary-row"><span>Fee</span><span className="summary-val">2%</span></div>
        <div className="summary-row"><span>Execution</span><span className="summary-val accent">{autosignEnabled ? "Instant (auto-sign)" : "1-click"}</span></div>
      </div>

      {!isConnected ? (
        <button className="btn-connect-trade" onClick={connect}>Connect Wallet to Trade</button>
      ) : (
        <button className={`btn-trade ${direction}`} onClick={handleTrade} disabled={!size || isLoading}>
          {isLoading ? "Submitting..." : direction === "higher" ? "▲ BUY HIGHER" : "▼ BUY LOWER"}
        </button>
      )}
    </div>
  );
}
