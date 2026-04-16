FROM ubuntu:22.04

RUN apt-get update && apt-get install -y \
    ca-certificates curl wget && \
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

EXPOSE 8545 1317 26657

CMD ["minitiad", "start", "--home", "/root/.minitia"]
