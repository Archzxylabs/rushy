"""Exercise every Meridian fighter and stage against the browser combat runtime."""
from playwright.sync_api import sync_playwright
import json
from pathlib import Path

BASE='http://127.0.0.1:5174'
OUT=Path(__file__).resolve().parent
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1440,'height':900},device_scale_factor=1,service_workers='block')
    errors=[];failed=[]
    page.on('pageerror',lambda error:errors.append(str(error)))
    page.on('requestfailed',lambda request:failed.append((request.url,request.failure)))
    page.goto(BASE+'/play.html',wait_until='load',timeout=30000)
    page.wait_for_function('window.__game?.snapshot().ready',timeout=30000)
    page.locator('#front-menu[data-screen="home"] .hub-persona').wait_for()
    page.wait_for_timeout(350)
    page.screenshot(path=str(OUT/'hub.png'))
    report=page.evaluate('''async () => {
       const game=window.__game, c=window.CHOG.characters, stages=Object.keys(MatchRules.stages);
       game.manual=true;
       const results=[];
       for(const fighter of c){
         let prepared=false,started=false,loads={};
         try{
           prepared=await game.prepareMatch({player:fighter.id,enemy:'yot',stage:stages[0]});
           started=game.startMatch({player:fighter.kit,enemy:'arco',stage:stages[0],mode:'training'});
           game.setAI(false);
           game.advance(.1);
           loads=game.snapshot();
           const moves=[];
           for(const name of ['attack','skill1','skill2','ultimate']){
             game.reset();game.advance(.1);
             if(name==='attack')game.dummy.x=game.hero.x+85;
             const startedMove=name==='attack'?game.attack():game.cast(name);
             const startState=game.snapshot();
             game.advance(2.8);
             const endState=game.snapshot();
             moves.push({name,started:startedMove,action:startState.hero.action?.name||startState.hero.state,
               endAction:endState.hero.action?.name||null,health:endState.hero.hp,
               dummyDamage:endState.dummy.damage,projectiles:endState.projectileCount});
           }
           results.push({id:fighter.slug,prepared,started,stageLoaded:loads.stageLoaded,
             selected:loads.selectedCharacter,manifestLoaded:loads.manifestLoaded,
             portrait:document.querySelector('#player-portrait')?.getAttribute('src'),moves});
         }catch(e){results.push({id:fighter.slug,error:String(e),stack:e.stack});}
       }
       const arenaResults=[];
       for(const stage of stages){
         try{await game.prepareMatch({player:'yot',enemy:'mamio',stage});
           const started=game.startMatch({player:'arco',enemy:'fenr',stage,mode:'training'});
           game.advance(.2);
           const state=game.snapshot();
           arenaResults.push({stage,name:MatchRules.stages[stage].name,started,loaded:state.stageLoaded,stageId:state.stageId});
         }catch(e){arenaResults.push({stage,error:String(e)});}
       }
       return {fighters:results,arenas:arenaResults};
    }''')
    page.screenshot(path=str(OUT/'arena.png'))
    browser.close()
report['pageErrors']=errors;report['failedRequests']=failed
(OUT/'browser-smoke.json').write_text(json.dumps(report,indent=2)+'\n')
print('fighters',len(report['fighters']),'arenas',len(report['arenas']))
for fighter in report['fighters']:
    print(fighter['id'], 'ERROR '+fighter['error'] if 'error' in fighter else ' '.join(f"{m['name']}:{m['started']}" for m in fighter['moves']))
for arena in report['arenas']:print('arena',arena)
print('page errors',errors[:10]);print('failed requests',failed[:10]);print('report',OUT/'browser-smoke.json')
