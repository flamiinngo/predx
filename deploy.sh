#!/bin/bash
set -e
echo "=== PredX Full Deploy ==="

cd ~/projects/predx/contracts

OUTPUT=$(forge script script/DeployAll.s.sol --rpc-url http://localhost:8545 --broadcast --tc DeployAll 2>&1)
echo "$OUTPUT" | grep -E "USDC:|Oracle:|Vault:|Factory:|PM:|SLTP:|Settlement:"

USDC=$(echo "$OUTPUT"       | grep "USDC:"       | awk '{print $NF}')
PM=$(echo "$OUTPUT"         | grep "PM:"         | awk '{print $NF}')
FACTORY=$(echo "$OUTPUT"    | grep "Factory:"    | awk '{print $NF}')
SLTP=$(echo "$OUTPUT"       | grep "SLTP:"       | awk '{print $NF}')
SETTLEMENT=$(echo "$OUTPUT" | grep "Settlement:" | awk '{print $NF}')

# Update keeper .env
cat > ~/projects/predx/keeper/.env << EOF
RPC_URL=http://localhost:8545
KEEPER_KEY=0xb9af6f29b5e257243fce3df3cc2e1b56b1c096dfcb71988eb26cee65e5babbba
SLTP_ADDRESS=$SLTP
SETTLEMENT_ADDRESS=$SETTLEMENT
FACTORY_ADDRESS=$FACTORY
EOF

# Update frontend .env
cat > ~/projects/predx/frontend/.env << EOF
VITE_RPC_URL=http://localhost:8545
VITE_POSITION_MANAGER=$PM
VITE_FACTORY=$FACTORY
VITE_USDC=$USDC
VITE_CHAIN_ID=predx-1
EOF

# Update frontend TradePanel addresses
sed -i "s/const PM_ADDRESS.*=.*/const PM_ADDRESS   = \"$PM\";/" ~/projects/predx/frontend/src/components/TradePanel.jsx
sed -i "s/const USDC_ADDRESS.*=.*/const USDC_ADDRESS = \"$USDC\";/" ~/projects/predx/frontend/src/components/TradePanel.jsx

echo "=== Deploy complete ==="
echo "PM:   $PM"
echo "USDC: $USDC"
