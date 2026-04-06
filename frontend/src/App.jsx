import { useState } from "react";
import Header from "./components/Header";
import MarketRow from "./components/MarketRow";
import ChartPanel from "./components/ChartPanel";
import TradePanel from "./components/TradePanel";
import OrderBook from "./components/OrderBook";
import RecentTrades from "./components/RecentTrades";
import StatsBar from "./components/StatsBar";
import Positions from "./components/Positions";
import Leaderboard from "./components/Leaderboard";
import MarketInfo from "./components/MarketInfo";
import DepositModal from "./components/DepositModal";
import "./App.css";

const DEFAULT = {
  symbol:"BTC", timeframe:"1m", id:"BTC-1m",
  higher:62, vol:47000,
  endTime:Date.now()+60000,
};

export default function App() {
  const [market, setMarket]       = useState(DEFAULT);
  const [showDeposit, setDeposit] = useState(false);

  return (
    <div className="app">
      <Header onDeposit={()=>setDeposit(true)} />
      <StatsBar />
      <div className="layout">
        <div className="col-main">
          <MarketRow onSelect={setMarket} selected={market} />
          <ChartPanel market={market} />
          <div className="bottom-row">
            <OrderBook market={market} />
            <RecentTrades />
            <Positions />
          </div>
          <div className="bottom-row2">
            <Leaderboard />
            <MarketInfo market={market} />
          </div>
        </div>
        <div className="col-side">
          <TradePanel market={market} />
        </div>
      </div>
      {showDeposit && <DepositModal onClose={()=>setDeposit(false)} />}
    </div>
  );
}
