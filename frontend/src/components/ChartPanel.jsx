import { useEffect, useRef, useState } from "react";
import { createChart } from "lightweight-charts";
import { useCountdown } from "../hooks/useCountdown";
import "./ChartPanel.css";

const TF_SECONDS  = { "1m": 60,  "5m": 300,  "15m": 900 };
const TF_CANDLES  = { "1m": 80,  "5m": 60,   "15m": 40  };
const TF_LABELS   = { "1m": "1 minute", "5m": "5 minutes", "15m": "15 minutes" };
const TF_VOL      = { "1m": 0.012, "5m": 0.009, "15m": 0.006 };

function genCandles(base, tf, count) {
  const out = [];
  let p          = base;
  const now      = Math.floor(Date.now() / 1000);
  const interval = TF_SECONDS[tf] || 60;
  const decimals = base < 10 ? 4 : 2;
  const vol      = TF_VOL[tf] || 0.006;

  for (let i = count; i >= 0; i--) {
    const o = p;
    const c = Math.max(base * 0.85, o + (Math.random() - 0.49) * base * vol);
    const h = Math.max(o, c) + Math.random() * base * 0.002;
    const l = Math.min(o, c) - Math.random() * base * 0.002;
    out.push({
      time:  now - i * interval,
      open:  parseFloat(o.toFixed(decimals)),
      high:  parseFloat(h.toFixed(decimals)),
      low:   parseFloat(Math.max(0.0001, l).toFixed(decimals)),
      close: parseFloat(c.toFixed(decimals)),
    });
    p = c;
  }
  return out;
}

export default function ChartPanel({ market, livePrice: externalPrice }) {
  const ref           = useRef(null);
  const remaining     = useCountdown(market.endTime);
  const base          = externalPrice || market.price || 83241;
  const [currentPrice, setCurrentPrice] = useState(base);

  useEffect(() => {
    if (externalPrice) setCurrentPrice(externalPrice);
  }, [externalPrice]);

  useEffect(() => {
    if (!ref.current) return;
    const tf       = market.timeframe || "1m";
    const decimals = base < 10 ? 4 : 2;
    const count    = TF_CANDLES[tf] || 80;
    const candles  = genCandles(base, tf, count);

    const chart = createChart(ref.current, {
      width:  ref.current.clientWidth,
      height: 340,
      layout: { background: { color: "#0d1117" }, textColor: "#8b949e", fontSize: 11 },
      grid:   { vertLines: { color: "#161b22" }, horzLines: { color: "#161b22" } },
      crosshair: {
        vertLine: { color: "#6366f1", labelBackgroundColor: "#6366f1" },
        horzLine: { color: "#6366f1", labelBackgroundColor: "#6366f1" },
      },
      rightPriceScale: { borderColor: "#21262d", scaleMargins: { top: 0.06, bottom: 0.1 } },
      timeScale: { borderColor: "#21262d", timeVisible: true, secondsVisible: tf === "1m", rightOffset: 12 },
      localization: {
        priceFormatter: (p) => base < 10 ? `$${p.toFixed(4)}` : `$${p.toLocaleString()}`,
      },
    });

    const series = chart.addCandlestickSeries({
      upColor: "#3fb950", downColor: "#f85149",
      borderUpColor: "#3fb950", borderDownColor: "#f85149",
      wickUpColor: "#3fb950", wickDownColor: "#f85149",
      priceFormat: { type: "price", precision: decimals, minMove: base < 10 ? 0.0001 : 0.01 },
    });

    series.setData(candles);
    chart.timeScale().fitContent();

    series.createPriceLine({
      price: candles[0].close, color: "#8b5cf6",
      lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: "strike",
    });

    const volSeries = chart.addHistogramSeries({
      priceFormat: { type: "volume" }, priceScaleId: "vol",
      scaleMargins: { top: 0.85, bottom: 0 },
    });
    volSeries.setData(candles.map(c => ({
      time: c.time, value: Math.random() * base * 0.3,
      color: c.close >= c.open ? "#3fb95025" : "#f8514925",
    })));

    const tickMs = tf === "1m" ? 1000 : tf === "5m" ? 2000 : 3000;
    const ticker = setInterval(() => {
      const last = candles[candles.length - 1];
      const nc   = parseFloat(
        Math.max(base * 0.85, last.close + (Math.random() - 0.49) * base * 0.0015).toFixed(decimals)
      );
      const upd = {
        time: last.time, open: last.open,
        high: parseFloat(Math.max(last.high, nc).toFixed(decimals)),
        low:  parseFloat(Math.min(last.low,  nc).toFixed(decimals)),
        close: nc,
      };
      candles[candles.length - 1] = upd;
      series.update(upd);
      setCurrentPrice(nc);
    }, tickMs);

    const ro = new ResizeObserver(() => {
      if (ref.current) chart.applyOptions({ width: ref.current.clientWidth });
    });
    ro.observe(ref.current);

    return () => { clearInterval(ticker); ro.disconnect(); chart.remove(); };
  }, [market.symbol, market.timeframe, base]);

  const decimals = base < 10 ? 4 : 2;
  const fmtP     = (p) => base < 10 ? `$${Number(p).toFixed(4)}` : `$${Number(p).toLocaleString()}`;
  const change   = base ? ((currentPrice - base) / base * 100).toFixed(3) : "0.000";
  const isUp     = currentPrice >= base;

  return (
    <div className="chart-panel">
      <div className="cp-header">
        <div className="cp-left">
          <span className="cp-sym">{market.symbol}/USDC</span>
          <span className="cp-tf">{market.timeframe}</span>
          <div className="cp-price-block">
            <span className="cp-live-price">{fmtP(currentPrice)}</span>
            <span className={`cp-change ${isUp ? "up" : "dn"}`}>{isUp?"+":""}{change}%</span>
          </div>
          <div className="cp-meta">
            <span className="cp-meta-label">Strike</span>
            <span className="cp-meta-val">{fmtP(base)}</span>
          </div>
          <div className="cp-meta">
            <span className="cp-meta-label">Candle</span>
            <span className="cp-meta-val">{TF_LABELS[market.timeframe]}</span>
          </div>
        </div>
        <div className="cp-right">
          <span className="cp-open">● OPEN</span>
          <div className="cp-timer">
            <span className="cp-timer-label">Expires in</span>
            <span className="cp-timer-val">{remaining}</span>
          </div>
        </div>
      </div>
      <div ref={ref} />
    </div>
  );
}
