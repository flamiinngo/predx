/**
 * Time-weighted fair-value odds for binary price markets.
 *
 * Why sensitivity=60:
 *   BTC price moves ~0.05-0.3% per minute. Raw percentage is tiny.
 *   We scale it up so the displayed odds feel responsive to real price action:
 *
 *   0.05% move (small tick):  at t=0 →  +3pts | t=50% → +9pts | t=90% → +27pts
 *   0.1%  move (clear move):  at t=0 →  +6pts | t=50% → +18pts | t=90% → +48pts (capped)
 *   0.3%  move (strong move): at t=0 → +18pts | t=50% → +48pts (capped)
 *
 * This mimics binary option mark-to-market:
 *   - Early in the candle: price signal is noise → modest odds shift
 *   - Near expiry: price vs strike is highly predictive → large odds shift
 *   - Last 10 seconds with price clearly above strike → HIGHER ~80-95%
 */
export function calcLiveOdds({ baseOdds, livePrice, strikePrice, endTime, startTime }) {
  if (!strikePrice || !livePrice || !endTime || !startTime) return baseOdds ?? 50;

  const now      = Date.now();
  const duration = endTime - startTime;
  const elapsed  = now - startTime;
  const progress = Math.max(0, Math.min(1, elapsed / duration));

  // Price deviation from strike as a raw percentage
  const priceDelta = ((livePrice - strikePrice) / strikePrice) * 100;

  // Sensitivity: scales priceDelta so small BTC/ETH moves register meaningfully.
  // 0.1% move = 6 base points, which then gets amplified by time.
  const SENSITIVITY = 60;

  // Quadratic time amplifier: 1x at open → ~9x at expiry
  // Makes the market feel increasingly decisive as time runs out
  const amplifier = 1 + Math.pow(progress, 2) * 8;

  const priceSignal = Math.max(-48, Math.min(48, priceDelta * SENSITIVITY * amplifier));

  return Math.max(2, Math.min(98, Math.round((baseOdds ?? 50) + priceSignal)));
}
