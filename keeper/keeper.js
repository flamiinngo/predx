import { ethers } from "ethers";
import dotenv from "dotenv";
dotenv.config();

const RPC_URL         = process.env.RPC_URL         || "http://localhost:8545";
const REST_URL        = process.env.REST_URL         || "http://localhost:1317";
const PRIVATE_KEY     = process.env.KEEPER_KEY;
const SLTP_ADDR       = process.env.SLTP_ADDRESS;
const SETTLEMENT_ADDR = process.env.SETTLEMENT_ADDRESS;
const FACTORY_ADDR    = process.env.FACTORY_ADDRESS;
const PM_ADDR         = process.env.PM_ADDRESS       || "0x4C7f26ca1B2692e362c00BC02cD997281dd355F7";
const USDC_ADDR       = process.env.USDC_ADDRESS     || "0x8b0F7f39d7d4238e9474a2c59013DBc34a87999d";

if (!PRIVATE_KEY || !SLTP_ADDR || !SETTLEMENT_ADDR || !FACTORY_ADDR) {
  console.error("Missing env vars.");
  process.exit(1);
}

const SETTLEMENT_ABI = [
  "function settleExpiredMarkets() external",
  "function bootstrapMarkets() external",
  "event MarketSettled(uint256 indexed marketId, string symbol, bool higherWon, uint256 settlementPrice, uint256 totalPayout, uint256 winnerCount)",
];
const FACTORY_ABI = [
  "function getActiveMarketId(string symbol, uint8 tf) external view returns (uint256)",
  "function getMarket(uint256 id) external view returns (tuple(uint256 id,string symbol,uint8 timeframe,uint256 startTime,uint256 endTime,uint256 strikePrice,bool settled,bool higherWon,uint256 totalHigher,uint256 totalLower))",
  "function getHigherProbability(uint256 marketId) external view returns (uint256 bps)",
];
const ORACLE_ABI = [
  "function updatePrices(uint256,uint256,uint256) external",
  "function setConnectOracle(address) external",
  "function connectOracle() external view returns (address)",
  "function isNativeActive(string) external view returns (bool)",
  "function oracleSource(string) external view returns (string)",
];
const ORACLE_ADDR = process.env.ORACLE_ADDRESS || "0xfb98bf3418eb41b008ca7621db973ec364a06cf7";

const SLTP_ABI = [
  "function checkAndExecute() external",
  "function getActiveOrderCount() external view returns (uint256)",
];
const PM_ABI = [
  "function openPosition(uint256 marketId, bool higher, uint256 size, uint256 slPrice, uint256 tpPrice) external returns (uint256)",
];
const USDC_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function balanceOf(address) external view returns (uint256)",
  "function mint(address to, uint256 amount) external",
];
const VAULT_ABI = [
  "function deposit(uint256 amount) external",
  "function getVaultBalance() external view returns (uint256)",
  "function approve(address spender, uint256 amount) external returns (bool)",
];

const VAULT_ADDR = process.env.VAULT_ADDRESS || "";

const provider      = new ethers.JsonRpcProvider(RPC_URL);
const _walletBase   = new ethers.Wallet(PRIVATE_KEY, provider);
const wallet        = new ethers.NonceManager(_walletBase);
const SEEDER_KEY    = process.env.SEEDER_KEY || PRIVATE_KEY;
const _seederBase   = new ethers.Wallet(SEEDER_KEY, provider);
const seederWallet  = new ethers.NonceManager(_seederBase);
const SEEDER_ADDR   = _seederBase.address;
const oracle     = new ethers.Contract(ORACLE_ADDR,     ORACLE_ABI,     wallet);
const settlement = new ethers.Contract(SETTLEMENT_ADDR, SETTLEMENT_ABI, wallet);
const factory    = new ethers.Contract(FACTORY_ADDR,    FACTORY_ABI,    wallet);
const sltp       = new ethers.Contract(SLTP_ADDR,       SLTP_ABI,       wallet);
const pm         = new ethers.Contract(PM_ADDR,         PM_ABI,         wallet);
const usdcSeeder = new ethers.Contract(USDC_ADDR,       USDC_ABI,       seederWallet);
const usdc       = new ethers.Contract(USDC_ADDR,       USDC_ABI,       wallet);
const vault      = VAULT_ADDR ? new ethers.Contract(VAULT_ADDR, VAULT_ABI, seederWallet) : null;

const SYMBOLS    = ["BTC", "ETH", "INIT"];
const TIMEFRAMES = [0, 1, 2];  // 1min, 5min, 15min
const TF_LABELS  = ["1min", "5min", "15min"]; // indexed by timeframe enum value

