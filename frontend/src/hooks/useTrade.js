import { useState } from "react";
import { useInterwovenKit } from "@initia/interwovenkit-react";
import { ethers } from "ethers";
const PM_ABI = ["function openPosition(uint256 marketId, bool higher, uint256 size, uint256 slPrice, uint256 tpPrice) external returns (uint256)"];
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
