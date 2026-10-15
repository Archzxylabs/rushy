"""Capture each skill's four live action phases for visual review."""
import io
import json
from pathlib import Path

from PIL import Image, ImageDraw
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).resolve().parent
ROSTER = json.loads((ROOT / 'tools/meridian-roster.json').read_text())['characters']
PHASES = ('anticipate', 'windup', 'contact', 'recover')
SLOTS = ('skill1', 'skill2', 'ultimate')
CELL = (220, 210)
report = {'captures': [], 'mirrorCaptures': [], 'pageErrors': [], 'failures': []}

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True, args=['--no-sandbox'])
    page = browser.new_page(viewport={'width': 1440, 'height': 900}, service_workers='block')
    page.on('pageerror', lambda error: report['pageErrors'].append(str(error)))
    page.goto('http://127.0.0.1:5174/play.html', wait_until='load')
    page.wait_for_function('window.__game?.snapshot().ready')
    for slot in SLOTS:
        sheet = Image.new('RGB', (CELL[0] * 4, CELL[1] * len(ROSTER)), '#172536')
        pen = ImageDraw.Draw(sheet)
        for row, fighter in enumerate(ROSTER):
            kit = fighter['source_kit_id']
            page.evaluate('''async kit => {
              const g=window.__game;g.manual=true;
              await g.prepareMatch({player:kit,enemy:'arco',stage:'rayj-house'});
              g.startMatch({player:kit,enemy:'arco',stage:'rayj-house',mode:'training'});
              g.setAI(false);g.advance(.1);g.dummy.x=1000;
            }''', kit)
            prior = 0
            for col, phase in enumerate(PHASES):
                result = page.evaluate('''([slot,col,prior]) => {
                  const g=window.__game;
                  if(prior===0 && !g.cast(slot))return {error:'cast rejected'};
                  const action=g.snapshot().hero.action;
                  if(!action)return {error:'action missing'};
                  const release=slot==='ultimate'?.5:slot==='skill2'&&action.hitAt>=.9?.72:(action.hitAt??.5);
                  const ratio=[release*.18,release*.7,release+(1-release)*.18,release+(1-release)*.8][col];
                  g.advance(action.duration*(ratio-prior));
                  return {duration:action.duration,ratio,frame:g.pose().frame,
                    state:g.pose().state,action:g.snapshot().hero.action?.type||null};
                }''', [slot, col, prior])
                if 'error' in result or result.get('frame') != col:
                    report['failures'].append({'fighter': fighter['id'], 'slot': slot, 'phase': phase, **result})
                raw = page.locator('#arena').screenshot()
                full = Image.open(io.BytesIO(raw)).convert('RGB')
                # Projected P1 at x≈394, floor≈734 in the 1440×900 viewport.
                crop = full.crop((180, 335, 650, 795))
                crop.thumbnail((CELL[0], CELL[1] - 20), Image.Resampling.LANCZOS)
                x, y = col * CELL[0], row * CELL[1]
                sheet.paste(crop, (x + (CELL[0] - crop.width)//2, y + 20))
                pen.text((x+6, y+3), f'{fighter["id"]} / {phase} / f{result.get("frame","?")}', fill='#f4f0e6')
                report['captures'].append({'fighter': fighter['id'], 'slot': slot, 'phase': phase, **result})
                prior = result.get('ratio', prior)
        sheet.save(OUT / f'skill-motion-{slot}.jpg', quality=90)
    mirror = Image.new('RGB', (CELL[0] * len(SLOTS), CELL[1] * len(ROSTER)), '#172536')
    pen = ImageDraw.Draw(mirror)
    for row, fighter in enumerate(ROSTER):
        kit = fighter['source_kit_id']
        for col, slot in enumerate(SLOTS):
            result = page.evaluate('''async ([kit,slot]) => {
              const g=window.__game;g.manual=true;
              await g.prepareMatch({player:kit,enemy:'arco',stage:'rayj-house'});
              g.startMatch({player:kit,enemy:'arco',stage:'rayj-house',mode:'training'});
              g.setAI(false);g.advance(.1);g.hero.facing=-1;g.dummy.x=80;
              if(!g.cast(slot))return {error:'cast rejected'};
              const a=g.snapshot().hero.action;
              const release=slot==='ultimate'?.5:slot==='skill2'&&a.hitAt>=.9?.72:(a.hitAt??.5);
              g.advance(a.duration*(release+(1-release)*.18));
              return {frame:g.pose().frame,facing:g.snapshot().hero.facing,x:g.hero.x,
                state:g.pose().state,action:g.snapshot().hero.action?.type||null};
            }''', [kit, slot])
            # At the left wall, Mask Swap uses the available side and still
            # faces the target instead of blinking out of bounds.
            if result.get('frame') != 2 or result.get('facing') != -1:
                report['failures'].append({'fighter': fighter['id'], 'slot': slot, 'mirror': True, **result})
            raw = page.locator('#arena').screenshot()
            full = Image.open(io.BytesIO(raw)).convert('RGB')
            center = round(result.get('x', 350) * 1.125)
            crop = full.crop((center-215, 335, center+255, 795))
            crop.thumbnail((CELL[0], CELL[1] - 20), Image.Resampling.LANCZOS)
            x, y = col * CELL[0], row * CELL[1]
            mirror.paste(crop, (x + (CELL[0] - crop.width)//2, y + 20))
            pen.text((x+6, y+3), f'{fighter["id"]} / {slot} / f{result.get("frame","?")}', fill='#f4f0e6')
            report['mirrorCaptures'].append({'fighter': fighter['id'], 'slot': slot, **result})
    mirror.save(OUT / 'skill-motion-left.jpg', quality=90)
    browser.close()

(OUT / 'skill-motion-review.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps({'captures': len(report['captures']), 'mirrorCaptures': len(report['mirrorCaptures']), 'failures': report['failures'],
                  'pageErrors': report['pageErrors']}, indent=2))
if report['failures'] or report['pageErrors']:
    raise SystemExit(1)
