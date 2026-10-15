"""Browser acceptance for all 36 original Meridian abilities."""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright

OUT = Path(__file__).resolve().parent
GAPS = {
    'aster': (120, 180), 'moro': (85, 120), 'beacon': (85, 85),
    'loom': (85, 85), 'vesper': (85, 85), 'kite': (85, 85),
    'iona': (180, 180), 'brink': (85, 85), 'nix': (85, 85),
    'torque': (120, 85), 'vela': (85, 240), 'orbit': (85, 85),
}

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True, args=['--no-sandbox'])
    page = browser.new_page(viewport={'width': 1440, 'height': 900}, service_workers='block')
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto('http://127.0.0.1:5174/play.html', wait_until='load')
    page.wait_for_function('window.__game?.snapshot().ready')
    results = []
    for fighter in page.evaluate('window.CHOG.characters.map(c=>({kit:c.kit,slug:c.slug,names:c.names}))'):
        page.evaluate('''async kit => {
          const g=window.__game;g.manual=true;
          await g.prepareMatch({player:kit,enemy:'arco',stage:'rayj-house'});
          if(!g.startMatch({player:kit,enemy:'arco',stage:'rayj-house',mode:'training'}))throw Error('match start');
          g.setAI(false);
        }''', fighter['kit'])
        for slot, gap in zip(('skill1', 'skill2', 'ultimate'), (*GAPS[fighter['slug']], 120)):
            result = page.evaluate('''({slot,gap}) => {
              const g=window.__game;g.reset();g.advance(.1);
              g.hero.x=350;g.hero.facing=1;g.dummy.x=350+gap;g.dummy.y=g.config.groundY;g.dummy.facing=-1;
              const started=g.cast(slot),initial=g.snapshot().hero.cooldowns[slot];
              g.advance(2.8);const done=g.snapshot();
              return {started,initialCooldown:initial,damage:done.dummy.damage,
                ended:done.hero.action===null,remaining:done.hero.cooldowns[slot],
                effects:done.meridian};
            }''', {'slot': slot, 'gap': gap})
            result.update({'fighter': fighter['slug'], 'slot': slot, 'gap': gap, 'name': fighter['names'][{'skill1':1,'skill2':2,'ultimate':3}[slot]]})
            result['pass'] = bool(result['started'] and result['initialCooldown'] > 0 and result['damage'] > 0
                                  and result['ended'] and result['remaining'] < result['initialCooldown']
                                  and (slot != 'ultimate' or result['damage'] >= 45))
            results.append(result)
    browser.close()

report = {'results': results, 'pageErrors': errors, 'failures': [f'{r["fighter"]}/{r["slot"]}: {r["damage"]}' for r in results if not r['pass']]}
(OUT / 'ability-hits.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps({'checked': len(results), 'failures': report['failures'], 'pageErrors': errors}, indent=2))
if errors or report['failures']:
    raise SystemExit(1)
