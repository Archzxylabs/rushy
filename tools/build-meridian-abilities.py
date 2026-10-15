"""Export the imagegen source sheets into three runtime VFX sprites per fighter."""
from pathlib import Path
from PIL import Image, ImageChops
import cv2
import numpy as np

ROOT = Path(__file__).resolve().parents[1] / 'assets' / 'meridian'
SOURCE = ROOT / 'source-art' / 'abilities'
OUT = ROOT / 'abilities'
SLUGS = ('aster','moro','beacon','loom','vesper','kite','iona','brink','nix','torque','vela','orbit')

for slug in SLUGS:
    image = Image.open(SOURCE / f'{slug}-fx-sheet.png').convert('RGBA')
    width, height = image.size
    target = OUT / slug
    target.mkdir(parents=True, exist_ok=True)
    for index, slot in enumerate(('skill1','skill2','ultimate')):
        left = round(index * width / 3)
        right = round((index + 1) * width / 3)
        cut = image.crop((left, 0, right, height))
        alpha = np.asarray(cut.getchannel('A'))
        count, labels, stats, centers = cv2.connectedComponentsWithStats((alpha > 22).astype('uint8'))
        largest = max(range(1, count), key=lambda component: stats[component, cv2.CC_STAT_AREA])
        kept = [component for component in range(1, count)
                if component == largest or
                (stats[component, cv2.CC_STAT_AREA] >= 50 and
                 (index == 0 or centers[component, 0] > cut.width * .16) and
                 (index == 2 or centers[component, 0] < cut.width * .82))]
        isolation = np.isin(labels, kept).astype('uint8') * 255
        isolation = cv2.dilate(isolation, np.ones((13, 13), dtype='uint8'))
        isolation = cv2.GaussianBlur(isolation, (7, 7), 0)
        cut.putalpha(ImageChops.multiply(cut.getchannel('A'), Image.fromarray(isolation)))
        # Some generated sheets let a neighboring effect graze a slot boundary.
        # Feather only that boundary, keeping the center and outer silhouette crisp.
        feather = round(cut.width * .17)
        edge = Image.new('L', (cut.width, 1), 255)
        for x in range(cut.width):
            strength = 255
            if index > 0:
                strength = min(strength, round(255 * min(1, x / feather)))
            if index < 2:
                strength = min(strength, round(255 * min(1, (cut.width - 1 - x) / feather)))
            edge.putpixel((x, 0), strength)
        mask = edge.resize(cut.size)
        cut.putalpha(ImageChops.multiply(cut.getchannel('A'), mask))
        # Equal square canvases keep each source image at its intended center and
        # let the runtime resize an effect without changing its aspect ratio.
        side = max(cut.size)
        square = Image.new('RGBA', (side, side))
        square.alpha_composite(cut, ((side - cut.width) // 2, (side - cut.height) // 2))
        square.resize((512, 512), Image.Resampling.LANCZOS).save(target / f'{slot}.webp', quality=91, method=6)
print(f'Exported {len(SLUGS) * 3} original VFX sprites to {OUT}')
