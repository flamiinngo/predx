import { useState } from "react";
import { useWallet }    from "../hooks/useWallet";
import { useAutosign }  from "../hooks/useAutosign";
import { calcLiveOdds } from "../hooks/useLiveOdds";
import { useTick }      from "../hooks/useTick";
import { useInterwovenKit } from "@initia/interwovenkit-react";
import {
  useWriteContract,
  useReadContract,
  useAccount,
} from "wagmi";
import { parseUnits, maxUint256, encodeFunctionData } from "viem";
import "./TradePanel.css";

const PM_ADDRESS   = import.meta.env.VITE_POSITION_MANAGER || "";
const USDC_ADDRESS = import.meta.env.VITE_USDC             || "";
const FACTORY_ADDR = import.meta.env.VITE_FACTORY          || "";

const PM_ABI = [{
  name: "openPosition", type: "function", stateMutability: "nonpayable",
  inputs: [
    { name: "marketId", type: "uint256" }, { name: "higher", type: "bool" },
    { name: "size",     type: "uint256" }, { name: "slPrice", type: "uint256" },
    { name: "tpPrice",  type: "uint256" },
  ],
  outputs: [{ name: "positionId", type: "uint256" }],
}];

const USDC_ABI = [
  { name: "approve",   type: "function", stateMutability: "nonpayable",
    inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }],
    outputs: [{ name: "", type: "bool" }] },
  { name: "allowance", type: "function", stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }],
    outputs: [{ name: "", type: "uint256" }] },
];

const FACTORY_ABI = [{
  name: "getHigherProbability", type: "function", stateMutability: "view",
  inputs: [{ name: "marketId", type: "uint256" }],
  outputs: [{ name: "bps", type: "uint256" }],
}];

function useLiveOdds(marketId) {
  const { data: bps } = useReadContract({
    address: FACTORY_ADDR, abi: FACTORY_ABI, functionName: "getHigherProbability",
    args: [marketId ? BigInt(marketId) : 0n],
    query: { enabled: !!marketId, refetchInterval: 8_000 },
  });
  return bps !== undefined ? Number(bps) / 100 : null;
}

function useAllowance(owner) {
  const { data } = useReadContract({
    address: USDC_ADDRESS, abi: USDC_ABI, functionName: "allowance",
    args: [owner, PM_ADDRESS],
    query: { enabled: !!owner, refetchInterval: 5_000 },
  });
  return data ?? 0n;
}

