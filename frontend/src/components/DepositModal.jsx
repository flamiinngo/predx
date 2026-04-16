import { useState } from "react";
import { ethers } from "ethers";
import { useWallet } from "../hooks/useWallet";
import "./DepositModal.css";

const USDC_ABI = ["function mint(address to, uint256 amount) external"];
const USDC_ADDRESS = import.meta.env.VITE_USDC       || "";
const RPC_URL      = import.meta.env.VITE_RPC_URL    || "http://localhost:8545";
const SEEDER_KEY   = import.meta.env.VITE_SEEDER_KEY || "";
const GAS_DRIP     = ethers.parseEther("0.05");
const USDC_DRIP    = ethers.parseUnits("1000", 6);

export default function DepositModal({ onClose }) {
  const { address, isConnected } = useWallet();
  const [loading, setLoading] = useState(false);
  const [done,    setDone]    = useState(false);
  const [error,   setError]   = useState(null);
  const [status,  setStatus]  = useState("");
  const [tab,     setTab]     = useState("faucet");

  const claim = async () => {
    if (!address) { setError("Connect your wallet first"); return; }
    if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
      setError("Connect a MetaMask / EVM wallet to use the faucet");
      return;
    }
    setLoading(true); setError(null); setStatus("");
    try {
      const network  = new ethers.Network("predx-1", 674323531314972);
      const provider = new ethers.JsonRpcProvider(RPC_URL, network, { staticNetwork: network });
      if (!SEEDER_KEY) throw new Error("Faucet key not configured");
      const seeder = new ethers.Wallet(SEEDER_KEY, provider);
      const usdc   = new ethers.Contract(USDC_ADDRESS, USDC_ABI, seeder);

      // Gas drip — best-effort, non-fatal
      setStatus("Sending gas...");
      try {
        const gasBal = await provider.getBalance(address);
        if (gasBal < ethers.parseEther("0.01")) {
          const gasTx = await seeder.sendTransaction({ to: address, value: GAS_DRIP });
          await gasTx.wait();
        }
      } catch {
        // Non-fatal — USDC covers fees via Initia fee abstraction
      }

      // Mint USDC
      setStatus("Minting USDC...");
      const tx = await usdc.mint(address, USDC_DRIP, { gasLimit: 150_000 });
      await tx.wait();

      setDone(true);
    } catch (err) {
      const msg = err.reason || err.message || "Failed";
      setError(msg.length > 90 ? msg.slice(0, 90) + "…" : msg);
    } finally {
      setLoading(false); setStatus("");
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>

        <div className="modal-header">
          <h3>Fund Your Wallet</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        {/* Tabs */}
        <div style={{ display:"flex", borderBottom:"1px solid #21262d", marginBottom:"20px" }}>
          {[["faucet","🚰 Testnet Faucet"],["bridge","🌉 Bridge"]].map(([t,label]) => (
            <button key={t} onClick={() => setTab(t)} style={{
              flex:1, padding:"10px", background:"none", border:"none",
              borderBottom: tab===t ? "2px solid #6366f1" : "2px solid transparent",
              color: tab===t ? "#e2e8f0" : "#4a5568",
              cursor:"pointer", fontSize:"13px", fontWeight:600,
            }}>{label}</button>
          ))}
        </div>

        {tab === "faucet" && (
          <div style={{ padding:"0 4px 16px", textAlign:"center" }}>
            {done ? (
              <>
                <div style={{ fontSize:"48px", marginBottom:"12px" }}>🎉</div>
                <div style={{ fontSize:"16px", fontWeight:700, color:"#3fb950", marginBottom:"6px" }}>
                  1,000 USDC + Gas sent!
                </div>
                <div style={{ fontSize:"12px", color:"#4a5568", marginBottom:"20px" }}>
                  Your wallet is ready to trade
                </div>
                <button onClick={onClose} style={{
                  padding:"12px 32px",
                  background:"linear-gradient(135deg,#3fb950,#2ea043)",
                  border:"none", borderRadius:"10px",
                  color:"#fff", fontWeight:700, fontSize:"14px", cursor:"pointer",
                }}>Start Trading →</button>
              </>
            ) : (
              <>
                <div style={{ fontSize:"13px", color:"#8b949e", lineHeight:"1.7", marginBottom:"16px" }}>
                  Get <b style={{ color:"#e2e8f0" }}>1,000 USDC</b> + gas to start trading.<br/>
                  No MetaMask needed — funded from our faucet wallet.
                </div>

                {/* Wallet status */}
                <div style={{
                  padding:"10px 14px", background:"#0d1117",
                  border:`1px solid ${isConnected ? "#3fb95040" : "#21262d"}`,
                  borderRadius:"8px", marginBottom:"16px",
                  fontSize:"12px", display:"flex", justifyContent:"space-between",
                }}>
                  <span style={{ color:"#4a5568" }}>Connected wallet</span>
                  {isConnected && address
                    ? <span style={{ color:"#3fb950" }}>{address.slice(0,8)}...{address.slice(-6)}</span>
                    : <span style={{ color:"#f85149" }}>Not connected</span>
                  }
                </div>

                <button
                  onClick={claim}
                  disabled={loading || !isConnected}
                  style={{
                    width:"100%", padding:"16px",
                    background: (!isConnected || loading) ? "#21262d" : "linear-gradient(135deg,#f59e0b,#d97706)",
                    border:"none", borderRadius:"10px",
                    color: (!isConnected || loading) ? "#4a5568" : "#000",
                    fontWeight:700, fontSize:"16px",
                    cursor: (loading || !isConnected) ? "not-allowed" : "pointer",
                    transition:"all 0.2s",
                  }}>
                  {!isConnected
                    ? "Connect wallet first"
                    : loading
                    ? (status || "Processing...")
                    : "🚰 Get 1,000 USDC + Gas"}
                </button>

                {error && (
                  <div style={{ marginTop:"10px", fontSize:"12px", color:"#f85149" }}>⚠ {error}</div>
                )}
                <div style={{ marginTop:"12px", fontSize:"11px", color:"#4a5568" }}>
                  Testnet only · Unlimited claims · Powered by predx-1
                </div>
              </>
            )}
          </div>
        )}

        {tab === "bridge" && (
          <div style={{ padding:"0 4px 16px" }}>
            <div style={{
              padding:"16px", background:"rgba(99,102,241,0.08)",
              border:"1px solid rgba(99,102,241,0.2)", borderRadius:"10px",
              marginBottom:"16px", fontSize:"13px", color:"#8b949e", lineHeight:"1.6",
            }}>
              Bridge USDC from Ethereum, BNB Chain, or Initia L1 to predx-1 via the Initia Interwoven Bridge.
            </div>
            <a href="https://app.testnet.initia.xyz/bridge" target="_blank" rel="noopener noreferrer"
              style={{
                display:"block", padding:"14px", textAlign:"center",
                background:"linear-gradient(135deg,#6366f1,#4f46e5)",
                border:"none", borderRadius:"10px",
                color:"#fff", fontWeight:700, fontSize:"14px", textDecoration:"none",
              }}>
              Open Initia Bridge →
            </a>
            <div style={{ marginTop:"12px", fontSize:"11px", color:"#4a5568", textAlign:"center" }}>
              Powered by Initia Interwoven Bridge
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
