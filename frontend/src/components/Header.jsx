import { useWallet } from "../hooks/useWallet";
import { useLivePrices } from "../hooks/useLivePrices";
import "./Header.css";

export default function Header({ onDeposit }) {
  const { isConnected, isConnecting, connect, disconnect, shortAddr } = useWallet();
  const prices = useLivePrices();

  return (
    <header className="header">
      <div className="header-brand">
        <div className="logo">
          <div className="logo-mark"><span>P</span></div>
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
          <button className="btn-deposit" onClick={onDeposit}>+ Deposit</button>
        )}
        {isConnected ? (
          <button className="btn-wallet connected" onClick={disconnect}>
            <span className="status-dot" />
            <span>{shortAddr}</span>
          </button>
        ) : (
          <button className="btn-wallet" onClick={connect} disabled={isConnecting}>
            {isConnecting ? "Connecting..." : "Connect Wallet"}
          </button>
        )}
      </div>
    </header>
  );
}
