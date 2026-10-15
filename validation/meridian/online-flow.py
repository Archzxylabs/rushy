"""Two browser contexts join a real free Meridian duel on a local server."""
from playwright.sync_api import sync_playwright
from pathlib import Path
import json
import os
OUT=Path(__file__).resolve().parent
BASE=os.environ.get('MERIDIAN_BASE','http://127.0.0.1:5190')
report={'errors':[]}
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,args=['--no-sandbox'])
    contexts=[browser.new_context(viewport={'width':1280,'height':800},service_workers='block') for _ in range(2)]
    one,two=[c.new_page() for c in contexts]
    for i,page in enumerate((one,two)):
        page.on('pageerror',lambda e,i=i:report['errors'].append(f'P{i+1}: {e}'))
    one.goto(BASE+'/play.html',wait_until='load')
    one.wait_for_selector('#front-menu[data-screen=home] .hub-persona',timeout=30000)
    one.click('[data-cmd=online]')
    one.wait_for_selector('#online-root .online-persona',timeout=30000)
    report['rosterCards']=one.locator('#online-root .online-persona').count()
    report['paidVisible']='PAID TESTNET' in one.locator('#online-root').inner_text()
    one.locator('#online-root [data-action=pick][data-chog=venty]').click()
    one.locator('#online-root [data-action=create-room]').click()
    one.wait_for_selector('#online-root input[aria-label="Room invite link"]',timeout=30000)
    invitation=one.locator('#online-root input[aria-label="Room invite link"]').input_value()
    report['invitationCreated']=bool(invitation)
    two.goto(invitation,wait_until='load')
    two.wait_for_selector('#online-root .online-seat-status',timeout=30000)
    report['lobbySeats']=two.locator('#online-root .online-showcase').count()
    one.wait_for_function('document.querySelector("#online-root [data-action=ready]")&&!document.querySelector("#online-root [data-action=ready]").disabled',timeout=30000)
    two.wait_for_function('document.querySelector("#online-root [data-action=ready]")&&!document.querySelector("#online-root [data-action=ready]").disabled',timeout=30000)
    one.locator('#online-root [data-action=ready]').click()
    two.locator('#online-root [data-action=ready]').click()
    one.wait_for_function('document.querySelector("#online-root").classList.contains("in-match")',timeout=30000)
    two.wait_for_function('document.querySelector("#online-root").classList.contains("in-match")',timeout=30000)
    report['p1']=one.evaluate('''() => ({fighter:document.querySelector('#player-name').textContent,mode:document.querySelector('#online-root').className,asset:window.__game.snapshot().stageLoaded})''')
    report['p2']=two.evaluate('''() => ({fighter:document.querySelector('#player-name').textContent,mode:document.querySelector('#online-root').className,asset:window.__game.snapshot().stageLoaded})''')
    one.wait_for_function("window.__game.snapshot().match?.phase==='fight'",timeout=30000)
    two.wait_for_function("window.__game.snapshot().match?.phase==='fight'",timeout=30000)
    one.evaluate("window.__game.cast('skill1')")
    one.wait_for_function("document.querySelector('#skill-flyer.visible')?.dataset.owner==='player'",timeout=5000)
    two.wait_for_function("document.querySelector('#skill-flyer.visible')?.dataset.owner==='enemy'",timeout=5000)
    report['skillFlyer']={
      'player':one.locator('#skill-flyer .skill-flyer-name').inner_text(),
      'rival':two.locator('#skill-flyer .skill-flyer-name').inner_text(),
      'owners':['player','enemy']
    }
    assert report['skillFlyer']['player']==report['skillFlyer']['rival']=='RICOCHET DISC'
    one.wait_for_function("window.__game.snapshot().hero.action===null",timeout=5000)
    one.evaluate("window.__game.cast('ultimate')")
    one.wait_for_selector('#ultimate-cutin.visible',timeout=5000)
    two.wait_for_selector('#ultimate-cutin.visible',timeout=5000)
    report['ultimate']={
      'player':one.locator('#ultimate-cutin strong').inner_text().replace('\n',' '),
      'rival':two.locator('#ultimate-cutin strong').inner_text().replace('\n',' '),
      'ownerPlayer':one.locator('#ultimate-cutin .cutin-kicker').inner_text(),
      'ownerRival':two.locator('#ultimate-cutin .cutin-kicker').inner_text()
    }
    assert report['ultimate']['player']==report['ultimate']['rival']=='ACROSS TOWN'
    assert 'PLAYER' in report['ultimate']['ownerPlayer'] and 'RIVAL' in report['ultimate']['ownerRival']
    one.screenshot(path=str(OUT/'online-fight.png'))
    browser.close()
(OUT/'online-flow.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
