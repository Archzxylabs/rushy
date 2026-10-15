# Meridian ability kit

The 12 fighters have original Skill 1, Skill 2, and ultimate rules in [meridian-abilities.js](meridian-abilities.js). Basic attacks, movement, and match rules still use adapted combat code. The same ability module runs in browser practice/CPU play and in the online authority.

| Fighter | Skill 1 (I) | Skill 2 (O) | Ultimate (P) |
| --- | --- | --- | --- |
| Aster | **Signal Anchor:** planted relay detonates after a tell | **Lane Shift:** blink forward and strike | **Priority Grid:** three marked lane blasts |
| Moro | **Drift Spark:** leave a damaging skid hazard | **Grind Vault:** airborne crossing strike | **Redline Lap:** three fast passes around a locked route |
| Beacon | **Rally Standard:** a flag pulses at three delayed moments | **Call Response:** paired shockwaves at two distances | **Standing Ovation:** three converging crowd waves |
| Loom | **Prism Post:** delayed glass pillar | **Refract Wall:** a brief invulnerable guard with close burst | **Glass Maze:** three pillars close the marked lane |
| Vesper | **Thread Needle:** long tether shot that draws the target in | **Backstitch:** ribbon pull across a broad area | **Night Weave:** crossing ribbons close around the marked lane |
| Kite | **Rotor Tag:** drone shot marks a delayed follow-up | **Crosswind:** tall rising gust | **Air Traffic:** three overhead drone lanes |
| Iona | **Glacial Pin:** ice stake grows from a marked point | **Sled Charge:** sliding ice impact | **Whiteout Route:** three blizzard sweeps |
| Brink | **Cargo Hook:** chain shot reels the target inward | **Pile Driver:** heavy close ground strike | **Crane Drop:** warned cargo drop for one heavy hit |
| Nix | **Color Bomb:** arcing paint shot with ground splash | **Mask Swap:** blink across the target and turn to face them; uses the available side at a wall | **Mural Flood:** three rolling paint surges |
| Torque | **Magnet Mine:** delayed ground mine | **Pressure Vent:** close knockback cone | **Foundry Overload:** three gear blasts |
| Vela | **Ricochet Disc:** a returning disc can hit twice | **Checkpoint Blink:** alternate between a saved point and a forward gate | **Across Town:** crossed high-speed routes |
| Orbit | **Gravity Tag:** orb shot pulls the target | **Orbit Pivot:** wide gravitational pull | **Singularity:** two pull pulses and a final burst |

The image generation source is in `assets/meridian/source-art/abilities/`: one transparent, three-effect source sheet per fighter, generated with that fighter's portrait as a style reference. [The exporter](tools/build-meridian-abilities.py) isolates the three effects and writes 36 runtime WebP sprites to `assets/meridian/abilities/`. [The contact sheet](validation/meridian/ability-contact-sheet.jpg) and [browser hit report](validation/meridian/ability-hits.json) show the current outputs.

Cooldowns and damage are encoded in the ability module. A complete ultimate hit sequence targets roughly 48 HP out of 200. Its first hit respects ordinary invulnerability; only later hits in that same confirmed ultimate may continue through the target's temporary post-hit invulnerability. Moves can still miss when their marked area, travel lane, or height does not intersect the opponent.
