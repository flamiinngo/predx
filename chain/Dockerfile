FROM ubuntu:22.04

# Railway routes to port 8545 (configured in Railway service settings).
# nginx listens on 8545 and proxies internally:
#   /*      → EVM JSON-RPC on :18545
#   /rest/* → Cosmos REST on :1317
#   /rpc/*  → CometBFT RPC on :26657
ENV PORT=8545

RUN apt-get update && apt-get install -y \
    ca-certificates curl wget nginx && \
    rm -rf /var/lib/apt/lists/*

# Download minitiad v1.2.15 (the EVM rollup node binary)
RUN wget -q https://github.com/initia-labs/minievm/releases/download/v1.2.15/minievm_v1.2.15_Linux_x86_64.tar.gz \
    && tar -xzf minievm_v1.2.15_Linux_x86_64.tar.gz \
    && mv minitiad /usr/local/bin/minitiad \
    && chmod +x /usr/local/bin/minitiad \
    && rm -f minievm_v1.2.15_Linux_x86_64.tar.gz

# Copy pre-initialized chain state (genesis + all deployed contracts baked in)
COPY minitia_home /root/.minitia

# Move EVM JSON-RPC to internal port 18545 so nginx can own port 8545.
# Enable CORS for all APIs.
RUN sed -i 's|address = "0.0.0.0:8545"|address = "127.0.0.1:18545"|g' /root/.minitia/config/app.toml && \
    sed -i 's/enable-unsafe-cors = false/enable-unsafe-cors = true/g' /root/.minitia/config/app.toml && \
    sed -i 's/enabled-unsafe-cors = false/enabled-unsafe-cors = true/g' /root/.minitia/config/app.toml

# nginx on port 8545 (Railway's routed port):
#   /*      → EVM JSON-RPC on :18545
#   /rest/* → Cosmos REST on :1317
#   /rpc/*  → CometBFT RPC on :26657
COPY nginx.conf /etc/nginx/sites-available/predx
RUN rm -f /etc/nginx/sites-enabled/default && \
    ln -s /etc/nginx/sites-available/predx /etc/nginx/sites-enabled/predx

# Startup: nginx as daemon, minitiad in foreground
# NOTE: printf interprets \n as real newline; echo in dash does NOT.
RUN printf '#!/bin/sh\nnginx\nexec minitiad start --home /root/.minitia\n' > /usr/local/bin/start.sh && \
    chmod +x /usr/local/bin/start.sh

# 8545  = nginx proxy (Railway routes here — public)
# 18545 = EVM JSON-RPC (internal only, nginx proxies /*)
# 1317  = Cosmos REST (internal only, nginx proxies /rest/*)
# 26657 = CometBFT RPC (internal only, nginx proxies /rpc/*)
EXPOSE 8545 18545 1317 26657

CMD ["/usr/local/bin/start.sh"]
