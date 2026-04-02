import { useState } from "react";
import Header from "./components/Header";
import MarketRow from "./components/MarketRow";
import ChartPanel from "./components/ChartPanel";
import TradePanel from "./components/TradePanel";
import OrderBook from "./components/OrderBook";
import RecentTrades from "./components/RecentTrades";
import StatsBar from "./components/StatsBar";
import Positions from "./components/Positions";
import DepositModal from "./components/DepositModal";
import "./App.css";

export default function App() {
  const [market, setMarket]       = useState(null);
  const [showDeposit, setDeposit] = useState(false);

  return (
    <div className="app">
      <Header onDeposit={() => setDeposit(true)} />
      <StatsBar />
      <div className="layout">
        {/* LEFT: markets + chart + bottom panels */}
        <div className="col-main">
          <MarketRow onSelect={setMarket} selected={market} />
          {market ? (
            <>
              <ChartPanel market={market} />
              <div className="bottom-row">
                <OrderBook market={market} />
                <RecentTrades market={market} />
                <Positions />
              </div>
            </>
          ) : (
            <div className="no-market">
              <div className="no-market-inner">
                <div className="nm-icon">↖</div>
                <h2>Select a market to start trading</h2>
                <p>BTC, ETH and INIT prediction markets — 1min, 5min, 15min windows</p>
              </div>
            </div>
          )}
        </div>
        {/* RIGHT: trade panel */}
        <div className="col-side">
          <TradePanel market={market} />
        </div>
      </div>
      {showDeposit && <DepositModal onClose={() => setDeposit(false)} />}
    </div>
  );
}
