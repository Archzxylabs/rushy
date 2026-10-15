"""Capture the complete arena at each fighter's visual skill-release phase."""
import io
import json
from pathlib import Path

from PIL import Image, ImageDraw
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).resolve().parent
ROSTER = json.loads((ROOT / 'tools/meridian-roster.json').read_text())['characters']
SLOTS = ('skill1', 'skill2', 'ultimate')
CELL = (400, 250)
report = {'captures': [], 'failures': [], 'pageErrors': []}
sheet = Image.new('RGB', (CELL[0] * 3, CELL[1] * len(ROSTER)), '#172536')
pen = ImageDraw.Draw(sheet)

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True, args=['--no-sandbox'])
    page = browser.new_page(viewport={'width': 1440, 'height': 900}, service_workers='block')
    page.on('pageerror', lambda error: report['pageErrors'].append(str(error)))
    page.goto('http://127.0.0.1:5174/play.html', wait_until='load')
    page.wait_for_function('window.__game?.snapshot().ready')
    for row, fighter in enumerate(ROSTER):
        for col, slot in enumerate(SLOTS):
            result = page.evaluate('''async ([kit,slot]) => {
              const g=window.__game;g.manual=true;
              await g.prepareMatch({player:kit,enemy:'arco',stage:'rayj-house'});
              g.startMatch({player:kit,enemy:'arco',stage:'rayj-house',mode:'training'});
              g.setAI(false);g.advance(.1);g.dummy.x=700;
              if(!g.cast(slot))return {error:'cast rejected'};
              const a=g.snapshot().hero.action;
              const release=slot==='ultimate'?.5:slot==='skill2'&&a.hitAt>=.9?.72:(a.hitAt??.5);
              g.advance(a.duration*(release+(1-release)*.18));
              return {frame:g.pose().frame,state:g.pose().state,heroX:g.snapshot().hero.x,
                action:g.snapshot().hero.action?.type||null};
            }''', [fighter['source_kit_id'], slot])
            if result.get('frame') != 2:
                report['failures'].append({'fighter': fighter['id'], 'slot': slot, **result})
            arena = Image.open(io.BytesIO(page.locator('#arena').screenshot())).convert('RGB')
            arena.thumbnail((CELL[0], CELL[1] - 22), Image.Resampling.LANCZOS)
            x, y = col * CELL[0], row * CELL[1]
            sheet.paste(arena, (x + (CELL[0] - arena.width) // 2, y + 22))
            pen.text((x+7, y+4), f'{fighter["id"]} / {slot} / f{result.get("frame","?")}', fill='#f4f0e6')
            report['captures'].append({'fighter': fighter['id'], 'slot': slot, **result})
    browser.close()

sheet.save(OUT / 'skill-contact-full.jpg', quality=91)
(OUT / 'skill-contact-full.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps({'captures': len(report['captures']), 'failures': report['failures'],
                  'pageErrors': report['pageErrors']}, indent=2))
if report['failures'] or report['pageErrors']:
    raise SystemExit(1)