export default function TradePanel({ market, livePrice }) {
  const { address, username, isConnected, connect, isIwkConnected } = useWallet();
  const { isEnabled: autoSignOn } = useAutosign();
  const { requestTxSync, initiaAddress } = useInterwovenKit();
  const wagmiAccount = useAccount();
  const effectiveAddress = address || wagmiAccount.address;

  const [dir,    setDir]    = useState("higher");
  const [size,   setSize]   = useState("");
  const [sl,     setSl]     = useState("");
  const [tp,     setTp]     = useState("");
  const [step,   setStep]   = useState("idle");
  const [txHash, setTxHash] = useState(null);
  const [errMsg, setErrMsg] = useState(null);

  useTick(1000); // re-render every second so odds track time
  const { writeContractAsync } = useWriteContract();
  const chainOdds = useLiveOdds(market?.marketId);
  const allowance = useAllowance(effectiveAddress);

  if (!market) return (
    <div className="tp empty">
      <div className="empty-hint">
        <div className="empty-arrow">↖</div>
        <p>Select a market</p>
        <p className="empty-sub">Choose BTC, ETH or INIT above</p>
      </div>
    </div>
  );

  const price    = livePrice || market?.price || 0;
  const isINIT   = market?.symbol === "INIT";
  const decimals = isINIT ? 4 : 2;
  const fmt      = (p) => isINIT ? `$${Number(p).toFixed(4)}` : `$${Number(p).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}`;
  const strike   = market?.strikePrice || 0;
  const delta    = strike > 0 ? ((price - strike) / strike * 100) : 0;
  const fee      = size ? (parseFloat(size) * 0.02).toFixed(2) : "0.00";

  // Pool odds — raw on-chain pool ratio (trades move this)
  const poolOdds   = chainOdds ?? market?.higher ?? 50;
  const poolLower  = 100 - poolOdds;

  // Time-weighted fair-value odds — incorporates price vs strike + time elapsed.
  // Near expiry with price clearly above strike, HIGHER odds rise to ~90%+
  // so obvious bets pay much less than 2x. Prevents last-second "sure thing" gaming.
  const liveHigher = calcLiveOdds({
    baseOdds:    poolOdds,
    livePrice:   price,
    strikePrice: strike,
    endTime:     market?.endTime,
    startTime:   market?.startTime,
  });
  const liveLower  = 100 - liveHigher;

  // Payout uses TIME-WEIGHTED odds — if BTC is clearly above strike with 5s left,
  // HIGHER is likely to win (~90%), so payout is ~1.1x not 2x.
  // This is how professional binary options mark-to-market.
  const yourLiveOdds = dir === "higher" ? liveHigher : liveLower;
  const multiplier   = yourLiveOdds > 0 ? (100 / yourLiveOdds) * 0.98 : 1.96;
  const payout       = size ? (parseFloat(size) * multiplier).toFixed(2) : "0.00";

  const slPh = dir === "higher"
    ? (price * 0.97).toFixed(decimals) : (price * 1.03).toFixed(decimals);
  const tpPh = dir === "higher"
    ? (price * 1.03).toFixed(decimals) : (price * 0.97).toFixed(decimals);

  const handleTrade = async () => {
    if (!size || parseFloat(size) < 1) { setErrMsg("Min $1 USDC"); return; }
    if (!effectiveAddress) { connect(); return; }
    const marketId = BigInt(market.marketId || 0);
    if (marketId === 0n) { setErrMsg("Market not loaded"); return; }

    setErrMsg(null); setTxHash(null);

    const sizeUnits = parseUnits(size, 6);
    const slWei     = sl ? BigInt(Math.round(parseFloat(sl) * 1e18)) : 0n;
    const tpWei     = tp ? BigInt(Math.round(parseFloat(tp) * 1e18)) : 0n;

    // ── Auto-Sign path (InterwovenKit) — zero popups ──────────────────────
    // Batches approve + openPosition into a single Cosmos tx, signed silently
    // by the Ghost Wallet when Auto-Sign is enabled for /minievm.evm.v1.MsgCall.
    if (isIwkConnected && autoSignOn && requestTxSync && initiaAddress) {
      try {
        setStep("trading");
        const msgs = [];

        // Approve USDC if allowance is insufficient (batched into same tx)
        if (allowance < sizeUnits) {
          msgs.push({
            "@type": "/minievm.evm.v1.MsgCall",
            sender:        initiaAddress,
            contract_addr: USDC_ADDRESS,
            input: encodeFunctionData({
              abi: USDC_ABI, functionName: "approve",
              args: [PM_ADDRESS, maxUint256],
            }),
            value:       "0",
            access_list: [],
          });
        }

        // openPosition
        msgs.push({
          "@type": "/minievm.evm.v1.MsgCall",
          sender:        initiaAddress,
          contract_addr: PM_ADDRESS,
          input: encodeFunctionData({
            abi: PM_ABI, functionName: "openPosition",
            args: [marketId, dir === "higher", sizeUnits, slWei, tpWei],
          }),
          value:       "0",
          access_list: [],
        });

        const result = await requestTxSync({ chain_id: "predx-1", messages: msgs });
        const hash   = result?.txhash || result?.tx_hash || result?.hash || "confirmed";
        setTxHash(hash);
        setStep("done");
        setSize(""); setSl(""); setTp("");
      } catch (err) {
        let msg = err?.message || "Transaction failed";
        if (msg.includes("expired") || msg.includes("settled"))
          msg = "Market expired — next one opens in seconds";
        else if (msg.includes("insufficient") || msg.includes("ERC20"))
          msg = "Insufficient USDC — claim from faucet";
        else
          msg = msg.slice(0, 90);
        setErrMsg(msg);
        setStep("error");
      }
      return;
    }

    // ── MetaMask / wagmi fallback path ────────────────────────────────────
    if (window.ethereum) {
      try {
        const chainHex = "0x" + (674323531314972).toString(16);
        const current  = await window.ethereum.request({ method: "eth_chainId" });
        if (current !== chainHex) {
          try {
            await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: chainHex }] });
          } catch {
            await window.ethereum.request({ method: "wallet_addEthereumChain", params: [{
              chainId: chainHex, chainName: "PredX (predx-1)",
              nativeCurrency: { name: "GAS", symbol: "GAS", decimals: 18 },
              rpcUrls: [import.meta.env.VITE_RPC_URL || "http://localhost:8545"],
            }]});
          }
        }
      } catch {}
    }

    try {
      if (allowance < sizeUnits) {
        setStep("approving");
        await writeContractAsync({
          address: USDC_ADDRESS, abi: USDC_ABI,
          functionName: "approve", args: [PM_ADDRESS, maxUint256],
        });
      }

      setStep("trading");
      const hash = await writeContractAsync({
        address: PM_ADDRESS, abi: PM_ABI,
        functionName: "openPosition",
        args: [marketId, dir === "higher", sizeUnits, slWei, tpWei],
        gas: 500_000n,
      });
      setTxHash(hash);
      setStep("done");
      setSize(""); setSl(""); setTp("");
    } catch (err) {
      let msg = err.shortMessage || err.reason || err.message || "Transaction failed";
      if (msg.includes("does not exist") || msg.includes("sequence"))
        msg = "Get gas from faucet first (+ Deposit)";
      else if (msg.includes("expired") || msg.includes("settled"))
        msg = "Market expired — next one opens in seconds";
      else if (msg.includes("insufficient") || msg.includes("ERC20"))
        msg = "Insufficient USDC — claim from faucet";
      else
        msg = msg.slice(0, 90);
      setErrMsg(msg);
      setStep("error");
    }
  };

  const isLoading = step === "approving" || step === "trading";

  return (
    <div className="tp">
      {/* ── Header ── */}
      <div className="tp-head">
        <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
          <span className="tp-name">{market.symbol}/USDC</span>
          <span className="tp-badge">{market.timeframe}</span>
          {autoSignOn && <span className="tp-autosign-tag">⚡ Auto</span>}
        </div>
        <div style={{ textAlign:"right" }}>
          <div className="tp-price">{fmt(price)}</div>
          {strike > 0 && (
            <div style={{ fontSize:"10px", color:"#8b5cf6", fontWeight:600 }}>
              Strike {fmt(strike)}
              <span style={{ marginLeft:"4px", color: delta >= 0 ? "#3fb950" : "#f85149" }}>
                {delta >= 0 ? "▲" : "▼"}{Math.abs(delta).toFixed(2)}%
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Odds bar — time-weighted live signal ── */}
      <div style={{ padding:"10px 14px 0" }}>
        <div style={{ display:"flex", justifyContent:"space-between", fontSize:"11px", marginBottom:"4px" }}>
          <span style={{ color:"#3fb950", fontWeight:700 }}>▲ HIGHER {liveHigher}%</span>
          <span style={{ color:"#4a5568", fontSize:"9px" }}>live signal</span>
          <span style={{ color:"#f85149", fontWeight:700 }}>{liveLower}% LOWER ▼</span>
        </div>
        <div style={{ height:"5px", borderRadius:"3px", background:"#1f2535", overflow:"hidden" }}>
          <div style={{
            height:"100%", width:`${liveHigher}%`,
            background:"linear-gradient(90deg,#10b981,#3fb950)",
            borderRadius:"3px", transition:"width 0.5s ease",
          }} />
        </div>
        <div style={{ display:"flex", justifyContent:"space-between", fontSize:"9px", color:"#4a5568", marginTop:"3px" }}>
          <span>pool: {poolOdds.toFixed(0)}% H / {poolLower.toFixed(0)}% L</span>
          <span>payout basis</span>
        </div>
      </div>

      {/* ── Direction ── */}
      <div className="tp-dirs">
        <button className={`tp-dir h ${dir==="higher"?"on":""}`}
          onClick={() => { setDir("higher"); setSl(""); setTp(""); }}>
          ▲ HIGHER
          <span style={{ fontSize:"9px", display:"block", opacity:0.65, fontWeight:400 }}>price goes up</span>
        </button>
        <button className={`tp-dir l ${dir==="lower"?"on":""}`}
          onClick={() => { setDir("lower"); setSl(""); setTp(""); }}>
          ▼ LOWER
          <span style={{ fontSize:"9px", display:"block", opacity:0.65, fontWeight:400 }}>price goes down</span>
        </button>
      </div>

      {/* ── Amount ── */}
      <div className="tp-section">
        <div className="tp-label-row"><span>Amount (USDC)</span></div>
        <div className="tp-inp-row">
          <span className="tp-pre">$</span>
          <input type="number" placeholder="0.00" value={size}
            onChange={e => { setSize(e.target.value); setErrMsg(null); setTxHash(null); setStep("idle"); }} />
          <span className="tp-suf">USDC</span>
        </div>
        <div className="tp-presets">
          {[10, 25, 50, 100, 250].map(n => (
            <button key={n} className={`tp-preset ${size==n?"on":""}`} onClick={() => setSize(String(n))}>
              ${n}
            </button>
          ))}
        </div>
      </div>

      {/* ── SL / TP — always visible, compact ── */}
      <div style={{ padding:"10px 14px 0" }}>
        <div style={{ display:"flex", alignItems:"center", gap:"6px", marginBottom:"7px" }}>
          <span style={{ fontSize:"11px", fontWeight:700, color:"#c9d1d9" }}>Stop Loss / Take Profit</span>
          <span style={{
            fontSize:"9px", fontWeight:700, color:"#818cf8",
            background:"rgba(99,102,241,0.12)", border:"1px solid rgba(99,102,241,0.25)",
            padding:"1px 6px", borderRadius:"10px",
          }}>⚡ on-chain auto-exec</span>
        </div>
        <div style={{ display:"flex", gap:"8px" }}>
          {/* SL */}
          <div style={{ flex:1 }}>
            <div style={{ fontSize:"10px", color:"#f85149", fontWeight:600, marginBottom:"4px" }}>
              🛑 SL {dir==="higher"?"↓":"↑"} <span style={{color:"#4a5568",fontSize:"9px"}}>optional</span>
            </div>
            <div style={{
              display:"flex", alignItems:"center", height:"32px",
              background:"#0d1117", border:"1px solid rgba(239,68,68,0.35)",
              borderRadius:"6px", overflow:"hidden",
            }}>
              <span style={{ padding:"0 7px", color:"#f85149", fontSize:"11px", borderRight:"1px solid #1f2535" }}>$</span>
              <input type="number" placeholder={slPh} value={sl} onChange={e => setSl(e.target.value)}
                style={{ flex:1, background:"transparent", border:"none", padding:"0 7px", color:"#e2e8f0", fontSize:"12px", outline:"none" }} />
            </div>
          </div>
          {/* TP */}
          <div style={{ flex:1 }}>
            <div style={{ fontSize:"10px", color:"#3fb950", fontWeight:600, marginBottom:"4px" }}>
              🎯 TP {dir==="higher"?"↑":"↓"} <span style={{color:"#4a5568",fontSize:"9px"}}>optional</span>
            </div>
            <div style={{
              display:"flex", alignItems:"center", height:"32px",
              background:"#0d1117", border:"1px solid rgba(63,185,80,0.35)",
              borderRadius:"6px", overflow:"hidden",
            }}>
              <span style={{ padding:"0 7px", color:"#3fb950", fontSize:"11px", borderRight:"1px solid #1f2535" }}>$</span>
              <input type="number" placeholder={tpPh} value={tp} onChange={e => setTp(e.target.value)}
                style={{ flex:1, background:"transparent", border:"none", padding:"0 7px", color:"#e2e8f0", fontSize:"12px", outline:"none" }} />
            </div>
          </div>
        </div>
      </div>

      {/* ── Summary ── */}
      <div className="tp-summary" style={{ margin:"10px 14px 0" }}>
        <div className="sum-r">
          <span>You win if</span>
          <span style={{ color: dir==="higher"?"#3fb950":"#f85149", fontWeight:600 }}>
            {market.symbol} {dir==="higher"?"ABOVE":"BELOW"} {strike > 0 ? fmt(strike) : "strike"}
          </span>
        </div>
        <div className="sum-r">
          <span>Fee (2%)</span>
          <span style={{ color:"#f85149" }}>-${fee}</span>
        </div>
        <div className="sum-r hl">
          <span>Payout if correct</span>
          <span style={{ color:"#3fb950", fontWeight:700 }}>
            ${payout}
            <span style={{fontSize:"10px",color:"#4a5568",marginLeft:"4px"}}>{multiplier.toFixed(2)}x · {yourLiveOdds.toFixed(0)}% likely</span>
          </span>
        </div>
      </div>

      {/* ── Feedback ── */}
      {step === "done" && txHash && (
        <div style={{
          margin:"8px 14px 0", padding:"8px 12px",
          background:"rgba(16,185,129,0.08)", border:"1px solid rgba(16,185,129,0.25)",
          borderRadius:"8px", fontSize:"11px", color:"#3fb950",
        }}>
          ✓ Position opened · <span style={{color:"#4a5568",fontSize:"10px"}}>{txHash.slice(0,14)}...{txHash.slice(-6)}</span>
        </div>
      )}
      {errMsg && (
        <div style={{
          margin:"8px 14px 0", padding:"8px 12px",
          background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.25)",
          borderRadius:"8px", fontSize:"11px", color:"#f85149",
        }}>
          ⚠ {errMsg}
        </div>
      )}

      {/* ── CTA ── */}
      {!isConnected ? (
        <button className="tp-cta connect" onClick={connect}>Connect Wallet to Trade</button>
      ) : (
        <button
          className={`tp-cta trade ${dir}`}
          onClick={handleTrade}
          disabled={!size || isLoading || parseFloat(size||0) < 1}
        >
          {isLoading ? (
            <span style={{display:"flex",alignItems:"center",gap:"8px",justifyContent:"center"}}>
              <span className="tp-spinner" />
              {step === "approving" ? "Approving USDC..." : "Submitting..."}
            </span>
          ) : isIwkConnected && autoSignOn ? (
            `⚡ ${dir==="higher"?"▲":"▼"} ${dir.toUpperCase()} ${market.symbol} · ${multiplier.toFixed(2)}x`
          ) : (
            `${dir==="higher"?"▲":"▼"} ${dir.toUpperCase()} ${market.symbol} · ${multiplier.toFixed(2)}x · ${yourLiveOdds.toFixed(0)}% likely`
          )}
        </button>
      )}

      <div className="tp-foot">
        Powered by Initia · predx-1 ·{" "}
        {autoSignOn
          ? <span style={{color:"#818cf8"}}>⚡ 1-click active</span>
          : "settled on-chain"}
      </div>
    </div>
  );
}