// Ensure keeper has infinite USDC approval for seeding
async function ensureApproval() {
  try {
    // Mint USDC to keeper in case balance is low (MockUSDC has no access control on mint)
    const keeperBal = await usdc.balanceOf(wallet.address);
    if (keeperBal < ethers.parseUnits("10000", 6)) {
      console.log("[SEED] Minting USDC to keeper...");
      const mintTx = await usdc.mint(wallet.address, ethers.parseUnits("10000000", 6), { gasLimit: 500_000 });
      await mintTx.wait();
      console.log("[SEED] ✓ Minted 10M USDC to keeper.");
    }

    const keeperAllowance = await usdc.allowance(wallet.address, PM_ADDR);
    if (keeperAllowance < ethers.parseUnits("1000000", 6)) {
      console.log("[SEED] Approving keeper USDC → PM...");
      const tx = await usdc.approve(PM_ADDR, ethers.MaxUint256, { gasLimit: 500_000 });
      await tx.wait();
      console.log("[SEED] ✓ Keeper USDC approved for PM.");
    } else {
      console.log(`[SEED] Keeper allowance OK (${ethers.formatUnits(keeperAllowance, 6)} USDC)`);
    }
  } catch (err) {
    console.error("[SEED] ensureApproval failed (non-fatal):", err.message?.slice(0, 200));
  }

  // Also approve vault for LP deposits (seeder wallet)
  if (vault) {
    try {
      const vaultAllowance = await usdcSeeder.allowance(SEEDER_ADDR, VAULT_ADDR);
      if (vaultAllowance < ethers.parseUnits("1000000", 6)) {
        const tx = await usdcSeeder.approve(VAULT_ADDR, ethers.MaxUint256, { gasLimit: 500_000 });
        await tx.wait();
        console.log("[SEED] Approved USDC for vault deposits.");
      }
    } catch (err) {
      console.error("[SEED] Vault approval failed (non-fatal):", err.message?.slice(0, 120));
    }
  }
}

// Fund vault with LP liquidity so it can cover winner payouts.
// The settlement contract pays winners FROM the vault before receiving
// losers' funds — so vault needs a substantial USDC reserve.
const VAULT_MIN_BALANCE = ethers.parseUnits("5000", 6);  // $5,000 minimum
const VAULT_TOP_UP      = ethers.parseUnits("10000", 6); // top up to $10,000

// vault contract connected to keeper wallet for deposits
const vaultKeeper = VAULT_ADDR ? new ethers.Contract(VAULT_ADDR, VAULT_ABI, wallet) : null;

async function fundVault() {
  if (!vaultKeeper || !VAULT_ADDR) return;
  try {
    const bal = await usdc.balanceOf(VAULT_ADDR);
    if (bal >= VAULT_MIN_BALANCE) {
      console.log(`[VAULT] Balance $${(Number(bal)/1e6).toFixed(0)} — OK`);
      return;
    }
    const needed = VAULT_TOP_UP - bal;
    console.log(`[VAULT] Low balance $${(Number(bal)/1e6).toFixed(0)} — depositing $${(Number(needed)/1e6).toFixed(0)} USDC from keeper...`);

    // Ensure keeper has enough USDC (mint if needed — MockUSDC has no access control)
    const keeperBal = await usdc.balanceOf(wallet.address);
    if (keeperBal < needed) {
      const mintTx = await usdc.mint(wallet.address, needed * 10n, { gasLimit: 500_000 });
      await mintTx.wait();
      console.log(`[VAULT] Minted USDC to keeper for vault`);
    }

    // Approve vault to pull from keeper if needed
    const vaultAllow = await usdc.allowance(wallet.address, VAULT_ADDR);
    if (vaultAllow < needed) {
      const approveTx = await usdc.approve(VAULT_ADDR, ethers.MaxUint256, { gasLimit: 500_000 });
      await approveTx.wait();
    }

    const tx = await vaultKeeper.deposit(needed, { gasLimit: 300_000 });
    await tx.wait();
    const newBal = await usdc.balanceOf(VAULT_ADDR);
    console.log(`[VAULT] ✓ Funded — vault balance now $${(Number(newBal)/1e6).toFixed(0)} USDC`);
  } catch (err) {
    console.error("[VAULT] Fund failed:", err.message?.slice(0, 200));
  }
}

