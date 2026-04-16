import { useState, useEffect, useRef } from "react";
import { ethers } from "ethers";
import { useInterwovenKit } from "@initia/interwovenkit-react";
import { useWallet }   from "../hooks/useWallet";
import { useAutosign } from "../hooks/useAutosign";
import { useLivePrices } from "../hooks/useLivePrices";
import "./Header.css";

const RPC_URL    = import.meta.env.VITE_RPC_URL    || "http://localhost:8545";
const SEEDER_KEY = import.meta.env.VITE_SEEDER_KEY || "";
const GAS_DRIP   = ethers.parseEther("0.05");
const GAS_MIN    = ethers.parseEther("0.005");

// Returns true if funded successfully (or already funded), false on failure
async function ensureGasBalance(hexAddr) {
  if (!hexAddr || !/^0x[0-9a-fA-F]{40}$/.test(hexAddr)) return false;
  if (!SEEDER_KEY) return false;
  try {
    const network  = new ethers.Network("predx-1", 674323531314972);
    const provider = new ethers.JsonRpcProvider(RPC_URL, network, { staticNetwork: network });
    const bal      = await provider.getBalance(hexAddr);
    if (bal >= GAS_MIN) return true; // already has enough
    const seeder = new ethers.Wallet(SEEDER_KEY, provider);
    const tx = await seeder.sendTransaction({ to: hexAddr, value: GAS_DRIP });
    await tx.wait();
    return true;
  } catch (e) {
    console.error("[AutoSign] gas fund failed:", e.message);
    return false;
  }
}

// Auto-sign toggle button
function AutoSignBadge({ onDeposit }) {
  const { isEnabled, isLoading, enable, disable, expiryLabel } = useAutosign();
  const { isConnected } = useWallet();
  const { hexAddress } = useInterwovenKit();
  const [funding, setFunding] = useState(false);
  const [fundErr, setFundErr] = useState(null);

  if (!isConnected) return null;

  const handleToggle = async () => {
    if (isEnabled) { disable(); return; }
    setFundErr(null);
    setFunding(true);
    let ok = false;
    try {
      ok = await ensureGasBalance(hexAddress);
    } finally {
      setFunding(false);
    }
    if (!ok && !SEEDER_KEY) {
      // No seeder configured — try anyway, IWK may have another fee path
      enable();
      return;
    }
    if (!ok) {
      setFundErr("Gas top-up failed — check seeder balance");
      return;
    }
    enable();
  };

  const busy = isLoading || funding;

  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:"3px" }}>
      <button
        className={`autosign-btn ${isEnabled ? "enabled" : "disabled"}`}
        onClick={handleToggle}
        disabled={busy}
        title={isEnabled ? `Auto-sign active · ${expiryLabel || ""}` : "Enable 1-click trading"}
      >
        <span className={`as-dot ${isEnabled ? "on" : "off"}`} />
        {funding ? "Funding gas..." : isLoading ? "..." : isEnabled ? (
          <>⚡ Auto-Sign <span className="as-tag">ON</span></>
        ) : (
          <>⚡ Auto-Sign</>
        )}
      </button>
      {fundErr && (
        <span style={{ fontSize:"10px", color:"#f85149" }}>{fundErr}</span>
      )}
    </div>
  );
}

