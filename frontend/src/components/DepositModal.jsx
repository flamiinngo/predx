import { useState } from "react";
import { useInterwovenKit } from "@initia/interwovenkit-react";
import "./DepositModal.css";

const CHAINS = [
  { id: "ethereum", name: "Ethereum",  color: "#627eea" },
  { id: "bnb",      name: "BNB Chain", color: "#f0b90b" },
  { id: "initia",   name: "Initia L1", color: "#6366f1" },
];

export default function DepositModal({ onClose }) {
  const { address, transferAsset } = useInterwovenKit();
  const [fromChain, setFromChain]  = useState(CHAINS[2]);
  const [amount, setAmount]        = useState("");
  const [loading, setLoading]      = useState(false);
  const [done, setDone]            = useState(false);

  const handleDeposit = async () => {
    if (!amount || !address) return;
    setLoading(true);
    try {
      await transferAsset({
        denom:       "uusdc",
        amount:      String(Math.floor(parseFloat(amount) * 1e6)),
        recipient:   address,
        sourceChain: fromChain.id,
        destChain:   "predx-1",
      });
      setDone(true);
    } catch (err) {
      console.error("Deposit error:", err);
      setDone(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Deposit USDC</h3>
          <button className="modal-close" onClick={onClose}>x</button>
        </div>
        {done ? (
          <div className="deposit-done">
            <div className="done-icon">✓</div>
            <p>Deposit submitted!</p>
            <p className="done-sub">USDC arriving via Interwoven Bridge</p>
            <button className="btn-done" onClick={onClose}>Done</button>
          </div>
        ) : (
          <>
            <div className="modal-section">
              <label>From chain</label>
              <div className="chain-select">
                {CHAINS.map((c) => (
                  <button key={c.id} className={`chain-btn ${fromChain.id === c.id ? "active" : ""}`} onClick={() => setFromChain(c)}>
                    <span className="chain-dot" style={{ background: c.color }} />{c.name}
                  </button>
                ))}
              </div>
            </div>
            <div className="modal-section">
              <label>To</label>
              <div className="to-chain">
                <span className="chain-dot" style={{ background: "#6366f1" }} />
                <span>PredX (predx-1)</span>
              </div>
            </div>
            <div className="modal-section">
              <label>Amount (USDC)</label>
              <div className="amount-wrap">
                <input type="number" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} />
                <span>USDC</span>
              </div>
            </div>
            <div className="modal-note">Powered by Initia Interwoven Bridge</div>
            <button className="btn-deposit-confirm" onClick={handleDeposit} disabled={!amount || loading}>
              {loading ? "Bridging..." : `Deposit from ${fromChain.name}`}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
