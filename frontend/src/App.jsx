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
import { useLivePrices } from "./hooks/useLivePrices";
import "./App.css";

export default function App() {
  const livePrices = useLivePrices();

  const DEFAULT = {
    symbol:    "BTC",
    timeframe: "1m",
    id:        "BTC-1m",
    higher:    62,
    vol:       47000,
    endTime:   Date.now() + 60000,
    price:     livePrices.BTC?.price || 83241,
  };

  const [market, setMarket]       = useState(DEFAULT);
  const [showDeposit, setDeposit] = useState(false);

  const handleSelect = (m) => {
    setMarket({ ...m, price: livePrices[m.symbol]?.price || m.price });
  };

  return (
    <div className="app">
      <Header onDeposit={() => setDeposit(true)} />
      <StatsBar />
      <div className="layout">
        <div className="col-main">
          <MarketRow onSelect={handleSelect} selected={market} />
          <ChartPanel market={market} livePrice={livePrices[market.symbol]?.price} />
          <div className="bottom-row">
            <OrderBook market={market} livePrice={livePrices[market.symbol]?.price} />
            <RecentTrades />
            <Positions />
          </div>
          <div className="bottom-row2">
            <Leaderboard />
            <MarketInfo market={market} livePrice={livePrices[market.symbol]?.price} />
          </div>
        </div>
        <div className="col-side">
          <TradePanel market={market} livePrice={livePrices[market.symbol]?.price} />
        </div>
      </div>
      {showDeposit && <DepositModal onClose={() => setDeposit(false)} />}
    </div>
  );
}
