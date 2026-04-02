import { useState } from "react";
import { useInterwovenKit } from "@initia/interwovenkit-react";
import { useAutosign } from "../hooks/useAutosign";
import { useTrade } from "../hooks/useTrade";
import "./TradePanel.css";

const BASE_PRICES = { BTC: 83241, ETH: 1842, INIT: 1.47 };

export default function TradePanel({ market }) {
  const { isConnected, connect } = useInterwovenKit();
  const { autosignEnabled, enableAutosign } = useAutosign();
  const { openPosition, isLoading }         = useTrade();

  const [dir,      setDir]      = useState("higher");
  const [size,     setSize]     = useState("");
  const [slPrice,  setSlPrice]  = useState("");
  const [tpPrice,  setTpPrice]  = useState("");
  const [showSLTP, setShowSLTP] = useState(false);

  const handleTrade = async () => {
    if (!market || !size) return;
    await openPosition({
      marketId: market.id || 1,
      higher:   dir === "higher",
      size:     parseFloat(size),
      slPrice:  slPrice ? parseFloat(slPrice) : 0,
      tpPrice:  tpPrice ? parseFloat(tpPrice) : 0,
    });
  };

  if (!market) return (
    <div className="tp empty">
      <div className="empty-hint">
        <div className="empty-arrow">↖</div>
        <p>Select a market</p>
        <p className="empty-sub">Choose BTC, ETH or INIT to start trading</p>
      </div>
    </div>
  );

  const price     = BASE_PRICES[market.symbol] || 0;
  const fee       = size ? (parseFloat(size) * 0.02).toFixed(2) : "—";
  const net       = size ? (parseFloat(size) * 0.98).toFixed(2) : "—";
  const payout    = size ? (parseFloat(size) * 1.96).toFixed(2) : "—";

  return (
    <div className="tp">
      {/* Header */}
      <div className="tp-head">
        <div className="tp-sym">
          <span className="tp-name">{market.symbol}/USDC</span>
          <span className="tp-badge">{market.timeframe}</span>
        </div>
        <div className="tp-price">${price.toLocaleString()}</div>
      </div>

      {/* Auto-sign notice */}
      {isConnected && !autosignEnabled && (
        <div className="autosign-row">
          <div className="autosign-left">
            <div className="autosign-icon">⚡</div>
            <div>
              <div className="autosign-title">Enable Auto-signing</div>
              <div className="autosign-sub">Trade instantly without popups</div>
            </div>
          </div>
          <button className="autosign-btn" onClick={enableAutosign}>Enable</button>
        </div>
      )}

      {/* Direction */}
      <div className="dir-tabs">
        <button className={`dir-btn h ${dir === "higher" ? "on" : ""}`} onClick={() => setDir("higher")}>
          <span className="dir-arrow">▲</span>
          <span>HIGHER</span>
        </button>
        <button className={`dir-btn l ${dir === "lower" ? "on" : ""}`} onClick={() => setDir("lower")}>
          <span className="dir-arrow">▼</span>
          <span>LOWER</span>
        </button>
      </div>

      {/* Size */}
      <div className="field">
        <div className="field-label">
          <span>Amount</span>
          <span className="field-bal">Balance: —</span>
        </div>
        <div className="field-input">
          <span className="field-pre">$</span>
          <input
            type="number"
            placeholder="0.00"
            value={size}
            onChange={(e) => setSize(e.target.value)}
            min="1" max="1000"
          />
          <span className="field-suf">USDC</span>
        </div>
        <div className="presets">
          {[10, 25, 50, 100, 250].map((n) => (
            <button key={n} className={`preset ${size == n ? "on" : ""}`} onClick={() => setSize(String(n))}>
              ${n}
            </button>
          ))}
        </div>
      </div>

      {/* SL/TP */}
      <div className="sltp-wrap">
        <button className="sltp-head" onClick={() => setShowSLTP(!showSLTP)}>
          <span>Stop Loss / Take Profit</span>
          <span className={`sltp-arrow ${showSLTP ? "open" : ""}`}>▼</span>
        </button>
        {showSLTP && (
          <div className="sltp-body">
            <div className="sltp-row">
              <div className="field">
                <div className="field-label"><span>Stop Loss</span><span className="sl-hint">{dir === "higher" ? `below $${price.toLocaleString()}` : `above $${price.toLocaleString()}`}</span></div>
                <div className="field-input">
                  <span className="field-pre">$</span>
                  <input type="number" placeholder="0.00" value={slPrice} onChange={(e) => setSlPrice(e.target.value)} />
                </div>
              </div>
              <div className="field">
                <div className="field-label"><span>Take Profit</span><span className="tp-hint">{dir === "higher" ? `above $${price.toLocaleString()}` : `below $${price.toLocaleString()}`}</span></div>
                <div className="field-input">
                  <span className="field-pre">$</span>
                  <input type="number" placeholder="0.00" value={tpPrice} onChange={(e) => setTpPrice(e.target.value)} />
                </div>
              </div>
            </div>
            {(slPrice || tpPrice) && (
              <div className="sltp-visual">
                {tpPrice && <div className="sltp-line tp-line" style={{ top: "10%" }}><span>TP ${tpPrice}</span></div>}
                <div className="sltp-current"><span>Entry ${price.toLocaleString()}</span></div>
                {slPrice && <div className="sltp-line sl-line" style={{ top: "80%" }}><span>SL ${slPrice}</span></div>}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Summary */}
      <div className="summary">
        <div className="sum-row"><span>Entry size</span><span>${net}</span></div>
        <div className="sum-row"><span>Protocol fee (2%)</span><span>-${fee}</span></div>
        <div className="sum-row highlight"><span>Max payout</span><span className={dir === "higher" ? "green" : "red"}>${payout}</span></div>
      </div>

      {/* CTA */}
      {!isConnected ? (
        <button className="cta-btn connect" onClick={connect}>
          Connect Wallet to Trade
        </button>
      ) : (
        <button
          className={`cta-btn trade ${dir}`}
          onClick={handleTrade}
          disabled={!size || isLoading}
        >
          {isLoading ? (
            <span className="loading">Submitting...</span>
          ) : (
            <>
              <span className="cta-arrow">{dir === "higher" ? "▲" : "▼"}</span>
              <span>BUY {dir.toUpperCase()} {market.symbol}</span>
              {autosignEnabled && <span className="cta-instant">⚡ Instant</span>}
            </>
          )}
        </button>
      )}

      <div className="tp-footer">
        Powered by Initia · Auto-signing · Interwoven Bridge
      </div>
    </div>
  );
}
