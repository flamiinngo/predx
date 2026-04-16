import { ethers } from "ethers";
import dotenv from "dotenv";
dotenv.config();

const RPC    = process.env.RPC_URL   || "http://localhost:8545";
const PK     = process.env.KEEPER_KEY;
const ORACLE = "0xF93eC52341d8bC7e9068410285B232E4F3272306";

const ABI = ["function updatePrices(uint256 btc, uint256 eth, uint256 init) external"];

const provider = new ethers.JsonRpcProvider(RPC);
const wallet   = new ethers.Wallet(PK, provider);
const oracle   = new ethers.Contract(ORACLE, ABI, wallet);

async function syncPrices() {
  try {
    const res  = await fetch("https://api.binance.com/api/v3/ticker/price?symbols=[%22BTCUSDT%22,%22ETHUSDT%22,%22INITUSDT%22]");
    const data = await res.json();
    const px   = {};
    for (const { symbol, price } of data) px[symbol] = parseFloat(price);

    const btc  = ethers.parseEther(px.BTCUSDT.toFixed(8));
    const eth  = ethers.parseEther(px.ETHUSDT.toFixed(8));
    const init = ethers.parseEther(px.INITUSDT.toFixed(8));

    const tx = await oracle.updatePrices(btc, eth, init, { gasLimit: 100000 });
    await tx.wait();
    console.log(`[PRICE] BTC $${px.BTCUSDT.toFixed(2)} | ETH $${px.ETHUSDT.toFixed(2)} | INIT $${px.INITUSDT.toFixed(4)}`);
  } catch (err) {
    console.error("[PRICE] Failed:", err.message);
  }
}

console.log("Price oracle sync starting...");
syncPrices();
setInterval(syncPrices, 5000);
