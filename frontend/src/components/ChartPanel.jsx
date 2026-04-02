import { useEffect, useRef } from "react";
import { createChart } from "lightweight-charts";
import "./ChartPanel.css";

const BASE = { BTC: 83241, ETH: 1842, INIT: 1.47 };

function genCandles(base, count = 60) {
  const out = [];
  let p = base;
  const now = Math.floor(Date.now() / 1000);
  for (let i = count; i >= 0; i--) {
    const o = p;
    const c = Math.max(base * 0.9, o + (Math.random() - 0.49) * base * 0.008);
    const h = Math.max(o, c) + Math.random() * base * 0.002;
    const l = Math.min(o, c) - Math.random() * base * 0.002;
    out.push({ time: now - i * 60, open: +o.toFixed(2), high: +h.toFixed(2), low: +Math.max(0.01,l).toFixed(2), close: +c.toFixed(2) });
    p = c;
  }
  return out;
}

export default function ChartPanel({ market }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current) return;
    const base = BASE[market.symbol] || 100;
    const candles = genCandles(base);

    const chart = createChart(ref.current, {
      width: ref.current.clientWidth,
      height: 300,
      layout: { background: { color: "#0d1117" }, textColor: "#8b949e" },
      grid: { vertLines: { color: "#161b22" }, horzLines: { color: "#161b22" } },
      crosshair: { vertLine: { labelBackgroundColor: "#6366f1" }, horzLine: { labelBackgroundColor: "#6366f1" } },
      rightPriceScale: { borderColor: "#30363d" },
      timeScale: { borderColor: "#30363d", timeVisible: true },
    });

    const series = chart.addCandlestickSeries({
      upColor: "#3fb950", downColor: "#f85149",
      borderUpColor: "#3fb950", borderDownColor: "#f85149",
      wickUpColor: "#3fb950", wickDownColor: "#f85149",
    });

    series.setData(candles);
    chart.timeScale().fitContent();

    series.createPriceLine({
      price: candles[0].close, color: "#8b5cf6",
      lineWidth: 1, lineStyle: 2,
      axisLabelVisible: true, title: "strike",
    });

    const ticker = setInterval(() => {
      const last = candles[candles.length - 1];
      const nc = +Math.max(base * 0.9, last.close + (Math.random() - 0.49) * base * 0.002).toFixed(2);
      const upd = { time: last.time, open: last.open, high: +Math.max(last.high, nc).toFixed(2), low: +Math.min(last.low, nc).toFixed(2), close: nc };
      candles[candles.length - 1] = upd;
      series.update(upd);
    }, 1000);

    const ro = new ResizeObserver(() => { chart.applyOptions({ width: ref.current?.clientWidth }); });
    ro.observe(ref.current);

    return () => { clearInterval(ticker); ro.disconnect(); chart.remove(); };
  }, [market.symbol]);

  const p = BASE[market.symbol];
  return (
    <div className="chart-panel">
      <div className="cp-header">
        <div className="cp-left">
          <span className="cp-sym">{market.symbol}/USDC</span>
          <span className="cp-tf">{market.timeframe}</span>
          <span className="cp-strike">Strike ${p?.toLocaleString()}</span>
        </div>
        <span className="cp-open">● OPEN</span>
      </div>
      <div ref={ref} />
    </div>
  );
}
