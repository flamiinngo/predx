/**
 * One-time setup: wire all deployed contracts together.
 * Run this once after fresh deployment:
 *   cd keeper && node setup.js
 *
 * What it does:
 *   vault.setContracts(settlement, sltp, pm, address(0))
 *   pm.setContracts(sltp, vault, settlement)
 *   vault: mint seed USDC liquidity so settlement can cover payouts
 */
import { ethers } from "ethers";
import dotenv from "dotenv";
dotenv.config();

const RPC           = process.env.RPC_URL          || "http://localhost:8545";
const PK            = process.env.KEEPER_KEY;
const VAULT_ADDR    = process.env.VAULT_ADDRESS;
const PM_ADDR       = process.env.PM_ADDRESS;
const SE_ADDR       = process.env.SETTLEMENT_ADDRESS;
const SLTP_ADDR     = process.env.SLTP_ADDRESS;
const USDC_ADDR     = process.env.USDC_ADDRESS;

if (!PK || !VAULT_ADDR || !PM_ADDR || !SE_ADDR || !SLTP_ADDR) {
  console.error("Missing env vars — check keeper/.env");
  process.exit(1);
}

const VAULT_ABI = [
  "function setContracts(address,address,address,address) external",
  "function settlementEngine() external view returns (address)",
  "function positionManager() external view returns (address)",
  "function owner() external view returns (address)",
  "function deposit(uint256) external",
  "function getVaultBalance() external view returns (uint256)",
];
const PM_ABI = [
  "function setContracts(address,address,address) external",
  "function settlementEngine() external view returns (address)",
  "function vault() external view returns (address)",
  "function owner() external view returns (address)",
];
const USDC_ABI = [
  "function mint(address,uint256) external",
  "function approve(address,uint256) external returns (bool)",
  "function balanceOf(address) external view returns (uint256)",
];

const provider = new ethers.JsonRpcProvider(RPC);
const wallet   = new ethers.Wallet(PK, provider);
const vault    = new ethers.Contract(VAULT_ADDR, VAULT_ABI, wallet);
const pm       = new ethers.Contract(PM_ADDR,    PM_ABI,    wallet);
const usdc     = new ethers.Contract(USDC_ADDR,  USDC_ABI,  wallet);

async function setup() {
  console.log("PredX Setup");
  console.log("Wallet:", wallet.address);
  console.log("─────────────────────────────────────");

  // ── 1. Wire vault ──────────────────────────────────────────────────────────
  const currentSE = await vault.settlementEngine();
  if (currentSE.toLowerCase() === SE_ADDR.toLowerCase()) {
    console.log("[VAULT] Already wired — settlement:", currentSE);
  } else {
    console.log("[VAULT] setContracts...");
    const tx = await vault.setContracts(SE_ADDR, SLTP_ADDR, PM_ADDR, ethers.ZeroAddress, { gasLimit: 200_000 });
    await tx.wait();
    console.log("[VAULT] OK — settlement:", SE_ADDR);
  }

  // ── 2. Wire PositionManager ───────────────────────────────────────────────
  const currentPMSE = await pm.settlementEngine();
  if (currentPMSE.toLowerCase() === SE_ADDR.toLowerCase()) {
    console.log("[PM]    Already wired — settlement:", currentPMSE);
  } else {
    console.log("[PM]    setContracts...");
    const tx = await pm.setContracts(SLTP_ADDR, VAULT_ADDR, SE_ADDR, { gasLimit: 200_000 });
    await tx.wait();
    console.log("[PM]    OK — vault:", VAULT_ADDR, "settlement:", SE_ADDR);
  }

  // ── 3. Seed vault with USDC so it can cover payouts ───────────────────────
  const vaultBal = await vault.getVaultBalance();
  const seedAmt  = ethers.parseUnits("10000", 6); // 10,000 USDC

  if (vaultBal >= seedAmt) {
    console.log(`[VAULT] Balance: $${Number(vaultBal) / 1e6} USDC — no seed needed`);
  } else {
    console.log("[VAULT] Seeding vault with 10,000 USDC...");
    // Keeper already has MaxUint256 allowance from ensureApproval() — deposit directly
    const depTx = await vault.deposit(seedAmt, { gasLimit: 300_000 });
    await depTx.wait();
    const newBal = await vault.getVaultBalance();
    console.log(`[VAULT] Seeded — balance now: $${Number(newBal) / 1e6} USDC`);
  }

  console.log("─────────────────────────────────────");
  console.log("Setup complete. Run: node keeper.js");
}

setup().catch(err => {
  console.error("Setup failed:", err.message);
  process.exit(1);
});
