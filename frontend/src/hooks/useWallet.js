import { useInterwovenKit } from "@initia/interwovenkit-react";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { injected } from "wagmi/connectors";

/**
 * Unified wallet hook.
 *
 * InterwovenKit returns THREE address formats:
 *   address       — bech32 (init1...) OR hex depending on wallet type
 *   initiaAddress — always bech32 (init1...)
 *   hexAddress    — always 0x... EVM hex address
 *
 * For ALL EVM operations (ethers, wagmi, contract calls) we must use hexAddress.
 * username and display can use address/initiaAddress.
 */
export function useWallet() {
  const iwk = useInterwovenKit();
  const wagmiAccount      = useAccount();
  const { connectAsync }  = useConnect();
  const { disconnect: wagmiDisconnect } = useDisconnect();

  // Always use the hex EVM address for on-chain operations
  const evmAddress  = iwk.hexAddress || wagmiAccount.address || null;
  const isConnected = iwk.isConnected || wagmiAccount.isConnected || false;
  const username    = iwk.username || null;

  const connect = () => {
    try {
      iwk.openConnect();
    } catch {
      connectAsync({ connector: injected() }).catch(() => {});
    }
  };

  const openWallet = () => {
    if (iwk.isConnected) iwk.openWallet();
  };

  const disconnect = () => {
    if (iwk.isConnected) iwk.disconnect();
    if (wagmiAccount.isConnected) wagmiDisconnect();
  };

  return {
    address:    evmAddress,           // always 0x... hex — safe for ethers/wagmi
    username,
    isConnected,
    connect,
    openWallet,
    disconnect,
    shortAddr:  evmAddress
      ? `${evmAddress.slice(0, 6)}...${evmAddress.slice(-4)}`
      : null,
    isIwkConnected:   iwk.isConnected,
    isWagmiConnected: wagmiAccount.isConnected,
  };
}
