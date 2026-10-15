"""Capture each fighter's first skill at its contact frame for visual review."""
import json
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).resolve().parent
ROSTER = json.loads((ROOT / 'tools/meridian-roster.json').read_text())['characters']
report = {'fighters': [], 'pageErrors': []}

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True, args=['--no-sandbox'])
    page = browser.new_page(viewport={'width': 1440, 'height': 900}, service_workers='block')
    page.on('pageerror', lambda error: report['pageErrors'].append(str(error)))
    page.goto('http://127.0.0.1:5174/play.html', wait_until='load')
    page.wait_for_function('window.__game?.snapshot().ready')
    for fighter in ROSTER:
        source_id = fighter['source_kit_id']
        info = page.evaluate('''async id => {
          const game = window.__game;
          game.manual = true;
          await game.prepareMatch({player:id,enemy:'arco',stage:'cwo-rally'});
          game.startMatch({player:id,enemy:'arco',stage:'cwo-rally',mode:'training'});
          game.setAI(false);
          game.advance(.1);
          game.dummy.x = game.hero.x + 350;
          const started = game.cast('skill1');
          const action = game.snapshot().hero.action;
          if (!started || !action) return {started, error:'Skill 1 did not create an action'};
          game.advance(action.duration * (action.hitAt ?? .5) + .02);
          const snapshot = game.snapshot();
          return {started, name:action.name, pose:game.pose(), damage:snapshot.dummy.damage,
            projectiles:snapshot.projectileCount,
            effects:game.effects.slice(-4).map(e=>({type:e.type,x:e.x,y:e.y}))};
        }''', source_id)
        page.screenshot(path=str(OUT / f'skill1-{fighter["id"]}.png'))
        report['fighters'].append({'id': fighter['id'], **info})
    browser.close()

(OUT / 'skill1-visual.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps({'fighters': len(report['fighters']), 'failed': [f['id'] for f in report['fighters'] if not f.get('started')], 'pageErrors': report['pageErrors']}, indent=2))
