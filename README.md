# PredX — Higher or Lower. That's It.

> **Initia INITIATE Hackathon** · Live on predx-1 (Initia MiniEVM Rollup)  
> **Demo**: https://predx.up.railway.app · **Chain**: predx-1 · **Chain ID**: 674323531314972

---

## The Problem

Perp DEXes are intimidating. Leverage sliders, liquidation prices, funding rates, margin ratios — most people close the tab before making a single trade. DeFi loses them before they even start.

## The Solution

One question: **is Bitcoin going higher or lower in the next 5 minutes?**

Pick one. Set an optional stop-loss. Walk away. That's the entire product.

No liquidations. No leverage. No complexity. A prediction market with perp DEX mechanics — built to be the first trade anyone ever makes on-chain.

---

## Live Demo

| | |
|---|---|
| **App** | https://predx.up.railway.app |
| **Chain RPC** | https://predx-production.up.railway.app |
| **Markets** | BTC / ETH / INIT — 1min, 5min, 15min timeframes |
| **Liquidity** | 9,000+ USDC in vault, keeper running live |

---

## Initia-Native Features

### ⚡ Auto-Sign (Ghost Wallet via IWK)
The headline feature. Enable once → every trade executes silently, no wallet popup.

InterwovenKit derives a ghost wallet via `personal_sign`, then broadcasts two Cosmos SDK transactions to predx-1:
- **Authz grant** — authorizes the ghost wallet to sign `/minievm.evm.v1.MsgCall` on your behalf
- **Feegrant** — ghost wallet covers gas fees from your account

Result: 1-click trading. Impossible on a standard EVM chain. Uniquely Initia.

```
frontend/src/main.jsx          → enableAutoSign: { "predx-1": ["/minievm.evm.v1.MsgCall"] }
frontend/src/hooks/useAutosign.js → enable / disable / expiry management
frontend/src/components/Header.jsx → ⚡ Auto-Sign toggle in header
```

### ◈ .init Usernames
Every address on the leaderboard resolves to its `.init` username via the Initia Username Registry on `initiation-2` L1. If you have a name, it shows — everywhere.

Solved a subtle bug: IWK's `useUsernameQuery` calls `InitiaAddress.validate()` which rejects hex `0x` addresses on MiniEVM chains. We convert hex → bech32 before every query so names resolve correctly.

```
frontend/src/hooks/useUsername.js → hex-to-bech32 conversion + useUsernameQuery
frontend/src/components/Leaderboard.jsx → ◈ name.init display per trader
```

### 🔮 ConnectOracle (Band Protocol Native Prices)
`OracleConsumer.sol` implements the `IConnectOracle` interface from Initia's MiniEVM precompile. On predx-1 it queries Band Protocol feeds natively; on local dev it falls back to keeper-pushed Binance prices. Zero code change needed for mainnet.

```
contracts/src/OracleConsumer.sol → dual-source oracle, staleness check
keeper/keeper.js                 → wireNativeOracle() on startup
```

### 🔗 MsgCall — EVM via Cosmos SDK
All trades on predx-1 go through `/minievm.evm.v1.MsgCall`. This Cosmos SDK message wrapping is what enables the authz layer to authorize EVM contract calls — the architectural foundation that makes auto-sign possible.

### 🌉 InterwovenKit
Full IWK integration: wallet connection, `.init` username resolution, auto-sign session management, and the dual-stack RPC layer (EVM JSON-RPC + Cosmos REST + CometBFT RPC on a single endpoint via nginx).

---

## Architecture

```
┌──────────────────────────────────────────────────────┐
│                    predx-1 (MiniEVM rollup)           │
│                                                       │
│  [Trader]                                             │
│     │  ← IWK auto-sign (authz + feegrant)            │
│     ▼                                                 │
│  PositionManager ──► MarketFactory                   │
│     │                     │                          │
│     │              OracleConsumer ◄── Band (native)   │
│     │              (fallback: keeper push)            │
│     ▼                                                 │
│  LPVault ◄────────── LP Providers                    │
│     │                                                 │
│  SLTPManager ◄─────── KeeperBot (trigger orders)     │
│     │                                                 │
│  SettlementEngine ◄── KeeperBot (auto-settle expiry)  │
│                                                       │
└──────────────────────────────────────────────────────┘
         ▲                    ▲
    wagmi/ethers.js    CosmJS/IWK (Cosmos SDK)
    (EVM trades)       (authz, feegrant, usernames)
```

---

## How a Trade Works

1. Keeper creates markets for BTC/ETH/INIT every 1min / 5min / 15min with live strike prices from Band Protocol
2. Trader opens HIGHER or LOWER with optional SL/TP — with auto-sign enabled, no popup
3. LPs deposit USDC to the vault — fund payouts, earn protocol fees
4. At expiry, SettlementEngine settles all markets, pays winners from vault, opens next cycle
5. SLTPManager watches open positions and auto-exits when price hits SL or TP
6. Leaderboard tracks all traders by real PnL from on-chain `PositionClosed` events

---

## Deployed Contracts (predx-1)

| Contract | Address |
|---|---|
| PositionManager | `0xa820e119a1515e7edcb206d0e6533cc1bd8f01a2` |
| SettlementEngine | `0x8eed12fbe5059d29d79ee697b44f435fa8f75449` |
| MarketFactory | `0x20416ad315d731023974e290c384d71fa409795b` |
| OracleConsumer | `0xfb98bf3418eb41b008ca7621db973ec364a06cf7` |
| LPVault | `0x823e7698ebba554baf21d71d2deceadbd844cbad` |
| SLTPManager | `0xdb9bbd6a98995278d6f489604bb93584bf07e106` |
| MockUSDC | `0x8b0F7f39d7d4238e9474a2c59013DBc34a87999d` |

---

## Tech Stack

| Layer | Stack |
|---|---|
| Contracts | Solidity 0.8.24, Foundry, OpenZeppelin 5 |
| Frontend | React 19, Vite, wagmi v3, ethers.js v6, @initia/interwovenkit-react |
| Keeper | Node.js, ethers.js v6 — price sync, settlement, SLTP, seeding |
| Chain | Initia MiniEVM rollup (minitiad v1.2.15), nginx reverse proxy |
| Infra | Railway (chain + keeper), Vercel (frontend) |

---

## Run Locally

```bash
# 1. Start local Initia EVM chain
weave init   # select EVM rollup, chain ID predx-1

# 2. Deploy contracts
cd contracts
forge script script/DeployAll.s.sol --rpc-url http://localhost:8545 --broadcast

# 3. Start keeper
cd keeper
cp .env.example .env   # fill in contract addresses + keeper key
npm install && npm start

# 4. Start frontend
cd frontend
cp .env.example .env   # set VITE_RPC_URL=http://localhost:8545
npm install && npm run dev
```

---

## Test Results

```
Ran 27 tests across 4 contracts — all passed
```

---

*Built for the Initia INITIATE Hackathon · April 2026*
