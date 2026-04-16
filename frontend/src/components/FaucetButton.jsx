import { useState } from "react";
import { ethers } from "ethers";

const USDC_ABI = [
  "function mint(address to, uint256 amount) external",
  "function balanceOf(address) external view returns (uint256)",
];
const USDC_ADDRESS  = import.meta.env.VITE_USDC        || "";
const RPC_URL       = import.meta.env.VITE_RPC_URL     || "http://localhost:8545";
const SEEDER_KEY    = import.meta.env.VITE_SEEDER_KEY  || "";

// Drip amounts
const GAS_DRIP  = ethers.parseEther("0.05");    // 0.05 GAS — enough for hundreds of trades
const USDC_DRIP = ethers.parseUnits("1000", 6); // 1000 USDC

export default function FaucetButton({ address }) {
  const [loading, setLoading] = useState(false);
  const [done,    setDone]    = useState(false);
  const [error,   setError]   = useState(null);
  const [status,  setStatus]  = useState("");

  const claim = async () => {
    if (!address) return;
    // Must be a valid EVM hex address — bech32 (init1...) triggers ENS errors
    if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
      setError("Connect a MetaMask / EVM wallet to use the faucet");
      return;
    }
    setLoading(true); setError(null); setStatus("");

    try {
      const network  = new ethers.Network("predx-1", 674323531314972);
      const provider = new ethers.JsonRpcProvider(RPC_URL, network, { staticNetwork: network });

      if (!SEEDER_KEY) throw new Error("Faucet not configured");
      const seeder = new ethers.Wallet(SEEDER_KEY, provider);
      const usdc   = new ethers.Contract(USDC_ADDRESS, USDC_ABI, seeder);

      // Step 1: Gas drip — best-effort, Initia supports fee abstraction with USDC
      setStatus("Sending gas...");
      try {
        const gasBal = await provider.getBalance(address);
        if (gasBal < ethers.parseEther("0.01")) {
          // Let the chain estimate gas — Initia native transfers cost > 21000
          const gasTx = await seeder.sendTransaction({
            to:    address,
            value: GAS_DRIP,
          });
          await gasTx.wait();
        }
      } catch {
        // Non-fatal — user can still trade using USDC for fees via Initia fee abstraction
      }

      // Step 2: Mint USDC — this is the critical step
      setStatus("Minting USDC...");
      const tx = await usdc.mint(address, USDC_DRIP, { gasLimit: 150_000 });
      await tx.wait();

      setDone(true);
    } catch (err) {
      const msg = err.reason || err.message || "Failed";
      setError(msg.length > 80 ? msg.slice(0, 80) + "…" : msg);
    } finally {
      setLoading(false);
      setStatus("");
    }
  };

  if (done) return (
    <div style={{
      padding:"8px 14px", background:"rgba(63,185,80,0.1)",
      border:"1px solid rgba(63,185,80,0.3)", borderRadius:"8px",
      fontSize:"12px", color:"#3fb950", fontWeight:600
    }}>
      ✓ 1,000 USDC + gas sent to your wallet!
    </div>
  );

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:"6px" }}>
      <button onClick={claim} disabled={loading || !address} style={{
        padding:"10px 18px",
        background: loading
          ? "rgba(245,158,11,0.4)"
          : "linear-gradient(135deg,#f59e0b,#d97706)",
        border:"none", borderRadius:"8px",
        color: loading ? "#d97706" : "#000",
        fontWeight:700, fontSize:"13px",
        cursor: address ? "pointer" : "not-allowed",
        opacity: address ? 1 : 0.5,
        transition:"all 0.2s",
      }}>
        {loading ? (status || "Claiming...") : "🚰 Get 1,000 USDC + Gas"}
      </button>
      {!address && (
        <div style={{ fontSize:"11px", color:"#4a5568", textAlign:"center" }}>
          Connect wallet first
        </div>
      )}
      {error && (
        <div style={{ fontSize:"11px", color:"#f85149" }}>{error}</div>
      )}
    </div>
  );
}
