import { useInterwovenKit } from "@initia/interwovenkit-react";
import { useUsername } from "../hooks/useUsername";
import { useLivePrices } from "../hooks/useLivePrices";
import "./Header.css";

export default function Header({ onDeposit }) {
  const { address, connect, disconnect, isConnected } = useInterwovenKit();
  const username    = useUsername(address);
  const prices      = useLivePrices();
  const shortAddr   = address ? `${address.slice(0,6)}...${address.slice(-4)}` : null;
  const displayName = username || shortAddr;

  return (
    <header className="header">
      <div className="header-brand">
        <div className="logo">
          <div className="logo-mark">
            <span>P</span>
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
                {data.change >= 0 ? "+" : ""}{data.change.toFixed(2)}%
              </span>
            </div>
          ))}
        </div>
      </div>
      <nav className="header-nav">
        <a className="nav-link active">Markets</a>
        <a className="nav-link">Leaderboard</a>
        <a className="nav-link">Earn</a>
        <a className="nav-link">Docs</a>
      </nav>
      <div className="header-actions">
        {isConnected && (
          <button className="btn-deposit" onClick={onDeposit}>
            <span>+</span> Deposit
          </button>
        )}
        {isConnected ? (
          <button className="btn-wallet connected" onClick={disconnect}>
            <span className="status-dot" />
            <span>{displayName}</span>
          </button>
        ) : (
          <button className="btn-wallet" onClick={connect}>
            Connect Wallet
          </button>
        )}
      </div>
    </header>
  );
}
