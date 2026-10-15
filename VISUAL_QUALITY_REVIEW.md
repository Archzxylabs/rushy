# Visual quality review: Aether Clash versus Meridian Rush

Reviewed 2026-10-15. This is a production diagnosis, not a gameplay or deployment acceptance result.

## What the reference actually does

[Aether Clash](https://github.com/bangtutorial/aether-clash) ships illustrated, complete fighter poses in WebP atlases. Its [character workflow](https://github.com/bangtutorial/aether-clash/blob/main/guide/character-workflow.md) locks one full-body character design, then uses that character's own base image as the identity reference for each animation. Its [sprite pipeline](https://github.com/bangtutorial/aether-clash/blob/main/guide/sprite-pipeline.md) specifies 14 states and 50 frames per fighter, extracts individual poses, normalizes their scale, anchors them at the feet, and composes the final atlas. Its [sprite QA](https://github.com/bangtutorial/aether-clash/blob/main/guide/sprite-qa.md) checks size, head and body landmarks, gait, edge clipping, and animation loops on the final atlas. Character portraits, skill icons, cut-ins, summon art, and effects are distinct assets. The [stage guide](https://github.com/bangtutorial/aether-clash/blob/main/guide/stage-background.md) leaves a clear fighting lane and lights the floor for sprite readability.

Reference screenshots: [fight](https://github.com/bangtutorial/aether-clash/blob/main/docs/screenshots/fight.jpg), [roster](https://github.com/bangtutorial/aether-clash/blob/main/docs/screenshots/roster.jpg), [ultimate](https://github.com/bangtutorial/aether-clash/blob/main/docs/screenshots/ultimate.jpg).

## What changed in Meridian

The first build used the old [procedural rig](tools/meridian-art.js) for combat. Its [rig contact sheet](assets/meridian/source-art/rig-contact.jpg) shows the large difference between selection art and match sprites. That rig is now a build intermediate only. Four original six-pose transparent sheets per fighter are in `assets/meridian/source-art/combat/`; the [atlas builder](tools/build_illustrated_atlases.py) extracts, scales, anchors, and installs them in all 13 runtime atlases. [Vela versus Brink](validation/meridian/versus.png) and the [mobile touch fight](validation/meridian/mobile-touch-fight.png) show the illustrated sprites in play.

The opaque HUD and round banner have been replaced with smaller dark translucent controls so the stage and fighters remain visible. Each Skill 1 action pose has a measured front-silhouette socket. Meridian's current moves include planted hazards, traveling shots, short repositioning, defensive windows, and area strikes. Their VFX origins and exact frame contact still need a human move-by-move visual review.

Skill 1 and Skill 2 now show a compact move flyer when a committed action begins, including rival casts received from the online server. Ultimates use a full-width illustrated cut-in with the fighter and move name; the presentation clock follows combat time, so pause freezes it. The 12-fighter browser sweep checked 36 move labels and images, plus reset, rejected cooldown input, local rival, and a two-browser online cast. [Screenshots and report](validation/meridian/skill-presentation.json) document this UI layer. It does not certify every pose transition, hitbox, VFX origin, or competitive balance.

The third source sheet supplies anticipation and follow-through poses for Skill 1, Skill 2, and ultimate. The fourth adds separate release and channel transitions, a third combo strike, a running contact step, and a guarded rise. All four cast slots use distinct full-body drawings. Twelve new imagegen VFX source sheets produce 36 transparent sprites, one for each original active skill and ultimate. The [effect contact sheet](validation/meridian/ability-contact-sheet.jpg) shows the exported sprites. The shared [ability module](meridian-abilities.js) now controls cast timing, collision, cooldowns, projectiles, traps, defensive windows, and ultimate damage in the browser and online authority. Code-drawn cast signatures remain behind the fighter as timing cues. Loom's Refract Wall grants a brief defensive window. Ultimates play telegraphs and damage pulses after the cut-in begins.

The [live browser contact sheets](validation/meridian/skill-motion-review.json) capture 144 right-facing phase frames and 36 left-facing contact frames across 12 fighters and three skills. All four pose slots appeared in the right-facing sweep after correcting the late-hit animation stall; every mirrored contact used slot 2. A separate [full-arena release sheet](validation/meridian/skill-contact-full.jpg) shows all 36 casts without cropping the actor's travel or the cut-in. The [run pose sheet](validation/meridian/run-pose-review.jpg) compares the three source drawings used in each fighter's running cycle. The [atlas validator](validation/meridian/art-check.json) found 13 atlases, 867 nonempty frames, zero clipping, zero socket issues, and zero size issues. Browser smoke, 36 presentation checks, mobile touch checks, and 51 server tests passed on the local build.

The 867 runtime slots map to **24 independent key poses per fighter**. Repeated frames preserve the existing state timing and deterministic combat behavior, but walk, run, recover, and combo transitions still need more in-between drawings and loop review. The sweep sampled four moments per skill facing right and one contact moment facing left; it does **not** prove animation smoothness at normal speed, every VFX contact, physical-phone readability, or competitive balance.

## Remaining visual production gate

1. Add movement, combo, and recovery in-betweens where repeated key poses still create visible snapping or foot sliding. Check all 15 states in normal and half-speed playback, facing both directions.
2. Review every basic attack and ability effect at its exact contact frame for all 12 fighters. The 36 ability sprites are distinct, but their origin, scale, and movement need a normal-speed human check against the posed hands, weapons, and target body. Basic attack impacts still use several shared effect shapes.
3. Test the finished composition on a physical phone and with two human players, including hit readability, touch controls, frame pacing, and cut-ins. Correct any failed state before presenting the visual build as production quality.

The prior game's source code is MIT licensed, but its [art, audio, screenshots, and guides are CC BY-NC 4.0](https://github.com/bangtutorial/aether-clash/blob/main/LICENSE-ASSETS.md). Study the workflow; produce original Meridian assets for any funding or commercial path.

## Acceptance boundary

The visual release is ready only when every runtime state reads as the same fighter, attack contact visually matches damage timing and VFX origin, no feet slide or body-size pumping is visible in normal-speed loops, and each fighter reads clearly against all five stages. The illustrated rebuild has improved the actual match, but **that full gate has not passed yet**.
