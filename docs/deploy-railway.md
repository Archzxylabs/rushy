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
   TRUST_RAILWAY_EDGE=1
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
The relay needs native Arc USDC for transaction gas. New deposits require at
least `RELAY_MIN_BALANCE_USDC=0.1` (18 decimal native units); an unfunded
duel creation must also leave this reserve after its estimated gas cost.
This threshold is an admission check, not a guarantee that every future
settlement can be covered; monitor and replenish the relay. Keep private keys in
Railway variables, outside Git and browser code.

The image includes the original deployed artifacts so the backend can verify
the deployed contract runtime without rebuilding Solidity. Creating this
web deployment does not deploy new contracts or change the existing ones.

Check both `settlement.enabled` and `paidDuel.enabled` in `/api/config` after
configuration. The backend leaves new paid entries disabled when required keys, contract
checks, pause status, or relay gas are unhealthy. Readiness is refreshed every
five seconds; network and Cup bytecode are reverified periodically.
`recoveryEnabled` is separate: verified wallet claims, funding receipt recovery,
and existing settlement jobs remain accessible when new entries are disabled.
Missing server keys do not hide the verified contract address needed for
wallet claims. Updating keys requires a service restart/redeploy. A successful launch does not establish that a
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

## Admission and relay limits

Each verified wallet can hold at most three unfinished paid duels and admit
at most ten paired duels in a rolling 24-hour window. Fresh anonymous sessions,
cancellations and process restarts do not reset this ledger. A peer with an
expired or changed wallet login is removed from the paid queue.

Unfunded duel creation has a separate conservative relay budget: 0.5 native
USDC and 20 broadcasts per rolling day. Existing settlement/refund/withdrawal
jobs retain their own 10 USDC / 100 broadcast daily budget. All relay work is
also capped at 2 USDC / 20 broadcasts per resource. Gas reservations are upper
bounds recorded before broadcasting, and rebroadcasting exact signed bytes
consumes an attempt without reserving the same gas twice. These are backend
spending limits, separate from the immutable onchain fee terms.

The HTTP limiter always checks a client-IP budget; only valid sessions get
additional per-session buckets. The default limits per minute are 600 total
API requests per IP, 60 writes per API group per IP, and 300 per API group per
valid session. Invalid bearer strings cannot create a new identity. Set
`TRUST_RAILWAY_EDGE=1` only on Railway HTTP ingress, where `X-Real-IP` is
supplied by the edge; direct/local hosting ignores forwarding headers.
See [Railway request headers](https://docs.railway.com/networking/public-networking/specs-and-limits).
Do not expose the container through an alternate public TCP proxy while
trusting an HTTP edge header.

Inline scripts use CSP hashes of the shipped HTML; inline event handlers and
string evaluation are blocked. Inline styles remain allowed for the existing
game renderer. The mobile same-origin iframe is permitted.
