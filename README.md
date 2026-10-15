# Rushy — Arc mainnet contracts

This repository contains the two deployed USDC escrows, their ABI, exact deployed
artifacts, deployment records, Solidity tests and the Arc deployment script.
The contracts are already on Arc mainnet. The game integration is configured by
the application maintainer using the addresses and roles below.

## Existing deployments

| Contract | Address | Deployment receipt |
| --- | --- | --- |
| PaidDuelEscrow | [`0xA6505430759EabF189b275251F72FDD357B0Abdc`](https://explorer.arc.io/address/0xA6505430759EabF189b275251F72FDD357B0Abdc) | [Success, block 25913480](https://explorer.arc.io/tx/0xcfa1f5a6780cc781213f111aaaaebacee9b812f00e6c255aeae496c90e8021d3) |
| HouseCupEscrow | [`0x38C8093907f6085e7c2Ad22335F3f4DA15466Efe`](https://explorer.arc.io/address/0x38C8093907f6085e7c2Ad22335F3f4DA15466Efe) | [Success, block 25913485](https://explorer.arc.io/tx/0x4398d615a8c37311f5eb8d764ea14669b1f805cdf4de07227a8d78adc3ce0a22) |

Deployed on 2026-10-14. The combined gas fee was `0.087863505873674975 USDC`.
The machine-readable configuration is [deployments/arc-mainnet.json](deployments/arc-mainnet.json).
Ready-to-import ABI files are in [abi/](abi/).

## Integration configuration

| Setting | Value |
| --- | --- |
| Chain | Arc mainnet, `5042` (`0x13b2`) |
| RPC | `https://rpc.mainnet.arc.io` |
| Explorer | `https://explorer.arc.io` |
| USDC ERC-20 | `0x3600000000000000000000000000000000000000`, **6 decimals** |
| Native gas | USDC, **18 decimals** |
| Owner | `0xd52e8a92937826e9874A0B972de01Ae5FA6D6c79` |
| Result signer | `0xE3D7014A9DC4B3D1d89ACF6ECFfB713155217990` |
| Relay | `0x0950E77E0c108E8442351f9cEBD9695499b5C357` |
| Duel treasury | `0xEA2d8827B331C80649353f6f28525d10bfa44796` |
| Duel fee | `500` basis points (5%), immutable |

Native and ERC-20 USDC share one underlying balance on Arc. Use six-decimal integer
amounts for escrow payments and 18-decimal amounts for native gas accounting.
Network details are documented in [Circle's Arc connection reference](https://docs.arc.io/arc/references/connect-to-arc).

The EIP-712 domain names remain **`CHOG Paid Duel`** and **`CHOG House Cup`**, both
version **`1`**, chain **`5042`**, with their respective deployed address as
`verifyingContract`. Renaming the repository does not change the deployed domains.
Read the locked game's signer and epoch when preparing a signed result.

The application needs the credentials for the configured result signer and relay
through its private secret configuration. The deployer key is not needed for game
operation. Fund the relay with native USDC for its transactions. The relay is
immutable; the owner may rotate the signer for future games. Locked games retain
their signer. Both escrows are non-upgradeable.

## Payment terms

- **Duel:** each assigned player deposits `1_000_000` units (1 USDC); winner credit
  is `1_900_000` and treasury credit is `100_000` (5% of the 2 USDC pool).
- **Cup:** sponsor deposits `100_000_000` units (100 USDC); champion receives
  `70_000_000`, runner-up `30_000_000`; no Cup fee.
- Settlement creates credits. Call `withdrawFor(gameId, recipient)` to transfer a
  winner, treasury or refund credit. Verify successful receipts and token Transfer
  events before displaying payment as complete.
- Cancellation, Void and expiry preserve applicable full refunds. Results can be
  paused by the owner; withdrawals and expiry refunds remain available.

## Build, test and recheck mainnet

Requires Node.js 24+ and Foundry with Solidity 0.8.27.

```bash
npm ci --ignore-scripts
npm run build
npm test
npm run verify:mainnet
```

The mainnet verifier is read-only and needs no signing key. It checks the RPC chain,
USDC decimals, original creation transactions, deployed bytecode, roles, payment
terms and EIP-712 domains. An optional RPC override is documented in `.env.example`.

Solidity sources are copied unchanged from the original deployment. The standalone
Foundry build uses a new dependency directory, so its compiler metadata differs.
Use [deployed-artifacts/](deployed-artifacts/) for strict comparison with the existing
deployments. Those artifacts retain the original bytecode, metadata and immutable
references. The exact original standard JSON compiler inputs and encoded constructor
arguments are in [docs/arc-mainnet-verification/](docs/arc-mainnet-verification/).

`contracts/script/DeployArcMainnet.s.sol` is retained for an explicitly requested new
deployment. A blank signing template is provided in `contracts/arc-mainnet.env.example`.
Integrate the existing addresses above when configuring these deployed escrows.

## Validation scope

All 49 Solidity tests pass in this standalone package. The suites cover funding,
payouts, refunds, replay protection, signer
locking and Arc deployment guards using a standard EVM with a mock token. Mainnet
read-only verification confirms deployment/configuration. Complete real-USDC payment
acceptance and an independent security audit have not been performed.

The last explorer source-publication attempt on 2026-10-14 returned a Cloudflare
challenge; publication has not been confirmed. The preserved standard JSON inputs
use Solidity `0.8.27+commit.40a35a09`, optimizer 200 runs, Cancun and via-IR. Source
publication does not require a new deployment or gas payment.

Source provenance: [haikarure/chog-clash, commit 1109b53](https://github.com/haikarure/chog-clash/commit/1109b530edac411df5058d20666ade5186677ac5).
The MIT license is retained in [LICENSE](LICENSE).
