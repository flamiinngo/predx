import { useState } from "react";
import Header        from "./components/Header";
import MarketRow     from "./components/MarketRow";
import ChartPanel    from "./components/ChartPanel";
import TradePanel    from "./components/TradePanel";
import StatsBar      from "./components/StatsBar";
import Positions     from "./components/Positions";
import MarketInfo    from "./components/MarketInfo";
import DepositModal  from "./components/DepositModal";
import OnboardingModal from "./components/OnboardingModal";
import Leaderboard   from "./components/Leaderboard";
import EarnPage      from "./components/EarnPage";
import { useLivePrices } from "./hooks/useLivePrices";
import "./App.css";

export default function App() {
  const livePrices = useLivePrices();
  const [market,       setMarket]      = useState(null);
  const [showDeposit,  setDeposit]     = useState(false);
  const [showOnboard,  setOnboard]     = useState(!localStorage.getItem("predx_visited"));
  const [activePage,   setActivePage]  = useState("Markets");

  const closeOnboard = () => {
    localStorage.setItem("predx_visited", "1");
    setOnboard(false);
  };

  const handleSelect = (m) => {
    setMarket({ ...m, price: livePrices[m.symbol]?.price || m.price });
  };

  return (
    <div className="app">
      <Header
        onDeposit={() => setDeposit(true)}
        activePage={activePage}
        setPage={setActivePage}
      />
      <StatsBar />

      {/* ── Markets page ── */}
      {activePage === "Markets" && (
        <div className="layout">
          <div className="col-main">
            <MarketRow onSelect={handleSelect} selected={market} />
            <ChartPanel market={market} livePrice={livePrices[market?.symbol]?.price} />
            <div className="bottom-row">
              <Positions />
              <MarketInfo market={market} livePrice={livePrices[market?.symbol]?.price} />
            </div>
          </div>
          <div className="col-side">
            <TradePanel market={market} livePrice={livePrices[market?.symbol]?.price} />
          </div>
        </div>
      )}

      {/* ── Leaderboard page ── */}
      {activePage === "Leaderboard" && <Leaderboard />}

      {/* ── Earn / LP page ── */}
      {activePage === "Earn" && <EarnPage />}

      {/* ── Modals ── */}
      {showDeposit && <DepositModal onClose={() => setDeposit(false)} />}
      {showOnboard && <OnboardingModal onClose={closeOnboard} />}
    </div>
  );
}
