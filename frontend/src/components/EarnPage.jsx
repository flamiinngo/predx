import { useState } from "react";
import { useWallet } from "../hooks/useWallet";
import {
  useWriteContract,
  useReadContract,
  useAccount,
} from "wagmi";
import { parseUnits, maxUint256 } from "viem";
import "./EarnPage.css";

const VAULT_ADDRESS = import.meta.env.VITE_VAULT || "";
const USDC_ADDRESS  = import.meta.env.VITE_USDC  || "";

const VAULT_ABI = [
  {
    name: "deposit",
    type: "function", stateMutability: "nonpayable",
    inputs:  [{ name: "amount",      type: "uint256" }],
    outputs: [],
  },
  {
    name: "withdraw",
    type: "function", stateMutability: "nonpayable",
    inputs:  [{ name: "shareAmount", type: "uint256" }],
    outputs: [],
  },
  {
    name: "getLPBalance",
    type: "function", stateMutability: "view",
    inputs:  [{ name: "lp", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "shares",
    type: "function", stateMutability: "view",
    inputs:  [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "totalDeposited",
    type: "function", stateMutability: "view",
    inputs:  [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "getVaultBalance",
    type: "function", stateMutability: "view",
    inputs:  [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "claimInitRewards",
    type: "function", stateMutability: "nonpayable",
    inputs:  [],
    outputs: [],
  },
  {
    name: "pendingInitRewards",
    type: "function", stateMutability: "view",
    inputs:  [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
];

const USDC_ABI = [
  {
    name: "allowance",
    type: "function", stateMutability: "view",
    inputs:  [{ name: "owner", type: "address" }, { name: "spender", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "approve",
    type: "function", stateMutability: "nonpayable",
    inputs:  [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "balanceOf",
    type: "function", stateMutability: "view",
    inputs:  [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
];

function fmt(n) {
  if (n === null || n === undefined) return "—";
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function EarnPage() {
  const { address, isConnected, connect } = useWallet();
  const wagmiAccount = useAccount();
  const effectiveAddress = address || wagmiAccount.address;

  const [tab,    setTab]    = useState("deposit"); // deposit | withdraw
  const [amount, setAmount] = useState("");
  const [step,   setStep]   = useState("idle");
  const [txHash, setTxHash] = useState(null);
  const [errMsg, setErrMsg] = useState(null);

  const { writeContractAsync } = useWriteContract();

  // Reads
  const { data: tvlRaw }        = useReadContract({ address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: "getVaultBalance",  query: { refetchInterval: 10_000 } });
  const { data: lpBalRaw }      = useReadContract({ address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: "getLPBalance",     args: [effectiveAddress], query: { enabled: !!effectiveAddress, refetchInterval: 8_000 } });
  const { data: sharesRaw }     = useReadContract({ address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: "shares",          args: [effectiveAddress], query: { enabled: !!effectiveAddress, refetchInterval: 8_000 } });
  const { data: pendingRaw }    = useReadContract({ address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: "pendingInitRewards", args: [effectiveAddress], query: { enabled: !!effectiveAddress, refetchInterval: 8_000 } });
  const { data: usdcBalRaw }    = useReadContract({ address: USDC_ADDRESS,  abi: USDC_ABI,  functionName: "balanceOf",        args: [effectiveAddress], query: { enabled: !!effectiveAddress, refetchInterval: 8_000 } });
  const { data: allowanceRaw }  = useReadContract({ address: USDC_ADDRESS,  abi: USDC_ABI,  functionName: "allowance",        args: [effectiveAddress, VAULT_ADDRESS], query: { enabled: !!effectiveAddress, refetchInterval: 5_000 } });

  const tvl       = tvlRaw    !== undefined ? Number(tvlRaw)    / 1e6 : null;
  const lpBalance = lpBalRaw  !== undefined ? Number(lpBalRaw)  / 1e6 : null;
  const shares    = sharesRaw !== undefined ? Number(sharesRaw) / 1e18 : null;
  const pending   = pendingRaw !== undefined ? Number(pendingRaw) / 1e18 : null;
  const usdcBal   = usdcBalRaw !== undefined ? Number(usdcBalRaw) / 1e6 : null;
  const allowance = allowanceRaw ?? 0n;

  // Estimated APY proxy: protocol fees go to vault, rough estimate
  const aprDisplay = "—"; // Would need historical data to compute

  const handleDeposit = async () => {
    if (!amount || parseFloat(amount) < 1) { setErrMsg("Minimum $1 USDC"); return; }
    if (!effectiveAddress) { connect(); return; }
    setErrMsg(null); setTxHash(null);
    try {
      const units = parseUnits(amount, 6);
      if (allowance < units) {
        setStep("approving");
        await writeContractAsync({ address: USDC_ADDRESS, abi: USDC_ABI, functionName: "approve", args: [VAULT_ADDRESS, maxUint256] });
      }
      setStep("depositing");
      const hash = await writeContractAsync({ address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: "deposit", args: [units], gas: 300_000n });
      setTxHash(hash);
      setStep("done");
      setAmount("");
    } catch (err) {
      setErrMsg(err.shortMessage || err.message || "Transaction failed");
      setStep("error");
    }
  };

  const handleWithdraw = async () => {
    if (!amount || parseFloat(amount) <= 0) { setErrMsg("Enter share amount"); return; }
    if (!effectiveAddress) { connect(); return; }
    setErrMsg(null); setTxHash(null);
    try {
      setStep("withdrawing");
      // Convert USDC amount back to shares proportionally
      const shareAmount = sharesRaw && lpBalRaw && Number(lpBalRaw) > 0
        ? BigInt(Math.floor(Number(sharesRaw) * parseFloat(amount) / (Number(lpBalRaw) / 1e6)))
        : parseUnits(amount, 18);
      const hash = await writeContractAsync({ address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: "withdraw", args: [shareAmount], gas: 300_000n });
      setTxHash(hash);
      setStep("done");
      setAmount("");
    } catch (err) {
      setErrMsg(err.shortMessage || err.message || "Transaction failed");
      setStep("error");
    }
  };

  const handleClaim = async () => {
    if (!effectiveAddress) return;
    try {
      await writeContractAsync({ address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: "claimInitRewards", gas: 200_000n });
    } catch (err) {
      setErrMsg(err.shortMessage || err.message);
    }
  };

  const isLoading = ["approving","depositing","withdrawing"].includes(step);

  return (
    <div className="earn-page">
      {/* Hero */}
      <div className="earn-hero">
        <div>
          <h1 className="earn-title">Earn</h1>
          <p className="earn-subtitle">
            Provide liquidity to PredX markets. Earn fees from every trade.
            Losers' stakes flow back to the vault — LPs profit when the market is active.
          </p>
        </div>
        <div className="earn-initia-badge">
          <img src="https://app.initia.xyz/favicon.ico" alt="" className="earn-initia-icon" onError={e => e.target.style.display='none'} />
          Powered by Initia VIP
        </div>
      </div>

      <div className="earn-grid">
        {/* ── Stats ── */}
        <div className="earn-stats">
          <div className="earn-stat-card">
            <div className="esc-label">Total Vault TVL</div>
            <div className="esc-val">${fmt(tvl)}</div>
            <div className="esc-sub live">● Live from chain</div>
          </div>
          <div className="earn-stat-card">
            <div className="esc-label">Your Position</div>
            <div className="esc-val">${fmt(lpBalance)}</div>
            <div className="esc-sub">{shares !== null ? `${shares.toFixed(4)} shares` : "—"}</div>
          </div>
          <div className="earn-stat-card">
            <div className="esc-label">INIT Rewards</div>
            <div className="esc-val">{pending !== null ? `${pending.toFixed(4)} INIT` : "—"}</div>
            {pending !== null && pending > 0 && effectiveAddress && (
              <button className="esc-claim" onClick={handleClaim}>Claim</button>
            )}
          </div>
          <div className="earn-stat-card highlight">
            <div className="esc-label">How it works</div>
            <div className="esc-feature">Protocol collects 2% fee on all trades</div>
            <div className="esc-feature">Losers' stakes credited to vault</div>
            <div className="esc-feature">Winners paid by vault (leverage comes from pool)</div>
            <div className="esc-feature">INIT token rewards distributed pro-rata</div>
          </div>
        </div>

        {/* ── Deposit / Withdraw ── */}
        <div className="earn-form-card">
          <div className="earn-tabs">
            {["deposit","withdraw"].map(t => (
              <button key={t} className={`earn-tab ${tab === t ? "on" : ""}`} onClick={() => { setTab(t); setAmount(""); setStep("idle"); setErrMsg(null); }}>
                {t === "deposit" ? "Deposit" : "Withdraw"}
              </button>
            ))}
          </div>

          <div className="earn-form">
            {tab === "deposit" && (
              <div className="earn-bal">
                Wallet: <span>${fmt(usdcBal)} USDC</span>
              </div>
            )}
            {tab === "withdraw" && (
              <div className="earn-bal">
                Position: <span>${fmt(lpBalance)} USDC</span>
              </div>
            )}

            <div className="earn-inp-wrap">
              <span className="earn-inp-pre">$</span>
              <input
                className="earn-inp"
                type="number"
                placeholder="0.00"
                value={amount}
                onChange={e => { setAmount(e.target.value); setErrMsg(null); setTxHash(null); setStep("idle"); }}
              />
              <span className="earn-inp-suf">USDC</span>
            </div>

            <div className="earn-presets">
              {[100, 500, 1000, 5000].map(n => (
                <button key={n} className={`earn-preset ${amount == n ? "on" : ""}`} onClick={() => setAmount(String(n))}>
                  ${n}
                </button>
              ))}
              {tab === "deposit" && usdcBal !== null && (
                <button className="earn-preset" onClick={() => setAmount(Math.floor(usdcBal).toString())}>MAX</button>
              )}
              {tab === "withdraw" && lpBalance !== null && (
                <button className="earn-preset" onClick={() => setAmount(Math.floor(lpBalance).toString())}>MAX</button>
              )}
            </div>

            {step === "done" && txHash && (
              <div className="earn-success">
                ✓ {tab === "deposit" ? "Deposited" : "Withdrawn"} successfully!
                <div className="earn-tx">Tx: {txHash.slice(0,16)}...{txHash.slice(-6)}</div>
              </div>
            )}
            {errMsg && <div className="earn-error">⚠ {errMsg}</div>}

            {!isConnected ? (
              <button className="earn-cta connect" onClick={connect}>Connect Wallet</button>
            ) : (
              <button
                className={`earn-cta ${tab}`}
                onClick={tab === "deposit" ? handleDeposit : handleWithdraw}
                disabled={!amount || isLoading}
              >
                {isLoading
                  ? (step === "approving" ? "Approving USDC..." : `${tab === "deposit" ? "Depositing" : "Withdrawing"}...`)
                  : (tab === "deposit" ? `Deposit ${amount || "0"} USDC` : `Withdraw ${amount || "0"} USDC`)
                }
              </button>
            )}
          </div>

          <div className="earn-note">
            Funds are deployed as liquidity in all active PredX markets.
            Withdrawals process immediately when vault has sufficient liquidity.
            INIT rewards come from Initia VIP program.
          </div>
        </div>
      </div>
    </div>
  );
}
