#!/bin/bash
# PredX VPS Setup — run this on a fresh Ubuntu 22.04 server
# Usage: bash vps-setup.sh
set -e

echo "=== PredX VPS Setup ==="

# ── 1. System deps ──────────────────────────────────────────────
sudo apt-get update -qq
sudo apt-get install -y curl git build-essential wget unzip jq

# ── 2. Node.js 20 ───────────────────────────────────────────────
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
echo "Node: $(node -v)"

# ── 3. PM2 (keeps processes alive forever) ──────────────────────
sudo npm install -g pm2
pm2 startup | tail -1 | sudo bash || true

# ── 4. Foundry (for contract deployment) ────────────────────────
curl -L https://foundry.paradigm.xyz | bash
export PATH="$HOME/.foundry/bin:$PATH"
echo 'export PATH="$HOME/.foundry/bin:$PATH"' >> ~/.bashrc
foundryup
echo "Forge: $(forge --version)"

# ── 5. Weave v0.3.9 ─────────────────────────────────────────────
wget -q https://github.com/initia-labs/weave/releases/download/v0.3.9/weave-0.3.9-linux-amd64.tar.gz
tar -xzf weave-0.3.9-linux-amd64.tar.gz
sudo mv weave /usr/local/bin/weave
rm weave-0.3.9-linux-amd64.tar.gz
echo "Weave: $(weave version)"

# ── 6. Clone PredX repo ─────────────────────────────────────────
git clone https://github.com/flamiinngo/predx ~/predx
echo "Repo cloned."

# ── 7. Open firewall ────────────────────────────────────────────
sudo ufw allow 22/tcp   || true
sudo ufw allow 8545/tcp || true
sudo ufw allow 1317/tcp || true
sudo ufw allow 26657/tcp || true
sudo ufw --force enable  || true
echo "Firewall: port 8545 open"

echo ""
echo "=== Setup complete ==="
echo ""
echo "NEXT STEPS (run manually in order):"
echo ""
echo "1. Copy your weave config from local machine:"
echo "   scp ~/.weave/config.json user@THIS_VPS_IP:~/.weave/config.json"
echo "   scp ~/.weave/data/minitia.config.json user@THIS_VPS_IP:~/.weave/data/minitia.config.json"
echo ""
echo "2. On the VPS, start the chain:"
echo "   weave rollup start"
echo "   (wait ~2 minutes for chain to produce blocks)"
echo ""
echo "3. In a new terminal on VPS, deploy contracts:"
echo "   cd ~/predx && bash deploy-vps.sh"
echo ""
echo "4. Start the keeper with PM2:"
echo "   cd ~/predx/keeper && npm install && pm2 start keeper.js --name predx-keeper"
echo "   pm2 save"
echo ""
echo "5. Get your VPS public IP:"
echo "   curl ifconfig.me"
echo ""
echo "Then update Vercel env: VITE_RPC_URL=http://YOUR_VPS_IP:8545"
