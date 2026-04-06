import { useState } from "react";
import { useInterwovenKit } from "@initia/interwovenkit-react";
import { useAutosign } from "../hooks/useAutosign";
import { useTrade } from "../hooks/useTrade";
import "./TradePanel.css";

const BASE = { BTC: 83241, ETH: 1842, INIT: 1.47 };

export default function TradePanel({ market }) {
  const { isConnected, connect } = useInterwovenKit();
  const { autosignEnabled, enableAutosign } = useAutosign();
  const { openPosition, isLoading } = useTrade();

  const [dir,  setDir]  = useState("higher");
  const [size, setSize] = useState("");
  const [sl,   setSl]   = useState("");
  const [tp,   setTp]   = useState("");

  if (!market) return (
    <div className="tp empty">
      <div className="empty-hint">
        <div className="empty-arrow">↖</div>
        <p>Select a market</p>
        <p className="empty-sub">Choose BTC, ETH or INIT</p>
      </div>
    </div>
  );

  const base   = BASE[market.symbol] || 0;
  const dec    = base < 10 ? 4 : 0;
  const fmt    = (p) => base < 10 ? `$${Number(p).toFixed(4)}` : `$${Number(p).toLocaleString()}`;
  const fee    = size ? (parseFloat(size) * 0.02).toFixed(2) : "—";
  const net    = size ? (parseFloat(size) * 0.98).toFixed(2) : "—";
  const payout = size ? (parseFloat(size) * 1.96).toFixed(2) : "—";

  const handleTrade = async () => {
    if (!market || !size) return;
    await openPosition({
      marketId: market.id || 1,
      higher:   dir === "higher",
      size:     parseFloat(size),
      slPrice:  sl ? parseFloat(sl) : 0,
      tpPrice:  tp ? parseFloat(tp) : 0,
    });
  };

  return (
    <div className="tp">

      <div className="tp-head">
        <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
          <span className="tp-name">{market.symbol}/USDC</span>
          <span className="tp-badge">{market.timeframe}</span>
        </div>
        <span className="tp-price">{fmt(base)}</span>
      </div>

      {isConnected && !autosignEnabled && (
        <div className="tp-autosign">
          <span style={{fontSize:"18px"}}>⚡</span>
          <div>
            <div style={{fontSize:"11px",fontWeight:600,color:"#e2e8f0"}}>Auto-signing available</div>
            <div style={{fontSize:"10px",color:"#94a3b8"}}>Trade instantly — no popups</div>
          </div>
          <button className="as-btn" onClick={enableAutosign}>Enable</button>
        </div>
      )}

      <div className="tp-dirs">
        <button className={`tp-dir h ${dir==="higher"?"on":""}`} onClick={()=>setDir("higher")}>▲ HIGHER</button>
        <button className={`tp-dir l ${dir==="lower" ?"on":""}`} onClick={()=>setDir("lower") }>▼ LOWER</button>
      </div>

      <div className="tp-section">
        <div className="tp-label-row">
          <span>Amount (USDC)</span>
          <span style={{fontSize:"10px",color:"#4a5568"}}>Balance: —</span>
        </div>
        <div className="tp-inp-row">
          <span className="tp-pre">$</span>
          <input type="number" placeholder="0.00" value={size} onChange={e=>setSize(e.target.value)} />
          <span className="tp-suf">USDC</span>
        </div>
        <div className="tp-presets">
          {[10,25,50,100,250].map(n=>(
            <button key={n} className={`tp-preset ${size==n?"on":""}`} onClick={()=>setSize(String(n))}>$  {n}</button>
          ))}
        </div>
      </div>

      <div className="sltp-section">
        <div className="sltp-header">
          <span className="sltp-header-title">Stop Loss / Take Profit</span>
          <span className="sltp-tag">RISK MANAGEMENT</span>
        </div>

        <div className="sltp-field">
          <div className="sltp-field-label">
            <span style={{color:"#f85149",fontWeight:700}}>Stop Loss</span>
            <span style={{fontSize:"10px",color:"#484f58"}}>
              {dir==="higher" ? `price drops below ${fmt(base)}` : `price rises above ${fmt(base)}`}
            </span>
          </div>
          <div className="sltp-inp sl">
            <span className="sltp-sym sl-sym">$</span>
            <input
              type="number"
              placeholder={dir==="higher" ? (base*0.98).toFixed(dec) : (base*1.02).toFixed(dec)}
              value={sl}
              onChange={e=>setSl(e.target.value)}
            />
            <span className="sltp-unit">USD</span>
          </div>
          {sl && size && (
            <div className="sltp-pill sl-pill">
              SL hit → you receive ${(parseFloat(size)*0.20).toFixed(2)} back (20% refund)
            </div>
          )}
        </div>

        <div className="sltp-field">
          <div className="sltp-field-label">
            <span style={{color:"#3fb950",fontWeight:700}}>Take Profit</span>
            <span style={{fontSize:"10px",color:"#484f58"}}>
              {dir==="higher" ? `price rises above ${fmt(base)}` : `price drops below ${fmt(base)}`}
            </span>
          </div>
          <div className="sltp-inp tp">
            <span className="sltp-sym tp-sym">$</span>
            <input
              type="number"
              placeholder={dir==="higher" ? (base*1.02).toFixed(dec) : (base*0.98).toFixed(dec)}
              value={tp}
              onChange={e=>setTp(e.target.value)}
            />
            <span className="sltp-unit">USD</span>
          </div>
          {tp && size && (
            <div className="sltp-pill tp-pill">
              TP hit → you receive ${(parseFloat(size)*1.80).toFixed(2)} (180% early exit)
            </div>
          )}
        </div>

        <div className="sltp-note">
          Both orders auto-execute on-chain via keeper bot — no manual action needed
        </div>
      </div>

      <div className="tp-summary">
        <div className="sum-r"><span>Entry size</span><span>${net}</span></div>
        <div className="sum-r"><span>Protocol fee (2%)</span><span>-${fee}</span></div>
        <div className="sum-r hl">
          <span>Max payout</span>
          <span style={{color:"#3fb950",fontWeight:700}}>${payout}</span>
        </div>
      </div>

      {!isConnected ? (
        <button className="tp-cta connect" onClick={connect}>Connect Wallet to Trade</button>
      ) : (
        <button className={`tp-cta trade ${dir}`} onClick={handleTrade} disabled={!size||isLoading}>
          {isLoading ? "Submitting..." : `${dir==="higher"?"▲":"▼"} BUY ${dir.toUpperCase()} ${market.symbol}`}
          {autosignEnabled && <span style={{position:"absolute",right:14,fontSize:14}}>⚡</span>}
        </button>
      )}

      <div className="tp-foot">Powered by Initia · Auto-signing · Interwoven Bridge</div>
    </div>
  );
}
