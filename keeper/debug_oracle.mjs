import { ethers } from "ethers";
import dotenv from "dotenv";
dotenv.config();

const provider = new ethers.JsonRpcProvider("http://localhost:8545");
const wallet = new ethers.Wallet(process.env.KEEPER_KEY, provider);
const oracle = new ethers.Contract(
  "0xF93eC52341d8bC7e9068410285B232E4F3272306",
  [
    "function setConnectOracle(address) external",
    "function owner() external view returns (address)",
    "function connectOracle() external view returns (address)"
  ],
  wallet
);

const owner   = await oracle.owner();
const current = await oracle.connectOracle();
console.log("Owner:         ", owner);
console.log("Wallet:        ", wallet.address);
console.log("connectOracle: ", current);

try {
  const tx = await oracle.setConnectOracle("0x031ECb63480983FD216D17BB6e1d393f3816b72F", { gasLimit: 100000 });
  const r = await tx.wait();
  console.log("OK — block:", r.blockNumber);
} catch(e) {
  console.log("FAIL:", e.shortMessage || e.message?.slice(0, 300));
}
