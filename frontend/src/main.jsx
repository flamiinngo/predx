import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";
import { InterwovenKitProvider } from "@initia/interwovenkit-react";
import "@initia/interwovenkit-react/styles.css";
import App from "./App";
import "./index.css";

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { err: null }; }
  static getDerivedStateFromError(e) { return { err: e }; }
  render() {
    if (this.state.err) return (
      <div style={{ padding:"40px", fontFamily:"monospace", color:"#f85149", background:"#0d1117", minHeight:"100vh" }}>
        <h2>App crashed — check console</h2>
        <pre style={{ fontSize:"12px", whiteSpace:"pre-wrap", marginTop:"16px", color:"#e2e8f0" }}>
          {this.state.err.message}{"\n\n"}{this.state.err.stack}
        </pre>
      </div>
    );
    return this.props.children;
  }
}

// PredX Cosmos REST base URL — served through nginx /cosmos/ proxy on the chain domain.
// After the chain Dockerfile nginx update, /cosmos/* routes to port 1317 (Cosmos REST).
const CHAIN_RPC_URL  = import.meta.env.VITE_RPC_URL  || "http://localhost:8080";
const CHAIN_REST_URL = CHAIN_RPC_URL.replace(/\/$/, "") + "/cosmos";

// InterwovenKit customChain config for predx-1.
// Registers our Railway-hosted minitia EVM rollup so IWK can:
//   1. Resolve addresses on the chain
//   2. Submit authz + feegrant for Auto-Sign via the Cosmos REST API
//   3. Broadcast MsgCall transactions via the json-rpc endpoint
const predxIwkChain = {
  chain_id:     "predx-1",
  chain_name:   "predx",
  pretty_name:  "PredX",
  bech32_prefix: "init",
  logo_URIs:    { png: "" },
  apis: {
    rpc:        [],
    rest:       [{ address: CHAIN_REST_URL }],
    "json-rpc": [{ address: CHAIN_RPC_URL }],
    indexer:    [],
  },
  metadata: { minitia: { type: "minievm" } },
};

// PredX EVM rollup chain config (wagmi)
// Chain ID 674323531314972 = 0x2654b2e8c371c (from weave init / forge broadcast)
const predxChain = {
  id: 674323531314972,
  name: "PredX",
  nativeCurrency: { name: "GAS", symbol: "GAS", decimals: 18 },
  rpcUrls: {
    default: { http: [import.meta.env.VITE_RPC_URL || "http://localhost:8545"] },
    public:  { http: [import.meta.env.VITE_RPC_URL || "http://localhost:8545"] },
  },
};

const wagmiConfig = createConfig({
  chains: [predxChain],
  connectors: [injected()],
  transports: {
    [predxChain.id]: http(import.meta.env.VITE_RPC_URL || "http://localhost:8545"),
  },
});

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 5_000 } },
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <WagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={queryClient}>
          {/*
            InterwovenKit — Initia's native wallet SDK
            chainId: L1 testnet for username resolution + bridge
            enableAutoSign: grants /minievm.evm.v1.MsgCall for our EVM rollup
          */}
          <InterwovenKitProvider
            chainId="initiation-2"
            customChain={predxIwkChain}
            enableAutoSign={{
              "predx-1": ["/minievm.evm.v1.MsgCall"],
            }}
            theme="dark"
          >
            <App />
          </InterwovenKitProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
