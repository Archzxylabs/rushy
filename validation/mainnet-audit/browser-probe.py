from playwright.sync_api import sync_playwright, expect
import json,urllib.request,os,shutil
from pathlib import Path
from urllib.parse import urlparse
BASE=os.environ.get('RUSHY_AUDIT_BASE','http://127.0.0.1:5197')
if urlparse(BASE).hostname not in ('localhost','127.0.0.1','::1'): raise SystemExit('Browser probes must run against localhost only')
def request(path,body=None,token=None):
 headers={'Content-Type':'application/json','Origin':BASE}
 if token: headers['Authorization']='Bearer '+token
 raw=None if body is None else json.dumps(body).encode()
 with urllib.request.urlopen(urllib.request.Request(BASE+'/api'+path,data=raw,headers=headers),timeout=20) as r:return json.load(r)
session=request('/session');payload='<img src=x onerror=window.__auditXss=1>'
cup=request('/cups',{'name':payload,'mode':'practice'},session['token'])
fixture=json.loads(Path('/tmp/rushy-browser-fixture.json').read_text())
if fixture['base']!=BASE or urlparse(fixture['rpc']).hostname!='127.0.0.1':raise SystemExit('Local fixture mismatch')
report={'scope':'localhost chain 31337, public Anvil wallets and mock token; no mainnet transactions','xssPayloadLength':len(payload)}
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium'),headless=True,args=['--no-sandbox'])
 errors=[];csp=[]
 def context(account=None):
  c=browser.new_context(viewport={'width':1440,'height':1000},service_workers='block')
  if account:
   script='''window.ethereum={on(){},removeListener(){},async request({method,params=[]}){
    const account=ACCOUNT, rpc=RPC;
    if(['eth_accounts','eth_requestAccounts'].includes(method))return [account];
    if(method==='wallet_switchEthereumChain'){if(params[0].chainId!=='0x7a69')throw Error('Local test only');return null;}
    if(method==='wallet_addEthereumChain')throw Error('No external networks in this fixture');
    if(method==='eth_sendTransaction'&&!DESTINATIONS.includes(params[0].to.toLowerCase()))throw Error('Unknown test contract');
    const r=await fetch(rpc,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})});const data=await r.json();if(data.error)throw Error(data.error.message);return data.result;
   }};'''.replace('ACCOUNT',json.dumps(account)).replace('RPC',json.dumps(fixture['rpc'])).replace('DESTINATIONS',json.dumps([fixture[k].lower() for k in ['token','cup','duel']]))
   c.add_init_script(script)
  c.on('page',lambda page:page.on('pageerror',lambda e:errors.append(str(e)[:200])))
  return c
 c=context();page=c.new_page()
 response=page.goto(BASE+'/play.html?cup='+cup['id'],wait_until='domcontentloaded')
 page.wait_for_selector('#online-root .online-cup-heading',timeout=45000)
 assert page.locator('.online-location').inner_text()==payload
 assert page.locator('#online-root img[src=x]').count()==0
 assert page.evaluate('window.__auditXss||null') is None
 report['storedXssBlocked']=True
 policy=response.headers['content-security-policy'];assert 'script-src-attr \'none\'' in policy;assert "'unsafe-inline'" not in policy.split('script-src ')[1].split(';')[0]
 report['scriptCspEnforced']=True
 # Hash-authorized mobile shell still boots the same-origin game iframe.
 page.goto(BASE+'/mobile.html?online=paid',wait_until='domcontentloaded')
 page.frame_locator('#game').locator('[data-action=create-paid]').wait_for(timeout=45000)
 report['mobilePaidEntryBoots']=True
 c.close()
 a=context(fixture['accounts'][0]);b=context(fixture['accounts'][1]);pa=a.new_page();pb=b.new_page()
 pa.goto(BASE+'/play.html?online=casual',wait_until='domcontentloaded')
 pa.wait_for_selector('#online-root [data-mode=paid]',timeout=45000);pa.locator('#online-root [data-mode=paid]').click()
 expect(pa.locator('[data-action=create-paid]')).to_be_enabled(timeout=15000)
 assert 'no monetary value' in pa.locator('#online-root').inner_text()
 assert 'REAL FUNDS' not in pa.locator('#online-root').inner_text()
 report['paidModeReachable']=True
 pa.locator('#online-nickname').fill('Browser first');pa.locator('[data-action=create-paid]').click()
 invite=pa.locator('input[aria-label="Paid duel invite link"]');invite.wait_for(timeout=20000);link=invite.input_value()
 report['inviteCreated']=True
 pb.goto(link,wait_until='domcontentloaded');pb.wait_for_selector('[data-action=join-paid]',timeout=45000)
 pb.locator('#online-nickname').fill('Browser rival');pb.locator('[data-action=join-paid]').click()
 expect(pb.locator('.online-state')).to_have_text('Funding',timeout=20000)
 pa.reload(wait_until='domcontentloaded');pa.wait_for_selector('[data-action=fund-duel]',timeout=45000)
 expect(pa.locator('.online-state')).to_have_text('Funding');assert pa.locator('#online-root').inner_text().count('· YOU')==1
 report['inviteJoinedAndReloadResumed']=True
 for pg in [pa,pb]:
  expect(pg.locator('[data-action=fund-duel]')).to_be_enabled(timeout=15000);pg.locator('[data-action=fund-duel]').click()
  pg.get_by_text('✓ ENTRY CONFIRMED',exact=True).first.wait_for(timeout=20000)
 for pg in [pa,pb]:
  pg.wait_for_selector('[data-action=open-paid-match]',timeout=20000);pg.locator('[data-action=open-paid-match]').click()
 for pg in [pa,pb]:
  expect(pg.locator('[data-action=ready]')).to_be_enabled(timeout=30000);pg.locator('[data-action=ready]').click()
 pa.wait_for_selector('[data-action=surrender]',timeout=30000)
 pb.wait_for_selector('[data-action=surrender]',timeout=30000);pb.locator('[data-action=surrender]').click()
 pa.get_by_text('WINNER PAYOUT VERIFIED ONCHAIN',exact=True).wait_for(timeout=30000)
 report['twoEntriesAndWinnerPayoutVerified']=True
 report['browserErrors']=errors;assert not errors,errors
 browser.close()
Path(__file__).with_name('browser-fixed-output.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
