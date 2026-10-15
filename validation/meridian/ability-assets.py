"""Validate the 36 runtime sprites exported from the imagegen source sheets."""
import hashlib
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'assets/meridian/source-art/abilities'
RUNTIME = ROOT / 'assets/meridian/abilities'
SLUGS = ('aster','moro','beacon','loom','vesper','kite','iona','brink','nix','torque','vela','orbit')
SLOTS = ('skill1','skill2','ultimate')
results = []
for slug in SLUGS:
    assert (SOURCE / f'{slug}-fx-sheet.png').is_file(), slug
    for slot in SLOTS:
        path = RUNTIME / slug / f'{slot}.webp'
        image = Image.open(path).convert('RGBA')
        alpha = image.getchannel('A')
        box = alpha.getbbox()
        results.append({'fighter':slug,'slot':slot,'size':image.size,'bounds':box,
                        'sha256':hashlib.sha256(path.read_bytes()).hexdigest()})
        assert image.size == (512,512), path
        assert box and box[2]-box[0]>100 and box[3]-box[1]>100, path
        assert all(alpha.getpixel(point)==0 for point in ((0,0),(0,511),(511,0),(511,511))), path
assert len({row['sha256'] for row in results}) == 36
report = {'sourceSheets':len(SLUGS),'runtimeSprites':len(results),'uniqueSprites':36,'results':results}
(Path(__file__).resolve().parent / 'ability-assets.json').write_text(json.dumps(report,indent=2)+'\n')
print('PASS: 12 source sheets, 36 unique transparent 512×512 ability sprites')
