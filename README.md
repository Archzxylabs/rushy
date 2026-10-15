# Rushy

Rushy is an original 2D browser fighting game set in a fictional transit city. It is a separate copy of the CHOG Clash codebase: the 12 fighter identities, five districts, art, interface, and abilities have been replaced. Basic attacks, locomotion, match rules, and the online room protocol still use adapted code from the existing game, with its source code license retained.

## Play locally

Node 24 or newer is required for the online server:

```bash
cd server
npm ci
npm run build:client
npm start
```

Open `http://localhost:5174/` for the landing page or `http://localhost:5174/play.html` for the arcade. VS Computer and Training also work with a static server in this folder (`python3 -m http.server 5174`). Free invited 1v1, Quick Match, and four-player Practice Cup need the Node server. No wallet is needed for these modes.

| Control | Action |
| --- | --- |
| A / D | Walk; double tap to run |
| W | Jump; press again in air to double jump |
| S | Crouch; double tap to roll |
| Space | Three-hit basic chain |
| I / O | Skill 1 / Skill 2 |
| P | Ultimate |
| Esc / R | Pause / reset Training |

The mobile shell at `mobile.html` rotates the landscape game for portrait phones and provides touch controls.

Skill 1 and Skill 2 show a short fighter and move header when the cast actually starts, for either side of a local or online match. Ultimates use a full-width illustrated cut-in. All 36 Meridian ability names, hit patterns, cooldowns, and generated VFX live in the shared Meridian ability rules and assets. The server remains authoritative for online hits.

## Roster and places

| Fighter | Style | Fighter | Style |
| --- | --- | --- | --- |
| Aster | Relay traps and lane shifts | Moro | Skid hazards and aerial vaults |
| Beacon | Crowd shockwaves | Loom | Guard and counter |
| Vesper | Ribbon reach | Kite | Aerial drones |
| Iona | Lance strikes | Brink | Heavy ground control |
| Nix | Paint bombs and swaps | Torque | Mines and pressure vents |
| Vela | Mag-skate rushdown | Orbit | Gravity control |

The stages are Halo Station, Tide Docks, Glass Orchard, Foundry Nine, and Night Bazaar. Legacy internal kit and stage IDs are intentionally retained for deterministic combat and online protocol compatibility; players see Meridian identities and places.

## Art build and checks

Character, arena, and ability source PNGs are in `assets/meridian/source-art/`. They were made with the built-in image generation tool for this game. Each of the 12 fighters has four original six-pose combat sheets in `assets/meridian/source-art/combat/`. The third sheet adds anticipation and follow-through poses for both skills and the ultimate; the fourth adds separate transition poses for all three skills, a combo strike, a running contact step, and a guarded rise. `tools/build_illustrated_atlases.py` extracts and feet-anchors those full-body poses into 13 runtime atlases. `tools/build-meridian-abilities.py` exports the imagegen VFX sheets as 36 transparent runtime sprites. `meridian-abilities.js` drives their projectiles, traps, movement skills, hit areas, and ultimate timelines in local and online play.

The 867 frame slots reuse 24 illustrated key poses per fighter across 15 states; they are **not** 867 unique drawings or full animation cycles. The old procedural rig is retained as a build input for atlas dimensions and UI art, then replaced by the illustrated atlas before packaging. See the [visual quality review](VISUAL_QUALITY_REVIEW.md) for the reference comparison and remaining animation and contact QA.

With a static server on port 5174 and Playwright Chromium installed:

```bash
python3 tools/build_meridian_assets.py
python3 tools/build_cache.py
python3 validation/meridian/verify-art.py
python3 validation/meridian/ability-assets.py
python3 validation/meridian/browser-smoke.py
python3 validation/meridian/ability-hits.py
python3 validation/meridian/skill-presentation.py
python3 validation/meridian/online-ability-render.py
python3 validation/meridian/skill-motion-review.py
python3 validation/meridian/skill-contact-full.py
python3 validation/meridian/flow-check.py
npm --prefix server test
```

`tools/build_meridian_assets.py` is the complete asset build and includes the ability sprite exporter. `tools/build_illustrated_atlases.py` refreshes only the illustrated atlases and their manifest metrics. The [local check ledger](validation/meridian/RELEASE_CHECK.md) links the latest browser, art, online, mobile, and server reports.

## Current scope

The free game modes and Practice Cup are implemented locally. The paid online flow runs on Arc mainnet: `PaidDuelEscrow` at `0xA6505430759EabF189b275251F72FDD357B0Abdc` and `HouseCupEscrow` at `0x38C8093907f6085e7c2Ad22335F3f4DA15466Efe`, both at 500 fee bps, with deployment receipts, roles, and EIP-712 domains verified (`deployments/arc-mainnet.json`). Sponsor Cups stake real USDC at `0x3600000000000000000000000000000000000000`; a 100 USDC pool splits 70/30 between champion and runner-up. Complete real-USDC payment acceptance and an independent audit have not been performed. The Arc grant direction is documented in `../../docs/arc-microgrants/GAME_DIRECTION.md`.

The original CHOG Clash source folder was not changed by this port. Rushy does not ship CHOG character or arena art. See `LICENSE`, `LICENSE-ASSETS.md`, and `THIRD_PARTY_NOTICES.md` for code, font, and audio provenance.
