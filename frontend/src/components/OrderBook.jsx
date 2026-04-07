import { useState, useEffect } from "react";
import "./OrderBook.css";

export default function OrderBook({ market, livePrice }) {
  const base = livePrice || market?.price || 83241;
  const [book, setBook] = useState({ asks: [], bids: [] });

  useEffect(() => {
    const gen = () => {
      const asks = [], bids = [];
      for (let i = 0; i < 8; i++) {
        asks.push({ price: +(base + (i+1)*base*0.0008).toFixed(2), size: +(Math.random()*2+0.1).toFixed(3) });
        bids.push({ price: +(base - (i+1)*base*0.0008).toFixed(2), size: +(Math.random()*2+0.1).toFixed(3) });
      }
      setBook({ asks: asks.reverse(), bids });
    };
    gen();
    const id = setInterval(gen, 2000);
    return () => clearInterval(id);
  }, [base]);

  const maxSize = Math.max(...book.asks.map(a=>a.size), ...book.bids.map(b=>b.size), 1);
  const fmt = (p) => base < 10 ? p.toFixed(4) : p.toLocaleString();

  return (
    <div className="order-book">
      <div className="ob-title">Order Book</div>
      <div className="ob-head"><span>Price</span><span>Size</span></div>
      <div className="ob-asks">
        {book.asks.map((a,i) => (
          <div key={i} className="ob-row ask">
            <div className="ob-fill ask-fill" style={{width:`${(a.size/maxSize)*100}%`}} />
            <span className="ob-price ask-price">{fmt(a.price)}</span>
            <span className="ob-size">{a.size}</span>
          </div>
        ))}
      </div>
      <div className="ob-spread">
        <span className="ob-mid">{fmt(base)}</span>
        <span className="ob-spread-val">Mark</span>
      </div>
      <div className="ob-bids">
        {book.bids.map((b,i) => (
          <div key={i} className="ob-row bid">
            <div className="ob-fill bid-fill" style={{width:`${(b.size/maxSize)*100}%`}} />
            <span className="ob-price bid-price">{fmt(b.price)}</span>
            <span className="ob-size">{b.size}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
