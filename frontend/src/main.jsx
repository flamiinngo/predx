import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, createConfig, http } from "wagmi";
import { InterwovenKitProvider } from "@initia/interwovenkit-react";
import App from "./App";
import "./index.css";

const predxChain = {
  id: 1,
  name: "PredX",
  nativeCurrency: { name: "GAS", symbol: "GAS", decimals: 18 },
  rpcUrls: {
    default: { http: ["http://localhost:8545"] },
    public:  { http: ["http://localhost:8545"] },
  },
};

const wagmiConfig = createConfig({
  chains: [predxChain],
  transports: { [predxChain.id]: http("http://localhost:8545") },
});

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <InterwovenKitProvider chainId="initiation-2">
          <App />
        </InterwovenKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  </React.StrictMode>
);
