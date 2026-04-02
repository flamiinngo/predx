import { useState } from "react";
import Header from "./components/Header";
import MarketGrid from "./components/MarketGrid";
import TradePanel from "./components/TradePanel";
import Positions from "./components/Positions";
import DepositModal from "./components/DepositModal";
import "./App.css";

export default function App() {
  const [selectedMarket, setSelectedMarket] = useState(null);
  const [showDeposit, setShowDeposit]       = useState(false);

  return (
    <div className="app">
      <Header onDeposit={() => setShowDeposit(true)} />
      <main className="main">
        <div className="left-col">
          <MarketGrid onSelect={setSelectedMarket} selected={selectedMarket} />
          <Positions />
        </div>
        <div className="right-col">
          <TradePanel market={selectedMarket} />
        </div>
      </main>
      {showDeposit && <DepositModal onClose={() => setShowDeposit(false)} />}
    </div>
  );
}
