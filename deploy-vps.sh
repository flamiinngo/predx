#!/bin/bash
# Run this on the VPS AFTER the chain is running
# Deploys all contracts and writes .env files
set -e

export PATH="$HOME/.foundry/bin:$PATH"
VPS_IP=$(curl -s ifconfig.me)

echo "=== PredX Contract Deploy on VPS ==="
echo "RPC: http://localhost:8545"
echo "Public IP: $VPS_IP"

cd ~/predx/contracts

# Install forge deps if not done
forge install --no-commit 2>/dev/null || true

# Deploy
PRIVATE_KEY=0xb9af6f29b5e257243fce3df3cc2e1b56b1c096dfcb71988eb26cee65e5babbba
OUTPUT=$(forge script script/DeployAll.s.sol \
  --rpc-url http://localhost:8545 \
  --broadcast \
  --tc DeployAll \
  --private-key $PRIVATE_KEY \
  2>&1)

echo "$OUTPUT" | grep -E "USDC:|Oracle:|Vault:|Factory:|PM:|SLTP:|Settlement:" || true

USDC=$(echo "$OUTPUT"       | grep "USDC"       | grep -oE '0x[0-9a-fA-F]{40}' | head -1)
ORACLE=$(echo "$OUTPUT"     | grep "Oracle"     | grep -oE '0x[0-9a-fA-F]{40}' | head -1)
VAULT=$(echo "$OUTPUT"      | grep "Vault"      | grep -oE '0x[0-9a-fA-F]{40}' | head -1)
FACTORY=$(echo "$OUTPUT"    | grep "Factory"    | grep -oE '0x[0-9a-fA-F]{40}' | head -1)
PM=$(echo "$OUTPUT"         | grep " PM"        | grep -oE '0x[0-9a-fA-F]{40}' | head -1)
SLTP=$(echo "$OUTPUT"       | grep "SLTP"       | grep -oE '0x[0-9a-fA-F]{40}' | head -1)
SETTLEMENT=$(echo "$OUTPUT" | grep "Settlement" | grep -oE '0x[0-9a-fA-F]{40}' | head -1)

echo ""
echo "Deployed addresses:"
echo "  USDC:       $USDC"
echo "  Oracle:     $ORACLE"
echo "  Vault:      $VAULT"
echo "  Factory:    $FACTORY"
echo "  PM:         $PM"
echo "  SLTP:       $SLTP"
echo "  Settlement: $SETTLEMENT"

# ── Write keeper .env ────────────────────────────────────────────
cat > ~/predx/keeper/.env << EOF
RPC_URL=http://localhost:8545
REST_URL=http://localhost:1317
KEEPER_KEY=0xb9af6f29b5e257243fce3df3cc2e1b56b1c096dfcb71988eb26cee65e5babbba
SEEDER_KEY=0xd272baf4e4d8eae05f5889d05d9feb327f79b11fd2f14d1e3508b6d0a4656e4f
ORACLE_ADDRESS=$ORACLE
VAULT_ADDRESS=$VAULT
FACTORY_ADDRESS=$FACTORY
PM_ADDRESS=$PM
SLTP_ADDRESS=$SLTP
SETTLEMENT_ADDRESS=$SETTLEMENT
USDC_ADDRESS=$USDC
EOF

echo ""
echo "✓ keeper/.env written"

# ── Write frontend .env ──────────────────────────────────────────
SEEDER_KEY=0xd272baf4e4d8eae05f5889d05d9feb327f79b11fd2f14d1e3508b6d0a4656e4f

cat > ~/predx/frontend/.env << EOF
VITE_RPC_URL=http://${VPS_IP}:8545
VITE_USDC=$USDC
VITE_FACTORY=$FACTORY
VITE_POSITION_MANAGER=$PM
VITE_VAULT=$VAULT
VITE_ORACLE=$ORACLE
VITE_CHAIN_ID=predx-1
VITE_EVM_CHAIN_ID=674323531314972
VITE_SEEDER_KEY=$SEEDER_KEY
EOF

echo "✓ frontend/.env written"
echo ""
echo "=== VERCEL ENVIRONMENT VARIABLES ==="
echo "Add these in Vercel dashboard → Project → Settings → Environment Variables:"
echo ""
echo "VITE_RPC_URL         = http://${VPS_IP}:8545"
echo "VITE_USDC            = $USDC"
echo "VITE_FACTORY         = $FACTORY"
echo "VITE_POSITION_MANAGER= $PM"
echo "VITE_VAULT           = $VAULT"
echo "VITE_ORACLE          = $ORACLE"
echo "VITE_CHAIN_ID        = predx-1"
echo "VITE_EVM_CHAIN_ID    = 674323531314972"
echo "VITE_SEEDER_KEY      = $SEEDER_KEY"
echo ""
echo "=== All done. Now run: ==="
echo "cd ~/predx/keeper && npm install && pm2 start keeper.js --name predx-keeper && pm2 save"