// Seed both sides of a market so odds stay near 50/50
async function seedMarket(marketId, symbol) {
  try {
    const m      = await factory.getMarket(marketId);
    const totalPool = Number(m.totalHigher) + Number(m.totalLower);
    const bps    = await factory.getHigherProbability(marketId);
    const higher = Number(bps);

    // Seed empty pools with both sides to bootstrap liquidity
    if (totalPool === 0) {
      const sizeH = BigInt((Math.floor(Math.random() * 100) + 150) * 1_000_000);
      const sizeL = BigInt((Math.floor(Math.random() * 100) + 150) * 1_000_000);
      const tx1 = await pm.openPosition(marketId, true,  sizeH, 0n, 0n, { gasLimit: 500_000 });
      await tx1.wait();
      const tx2 = await pm.openPosition(marketId, false, sizeL, 0n, 0n, { gasLimit: 500_000 });
      await tx2.wait();
      console.log(`[SEED] ${symbol} market ${marketId} — bootstrapped $${sizeH/1000000n} HIGHER + $${sizeL/1000000n} LOWER`);
      return;
    }

    // Rebalance if heavily skewed (>75% or <25%)
    if (higher > 7500) {
      // Too many HIGHER — add LOWER to rebalance
      const randomSize = BigInt((Math.floor(Math.random() * 50) + 50) * 1_000_000);
      const tx = await pm.openPosition(marketId, false, randomSize, 0n, 0n, { gasLimit: 500_000 });
      await tx.wait();
      console.log(`[SEED] ${symbol} market ${marketId} — rebalanced +$${randomSize/1000000n} LOWER (was ${higher/100}% higher)`);
    } else if (higher < 2500) {
      // Too many LOWER — add HIGHER to rebalance
      const randomSize = BigInt((Math.floor(Math.random() * 50) + 50) * 1_000_000);
      const tx = await pm.openPosition(marketId, true, randomSize, 0n, 0n, { gasLimit: 500_000 });
      await tx.wait();
      console.log(`[SEED] ${symbol} market ${marketId} — rebalanced +$${randomSize/1000000n} HIGHER (was ${higher/100}% higher)`);
    }
  } catch (err) {
    console.error(`[SEED] Failed for market ${marketId}:`, err.message);
  }
}

// In the final seconds before expiry, the pool odds must reflect reality.
// If BTC is clearly above strike with 10s left, HIGHER probability is near 100%
// but the pool might still be 50/50. We seed the winning side aggressively so
// payout shrinks to fair value — preventing last-second "free money" bets.
async function dynamicRebalance() {
  const now = BigInt(Math.floor(Date.now() / 1000));
  for (const sym of SYMBOLS) {
    for (const tf of TIMEFRAMES) {
      try {
        const mid = await factory.getActiveMarketId(sym, tf);
        if (mid === 0n) continue;
        const market = await factory.getMarket(mid);
        if (market.settled) continue;
        const secsLeft = Number(market.endTime - now);
        if (secsLeft > 45 || secsLeft <= 0) continue; // only last 45s

        // Fetch current price from oracle (already pushed by syncPrices)
        const ORACLE_READ_ABI = ["function getPrice(string) external view returns (uint256)"];
        const oracleRead = new ethers.Contract(ORACLE_ADDR, ORACLE_READ_ABI, wallet);
        const rawPrice   = await oracleRead.getPrice(sym);
        const curPrice   = Number(rawPrice) / 1e18;
        const strike     = Number(market.strikePrice) / 1e18;
        if (strike === 0 || curPrice === 0) continue;

        const priceDelta = (curPrice - strike) / strike * 100; // % deviation
        // Same formula as frontend calcLiveOdds (sensitivity=60, amplifier quadratic)
        const elapsed   = 45 - secsLeft;
        const progress  = Math.min(1, elapsed / 45);
        const amp       = 1 + Math.pow(progress, 2) * 8;
        const signal    = Math.max(-48, Math.min(48, priceDelta * 60 * amp));
        // signal > 0 → HIGHER is winning; signal < 0 → LOWER is winning
        if (Math.abs(signal) < 8) continue; // not decisive enough to act

        const rawH = Number(market.totalHigher); // in USDC 6-dec
        const rawL = Number(market.totalLower);
        const totalPool = rawH + rawL;
        if (totalPool === 0) continue;

        // Target: push pool ratio to match the signal
        // e.g. signal=40 → target 90% on winning side
        const targetWinningPct = Math.min(88, 50 + signal); // cap at 88%
        const winningIsHigher  = signal > 0;
        const winningPool = winningIsHigher ? rawH : rawL;
        const losingPool  = winningIsHigher ? rawL  : rawH;

        // How much do we need to add to winning side to reach targetWinningPct?
        // winningPool + add  / (totalPool + add) = targetPct/100
        // Solving: add = (targetPct * totalPool - 100 * winningPool) / (100 - targetPct)
        const tgt = targetWinningPct / 100;
        const needed = Math.round((tgt * totalPool - winningPool) / (1 - tgt));
        if (needed <= 1_000_000) continue; // less than $1 needed — skip
        const seedAmt = BigInt(Math.min(needed, 500_000_000)); // cap at $500 per rebalance

        console.log(`[DYNB] ${sym} ${secsLeft}s left — price ${priceDelta >= 0 ? "+" : ""}${priceDelta.toFixed(2)}% → seeding $${Number(seedAmt)/1e6} ${winningIsHigher ? "HIGHER" : "LOWER"} (target ${targetWinningPct.toFixed(0)}%)`);
        const tx = await pm.openPosition(mid, winningIsHigher, seedAmt, 0n, 0n, { gasLimit: 500_000 });
        await tx.wait();
      } catch (err) {
        // Non-fatal — skip this market if rebalance fails
      }
    }
  }
}

