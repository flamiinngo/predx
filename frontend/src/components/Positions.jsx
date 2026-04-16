import { useState, useEffect, useRef } from "react";
import { useWallet }    from "../hooks/useWallet";
import { usePositions } from "../hooks/usePositions";
import { useCountdown } from "../hooks/useCountdown";
import { useLivePrices } from "../hooks/useLivePrices";
import { useTick }       from "../hooks/useTick";
import "./Positions.css";

function fmt(sym, val) {
  if (!val && val !== 0) return "—";
  if (sym === "INIT") return `$${Number(val).toFixed(4)}`;
  return `$${Number(val).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function Toast({ position, onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 6000); return () => clearTimeout(t); }, []);
  return (
    <div style={{
      position:"fixed", top:"76px", right:"20px", zIndex:9999,
      padding:"18px 22px", borderRadius:"14px", minWidth:"260px",
      background: position.won
        ? "linear-gradient(135deg,rgba(16,185,129,0.18),rgba(63,185,80,0.12))"
        : "linear-gradient(135deg,rgba(239,68,68,0.18),rgba(248,81,73,0.12))",
      border:`1.5px solid ${position.won?"#3fb950":"#f85149"}`,
      backdropFilter:"blur(16px)", boxShadow:"0 12px 40px rgba(0,0,0,0.5)",
      animation:"slideIn 0.3s ease",
    }}>
      <div style={{fontSize:"24px",marginBottom:"8px"}}>{position.won?"🎉":"💔"}</div>
      <div style={{fontSize:"14px",color:"#e2e8f0",fontWeight:700,marginBottom:"2px"}}>
        {position.won ? "Position Won!" : "Position Lost"}
      </div>
      <div style={{fontSize:"12px",color:"#8b949e",marginBottom:"8px"}}>
        {position.symbol} {position.timeframe} · {position.higher?"▲ HIGHER":"▼ LOWER"}
      </div>
      <div style={{
        fontSize:"22px",fontWeight:800,
        color:position.won?"#3fb950":"#f85149",
        letterSpacing:"-0.5px",
      }}>
        {position.won
          ? `+$${position.payout.toFixed(2)}`
          : `-$${position.size.toFixed(2)}`}
        <span style={{fontSize:"11px",fontWeight:500,marginLeft:"4px"}}>USDC</span>
      </div>
      {position.won && (
        <div style={{
          marginTop:"8px",fontSize:"11px",color:"#4a5568",
          borderTop:"1px solid rgba(63,185,80,0.2)",paddingTop:"8px",
        }}>
          Paid directly to your wallet ✓
        </div>
      )}
    </div>
  );
}

function LivePosition({ p, livePrice }) {
  useTick(1000);
  const remaining  = useCountdown(p.endTime);
  const strike     = p.strikePrice || p.entryPrice || 0;
  const price      = livePrice || 0;
  const isWinning  = price > 0 && strike > 0
    ? (p.higher ? price > strike : price < strike)
    : null;
  const secsLeft   = Math.max(0, Math.floor((p.endTime - Date.now()) / 1000));
  const urgent     = secsLeft <= 15;

  const priceDelta = strike > 0 ? ((price - strike) / strike * 100) : 0;

  return (
    <div style={{
      padding:"12px", borderBottom:"1px solid #161b22",
      borderLeft:`3px solid ${isWinning === null ? "#4a5568" : isWinning ? "#3fb950" : "#f85149"}`,
      background: isWinning === true
        ? "rgba(63,185,80,0.03)" : isWinning === false
        ? "rgba(248,81,73,0.03)" : "transparent",
      transition:"background 0.5s ease, border-color 0.5s ease",
    }}>
      {/* Top row */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"8px"}}>
        <div style={{display:"flex",alignItems:"center",gap:"6px"}}>
          <span style={{fontWeight:700,color:"#e2e8f0",fontSize:"13px"}}>{p.symbol}</span>
          <span style={{
            fontSize:"9px",color:"#818cf8",
            background:"rgba(99,102,241,0.12)",border:"1px solid rgba(99,102,241,0.2)",
            padding:"1px 6px",borderRadius:"4px",fontWeight:600,
          }}>{p.timeframe}</span>
          <span style={{
            fontSize:"11px",fontWeight:700,
            color:p.higher?"#3fb950":"#f85149",
          }}>
            {p.higher?"▲ HIGHER":"▼ LOWER"}
          </span>
        </div>

        {/* Winning / losing badge */}
        {isWinning !== null && (
          <span style={{
            fontSize:"10px",fontWeight:700,padding:"2px 8px",borderRadius:"6px",
            background: isWinning ? "rgba(63,185,80,0.15)" : "rgba(248,81,73,0.15)",
            color: isWinning ? "#3fb950" : "#f85149",
            border:`1px solid ${isWinning ? "rgba(63,185,80,0.3)" : "rgba(248,81,73,0.3)"}`,
          }}>
            {isWinning ? "✓ WINNING" : "✗ LOSING"}
          </span>
        )}
      </div>

      {/* Price row */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"6px"}}>
        <div style={{fontSize:"11px",color:"#8b949e"}}>
          Strike <span style={{color:"#c4b5fd",fontWeight:700}}>{fmt(p.symbol, strike)}</span>
        </div>
        <div style={{fontSize:"11px",color:"#8b949e"}}>
          Now <span style={{
            fontWeight:700,
            color: priceDelta >= 0 ? "#3fb950" : "#f85149",
          }}>
            {fmt(p.symbol, price)}
            {price > 0 && strike > 0 && (
              <span style={{fontSize:"9px",marginLeft:"3px"}}>
                {priceDelta >= 0 ? "▲" : "▼"}{Math.abs(priceDelta).toFixed(2)}%
              </span>
            )}
          </span>
        </div>
      </div>

      {/* Bottom row */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <span style={{fontSize:"11px",color:"#8b949e"}}>
          Bet <b style={{color:"#e2e8f0"}}>${p.size.toFixed(2)}</b>
        </span>
        <span style={{
          fontSize:"12px",fontWeight:700,
          color: urgent ? "#f85149" : "#f0c040",
          display:"flex",alignItems:"center",gap:"4px",
        }}>
          <span style={{
            width:"5px",height:"5px",borderRadius:"50%",
            background: urgent ? "#f85149" : "#f0c040",
            display:"inline-block",
            animation: urgent ? "pulse 0.8s infinite" : "none",
          }}/>
          {remaining}
        </span>
        <span style={{fontSize:"11px",color:"#8b949e"}}>
          Win <b style={{color:"#3fb950"}}>${(p.size * 1.96).toFixed(2)}+</b>
        </span>
      </div>
    </div>
  );
}

function ClosedPosition({ p }) {
  const strike = p.strikePrice || p.entryPrice || 0;
  return (
    <div style={{
      padding:"10px 12px", borderBottom:"1px solid #0d1117",
      borderLeft:`3px solid ${p.won ? "#3fb950" : "#f85149"}`,
      background: p.won ? "rgba(63,185,80,0.03)" : "rgba(248,81,73,0.03)",
    }}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div style={{display:"flex",alignItems:"center",gap:"5px"}}>
          <span style={{fontWeight:700,color: p.won ? "#e2e8f0" : "#8b949e",fontSize:"13px"}}>{p.symbol}</span>
          <span style={{
            fontSize:"9px",color:"#4a5568",
            background:"#161b22",padding:"1px 5px",borderRadius:"3px",
          }}>{p.timeframe}</span>
          <span style={{fontSize:"10px",color:p.higher?"#3fb950":"#f85149"}}>
            {p.higher?"▲":"▼"} {p.higher?"HIGHER":"LOWER"}
          </span>
        </div>
        <div style={{textAlign:"right"}}>
          <div style={{
            fontSize:"14px",fontWeight:800,
            color:p.won?"#3fb950":"#f85149",
          }}>
            {p.won ? `+$${p.payout.toFixed(2)}` : `-$${p.size.toFixed(2)}`}
          </div>
          <div style={{
            fontSize:"9px",fontWeight:700,letterSpacing:"0.5px",
            color: p.won ? "#3fb950" : "#f85149",
            opacity:0.7,
          }}>
            {p.won ? "WON" : "LOST"} · ${p.size.toFixed(2)} bet
          </div>
        </div>
      </div>
      {strike > 0 && (
        <div style={{marginTop:"5px",fontSize:"9px",color:"#4a5568"}}>
          Strike {fmt(p.symbol, strike)} · {p.higher ? "needed price above" : "needed price below"}
        </div>
      )}
    </div>
  );
}

export default function Positions() {
  const { address, isConnected } = useWallet();
  const { positions, balance }   = usePositions(address);
  const livePrices = useLivePrices();
  const [toasts, setToasts] = useState([]);
  const seen = useRef(new Set());

  useEffect(() => {
    for (const p of positions) {
      if (p.justSettled && !seen.current.has(p.id)) {
        seen.current.add(p.id);
        setToasts(t => [...t, p]);
      }
    }
  }, [positions]);

  const open    = positions.filter(p => !p.closed);
  const closed  = positions.filter(p => p.closed);
  const pnl     = closed.reduce((acc, p) => acc + (p.won ? p.payout - p.size : -p.size), 0);
  const wins    = closed.filter(p => p.won).length;
  const winRate = closed.length > 0 ? Math.round(wins / closed.length * 100) : null;

  return (
    <>
      <style>{`
        @keyframes slideIn { from { opacity:0; transform:translateX(20px); } to { opacity:1; transform:translateX(0); } }
        @keyframes pulse   { 0%,100% { opacity:1; } 50% { opacity:0.3; } }
      `}</style>

      {toasts.map(p => (
        <Toast key={p.id} position={p} onDone={() => setToasts(t => t.filter(x => x.id !== p.id))} />
      ))}

      <div className="positions-wrap" style={{display:"flex",flexDirection:"column",height:"100%"}}>

        {/* Header */}
        <div className="positions-header">
          <span className="pos-title">My Positions</span>
          <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
            {winRate !== null && (
              <span style={{
                fontSize:"10px",fontWeight:600,
                color: winRate >= 50 ? "#3fb950" : "#f85149",
              }}>
                {wins}/{closed.length} wins ({winRate}%)
              </span>
            )}
            {closed.length > 0 && (
              <span style={{fontSize:"13px",fontWeight:700,color:pnl>=0?"#3fb950":"#f85149"}}>
                {pnl>=0?"+":""}{pnl.toFixed(2)} USDC
              </span>
            )}
            {address && (
              <span className="pos-user">{address.slice(0,6)}…{address.slice(-4)}</span>
            )}
          </div>
        </div>

        {/* Balance */}
        {balance !== null && (
          <div style={{
            padding:"6px 12px",background:"#0d1117",borderBottom:"1px solid #21262d",
            display:"flex",justifyContent:"space-between",alignItems:"center",
          }}>
            <span style={{fontSize:"10px",color:"#4a5568"}}>Wallet</span>
            <span style={{fontSize:"13px",color:"#3fb950",fontWeight:700}}>
              ${balance.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})} USDC
            </span>
          </div>
        )}

        {!isConnected ? (
          <div className="pos-empty">Connect wallet to view positions</div>
        ) : positions.length === 0 ? (
          <div className="pos-empty" style={{padding:"28px",textAlign:"center"}}>
            <div style={{fontSize:"36px",marginBottom:"10px"}}>📈</div>
            <div style={{color:"#e2e8f0",fontWeight:600,marginBottom:"4px"}}>No positions yet</div>
            <div style={{color:"#4a5568",fontSize:"12px",lineHeight:"1.6"}}>
              Select a market and place your first trade.<br/>
              Markets settle every 1–15 minutes.
            </div>
          </div>
        ) : (
          <div style={{flex:1,overflowY:"auto"}}>

            {open.length > 0 && (
              <>
                <div style={{
                  padding:"5px 12px",fontSize:"10px",fontWeight:600,
                  color:"#f0c040",textTransform:"uppercase",letterSpacing:"0.5px",
                  background:"#0d1117",borderBottom:"1px solid #161b22",
                  display:"flex",alignItems:"center",gap:"6px",
                }}>
                  <span style={{width:"5px",height:"5px",borderRadius:"50%",background:"#f0c040",display:"inline-block"}}/>
                  Live ({open.length})
                </div>
                {open.map(p => (
                  <LivePosition
                    key={p.id} p={p}
                    livePrice={livePrices[p.symbol]?.price}
                  />
                ))}
              </>
            )}

            {closed.length > 0 && (
              <>
                <div style={{
                  padding:"5px 12px",fontSize:"10px",fontWeight:600,
                  color:"#4a5568",textTransform:"uppercase",letterSpacing:"0.5px",
                  background:"#0d1117",borderBottom:"1px solid #161b22",
                }}>
                  History ({closed.length})
                </div>
                {closed.map(p => <ClosedPosition key={p.id} p={p} />)}
              </>
            )}

          </div>
        )}
      </div>
    </>
  );
}
