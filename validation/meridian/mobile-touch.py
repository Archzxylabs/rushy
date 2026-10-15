"""Verify touch attack in a real landscape mobile viewport."""
from playwright.sync_api import sync_playwright
from pathlib import Path
import json
OUT=Path(__file__).resolve().parent
result={'errors':[]}
with sync_playwright() as p:
    browser=p.chromium.launch(args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':844,'height':390},is_mobile=True,has_touch=True,service_workers='block')
    page.on('pageerror',lambda e:result['errors'].append(str(e)))
    page.goto('http://127.0.0.1:5174/play.html?touch=1&embed=1',wait_until='load')
    page.wait_for_function('window.__game?.snapshot().ready',timeout=30000)
    page.evaluate('''async () => {await __game.prepareMatch({player:'venty',enemy:'yot',stage:'rayj-house'});__game.startMatch({player:'nib',enemy:'arco',stage:'rayj-house',mode:'training'});__game.setAI(false);__game.dummy.x=__game.hero.x+85;}''')
    page.locator('.tbtn-attack').tap()
    page.wait_for_function('window.__game.snapshot().dummy.damage>0',timeout=5000)
    result['damage']=page.evaluate('window.__game.snapshot().dummy.damage')
    result['touchControlsVisible']=page.locator('#touch-controls').is_visible()
    page.screenshot(path=str(OUT/'mobile-touch-fight.png'))
    result['skills']={}
    for button,skill in [('.tbtn-s1','skill1'),('.tbtn-s2','skill2'),('.tbtn-ult','ultimate')]:
        page.evaluate('window.__game.reset()')
        page.locator(button).tap()
        cooldown=page.evaluate('(name) => window.__game.snapshot().hero.cooldowns[name]',skill)
        result['skills'][skill]=cooldown
        assert cooldown>0,f'{skill} did not start from its touch button'
    browser.close()
(OUT/'mobile-touch.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result,indent=2))