async function checkSLTP() {
  try {
    const count = await sltp.getActiveOrderCount();
    if (count === 0n) return;
    const tx = await sltp.checkAndExecute({ gasLimit: 500_000 });
    await tx.wait();
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
    const tx      = await settlement.settleExpiredMarkets({ gasLimit: 3_000_000 });
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

const seededMarkets = new Set();
// Prevent unbounded memory growth — keep only the last 200 market IDs
function trackSeeded(id) {
  seededMarkets.add(id);
  if (seededMarkets.size > 200) {
    seededMarkets.delete(seededMarkets.values().next().value);
  }
}

async function checkSeeding() {
  for (const sym of SYMBOLS) {
    for (const tf of TIMEFRAMES) {
      try {
        const mid = await factory.getActiveMarketId(sym, tf);
        if (mid === 0n) continue;
        // Only seed each market once
        if (seededMarkets.has(mid.toString())) continue;
        const market = await factory.getMarket(mid);
        if (market.settled) continue;
        const now = BigInt(Math.floor(Date.now() / 1000));
        if (market.endTime - now < 10n) continue;
        await seedMarket(mid, sym);
        trackSeeded(mid.toString());
      } catch {}
    }
  }
}

async function logStatus() {
  for (const sym of SYMBOLS) {
    const mid = await factory.getActiveMarketId(sym, 0);
    if (mid === 0n) continue;
    const rem = await factory.getMarket(mid);
    const now = BigInt(Math.floor(Date.now() / 1000));
    const left = rem.endTime > now ? rem.endTime - now : 0n;
    const bps  = await factory.getHigherProbability(mid);
    console.log(`[INFO] ${sym} 1-min — ${left}s remaining — ${Number(bps)/100}% higher`);
  }
}

async function syncPrices() {
  try {
    const res  = await fetch("https://api.binance.com/api/v3/ticker/price?symbols=[%22BTCUSDT%22,%22ETHUSDT%22,%22INITUSDT%22]");
    const data = await res.json();
    const px   = {};
    for (const { symbol, price } of data) px[symbol] = parseFloat(price);
    const tx = await oracle.updatePrices(
      ethers.parseEther(px.BTCUSDT.toFixed(8)),
      ethers.parseEther(px.ETHUSDT.toFixed(8)),
      ethers.parseEther(px.INITUSDT.toFixed(8)),
      { gasLimit: 150000 }
    );
    await tx.wait();
    console.log(`[PRICE] BTC $${px.BTCUSDT.toFixed(2)} | ETH $${px.ETHUSDT.toFixed(2)} | INIT $${px.INITUSDT.toFixed(4)}`);
  } catch (err) {
    console.error("[PRICE] Failed:", err.message);
  }
}

/// Try to wire the Initia native ConnectOracle precompile into OracleConsumer.
/// This is a one-shot call on startup — if it fails (local dev), we fall back to
/// keeper-pushed prices from Binance.
async function wireNativeOracle() {
  try {
    const res  = await fetch(`${REST_URL}/minievm/evm/v1/connect_oracle`);
    const data = await res.json();
    const addr = data?.address;
    if (!addr || addr === "0x0000000000000000000000000000000000000000") {
      console.log("[ORACLE] ConnectOracle not available on this chain — using fallback");
      return;
    }
    console.log(`[ORACLE] ConnectOracle precompile found at ${addr}`);
    // Check if already wired to this address
    const current = await oracle.connectOracle();
    if (current.toLowerCase() === addr.toLowerCase()) {
      console.log("[ORACLE] Already wired — skipping setConnectOracle");
    } else {
      const tx = await oracle.setConnectOracle(addr, { gasLimit: 100_000 });
      await tx.wait();
      console.log("[ORACLE] ✓ Native oracle wired — Band Protocol prices active");
    }
    // Verify
    const src = await oracle.oracleSource("BTC");
    console.log(`[ORACLE] BTC price source: ${src}`);
  } catch (err) {
    console.log(`[ORACLE] Could not wire native oracle (${err.message?.slice(0, 60)}) — using keeper fallback`);
  }
}

// ─── Chain health check ────────────────────────────────────────────────────
// Tracks whether the chain RPC was unreachable last tick. When the chain comes
// back we reset NonceManagers (so stale in-memory nonces don't cause sequence
// mismatch) and clear seededMarkets (so new markets get seeded fresh).
let chainWasDown = false;
let rpcFailures  = 0;

async function checkChainHealth() {
  try {
    await provider.getBlockNumber();
    if (chainWasDown) {
      console.log("[RPC] Chain back online — resetting nonce managers & re-seeding");
      wallet.reset();
      seederWallet.reset();
      seededMarkets.clear();
      chainWasDown = false;
      rpcFailures  = 0;
      // Re-run startup tasks after recovery
      await ensureApproval();
      await ensureMarketsExist();
    }
    return true;
  } catch (err) {
    rpcFailures++;
    chainWasDown = true;
    if (rpcFailures === 1 || rpcFailures % 12 === 0) {
      console.log(`[RPC] Chain unreachable (attempt ${rpcFailures}) — pausing until recovery`);
    }
    return false;
  }
}

// If no active market exists for any symbol (e.g. after a long outage where
// markets expired and settlement never ran) bootstrap all 9 markets fresh.
async function ensureMarketsExist() {
  try {
    // First try settling any expired-but-unsettled markets
    await checkSettlements();

    // Check if we still have no active markets
    let anyActive = false;
    for (const sym of SYMBOLS) {
      const mid = await factory.getActiveMarketId(sym, 0);
      if (mid !== 0n) { anyActive = true; break; }
    }
    if (anyActive) return;

    console.log("[BOOT] No active markets — bootstrapping all symbols/timeframes...");
    const tx = await settlement.bootstrapMarkets({ gasLimit: 2_000_000 });
    await tx.wait();
    console.log("[BOOT] ✓ Markets bootstrapped");
    seededMarkets.clear(); // seed the freshly created markets
  } catch (err) {
    console.error("[BOOT] Bootstrap failed (non-fatal):", err.message?.slice(0, 150));
  }
}

async function run() {
  console.log("PredX Keeper starting...");
  console.log(`Wallet : ${wallet.address}`);
  console.log(`RPC    : ${RPC_URL}`);
  console.log(`REST   : ${REST_URL}`);
  console.log("─────────────────────────────────────");

  // Wire Initia native oracle (non-blocking — falls back to Binance push)
  await wireNativeOracle();

  await ensureApproval();
  await fundVault();          // ensure vault has enough USDC before any settlement
  await ensureMarketsExist(); // settle stale markets / bootstrap if none exist

  let tick    = 0;
  let running = false;  // prevent concurrent ticks causing nonce collisions
  setInterval(async () => {
    if (running) return;
    running = true;
    tick++;
    try {
      // Health check first — skip all work if chain is down, reset on recovery
      if (!(await checkChainHealth())) return;

      await checkSLTP();
      await dynamicRebalance();         // every tick — markets near expiry need fast response
      if (tick % 2 === 0) await checkSettlements();
      if (tick % 3 === 0) await syncPrices();
      if (tick % 4 === 0) await checkSeeding();
      if (tick % 12 === 0) await logStatus();
      if (tick % 30 === 0) await ensureMarketsExist(); // safety net: re-check every 2.5 min
      if (tick % 60 === 0) await fundVault();
    } finally {
      running = false;
    }
  }, 5000);
}

// ─── Process-level crash guards ───────────────────────────────────────────
// Prevent any unhandled rejection or exception from killing the process.
// The tick loop already wraps everything in try/catch — these are a last resort.
process.on("uncaughtException", (err) => {
  console.error("[FATAL] Uncaught exception (continuing):", err.message);
});
process.on("unhandledRejection", (reason) => {
  console.error("[FATAL] Unhandled rejection (continuing):", reason?.message ?? reason);
});

run().catch((err) => {
  // run() itself threw — log and restart the loop after 10s
  console.error("[FATAL] run() crashed — restarting in 10s:", err.message);
  setTimeout(() => run().catch(console.error), 10_000);
});
