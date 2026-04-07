import { useState } from "react";
import { useWallet } from "../hooks/useWallet";
import { ethers } from "ethers";
import "./TradePanel.css";

const PM_ABI = [
  "function openPosition(uint256 marketId, bool higher, uint256 size, uint256 slPrice, uint256 tpPrice) external returns (uint256)"
];
const USDC_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)"
];
const PM_ADDRESS   = "0x53970243c108E7d8eF24227924F6aEF1db0E98B1";
const USDC_ADDRESS = "0x28Bc46dE1761EaB4a1BEF1974afE4a6cbF196D34";

const MARKET_IDS = { "BTC-1m":0, "BTC-5m":1, "BTC-15m":2, "ETH-1m":3, "ETH-5m":4, "ETH-15m":5, "INIT-1m":6, "INIT-5m":7, "INIT-15m":8 };

export default function TradePanel({ market, livePrice }) {
  const { isConnected, connect, address } = useWallet();
  const [dir,     setDir]     = useState("higher");
  const [size,    setSize]    = useState("");
  const [sl,      setSl]      = useState("");
  const [tp,      setTp]      = useState("");
  const [loading, setLoading] = useState(false);
  const [txHash,  setTxHash]  = useState(null);
  const [error,   setError]   = useState(null);

  if (!market) return (
    <div className="tp empty">
      <div className="empty-hint">
        <div className="empty-arrow">↖</div>
        <p>Select a market</p>
        <p className="empty-sub">Choose BTC, ETH or INIT</p>
      </div>
    </div>
  );

  const base    = livePrice || market.price || 83241;
  const dec     = base < 10 ? 4 : 2;
  const fmt     = (p) => base < 10 ? `$${Number(p).toFixed(4)}` : `$${Number(p).toLocaleString()}`;
  const fee     = size ? (parseFloat(size) * 0.02).toFixed(2) : "—";
  const net     = size ? (parseFloat(size) * 0.98).toFixed(2) : "—";
  const payout  = size ? (parseFloat(size) * 1.96).toFixed(2) : "—";

  const slDefault = (base * (dir==="higher" ? 0.98 : 1.02)).toFixed(dec);
  const tpDefault = (base * (dir==="higher" ? 1.02 : 0.98)).toFixed(dec);

  const handleTrade = async () => {
    if (!size || !window.ethereum) return;
    setLoading(true);
    setError(null);
    setTxHash(null);
    try {
      const provider  = new ethers.BrowserProvider(window.ethereum);
      const signer    = await provider.getSigner();
      const usdc      = new ethers.Contract(USDC_ADDRESS, USDC_ABI, signer);
      const pm        = new ethers.Contract(PM_ADDRESS, PM_ABI, signer);
      const sizeUnits = ethers.parseUnits(size, 6);
      const marketId  = MARKET_IDS[market.id] ?? 0;

      // Check and approve USDC if needed
      const allowance = await usdc.allowance(address, PM_ADDRESS);
      if (allowance < sizeUnits) {
        const approveTx = await usdc.approve(PM_ADDRESS, ethers.MaxUint256);
        await approveTx.wait();
      }

      // Convert SL/TP to price units (multiply by 1e18)
      const slWei = sl ? ethers.parseEther(String(parseFloat(sl))) : 0n;
      const tpWei = tp ? ethers.parseEther(String(parseFloat(tp))) : 0n;

      const tx      = await pm.openPosition(marketId, dir === "higher", sizeUnits, slWei, tpWei);
      const receipt = await tx.wait();
      setTxHash(receipt.hash);
      setSize(""); setSl(""); setTp("");
    } catch (err) {
      setError(err.reason || err.shortMessage || err.message?.slice(0,80) || "Transaction failed");
    } finally {
      setLoading(false);
    }
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

      {isConnected && (
        <div className="tp-autosign">
          <span style={{fontSize:"18px"}}>⚡</span>
          <div>
            <div style={{fontSize:"11px",fontWeight:600,color:"#e2e8f0"}}>MetaMask · predx-1</div>
            <div style={{fontSize:"10px",color:"#94a3b8"}}>{address?.slice(0,6)}...{address?.slice(-4)}</div>
          </div>
          <span style={{fontSize:"10px",color:"#3fb950",fontWeight:700}}>LIVE</span>
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
            <button key={n} className={`tp-preset ${size==n?"on":""}`} onClick={()=>setSize(String(n))}>$ {n}</button>
          ))}
        </div>
      </div>

      <div className="sltp-section">
        <div className="sltp-header">
          <span className="sltp-header-title">Stop Loss / Take Profit</span>
          <span className="sltp-tag">RISK MANAGEMENT</span>
        </div>

        <div style={{padding:"12px 14px 0",display:"flex",flexDirection:"column",gap:"7px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <span style={{color:"#f85149",fontWeight:700,fontSize:"12px"}}>Stop Loss</span>
            <span style={{fontSize:"10px",color:"#484f58"}}>
              {dir==="higher"?`below ${fmt(base)}`:`above ${fmt(base)}`}
            </span>
          </div>
          <div style={{display:"flex",alignItems:"center",background:"#0d1117",border:"2px solid rgba(248,81,73,0.4)",borderRadius:"8px",overflow:"hidden",height:"44px"}}>
            <span style={{padding:"0 12px",color:"#f85149",fontWeight:700,fontSize:"14px",borderRight:"1px solid #21262d"}}>$</span>
            <input
              type="number"
              placeholder={slDefault}
              value={sl}
              onChange={e=>setSl(e.target.value)}
              style={{flex:1,background:"transparent",border:"none",padding:"0 10px",color:"#f0f6fc",fontSize:"14px",fontWeight:500,outline:"none"}}
            />
            <span style={{padding:"0 10px",fontSize:"10px",color:"#484f58",borderLeft:"1px solid #21262d"}}>USD</span>
          </div>
          {sl && size && (
            <div style={{fontSize:"10px",color:"#f85149",background:"rgba(248,81,73,0.08)",padding:"5px 10px",borderRadius:"5px",border:"1px solid rgba(248,81,73,0.15)"}}>
              SL hit → receive ${(parseFloat(size)*0.20).toFixed(2)} back (20% refund)
            </div>
          )}
        </div>

        <div style={{padding:"12px 14px 0",display:"flex",flexDirection:"column",gap:"7px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <span style={{color:"#3fb950",fontWeight:700,fontSize:"12px"}}>Take Profit</span>
            <span style={{fontSize:"10px",color:"#484f58"}}>
              {dir==="higher"?`above ${fmt(base)}`:`below ${fmt(base)}`}
            </span>
          </div>
          <div style={{display:"flex",alignItems:"center",background:"#0d1117",border:"2px solid rgba(63,185,80,0.4)",borderRadius:"8px",overflow:"hidden",height:"44px"}}>
            <span style={{padding:"0 12px",color:"#3fb950",fontWeight:700,fontSize:"14px",borderRight:"1px solid #21262d"}}>$</span>
            <input
              type="number"
              placeholder={tpDefault}
              value={tp}
              onChange={e=>setTp(e.target.value)}
              style={{flex:1,background:"transparent",border:"none",padding:"0 10px",color:"#f0f6fc",fontSize:"14px",fontWeight:500,outline:"none"}}
            />
            <span style={{padding:"0 10px",fontSize:"10px",color:"#484f58",borderLeft:"1px solid #21262d"}}>USD</span>
          </div>
          {tp && size && (
            <div style={{fontSize:"10px",color:"#3fb950",background:"rgba(63,185,80,0.08)",padding:"5px 10px",borderRadius:"5px",border:"1px solid rgba(63,185,80,0.15)"}}>
              TP hit → receive ${(parseFloat(size)*1.80).toFixed(2)} (180% early exit)
            </div>
          )}
        </div>

        <div style={{margin:"12px 14px 14px",fontSize:"10px",color:"#484f58",lineHeight:"1.6",padding:"8px 10px",background:"#161b22",borderRadius:"6px",border:"1px solid #21262d"}}>
          Both orders auto-execute on-chain via keeper bot — no manual action needed
        </div>
      </div>

      <div className="tp-summary">
        <div className="sum-r"><span>Entry size</span><span>${net}</span></div>
        <div className="sum-r"><span>Protocol fee (2%)</span><span>-${fee}</span></div>
        <div className="sum-r hl"><span>Max payout</span><span style={{color:"#3fb950",fontWeight:700}}>${payout}</span></div>
      </div>

      {txHash && (
        <div style={{margin:"0 14px",padding:"10px 12px",background:"rgba(63,185,80,0.1)",border:"1px solid rgba(63,185,80,0.3)",borderRadius:"8px",fontSize:"11px",color:"#3fb950",wordBreak:"break-all"}}>
          ✓ Position opened on predx-1!<br/>Tx: {txHash}
        </div>
      )}
      {error && (
        <div style={{margin:"0 14px",padding:"10px 12px",background:"rgba(248,81,73,0.1)",border:"1px solid rgba(248,81,73,0.3)",borderRadius:"8px",fontSize:"11px",color:"#f85149"}}>
          ⚠ {error}
        </div>
      )}

      {!isConnected ? (
        <button className="tp-cta connect" onClick={connect}>Connect Wallet to Trade</button>
      ) : (
        <button className={`tp-cta trade ${dir}`} onClick={handleTrade} disabled={!size||loading}>
          {loading
            ? "Submitting to predx-1..."
            : `${dir==="higher"?"▲":"▼"} BUY ${dir.toUpperCase()} ${market.symbol}`}
        </button>
      )}

      <div className="tp-foot">Powered by Initia · predx-1 · On-chain SL/TP</div>
    </div>
  );
}
