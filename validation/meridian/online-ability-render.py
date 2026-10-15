"""Render shared online ability snapshots for both player seats."""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright

OUT = Path(__file__).resolve().parent
with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True, args=['--no-sandbox'])
    page = browser.new_page(viewport={'width': 1440, 'height': 900}, service_workers='block')
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto('http://127.0.0.1:5174/play.html', wait_until='load')
    page.wait_for_function('window.__game?.snapshot().ready')
    results = []
    for fighter in page.evaluate('window.CHOG.characters.map(c=>({id:c.id,kit:c.kit,slug:c.slug,names:c.names}))'):
        for seat in (0, 1):
            for slot in ('skill1', 'ultimate'):
                result = page.evaluate('''async ({fighter,seat,slot}) => {
                  const g=window.__game;g.manual=true;
                  await g.prepareMatch({player:fighter.kit,enemy:'arco',stage:'rayj-house'});
                  if(!g.startMatch({player:fighter.kit,enemy:'arco',stage:'rayj-house',mode:'training'}))throw Error('start');
                  g.setOnlineInput(()=>true);
                  const {createCombat}=await import('./online/core.mjs');
                  const ids=seat===0?[fighter.id,'yot']:['yot',fighter.id];
                  const sim=createCombat({characters:ids,skipIntro:true});
                  sim.actors[0].x=470;sim.actors[1].x=590;
                  const bit=slot==='ultimate'?128:32;
                  for(let i=0;i<12;i++){
                    const frames=[{bits:0,seq:i},{bits:0,seq:i}];
                    if(i===0)frames[seat].bits=bit;
                    sim.step(frames);
                  }
                  g.renderOnline(sim.snapshot(),seat);g.draw();
                  const el=document.querySelector(slot==='ultimate'?'#ultimate-cutin':'#skill-flyer');
                  return {character:g.snapshot().selectedCharacter,visible:el.classList.contains('visible'),
                    label:slot==='ultimate'?el.querySelector('strong').innerText.replace(/\\n/g,' '):el.querySelector('.skill-flyer-name').textContent,
                    imageLoaded:el.querySelector('img').naturalWidth>0,
                    owner:slot==='ultimate'?el.querySelector('.cutin-kicker').textContent:el.dataset.owner};
                }''', {'fighter': fighter, 'seat': seat, 'slot': slot})
                expected = fighter['names'][1 if slot == 'skill1' else 3]
                result.update({'fighter': fighter['slug'], 'seat': seat, 'slot': slot, 'expected': expected})
                result['pass'] = result['character'] == fighter['id'] and result['visible'] and result['label'] == expected and result['imageLoaded'] and 'PLAYER' in result['owner'].upper()
                results.append(result)
    browser.close()

report = {'results': results, 'pageErrors': errors, 'failures': [f'{r["fighter"]}/{r["seat"]}/{r["slot"]}' for r in results if not r['pass']]}
(OUT / 'online-ability-render.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps({'checked': len(results), 'failures': report['failures'], 'pageErrors': errors}, indent=2))
if errors or report['failures']:
    raise SystemExit(1)
