FROM node:24-bookworm-slim AS build

WORKDIR /app
COPY server/package.json server/package-lock.json ./server/
RUN npm ci --prefix server --include=dev --ignore-scripts --no-audit --no-fund

COPY . .
RUN npm --prefix server run build:client
RUN npm prune --prefix server --omit=dev --ignore-scripts --no-audit --no-fund

# Use the original deployment artifacts, including their compiler metadata,
# for the backend's exact Arc mainnet bytecode checks.
COPY deployed-artifacts/HouseCupEscrow.json ./contracts/out/HouseCupEscrow.sol/HouseCupEscrow.json
COPY deployed-artifacts/PaidDuelEscrow.json ./contracts/out/PaidDuelEscrow.sol/PaidDuelEscrow.json

FROM node:24-bookworm-slim

WORKDIR /app
COPY --from=build /app /app
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=5174 \
    DATABASE_PATH=/data/rushy.sqlite

WORKDIR /app/server
EXPOSE 5174
CMD ["node", "--experimental-strip-types", "index.ts"]
