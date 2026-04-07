import { useState, useEffect } from "react";

const PREDX_CHAIN = {
  chainId:         "0x2654b2e8c371c",
  chainName:       "PredX (predx-1)",
  nativeCurrency:  { name: "GAS", symbol: "GAS", decimals: 18 },
  rpcUrls:         ["http://localhost:8545"],
  blockExplorerUrls: [],
};

export function useWallet() {
  const [address,      setAddress]      = useState(null);
  const [isConnected,  setIsConnected]  = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    if (window.ethereum) {
      window.ethereum.request({ method: "eth_accounts" }).then(accounts => {
        if (accounts.length > 0) { setAddress(accounts[0]); setIsConnected(true); }
      });
    }
  }, []);

  const connect = async () => {
    if (!window.ethereum) {
      alert("Please install MetaMask to connect.\n\nGet it at metamask.io");
      return;
    }
    setIsConnecting(true);
    try {
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [PREDX_CHAIN],
      });
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      setAddress(accounts[0]);
      setIsConnected(true);
    } catch (err) {
      console.error("Connect failed:", err);
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnect = () => { setAddress(null); setIsConnected(false); };

  return { address, isConnected, isConnecting, connect, disconnect,
    shortAddr: address ? `${address.slice(0,6)}...${address.slice(-4)}` : null };
}
