import { useEffect, useRef, useState } from "react";
import { createChart } from "lightweight-charts";
import { useCountdown } from "../hooks/useCountdown";
import "./ChartPanel.css";

const TF_SECONDS = { "1m": 60, "5m": 300, "15m": 900 };
const TF_LABELS  = { "1m": "1 minute", "5m": "5 minutes", "15m": "15 minutes" };
const TF_MAP     = { "1m": "1m", "5m": "5m", "15m": "15m" };

async function fetchBinanceCandles(symbol, tf) {
  const sym      = symbol === "INIT" ? "INITUSDT" : `${symbol}USDT`;
  const interval = TF_MAP[tf] || "1m";
  const limit    = tf === "1m" ? 80 : tf === "5m" ? 60 : 40;
  const url      = `https://api.binance.com/api/v3/klines?symbol=${sym}&interval=${interval}&limit=${limit}`;
  const res      = await fetch(url);
  const data     = await res.json();
  return data.map(k => ({
    time:  Math.floor(k[0] / 1000),
    open:  parseFloat(k[1]),
    high:  parseFloat(k[2]),
    low:   parseFloat(k[3]),
    close: parseFloat(k[4]),
    volume: parseFloat(k[5]),
  }));
}

export default function ChartPanel({ market, livePrice: externalPrice }) {
  if (!market) return <div className="chart-panel" />;

  const ref           = useRef(null);
  const seriesRef     = useRef(null);
  const remaining     = useCountdown(market?.endTime);
  const base          = externalPrice || market?.price || 68000;
  const [currentPrice, setCurrentPrice] = useState(base);
  const [strikePrice,  setStrikePrice]  = useState(market?.strikePrice || base);

  // Update current price from oracle (passed as externalPrice)
  useEffect(() => {
    if (!externalPrice || !seriesRef.current) return;
    setCurrentPrice(externalPrice);
    // Update last candle close to match oracle price
    const now = Math.floor(Date.now() / 1000);
    const tf  = market?.timeframe || "1m";
    const interval = TF_SECONDS[tf];
    const candleTime = Math.floor(now / interval) * interval;
    seriesRef.current.update({
      time:  candleTime,
      open:  externalPrice,
      high:  externalPrice,
      low:   externalPrice,
      close: externalPrice,
    });
  }, [externalPrice]);

  useEffect(() => {
    if (!ref.current) return;
    const tf       = market?.timeframe || "1m";
    const sym      = market?.symbol || "BTC";
    const decimals = base < 10 ? 4 : 2;

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
    seriesRef.current = series;

    const volSeries = chart.addHistogramSeries({
      priceFormat: { type: "volume" }, priceScaleId: "vol",
      scaleMargins: { top: 0.85, bottom: 0 },
    });

    // Load real Binance candles
    fetchBinanceCandles(sym, tf).then(candles => {
      if (!candles.length) return;
      series.setData(candles);
      volSeries.setData(candles.map(c => ({
        time: c.time, value: c.volume,
        color: c.close >= c.open ? "#3fb95025" : "#f8514925",
      })));
      chart.timeScale().fitContent();

      // Strike price line from on-chain market data
      const strike = market?.strikePrice || candles[0].close;
      setStrikePrice(strike);
      series.createPriceLine({
        price: strike, color: "#8b5cf6",
        lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: "strike",
      });

      setCurrentPrice(externalPrice || candles[candles.length - 1].close);
    }).catch(() => {
      // Fallback: single point if Binance fails
      const now = Math.floor(Date.now() / 1000);
      series.setData([{ time: now, open: base, high: base, low: base, close: base }]);
    });

    // Live candle updates from Binance WebSocket
    const wsSymbol = sym === "INIT" ? "initusdt" : `${sym.toLowerCase()}usdt`;
    const wsTf     = tf;
    const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${wsSymbol}@kline_${wsTf}`);
    ws.onmessage = (e) => {
      const k = JSON.parse(e.data).k;
      series.update({
        time:  Math.floor(k.t / 1000),
        open:  parseFloat(k.o),
        high:  parseFloat(k.h),
        low:   parseFloat(k.l),
        close: parseFloat(k.c),
      });
      volSeries.update({
        time: Math.floor(k.t / 1000), value: parseFloat(k.v),
        color: parseFloat(k.c) >= parseFloat(k.o) ? "#3fb95025" : "#f8514925",
      });
      setCurrentPrice(parseFloat(k.c));
    };

    const ro = new ResizeObserver(() => {
      if (ref.current) chart.applyOptions({ width: ref.current.clientWidth });
    });
    ro.observe(ref.current);

    return () => { ws.close(); ro.disconnect(); chart.remove(); seriesRef.current = null; };
  }, [market?.symbol, market?.timeframe]);

  const decimals    = base < 10 ? 4 : 2;
  const strike      = market?.strikePrice || strikePrice;
  const pct         = strike > 0 ? ((currentPrice - strike) / strike * 100) : 0;
  const fmtP        = (p) => base < 10 ? `$${p.toFixed(4)}` : `$${p.toLocaleString()}`;

  return (
    <div className="chart-panel">
      <div className="cp-header">
        <div className="cp-left">
          <span className="cp-sym">{market?.symbol}/USDC</span>
          <span className="cp-tf">{market?.timeframe}</span>
          <div className="cp-price-block">
            <span className="cp-live-price">{fmtP(currentPrice)}</span>
            <span className={`cp-chg ${pct >= 0 ? "up" : "dn"}`}>
              {pct >= 0 ? "+" : ""}{pct.toFixed(3)}%
            </span>
          </div>
          <span className="cp-meta" style={{ color:"#8b5cf6", fontWeight:700 }}>
            Strike: <span style={{ color:"#c4b5fd" }}>{fmtP(strike)}</span>
          </span>
          <span className="cp-meta">Candle: {TF_LABELS[market?.timeframe]}</span>
        </div>
        <div className="cp-right">
          <span className="cp-status">● OPEN</span>
          <div className="cp-timer-box">
            <div className="cp-timer-label">EXPIRES IN</div>
            <div className={`cp-timer-val ${remaining === "0:00" ? "urgent" : ""}`}>{remaining}</div>
          </div>
        </div>
      </div>
      <div ref={ref} className="cp-canvas" />
    </div>
  );
}
