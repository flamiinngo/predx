import { useState } from "react";
import { useInterwovenKit } from "@initia/interwovenkit-react";
import { ethers } from "ethers";
const PM_ABI = ["function openPosition(uint256 marketId, bool higher, uint256 size, uint256 slPrice, uint256 tpPrice) external returns (uint256)"];
const PREDX_CHAIN_HEX = "0x" + (674323531314972).toString(16);

// Ensure MetaMask is on predx-1 before IWK calls getEvmSigner().
// Only runs when window.ethereum (MetaMask) is present AND is not already
// on predx-1 — has no effect when auto-sign is on (ghost wallet bypasses MM).
async function ensurePredxNetwork() {
  if (!window.ethereum) return;
  const current = await window.ethereum.request({ method: "eth_chainId" });
  if (current === PREDX_CHAIN_HEX) return;
  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: PREDX_CHAIN_HEX }],
    });
  } catch (err) {
    if (err.code === 4902) {
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [{
          chainId: PREDX_CHAIN_HEX,
          chainName: "PredX (predx-1)",
          nativeCurrency: { name: "GAS", symbol: "GAS", decimals: 18 },
          rpcUrls: [import.meta.env.VITE_RPC_URL || "http://localhost:8545"],
        }],
      });
    }
  }
}

export function useTrade() {
  const { address, getEvmSigner } = useInterwovenKit();
  const [isLoading, setIsLoading] = useState(false);
  const [lastTx, setLastTx]       = useState(null);
  const [error, setError]         = useState(null);
  const PM = import.meta.env.VITE_POSITION_MANAGER || "";
  const openPosition = async ({ marketId, higher, size, slPrice, tpPrice }) => {
    if (!address || !PM) { console.warn("Not connected or contract not set"); return; }
    setIsLoading(true); setError(null);
    try {
      await ensurePredxNetwork();
      const signer   = await getEvmSigner();
      const contract = new ethers.Contract(PM, PM_ABI, signer);
      const tx       = await contract.openPosition(
        marketId, higher,
        ethers.parseUnits(String(size), 6),
        slPrice  ? ethers.parseUnits(String(slPrice),  18) : 0n,
        tpPrice  ? ethers.parseUnits(String(tpPrice),  18) : 0n
      );
      const receipt = await tx.wait();
      setLastTx(receipt.hash);
    } catch (err) {
      console.error("Trade failed:", err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };
  return { openPosition, isLoading, lastTx, error };
}
