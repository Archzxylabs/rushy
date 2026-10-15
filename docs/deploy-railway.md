# Deploy Rushy on Railway

One Node service serves the game, HTTP API, and multiplayer WebSockets from
the same HTTPS domain. Vercel is optional. The current browser client connects
to its page's origin, so deploying only the static game to Vercel does not
connect it to a separate backend automatically.

## Railway setup

1. Create a Railway project using the GitHub repository
   `Archzxylabs/rushy`, branch `main`.
2. Keep the source/root directory at the repository root (`/`), not `server`.
   Railway detects the root `Dockerfile`. Leave build and start command
   overrides empty; the image installs dependencies, builds the browser SDK
   and combat modules, and starts the Node server.
3. Add a persistent Volume mounted at `/data` to this service. The image sets
   `DATABASE_PATH=/data/rushy.sqlite`, so sessions, match results, and payment
   recovery data survive redeployments. Use one replica: live rooms are held
   in process memory and the database is local SQLite.
4. In Networking, generate a public domain targeting port `5174`. Set:

   ```dotenv
   HOST=0.0.0.0
   PORT=5174
   PUBLIC_ORIGIN=https://YOUR-SERVICE.up.railway.app
   DATABASE_PATH=/data/rushy.sqlite
   ```

   Use the exact HTTPS origin without a trailing slash. If you add a custom
   domain, update `PUBLIC_ORIGIN` to that domain. `PUBLIC_WS_ADDRESS` can stay
   unset for this single-service deployment.
5. Set the deployment healthcheck path to `/api/config` and deploy. Keep the
   service running continuously for multiplayer; do not enable sleeping
   between requests.

The landing page is `/` and the game is `/play.html`. A successful
`GET /api/config` returns `online: true`. Verify an invited match with two
browsers after deployment. Restarting the server interrupts active fights;
the existing recovery code records interrupted matches as void.

## Enable paid Arc mainnet modes

Free modes work without wallet keys. Paid modes additionally require these
Railway runtime variables:

```dotenv
ENABLE_ARC_PRIZES=1
ARC_MAINNET_RPC_URL=https://rpc.mainnet.arc.io
CUP_ESCROW_ADDRESS=0x38C8093907f6085e7c2Ad22335F3f4DA15466Efe
DUEL_ESCROW_ADDRESS=0xA6505430759EabF189b275251F72FDD357B0Abdc
DUEL_FEE_BPS=500
DUEL_TREASURY_ADDRESS=0xEA2d8827B331C80649353f6f28525d10bfa44796
RESULT_SIGNER_PRIVATE_KEY=<private key for the existing result signer>
RELAY_PRIVATE_KEY=<private key for the existing relay>
```

The result signer must be `0xE3D7014A9DC4B3D1d89ACF6ECFfB713155217990`,
and the relay must be `0x0950E77E0c108E8442351f9cEBD9695499b5C357`.
They are separate accounts; the deployer key does not replace either one.
The relay needs native Arc USDC for transaction gas. Keep private keys in
Railway variables, outside Git and browser code.

The image includes the original deployed artifacts so the backend can verify
the deployed contract runtime without rebuilding Solidity. Creating this
web deployment does not deploy new contracts or change the existing ones.

Check both `settlement.enabled` and `paidDuel.enabled` in `/api/config` after
configuration. The backend leaves paid modes disabled when required keys or
contract checks are missing. A successful launch does not establish that a
complete real-USDC match, payout, or independent audit has been performed.

## Local container check

```bash
docker build -t rushy:local .
docker volume create rushy-local-data
docker run --rm -p 5174:5174 \
  -e PUBLIC_ORIGIN=http://localhost:5174 \
  -v rushy-local-data:/data rushy:local
```

Railway documentation: [Dockerfiles](https://docs.railway.com/builds/dockerfiles),
[Volumes](https://docs.railway.com/volumes), and
[public networking](https://docs.railway.com/networking/public-networking).
