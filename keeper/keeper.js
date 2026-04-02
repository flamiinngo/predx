import { ethers } from "ethers";
import { readFileSync } from "fs";
import dotenv from "dotenv";
dotenv.config();

const RPC_URL         = process.env.RPC_URL         || "http://localhost:8545";
const PRIVATE_KEY     = process.env.KEEPER_KEY;
const SLTP_ADDR       = process.env.SLTP_ADDRESS;
const SETTLEMENT_ADDR = process.env.SETTLEMENT_ADDRESS;
const FACTORY_ADDR    = process.env.FACTORY_ADDRESS;

if (!PRIVATE_KEY || !SLTP_ADDR || !SETTLEMENT_ADDR || !FACTORY_ADDR) {
  console.error("Missing env vars. Copy keeper/.env.example to keeper/.env and fill it in.");
  process.exit(1);
}

const SLTP_ABI = [
  "function checkAndExecute() external",
  "function getActiveOrderCount() external view returns (uint256)",
  "event StopLossTriggered(uint256 indexed positionId, uint256 currentPrice)",
  "event TakeProfitTriggered(uint256 indexed positionId, uint256 currentPrice)"
];

const SETTLEMENT_ABI = [
  "function settleExpiredMarkets() external",
  "event MarketSettled(uint256 indexed marketId, string symbol, bool higherWon, uint256 settlementPrice, uint256 totalPayout, uint256 winnerCount)"
];

const FACTORY_ABI = [
  "function getActiveMarketId(string symbol, uint8 tf) external view returns (uint256)",
  "function getMarket(uint256 id) external view returns (tuple(uint256 id, string symbol, uint8 timeframe, uint256 startTime, uint256 endTime, uint256 strikePrice, bool settled, bool higherWon, uint256 totalHigher, uint256 totalLower))",
  "function getTimeRemaining(uint256 marketId) external view returns (uint256)"
];

const provider   = new ethers.JsonRpcProvider(RPC_URL);
const wallet     = new ethers.Wallet(PRIVATE_KEY, provider);
const sltp       = new ethers.Contract(SLTP_ADDR, SLTP_ABI, wallet);
const settlement = new ethers.Contract(SETTLEMENT_ADDR, SETTLEMENT_ABI, wallet);
const factory    = new ethers.Contract(FACTORY_ADDR, FACTORY_ABI, wallet);

const SYMBOLS    = ["BTC", "ETH", "INIT"];
const TIMEFRAMES = [0, 1, 2];
const TF_LABELS  = ["1min", "5min", "15min"];

async function checkSLTP() {
  try {
    const count = await sltp.getActiveOrderCount();
    if (count === 0n) return;
    console.log(`[SLTP] ${count} active orders — checking...`);
    const tx      = await sltp.checkAndExecute({ gasLimit: 500_000 });
    const receipt = await tx.wait();
    for (const log of receipt.logs) {
      try {
        const parsed = sltp.interface.parseLog(log);
        if (parsed?.name === "StopLossTriggered")
          console.log(`[SLTP] Stop loss  — pos ${parsed.args.positionId} @ ${ethers.formatUnits(parsed.args.currentPrice, 18)}`);
        if (parsed?.name === "TakeProfitTriggered")
          console.log(`[SLTP] Take profit — pos ${parsed.args.positionId} @ ${ethers.formatUnits(parsed.args.currentPrice, 18)}`);
      } catch {}
    }
  } catch (err) {
    console.error("[SLTP] Error:", err.message);
  }
}

async function checkSettlements() {
  try {
    let anyExpired = false;
    const now = BigInt(Math.floor(Date.now() / 1000));
    for (const sym of SYMBOLS) {
      for (const tf of TIMEFRAMES) {
        const mid = await factory.getActiveMarketId(sym, tf);
        if (mid === 0n) continue;
        const market = await factory.getMarket(mid);
        if (!market.settled && now >= market.endTime) {
          anyExpired = true;
          console.log(`[SETTLE] Expired — ${sym} ${TF_LABELS[tf]} market ${mid}`);
        }
      }
    }
    if (!anyExpired) return;
    console.log("[SETTLE] Settling expired markets...");
    const tx      = await settlement.settleExpiredMarkets({ gasLimit: 2_000_000 });
    const receipt = await tx.wait();
    for (const log of receipt.logs) {
      try {
        const parsed = settlement.interface.parseLog(log);
        if (parsed?.name === "MarketSettled") {
          const { marketId, symbol, higherWon, settlementPrice, totalPayout, winnerCount } = parsed.args;
          console.log(
            `[SETTLE] Market ${marketId} — ${symbol} — ${higherWon ? "HIGHER" : "LOWER"} won` +
            ` — price ${ethers.formatUnits(settlementPrice, 18)}` +
            ` — ${winnerCount} winners — payout ${ethers.formatUnits(totalPayout, 6)} USDC`
          );
        }
      } catch {}
    }
  } catch (err) {
    console.error("[SETTLE] Error:", err.message);
  }
}

async function logStatus() {
  for (const sym of SYMBOLS) {
    const mid = await factory.getActiveMarketId(sym, 0);
    if (mid === 0n) continue;
    const rem = await factory.getTimeRemaining(mid);
    console.log(`[INFO] ${sym} 1-min — ${rem}s remaining`);
  }
}

async function run() {
  console.log("PredX Keeper starting...");
  console.log(`Wallet : ${wallet.address}`);
  console.log(`RPC    : ${RPC_URL}`);
  console.log("─────────────────────────────────────");

  let tick = 0;
  setInterval(async () => {
    tick++;
    await checkSLTP();
    if (tick % 2 === 0) await checkSettlements();
    if (tick % 12 === 0) await logStatus();
  }, 5000);
}

run().catch(console.error);
