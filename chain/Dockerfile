FROM ubuntu:22.04

# PORT=8080 tells Railway to route public traffic to nginx (port 8080).
# nginx then proxies: /* → EVM (8545), /cosmos/* → REST (1317).
# Without this, Railway auto-detects 8545 and REST becomes unreachable.
ENV PORT=8080

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

# Ensure CORS is enabled for frontend access
RUN sed -i 's/enable-unsafe-cors = false/enable-unsafe-cors = true/g' /root/.minitia/config/app.toml && \
    sed -i 's/enabled-unsafe-cors = false/enabled-unsafe-cors = true/g' /root/.minitia/config/app.toml

# nginx proxy on port 8080:
#   /cosmos/* → Cosmos REST on :1317 (strips /cosmos prefix)
#   /*        → EVM JSON-RPC on :8545
# This lets Railway expose a single port while serving both APIs.
COPY nginx.conf /etc/nginx/sites-available/predx
RUN rm -f /etc/nginx/sites-enabled/default && \
    ln -s /etc/nginx/sites-available/predx /etc/nginx/sites-enabled/predx

# Startup: nginx as daemon, minitiad in foreground
RUN echo '#!/bin/sh\nnginx\nexec minitiad start --home /root/.minitia' > /usr/local/bin/start.sh && \
    chmod +x /usr/local/bin/start.sh

# 8080 = nginx proxy (Railway routes here)
# 8545 = EVM JSON-RPC (internal only after nginx)
# 1317 = Cosmos REST (internal only after nginx)
# 26657 = CometBFT RPC (internal)
EXPOSE 8080 8545 1317 26657

CMD ["/usr/local/bin/start.sh"]
