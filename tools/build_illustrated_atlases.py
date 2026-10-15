"""Extract original illustrated key poses and bake Meridian's runtime atlases.

The game retains its manifest geometry and combat timings. This builder replaces
only visual frame pixels and measured visual bounds. Source sheets are immutable.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageFilter


ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / 'assets/meridian/source-art/combat'
ROSTER = json.loads((ROOT / 'tools/meridian-roster.json').read_text())['characters']

# Calibrated against each fighter's illustrated idle body, rather than tall props.
# Fixed per fighter across all source sheets and every state: no runtime pumping.
SCALE = {
    'aster': .40, 'moro': .40, 'beacon': .49, 'loom': .42,
    'vesper': .41, 'kite': .42, 'iona': .48, 'brink': .44,
    'nix': .42, 'torque': .42, 'vela': .40, 'orbit': .42,
}

# A=idle, run, jump, light attack, projectile cast, hurt.
# B=alternate step, crouch, heavy attack, second skill, ultimate, down.
# C=skill 1 anticipation/follow-through, skill 2 anticipation/follow-through,
#   ultimate anticipation/follow-through. The middle action frames retain the
#   established contact poses and therefore the measured projectile lanes.
# D=three skill transition poses, a combo strike, a running contact step, and
#   a guarded rise. All four skill slots now show distinct drawings.
POSES = {
    'idle':      ['A0'] * 6,
    'walk':      ['B0', 'A1', 'B0', 'A1', 'B0', 'A1', 'B0', 'A1'],
    'run':       ['A1', 'B0', 'D4', 'B0', 'A1', 'B0', 'D4', 'B0'],
    'jump':      ['A2'] * 4,
    'doublejump':['B1'],
    'crouch':    ['B1'] * 4,
    'attack1':   ['A0', 'A3', 'A3', 'A0'],
    'attack2':   ['A0', 'B2', 'B2', 'A0'],
    'attack3':   ['A0', 'B2', 'D3', 'A0'],
    'skill1':    ['C0', 'A4', 'D0', 'C1'],
    'skill2':    ['C2', 'B3', 'D1', 'C3'],
    'ultimate':  ['C4', 'B4', 'D2', 'C5'],
    'hurt':      ['A5', 'A5', 'A5', 'A0'],
    'down':      ['B5'] * 4,
    'recover':   ['B5', 'B1', 'D5', 'A0'],
}


def assignments(path: Path):
    content = path.read_text()
    values = {}
    for match in re.finditer(r'window\.(\w+)\s*=\s*', content):
        values[match.group(1)] = json.JSONDecoder().raw_decode(content[match.end():])[0]
    return values


def components(sheet: Image.Image, fighter: str, letter: str):
    rgba = np.asarray(sheet.convert('RGBA'))
    alpha = rgba[:, :, 3]
    binary = (alpha > 25).astype(np.uint8)
    # Two Loom shield poses meet at one point. Remove their shared five-pixel
    # bridge in the gutter, without altering either source image on disk.
    if fighter == 'loom' and letter == 'A':
        binary[530:, 578:583] = 0
    count, labels, stats, centroids = cv2.connectedComponentsWithStats(binary, 8)
    main = [i for i in range(1, count) if stats[i, cv2.CC_STAT_AREA] > 10000]
    if len(main) != 6:
        raise ValueError(f'{fighter} {letter}: expected six independent poses, found {len(main)}')
    top = sorted((i for i in main if centroids[i, 1] < sheet.height / 2), key=lambda i: centroids[i, 0])
    bottom = sorted((i for i in main if centroids[i, 1] >= sheet.height / 2), key=lambda i: centroids[i, 0])
    if len(top) != 3 or len(bottom) != 3:
        raise ValueError(f'{fighter} {letter}: expected three poses in each row')
    ordered = top + bottom
    masks = {i: (labels == i).astype(np.uint8) for i in ordered}

    # Detached design props (orbs and drones) must follow their owner. Assign
    # small components by row and nearest large component bounding box.
    for i in range(1, count):
        if i in masks or stats[i, cv2.CC_STAT_AREA] < 80:
            continue
        cx, cy = centroids[i]
        candidates = top if cy < sheet.height / 2 else bottom
        def gap(j):
            x, y, w, h = stats[j, :4]
            return (max(x - cx, 0, cx - (x + w)) ** 2 +
                    max(y - cy, 0, cy - (y + h)) ** 2)
        owner = min(candidates, key=gap)
        masks[owner][labels == i] = 1

    result = []
    for i in ordered:
        # Restore feathered alpha at the edge of the component.
        mask = cv2.dilate(masks[i], np.ones((3, 3), np.uint8))
        ys, xs = np.where(mask > 0)
        x0, x1 = max(0, xs.min() - 2), min(sheet.width, xs.max() + 3)
        y0, y1 = max(0, ys.min() - 2), min(sheet.height, ys.max() + 3)
        crop = rgba[y0:y1, x0:x1].copy()
        crop[:, :, 3] = (crop[:, :, 3].astype(np.uint16) * mask[y0:y1, x0:x1]).astype(np.uint8)
        if crop[:, :, 3].max() < 100:
            raise ValueError(f'{fighter} {letter}: empty extracted pose')
        result.append(Image.fromarray(crop, 'RGBA'))
    return result


def source_anchor(pose: Image.Image, down: bool):
    alpha = np.asarray(pose)[:, :, 3]
    ys, xs = np.where(alpha > 40)
    if len(xs) < 1000:
        raise ValueError('Pose has too few visible pixels')
    bottom = int(ys.max()) + 1
    if down:
        foot_x = int(np.median(xs))
    else:
        feet = xs[ys > bottom - max(15, int(pose.height * .10))]
        foot_x = int(np.median(feet)) if len(feet) else int(np.median(xs))
    return foot_x, bottom


def draw_pose(atlas, box, cell, pose, scale, empowered, down):
    px, py = source_anchor(pose, down)
    new_size = (max(1, round(pose.width * scale)), max(1, round(pose.height * scale)))
    sprite = pose.resize(new_size, Image.Resampling.LANCZOS)
    if empowered:
        glow = Image.new('RGBA', sprite.size)
        glow.paste((255, 200, 80, 0), (0, 0, *sprite.size))
        glow.putalpha(sprite.getchannel('A').filter(ImageFilter.GaussianBlur(8)).point(lambda a: round(a * .40)))
        merged = Image.new('RGBA', sprite.size)
        merged.alpha_composite(glow)
        merged.alpha_composite(sprite)
        sprite = merged
    local_x = round(cell['anchor_x'] - px * scale)
    local_y = round(cell['anchor_y'] - py * scale)
    # A long flag/lance can extend farther behind the planted feet than the
    # prior procedural cell expected. Translate within the cell, never rescale
    # an individual frame; record the resulting visual bounds below.
    if sprite.width <= box['w'] - 4:
        local_x = max(2, min(local_x, box['w'] - sprite.width - 2))
    if local_x < 2 or local_y < 2 or local_x + sprite.width > box['w'] - 2 or local_y + sprite.height > box['h'] - 2:
        raise ValueError(f'Illustrated pose clips frame {box} at {(local_x, local_y)} size {sprite.size}')
    atlas.alpha_composite(sprite, (box['x'] + local_x, box['y'] + local_y))
    visible = np.asarray(sprite.getchannel('A')) > 25
    ys, xs = np.where(visible)
    bounds = {
        'left': int(local_x + xs.min() - cell['anchor_x']),
        'right': int(local_x + xs.max() + 1 - cell['anchor_x']),
        'top': int(local_y + ys.min() - cell['anchor_y']),
        'bottom': int(local_y + ys.max() + 1 - cell['anchor_y']),
    }
    if bounds['bottom'] > 2 or bounds['top'] >= -40:
        raise ValueError(f'Implausible feet/body bounds: {bounds}')
    return bounds


def front_silhouette_socket(atlas, box, cell):
    """Place the first projectile at the visible front tip of its action pose."""
    alpha = np.asarray(atlas.crop((box['x'], box['y'], box['x'] + box['w'], box['y'] + box['h'])).getchannel('A'))
    ys, xs = np.where(alpha > 128)
    if len(xs) < 1000:
        raise ValueError('Skill pose has too few opaque pixels for a projectile socket')
    front = xs >= np.quantile(xs, .995)
    return {'x': int(round(np.median(xs[front]))) - cell['anchor_x'],
            'y': int(round(np.median(ys[front]))) - cell['anchor_y']}


def build_one(fighter: str, variant: str | None, poses):
    directory = ROOT / 'assets/meridian/fighters' / fighter
    if variant:
        directory /= variant
    manifest_path = directory / 'manifest.js'
    values = assignments(manifest_path)
    manifest_key = next(k for k in values if k.endswith('MANIFEST'))
    metrics_key = next(k for k in values if k.endswith('METRICS'))
    manifest, metrics = values[manifest_key], values[metrics_key]
    layout, cell = manifest['frame_layout'], manifest['cell']
    atlas = Image.new('RGBA', (layout['sheetWidth'], layout['sheetHeight']))
    for state, row in layout['rows'].items():
        keys = POSES.get(state)
        # Iona's ice bolt is a low rising poke. Her horizontal thrust matches
        # the existing projectile lane in the two release frames.
        if fighter == 'iona' and state == 'skill1':
            keys = ['C0', 'A3', 'D0', 'C1']
        if not keys or len(keys) != len(row):
            raise ValueError(f'{fighter}: unmapped state {state} with {len(row)} frames')
        measured = []
        for index, box in enumerate(row):
            key = keys[index]
            pose = poses[key[0]][int(key[1])]
            bounds = draw_pose(atlas, box, cell, pose, SCALE[fighter], variant == 'empowered', state == 'down' or (state == 'recover' and index == 0))
            measured.append({'frame': index, 'bounds': bounds, 'height': bounds['bottom'] - bounds['top']})
        metrics.setdefault('states', {}).setdefault(state, {})['frames'] = measured
    manifest.setdefault('presentation', {}).update({
        'version': 3, 'rig': 'original illustrated full-body key poses',
        'source': f'assets/meridian/source-art/combat/{fighter}/poses-a.png + poses-b.png + poses-c.png + poses-d.png',
        'pose_count': 24, 'frame_slots': sum(len(v) for v in layout['rows'].values()),
        'scale': SCALE[fighter],
    })
    # Emitters from the prior rig are gameplay anchors. Preserve them until
    # art-specific hand/muzzle measurement is completed in live-action QA.
    for emitter in metrics.get('emitters', {}).values():
        if isinstance(emitter, dict) and emitter.get('method', '').startswith('Meridian v1'):
            emitter['method'] = 'legacy gameplay anchor; art-specific muzzle review pending'
    # Skill 1 creates a visible projectile or burst. Its old procedural socket
    # could sit a full hand-length away from the illustrated action pose.
    skill_box = layout['rows']['skill1'][2]
    skill_tip = front_silhouette_socket(atlas, skill_box, cell)
    metrics['emitters']['skill1'].update(skill_tip)
    metrics['emitters']['skill1']['method'] = 'Meridian illustrated action pose: front silhouette tip (frame 2)'
    out = directory / 'run/sprite-sheet-alpha.webp'
    out.parent.mkdir(parents=True, exist_ok=True)
    atlas.save(out, 'WEBP', quality=95, method=6)
    manifest_path.write_text('/* Meridian illustrated fighter atlas and measured alpha bounds. */\n' + '\n'.join(
        'window.' + key + ' = ' + json.dumps(value, separators=(',', ':')) + ';' for key, value in values.items()) + '\n')
    return out, sum(len(v) for v in layout['rows'].values())


def build():
    report = {'source': 'built-in image generation; 48 original six-pose sheets', 'characters': {}, 'total_frame_slots': 0}
    for entry in ROSTER:
        fighter = entry['id']
        poses = {}
        for letter in 'ABCD':
            path = SOURCE / fighter / f'poses-{letter.lower()}.png'
            if not path.is_file():
                raise FileNotFoundError(path)
            poses[letter] = components(Image.open(path), fighter, letter)
        variants = ['base', 'empowered'] if fighter == 'moro' else [None]
        for variant in variants:
            out, slots = build_one(fighter, variant, poses)
            report['total_frame_slots'] += slots
            report['characters'][fighter + (':' + variant if variant else '')] = {'atlas': str(out.relative_to(ROOT)), 'key_poses': 24, 'frame_slots': slots}
        print('Illustrated', fighter, flush=True)
    (ROOT / 'assets/meridian/illustrated-build.json').write_text(json.dumps(report, indent=2) + '\n')
    return report


if __name__ == '__main__':
    build()
