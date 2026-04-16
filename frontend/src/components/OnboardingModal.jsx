import { useState } from "react";
import { useWallet } from "../hooks/useWallet";
import FaucetButton  from "./FaucetButton";

const STEPS = [
  {
    icon: "◈",
    iconColor: "#818cf8",
    title: "Welcome to PredX",
    body: "The first prediction market with perp DEX mechanics on Initia.\n\nBet HIGHER or LOWER on BTC, ETH, or INIT price — with on-chain stop-loss and take-profit.",
  },
  {
    icon: "⚡",
    iconColor: "#f59e0b",
    title: "Auto-Sign: 1-Click Trading",
    body: "PredX uses Initia's Ghost Wallet technology.\n\nEnable Auto-Sign once → all trades execute silently, no wallet popups. Session expires after your chosen duration.",
    tag: "Initia Native",
  },
  {
    icon: "◈",
    iconColor: "#c4b5fd",
    title: ".init Usernames",
    body: "Your Initia username (e.g. wolf.init) shows across the leaderboard and your positions.\n\nRegister at app.initia.xyz — it's your identity across the entire Interwoven Stack.",
    tag: "Initia Usernames",
  },
  {
    icon: "🌉",
    iconColor: "#3b82f6",
    title: "Bridge & Earn",
    body: "Bridge USDC from Ethereum, BNB Chain, or Cosmos via the Interwoven Bridge.\n\nProvide liquidity in the Earn tab to collect protocol fees and INIT VIP rewards.",
    tag: "Interwoven Bridge",
  },
  {
    icon: "🚰",
    iconColor: "#10b981",
    title: "Get Testnet USDC",
    body: "This is a testnet — use the faucet to get free USDC and start trading. No real money involved.",
  },
];

export default function OnboardingModal({ onClose }) {
  const [step, setStep] = useState(0);
  const { address, isConnected, connect } = useWallet();

  const current = STEPS[step];
  const isLast  = step === STEPS.length - 1;

  return (
    <div style={{
      position:"fixed", inset:0, zIndex:10000,
      background:"rgba(0,0,0,0.85)", backdropFilter:"blur(6px)",
      display:"flex", alignItems:"center", justifyContent:"center",
    }}>
      <div style={{
        background:"var(--surface)",
        border:"1px solid var(--border2)",
        borderRadius:"20px",
        padding:"36px 32px 28px",
        maxWidth:"440px", width:"90%",
        textAlign:"center",
        boxShadow:"0 24px 80px rgba(0,0,0,0.6)",
        position:"relative",
      }}>
        {/* Initia badge */}
        <div style={{
          position:"absolute", top:"16px", right:"16px",
          padding:"3px 10px",
          background:"rgba(99,102,241,0.1)",
          border:"1px solid rgba(99,102,241,0.25)",
          borderRadius:"20px",
          fontSize:"10px", fontWeight:700,
          color:"#818cf8",
        }}>
          Built on Initia
        </div>

        {/* Icon */}
        <div style={{
          fontSize: current.icon.length === 1 ? "52px" : "44px",
          color: current.iconColor,
          marginBottom:"18px",
          lineHeight:1,
        }}>
          {current.icon}
        </div>

        {/* Tag pill */}
        {current.tag && (
          <div style={{
            display:"inline-flex", alignItems:"center", gap:"5px",
            padding:"3px 10px", marginBottom:"10px",
            background:"rgba(99,102,241,0.1)",
            border:"1px solid rgba(99,102,241,0.25)",
            borderRadius:"20px",
            fontSize:"10px", fontWeight:700, color:"#818cf8",
          }}>
            ◈ {current.tag}
          </div>
        )}

        <div style={{
          fontSize:"20px", fontWeight:800, color:"var(--text)",
          marginBottom:"12px",
        }}>
          {current.title}
        </div>
        <div style={{
          fontSize:"13px", color:"var(--text2)", lineHeight:"1.75",
          marginBottom:"28px", whiteSpace:"pre-line",
        }}>
          {current.body}
        </div>

        {/* Progress dots */}
        <div style={{ display:"flex", justifyContent:"center", gap:"6px", marginBottom:"24px" }}>
          {STEPS.map((_, i) => (
            <div key={i} onClick={() => setStep(i)} style={{
              width:"8px", height:"8px", borderRadius:"50%",
              background: i === step ? "#6366f1" : "var(--surface3)",
              cursor:"pointer",
              transition:"background 0.25s, transform 0.2s",
              transform: i === step ? "scale(1.3)" : "scale(1)",
            }} />
          ))}
        </div>

        {/* Faucet on last step */}
        {isLast && (
          <div style={{ marginBottom:"16px" }}>
            {!isConnected ? (
              <button onClick={connect} style={{
                width:"100%", padding:"12px",
                background:"linear-gradient(135deg,#4f46e5,#6366f1)",
                border:"none", borderRadius:"10px",
                color:"#fff", fontWeight:700, fontSize:"14px", cursor:"pointer",
                marginBottom:"10px",
              }}>
                Connect Wallet First
              </button>
            ) : (
              <FaucetButton address={address} />
            )}
          </div>
        )}

        {/* Navigation */}
        <div style={{ display:"flex", gap:"10px" }}>
          {step > 0 && (
            <button onClick={() => setStep(s => s - 1)} style={{
              flex:1, padding:"12px",
              background:"var(--surface2)",
              border:"1px solid var(--border2)",
              borderRadius:"10px",
              color:"var(--text2)", cursor:"pointer", fontSize:"13px", fontWeight:600,
            }}>← Back</button>
          )}
          <button onClick={() => isLast ? onClose() : setStep(s => s + 1)} style={{
            flex:2, padding:"12px",
            background: isLast
              ? "linear-gradient(135deg,#059669,#10b981)"
              : "linear-gradient(135deg,#4f46e5,#6366f1)",
            border:"none", borderRadius:"10px",
            color:"#fff", cursor:"pointer", fontSize:"14px", fontWeight:700,
            transition:"opacity 0.15s",
          }}>
            {isLast ? "Start Trading →" : "Next →"}
          </button>
        </div>

        <button onClick={onClose} style={{
          marginTop:"14px", background:"none", border:"none",
          color:"var(--text3)", cursor:"pointer", fontSize:"12px",
        }}>
          Skip tutorial
        </button>
      </div>
    </div>
  );
}
