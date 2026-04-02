import { useInterwovenKit } from "@initia/interwovenkit-react";
import { useUsername } from "../hooks/useUsername";
import "./Header.css";

export default function Header({ onDeposit }) {
  const { address, connect, disconnect, isConnected } = useInterwovenKit();
  const username  = useUsername(address);
  const shortAddr = address ? `${address.slice(0,6)}...${address.slice(-4)}` : null;
  const displayName = username || shortAddr;

  return (
    <header className="header">
      <div className="header-left">
        <div className="logo">
          <span className="logo-icon">P</span>
          <span className="logo-text">PredX</span>
          <span className="logo-badge">BETA</span>
        </div>
        <nav className="nav">
          <span className="nav-item active">Markets</span>
          <span className="nav-item">Leaderboard</span>
          <span className="nav-item">Earn</span>
        </nav>
      </div>
      <div className="header-right">
        {isConnected && (
          <button className="btn-deposit" onClick={onDeposit}>+ Deposit</button>
        )}
        {isConnected ? (
          <button className="btn-wallet connected" onClick={disconnect}>
            <span className="wallet-dot" />{displayName}
          </button>
        ) : (
          <button className="btn-wallet" onClick={connect}>Connect Wallet</button>
        )}
      </div>
    </header>
  );
}
