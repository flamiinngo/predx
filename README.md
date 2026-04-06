# PredX — Prediction Market Perp DEX on Initia

## Initia Hackathon Submission

- **Project Name**: PredX
- **Chain ID**: predx-1
- **VM**: EVM (Solidity)
- **Track**: DeFi / Institutional

### Project Overview

PredX is the first prediction market with perpetual DEX mechanics on Initia. Traders take HIGHER or LOWER positions on BTC, ETH, and INIT prices across 1-minute, 5-minute, and 15-minute markets with on-chain stop-loss and take-profit orders, a shared USDC liquidity vault, and seamless trading powered by Initia auto-signing.

### The Innovation

Standard prediction markets have no risk management. PredX adds on-chain SL/TP to binary positions. If you are HIGHER on BTC and price drops to your stop-loss, the keeper bot triggers an early exit at 20% refund. If price hits your take-profit, you exit at 180% payout. Both execute automatically via on-chain keeper.

### Native Features

- Auto-signing: Traders approve a session once, all trades execute without popups
- Interwoven Bridge: Users bridge USDC from Ethereum or BNB Chain directly into PredX
- Initia Usernames: Leaderboard shows .init names instead of hex addresses

### Contracts

| Contract | Description |
|---|---|
| OracleConsumer | Reads Initia L1 native price feed |
| MarketFactory | Manages all 9 markets (3 tokens x 3 timeframes) |
| PositionManager | Handles trades, validates SL/TP, collects fees |
| SLTPManager | Stores and executes trigger orders via keeper bot |
| LPVault | USDC pool with Initia VIP reward accounting |
| SettlementEngine | Settles markets, pays winners, opens next cycle |

### Test Results

27 tests passed, 0 failed

### How to Run

1. `weave init` — select EVM, chain ID predx-1, enable oracle
2. `cd contracts && forge script script/DeployPredX.s.sol --rpc-url http://localhost:8545 --broadcast`
3. `cd keeper && npm install && npm start`
4. `cd frontend && npm install && npm run dev`

Built for the INITIATE Hackathon — April 2026
