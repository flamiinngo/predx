# PredX — Prediction Market Perp DEX on Initia

> **Initia INITIATE Hackathon Submission** · DeFi / Institutional Track

PredX is the first prediction market with perp DEX mechanics on Initia. Traders take HIGHER or LOWER positions on BTC, ETH, and INIT prices across 5-minute and 15-minute markets — with **on-chain stop-loss and take-profit**, a shared USDC liquidity vault, and seamless one-click trading powered by Initia's native infrastructure.

---

## What Makes PredX Different

Standard prediction markets (Polymarket, etc.) have zero risk management. PredX adds on-chain SL/TP to binary positions — the first prediction market with perp DEX mechanics:

- Open HIGHER on BTC, set a stop-loss at $68,000 → keeper auto-exits at 20% refund if price drops there
- Set a take-profit at $72,000 → keeper auto-exits at 180% payout if price reaches there
- Both execute silently, on-chain, without the trader needing to watch

---

## Initia Native Features

### ⚡ Auto-Sign (Ghost Wallet)
Enable once → all trades execute without wallet popups. Powered by Initia's Ghost Wallet / authz-feegrant pattern via InterwovenKit.

**Implementation:**
- `frontend/src/main.jsx` — `enableAutoSign={{ "predx-1": ["/minievm.evm.v1.MsgCall"] }}`
- `frontend/src/hooks/useAutosign.js` — enable/disable/expiry display
- `frontend/src/components/TradePanel.jsx` — `⚡ Auto` badge, 1-click UX

### ◈ .init Usernames
Leaderboard resolves every trader address to their `.init` username via the Initia Username Registry on `initiation-2` L1. No addresses shown when a name exists.

**Implementation:**
- `frontend/src/hooks/useUsername.js` — `useUsernameQuery` from InterwovenKit
- `frontend/src/components/Leaderboard.jsx` — purple `◈ name.init` display
- `frontend/src/components/TradePanel.jsx` — shows username next to position info

### 🔮 ConnectOracle (Band Protocol Native Prices)
OracleConsumer implements the `IConnectOracle` interface. On Initia rollups, it queries the native precompile for Band Protocol feeds; on local dev it falls back to keeper-pushed Binance prices. Zero code change needed when moving to mainnet.

**Implementation:**
- `contracts/src/OracleConsumer.sol` — dual-source oracle with staleness check
- `keeper/keeper.js` — `wireNativeOracle()` queries `${REST_URL}/minievm/evm/v1/connect_oracle` on startup

### 🌉 Interwoven Bridge
The "+ Deposit" modal has a Bridge tab linking to the Initia Interwoven Bridge. Users bridge USDC from Ethereum, BNB Chain, or Cosmos directly to predx-1.

---

## Architecture

```
                    ┌─────────────────────────────────────┐
                    │            Initia predx-1            │
                    │                                      │
  [Trader] ─────► MarketFactory ◄──── OracleConsumer ◄── ConnectOracle (Band)
      │              │                      │                    │
      │              ▼                      │                    │
      └────────► PositionManager ◄──────────┘           KeeperBot (fallback)
                    │    │
                    │    ├──► LPVault ────► LP Providers
                    │    │
                    │    └──► SLTPManager ─► KeeperBot (trigger orders)
                    │
                    └──► SettlementEngine (auto-settle at expiry)
```

---

## Deployed Contracts (predx-1)

| Contract | Address |
|---|---|
| PositionManager | `0x4C7f26ca1B2692e362c00BC02cD997281dd355F7` |
| SettlementEngine | `0xffA192402F0d9a2001477d4f4876C1F623b83212` |
| MarketFactory | `0x7CA973067c3a96c374b930eC1f8CEd52cB2c4e4c` |
| OracleConsumer | `0xF93eC52341d8bC7e9068410285B232E4F3272306` |
| LPVault | `0x89b399601eaa8f6b05e86fd5c6e5f451907865cf` |
| SLTPManager | `0xB7c8CE11aA3Da26249711d5E7ffe670692224d20` |
| MockUSDC | `0x8b0F7f39d7d4238e9474a2c59013DBc34a87999d` |

---

## Tech Stack

- **Contracts**: Solidity 0.8.24, Foundry, OpenZeppelin 5
- **Frontend**: React 19 + Vite, wagmi v3, viem, @initia/interwovenkit-react
- **Keeper**: Node.js + ethers.js 6 — price sync, settlement, seeding, SLTP
- **Chain**: Initia EVM rollup (predx-1, chain ID `674323531314972`)

---

## Run Locally

```bash
# 1. Start local Initia EVM chain
weave init   # select EVM, chain ID predx-1

# 2. Deploy contracts
cd contracts
forge script script/DeployAll.s.sol --rpc-url http://localhost:8545 --broadcast

# 3. Start keeper bot
cd keeper
cp .env.example .env   # fill in contract addresses
npm install && npm start

# 4. Start frontend
cd frontend
npm install && npm run dev
```

---

## How It Works

1. Keeper creates 5m + 15m markets for BTC/ETH/INIT every cycle with live strike prices
2. Traders open HIGHER or LOWER positions with optional SL/TP (2% protocol fee)
3. LPs deposit USDC to the vault — fund payouts, earn fees + INIT VIP rewards
4. At expiry, SettlementEngine settles all markets, pays winners from vault, opens next cycle
5. Leaderboard shows real on-chain PnL from `PositionClosed` events

---

## Test Results

```
Ran 27 tests across 4 test files — all passed
```

---

Built for the INITIATE Hackathon — April 2026
