"""Browser acceptance for the 12 Meridian move headers and ultimate cut-ins."""
import json
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).resolve().parent
BASE = 'http://127.0.0.1:5174/play.html'


def setup(page, player, enemy='arco'):
    return page.evaluate('''async ([player, enemy]) => {
      const g=window.__game;
      g.manual=true;
      await g.prepareMatch({player,enemy,stage:'rayj-house'});
      if(!g.startMatch({player,enemy,stage:'rayj-house',mode:'training'}))throw Error('Match did not start');
      g.setAI(false);
      g.advance(.1);
      return g.snapshot().selectedCharacter;
    }''', [player, enemy])


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True, args=['--no-sandbox'])
    page = browser.new_page(viewport={'width': 1440, 'height': 900}, service_workers='block')
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(BASE, wait_until='load')
    page.wait_for_function('window.__game?.snapshot().ready')
    results = []
    for fighter in page.evaluate('window.CHOG.characters.map(c=>({kit:c.kit,name:c.name,names:c.names}))'):
        setup(page, fighter['kit'])
        for slot in ['skill1', 'skill2', 'ultimate']:
            result = page.evaluate('''slot => {
              const g=window.__game;
              g.reset();g.advance(.1);
              const started=g.cast(slot);
              g.advance(slot==='ultimate'?.29:.18);
              const el=document.querySelector(slot==='ultimate'?'#ultimate-cutin':'#skill-flyer');
              const box=el.getBoundingClientRect();
              return {started,visible:el.classList.contains('visible'),
                label:slot==='ultimate'?el.querySelector('strong').innerText.replace(/\\n/g,' '):el.querySelector('.skill-flyer-name').textContent,
                owner:el.dataset.owner||'player',imageLoaded:el.querySelector('img').naturalWidth>0,
                width:box.width,viewport:innerWidth};
            }''', slot)
            expected = fighter['names'][{'skill1': 1, 'skill2': 2, 'ultimate': 3}[slot]]
            result.update({'fighter': fighter['name'], 'slot': slot, 'expected': expected})
            result['pass'] = (result['started'] and result['visible'] and result['label'] == expected
                              and result['imageLoaded'] and (slot != 'ultimate' or result['width'] >= result['viewport'] * .9))
            results.append(result)

    setup(page, 'rhea', 'arco')
    page.evaluate("() => {const g=window.__game;g.cast('skill1');g.advance(.18)}")
    page.screenshot(path=str(OUT / 'skill-flyer-desktop.png'))
    desktop_flyer = page.evaluate("() => document.querySelector('#skill-flyer').getBoundingClientRect().toJSON()")
    page.evaluate("() => {const g=window.__game;g.reset();g.advance(.1);g.cast('ultimate');g.advance(.29)}")
    page.screenshot(path=str(OUT / 'ultimate-cutin-desktop.png'))
    desktop_ultimate = page.evaluate("() => document.querySelector('#ultimate-cutin').getBoundingClientRect().toJSON()")

    behavior = page.evaluate('''() => {
      const g=window.__game, f=document.querySelector('#skill-flyer');
      g.reset();g.advance(.1);g.cast('skill1');g.advance(.18);
      const first=f.classList.contains('visible');
      g.setPaused(true);const t=g.snapshot().time;g.advance(1);
      const frozen=g.snapshot().time===t&&f.classList.contains('visible');
      g.setPaused(false);g.advance(.8);
      const expired=!f.classList.contains('visible');
      const rejected=!g.cast('skill1');g.advance(.03);
      const noFalseHeader=!f.classList.contains('visible');
      g.reset();g.advance(.03);
      const resetHidden=!f.classList.contains('visible');
      const enemyStarted=g.enemyCast('skill2');g.advance(.14);
      return {first,frozen,expired,rejected,noFalseHeader,resetHidden,
        enemyStarted,enemyVisible:f.classList.contains('visible'),enemyOwner:f.dataset.owner,enemyName:f.querySelector('.skill-flyer-name').textContent};
    }''')

    mobile = browser.new_page(viewport={'width': 844, 'height': 390}, service_workers='block')
    mobile.on('pageerror', lambda error: errors.append(str(error)))
    mobile.goto(BASE + '?touch=1&embed=1', wait_until='load')
    mobile.wait_for_function('window.__game?.snapshot().ready')
    setup(mobile, 'nib')
    mobile.evaluate("() => {const g=window.__game;g.cast('skill2');g.advance(.18)}")
    mobile.screenshot(path=str(OUT / 'skill-flyer-mobile.png'))
    mobile_flyer = mobile.evaluate("() => {const e=document.querySelector('#skill-flyer');return {visible:e.classList.contains('visible'),box:e.getBoundingClientRect().toJSON(),name:e.querySelector('.skill-flyer-name').textContent}}")
    mobile.evaluate("() => {const g=window.__game;g.reset();g.advance(.1);g.cast('ultimate');g.advance(.29)}")
    mobile.screenshot(path=str(OUT / 'ultimate-cutin-mobile.png'))
    mobile_ultimate = mobile.evaluate("() => {const e=document.querySelector('#ultimate-cutin');return {visible:e.classList.contains('visible'),box:e.getBoundingClientRect().toJSON(),name:e.querySelector('strong').innerText}}")
    browser.close()

report = {'results': results, 'behavior': behavior, 'desktop': {'flyer': desktop_flyer, 'ultimate': desktop_ultimate},
          'mobile': {'flyer': mobile_flyer, 'ultimate': mobile_ultimate}, 'pageErrors': errors}
(OUT / 'skill-presentation.json').write_text(json.dumps(report, indent=2) + '\n')
failures = [f'{r["fighter"]} {r["slot"]}' for r in results if not r['pass']]
print(json.dumps({'checked': len(results), 'failures': failures, 'behavior': behavior,
                  'mobileVisible': [mobile_flyer['visible'], mobile_ultimate['visible']], 'pageErrors': errors}, indent=2))
if failures or errors or not all(behavior[k] for k in ['first', 'frozen', 'expired', 'rejected', 'noFalseHeader', 'resetHidden', 'enemyStarted', 'enemyVisible']) or behavior['enemyOwner'] != 'enemy' or not mobile_flyer['visible'] or not mobile_ultimate['visible']:
    raise SystemExit(1)