// Wallet connect / profile button
function WalletButton() {
  const { address, username, isConnected, connect, openWallet, disconnect, shortAddr } = useWallet();
  const [showMenu, setShowMenu] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const dropRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (dropRef.current && !dropRef.current.contains(e.target)) setShowOptions(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (!isConnected) {
    return (
      <div style={{ position: "relative" }} ref={dropRef}>
        <button className="btn-wallet connect" onClick={() => setShowOptions(s => !s)}>
          Connect Wallet
        </button>
        {showOptions && (
          <div className="wallet-menu" style={{ right: 0, top: "calc(100% + 6px)" }}>
            <button className="wm-item" onClick={() => { connect(); setShowOptions(false); }}>
              ◈ Initia Wallet
            </button>
            <button className="wm-item" onClick={async () => {
              setShowOptions(false);
              try {
                if (!window.ethereum) { alert("MetaMask not found. Install it at metamask.io"); return; }
                await window.ethereum.request({ method: "eth_requestAccounts" });
                // Switch MetaMask to predx-1 network
                const chainHex = "0x" + (674323531314972).toString(16);
                try {
                  await window.ethereum.request({
                    method: "wallet_switchEthereumChain",
                    params: [{ chainId: chainHex }],
                  });
                } catch (switchErr) {
                  if (switchErr.code === 4902) {
                    await window.ethereum.request({
                      method: "wallet_addEthereumChain",
                      params: [{
                        chainId: chainHex,
                        chainName: "PredX (predx-1)",
                        nativeCurrency: { name: "GAS", symbol: "GAS", decimals: 18 },
                        rpcUrls: ["http://localhost:8545"],
                      }],
                    });
                  }
                }
                connect();
              } catch (err) {
                console.error("MetaMask connect failed:", err.message);
              }
            }}>
              🦊 MetaMask
            </button>
          </div>
        )}
      </div>
    );
  }

  const displayName = username || shortAddr;

  return (
    <div className="wallet-profile" onMouseLeave={() => setShowMenu(false)}>
      <button
        className="btn-wallet connected"
        onClick={() => setShowMenu(s => !s)}
      >
        <span className="wallet-avatar">
          {username ? username.slice(0, 2).toUpperCase() : "0x"}
        </span>
        <span className="wallet-name">{displayName}</span>
        <span className="wallet-chevron">▾</span>
      </button>

      {showMenu && (
        <div className="wallet-menu">
          {username && (
            <div className="wm-username">
              <span className="wm-init-icon">◈</span>
              <span className="wm-init-name">{username}</span>
            </div>
          )}
          <div className="wm-addr">{address?.slice(0, 10)}...{address?.slice(-8)}</div>
          <div className="wm-divider" />
          <button className="wm-item" onClick={() => { openWallet(); setShowMenu(false); }}>
            Open Wallet
          </button>
          <button className="wm-item" onClick={() => { disconnect(); setShowMenu(false); }}>
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
}

export default function Header({ onDeposit, activePage, setPage }) {
  const prices = useLivePrices();

  return (
    <header className="header">
      {/* Brand + live ticker */}
      <div className="header-brand">
        <div className="logo">
          <div className="logo-mark">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M10 2L18 6V14L10 18L2 14V6L10 2Z" fill="#6366f1" opacity="0.9"/>
              <path d="M10 6L14 8.5V13.5L10 16L6 13.5V8.5L10 6Z" fill="#818cf8"/>
              <circle cx="10" cy="10" r="2" fill="#c4b5fd"/>
            </svg>
          </div>
          <span className="logo-name">PredX</span>
          <span className="logo-tag">BETA</span>
        </div>

        <div className="ticker-bar">
          {Object.entries(prices).map(([sym, data]) => (
            <div key={sym} className="ticker-item">
              <span className="ticker-sym">{sym}</span>
              <span className="ticker-price">{data.formatted}</span>
              <span className={`ticker-chg ${data.change >= 0 ? "up" : "dn"}`}>
                {data.change >= 0 ? "▲" : "▼"}{Math.abs(data.change).toFixed(2)}%
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Navigation */}
      <nav className="header-nav">
        {["Markets", "Leaderboard", "Earn"].map(page => (
          <button
            key={page}
            className={`nav-link ${activePage === page ? "active" : ""}`}
            onClick={() => setPage(page)}
          >
            {page}
          </button>
        ))}
      </nav>

      {/* Actions */}
      <div className="header-actions">
        <AutoSignBadge />
        <button className="btn-deposit" onClick={onDeposit}>+ Deposit</button>
        <WalletButton />
      </div>
    </header>
  );
}
