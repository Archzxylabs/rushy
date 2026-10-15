import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {parseAbi,encodeEventTopics,encodeAbiParameters,parseEther} from 'viem';
import {Store} from '../store.mjs';
import {Chain,cupHash} from '../chain.mjs';
import {PaidDuels} from '../paid-duels.mjs';
import {startServer} from '../app.mjs';
import {clientAddress} from '../rate-limit.mjs';

const address=n=>'0x'+n.toString(16).padStart(40,'0');
const artifact=name=>JSON.parse(fs.readFileSync(new URL('../../deployed-artifacts/'+name+'.json',import.meta.url)));
const row=(store,id)=>{const r=store.db.prepare('SELECT * FROM outbox WHERE id=?').get(id);return {...r,payload:JSON.parse(r.payload)};};
function verifiedSession(store,wallet){const s=store.newSession();store.db.prepare('UPDATE sessions SET wallet=?,wallet_expires=? WHERE id=?').run(wallet.toLowerCase(),Date.now()+3600000,s.id);return store.session(s.token);}
function rpcFixture(store,{credentials=true}={}){
 const c=new Chain(store,{});Object.assign(c,{configured:true,activationRequested:true,address:address(10),artifact:artifact('HouseCupEscrow'),minRelayBalance:parseEther('0.1')});
 if(credentials){c.signer={address:address(8)};c.relay={address:address(9)};}
 const state={paused:false,balance:parseEther('1'),signer:address(8),network:5042};
 c.public={getChainId:async()=>state.network,getBytecode:async()=>c.artifact.deployedBytecode.object,readContract:async()=>6,getBalance:async()=>state.balance};
 c.read=async name=>({token:c.token,relay:address(9),nextSigner:state.signer,paused:state.paused})[name];
 return {c,state};
}
test('mainnet admission checks gas, pause, signer and network repeatedly; recovery does not depend on admission',async()=>{
 const store=new Store();try{
  const {c,state}=rpcFixture(store);await c.initialize();assert.equal(c.info().mode,'mainnet');assert.equal(c.info().enabled,true);
  for(const [property,value] of [['paused',true],['balance',0n],['signer',address(99)]]){
   const old=state[property];state[property]=value;await c.refreshReadiness(true);
   assert.equal(c.info().enabled,false,property);assert.equal(c.info().recoveryEnabled,true,property);await assert.rejects(c.requireAccepting());state[property]=old;
  }
  state.paused=true;await c.refreshReadiness(true);
  const host=store.newSession(),cup=store.createCup(host,'Existing sponsor refund','mainnet');store.updateCup(cup.id,{state:'Cancelled',sponsor:address(1)});
  c.abi=artifact('HouseCupEscrow').abi;c.read=async name=>name==='credits'?100000000n:state.paused;
  const claim=await c.claim(store.cup(cup.id),host);assert.equal(claim.to,c.address);assert.equal(claim.amount,'100000000');
  state.network=1;await c.refreshReadiness(true);assert.equal(c.info().recoveryEnabled,false);assert.equal(c.info().enabled,false);
 }finally{store.close();}
});
test('missing private keys leave verified wallet recovery available and new paid entries disabled',async()=>{
 const store=new Store();try{const {c}=rpcFixture(store,{credentials:false});await c.initialize();assert.equal(c.info().enabled,false);assert.equal(c.info().recoveryEnabled,true);assert.match(c.info().reason,/credentials/);}finally{store.close();}
});
test('a paused duel rejects new funding while deposit recovery and wallet claims stay available',async()=>{
 const store=new Store();try{
  const {c}=rpcFixture(store);await c.initialize();const d=new PaidDuels({chain:c,store,createRoom:async()=>{},env:{}});d.enabled=true;d.abi=artifact('PaidDuelEscrow').abi;d.address=address(11);d.read=async name=>({paused:true,nextSigner:c.signer.address,credits:1000000n})[name];
  await d.refreshReadiness(true);assert.equal(d.info().enabled,false);assert.equal(d.info().recoveryEnabled,true);await assert.rejects(d.requireAccepting(),/paused/);
  const a=verifiedSession(store,address(1)),duel=store.createDuel(a,{chog:'yot',nickname:'Recipient'});const claim=await d.claim(duel,a);assert.equal(claim.to,d.address);
 }finally{store.close();}
});
test('batch receipts cannot borrow another Cup or duel payout; legitimate batched withdrawals still confirm',async()=>{
 const store=new Store();try{
  const c=new Chain(store,{}),escrow=address(10),to=address(1),other=address(2),token=c.token;Object.assign(c,{address:escrow,abi:artifact('HouseCupEscrow').abi,enabled:true});c.read=async()=>({state:3});
  const transfer=parseAbi(['event Transfer(address indexed from,address indexed to,uint256 value)']);
  const log=(abi,name,args)=>{const e=abi.find(v=>v.type==='event'&&v.name===name),plain=e.inputs.filter(v=>!v.indexed);return {address:name==='Transfer'?token:escrow,topics:encodeEventTopics({abi,eventName:name,args}),data:encodeAbiParameters(plain,plain.map(i=>args[i.name]))};};
  const host=verifiedSession(store,to),cup=store.createCup(host,'Scoped receipt test','mainnet');
  const id=store.enqueue({cupId:cup.id,kind:'withdraw',payload:{recipient:to,amount:'70000000'}});
  const wrongPaid=log(c.abi,'Paid',{cupId:cupHash('other'),recipient:to,amount:70000000n,token}),ownRunner=log(c.abi,'Paid',{cupId:cupHash(cup.id),recipient:other,amount:30000000n,token});
  const receipt={status:'success',transactionHash:'0x'+'aa'.repeat(32),logs:[wrongPaid,log(transfer,'Transfer',{from:escrow,to,value:70000000n}),ownRunner]};
  await assert.rejects(c.confirm(row(store,id),receipt),/Payout event mismatch/);assert.equal(row(store,id).state,'pending');
  receipt.logs.push(log(c.abi,'Paid',{cupId:cupHash(cup.id),recipient:to,amount:70000000n,token}));
  // Find by recipient within the scoped resource, even when its runner-up is first.
  await c.confirm(row(store,id),receipt);assert.equal(row(store,id).state,'paid');
  const d=new PaidDuels({chain:c,store,createRoom:async()=>{},env:{}});d.abi=artifact('PaidDuelEscrow').abi;d.address=escrow;d.read=async()=>({state:4});
  const duel=store.createDuel(host,{chog:'yot',nickname:'Recipient'}),jid=store.enqueue({cupId:duel.id,kind:'duel-withdraw',payload:{recipient:to,amount:'1000000'}});
  const r={status:'success',transactionHash:'0x'+'bb'.repeat(32),logs:[log(d.abi,'DuelFunded',{duelId:cupHash(duel.id),player:to,amount:1000000n,fundedMask:1}),log(d.abi,'Paid',{duelId:cupHash('other'),recipient:to,amount:1000000n,token}),log(transfer,'Transfer',{from:escrow,to,value:1000000n})]};
  await assert.rejects(d.confirm(row(store,jid),r),/Duel payout mismatch/);assert.equal(row(store,jid).state,'pending');
  r.logs.push(log(d.abi,'Paid',{duelId:cupHash(duel.id),recipient:to,amount:1000000n,token}));await d.confirm(row(store,jid),r);assert.equal(row(store,jid).state,'paid');
  await assert.rejects(d.confirm(row(store,jid),{...r,status:'reverted'}),/not successful/);
 }finally{store.close();}
});
test('outbox filters future retries before LIMIT and rotates missing receipts, including across restart',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'rushy-fair-')),file=path.join(dir,'db.sqlite');let store=new Store(file);
 try{
  for(let i=0;i<20;i++)store.enqueue({id:'deferred-'+i,cupId:'d',kind:'withdraw',payload:{_nextTry:Date.now()+60000}});
  store.enqueue({id:'ready',cupId:'c',kind:'withdraw',payload:{}});assert.equal(store.outbox()[0].id,'ready');
  store.db.prepare('DELETE FROM outbox').run();
  for(let i=0;i<21;i++){const id=store.enqueue({id:'j'+i.toString().padStart(2,'0'),cupId:'c',kind:'withdraw',payload:{}});if(i<20)store.updateOutbox(id,{state:'submitted',tx_hash:'0x'+(i+1).toString(16).padStart(64,'0'),attempts:3});}
  const c=new Chain(store,{});Object.assign(c,{enabled:true,relayReady:true,public:{getTransactionReceipt:async()=>null}});const seen=[];c.prepare=async j=>{seen.push(j.id);throw Error('local probe');};await c.poll();store.close();store=new Store(file);c.store=store;await c.poll();assert.deepEqual(seen,['j20']);
 }finally{store.close();fs.rmSync(dir,{recursive:true,force:true});}
});
test('duel reconciliation reaches resources beyond twenty and isolates individual RPC failures',async()=>{
 const store=new Store();try{
  for(let i=0;i<25;i++)store.db.prepare('INSERT INTO paid_duels(id,players,characters,nicknames,wallets,state,created) VALUES(?,?,?,?,?,?,?)').run('d'+i,JSON.stringify([]),JSON.stringify([]),JSON.stringify([]),JSON.stringify([]),i===24?'Cancelling':'Funding',i);
  const chain={enabled:true,accepting:true,refreshReadiness:async()=>{}},d=new PaidDuels({chain,store,createRoom:async()=>{},env:{}});d.enabled=true;d.refreshReadiness=async()=>{};const seen=[];
  d.reconcile=async duel=>{seen.push(duel.id);if(duel.id==='d0')throw Error('local RPC failure');};d.advance=async()=>{};
  await d.poll();await d.poll();assert.equal(new Set(seen).size,25);assert.ok(seen.includes('d24'));
 }finally{store.close();}
});
test('paid admission limits survive fresh sessions and restart; stale queue wallets cannot pair',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'rushy-admit-')),file=path.join(dir,'db.sqlite');let store=new Store(file);
 try{
  const a=verifiedSession(store,address(1)),b=verifiedSession(store,address(2));
  for(let i=0;i<10;i++){const d=store.createDuel(a,{chog:'yot',nickname:'First'});store.joinDuel(d.id,d.invite_token,b,{chog:'mamio',nickname:'Second'});store.updateDuel(d.id,{state:'Cancelled'});}
  store.close();store=new Store(file);const fresh=verifiedSession(store,address(1)),peer=verifiedSession(store,address(3)),d=store.createDuel(fresh,{chog:'yot',nickname:'Fresh session'});
  assert.throws(()=>store.joinDuel(d.id,d.invite_token,peer,{chog:'mamio',nickname:'Third'}),/Daily/);assert.equal(store.duel(d.id).state,'Draft');assert.equal(store.db.prepare('SELECT count(*) n FROM duel_admissions WHERE wallet=?').get(peer.wallet).n,0,'denied admissions roll back both wallet charges');
  const wallet=address(4);for(let i=0;i<3;i++)store.createDuel(verifiedSession(store,wallet),{chog:'yot',nickname:'New session'});
  assert.throws(()=>store.createDuel(verifiedSession(store,wallet),{chog:'yot',nickname:'Fourth'}),/existing paid duel/);
  const qa=verifiedSession(store,address(5)),qb=verifiedSession(store,address(6));for(const s of [qa,qb])store.queueJoin(s,{kind:'paid',chog:'yot',nickname:'Queued'});
  store.db.prepare('UPDATE sessions SET wallet_expires=0 WHERE id=?').run(qa.id);assert.equal(store.queuePair('paid'),null);assert.equal(store.queueStatus(qa.id),null);
 }finally{store.close();fs.rmSync(dir,{recursive:true,force:true});}
});
test('invalid bearer rotation and spoofed forwarding headers cannot bypass the HTTP IP budget',async()=>{
 const store=new Store(),server=await startServer({port:0,store,env:{},rateLimits:{ip:6,session:6,write:6}});
 try{
  for(let i=0;i<9;i++){const response=await fetch(`http://127.0.0.1:${server.port}/api/config`,{headers:{Authorization:'Bearer invalid-'+i,'X-Forwarded-For':'203.0.113.'+i,'X-Real-IP':'203.0.113.'+i}});assert.equal(response.status,i<6?200:429);if(i>=6)assert.equal(response.headers.get('Retry-After'),'60');}
  assert.equal(clientAddress({headers:{'x-real-ip':'203.0.113.1'},socket:{remoteAddress:'127.0.0.1'}},false),'127.0.0.1');
  assert.equal(clientAddress({headers:{'x-real-ip':'203.0.113.1'},socket:{remoteAddress:'100.64.0.1'}},true),'203.0.113.1');
 }finally{await server.close();}
});
test('existing Arc cup mode migrates without changing payment transaction hashes',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'rushy-migrate-')),file=path.join(dir,'db.sqlite');let store=new Store(file);
 try{const h=store.newSession(),c=store.createCup(h,'Legacy Arc cup','mainnet');store.db.prepare("UPDATE cups SET mode='testnet',chain_id='5042',funding_tx='0xunchanged' WHERE id=?").run(c.id);store.close();store=new Store(file);assert.equal(store.cup(c.id).mode,'mainnet');assert.equal(store.cup(c.id).funding_tx,'0xunchanged');}finally{store.close();fs.rmSync(dir,{recursive:true,force:true});}
});

test('relay admission spending is durable, separate from settlement, and charged when an old job is retried',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'rushy-budget-')),file=path.join(dir,'db.sqlite');let store=new Store(file);
 try{
  const job={id:'old-create',cup_id:'d',kind:'duel-create'},payload={_gasReserved:parseEther('0.1').toString(),_broadcasts:1};
  store.enqueue({id:job.id,cupId:job.cup_id,kind:job.kind,payload});store.reserveRelay(job,parseEther('0.1'));
  store.db.prepare('UPDATE relay_budget SET created=?').run(Date.now()-2*86400000);
  store.reserveRelay(job,parseEther('0.2'));store.updateOutbox(job.id,{tx_hash:'0x'+'11'.repeat(32),payload:{_gasReserved:parseEther('0.3').toString(),_broadcasts:2}});
  let usage=store.relayUsage(job);assert.equal(usage.dailyGas,parseEther('0.2'));assert.equal(usage.dailyBroadcasts,1);assert.equal(usage.resourceGas,parseEther('0.3'));
  assert.equal(store.relayUsage({...job,kind:'duel-withdraw'}).dailyGas,0n,'unfunded creates cannot consume the settlement budget');
  store.close();store=new Store(file);usage=store.relayUsage(job);assert.equal(usage.dailyGas,parseEther('0.2'));assert.equal(usage.dailyBroadcasts,1,'restart does not duplicate a budget entry');
  store.reserveRelay(job);assert.equal(store.relayUsage(job).dailyGas,parseEther('0.2'));assert.equal(store.relayUsage(job).dailyBroadcasts,2,'same signed bytes cost a broadcast slot but do not reserve gas twice');
 }finally{store.close();fs.rmSync(dir,{recursive:true,force:true});}
});
test('an uncertain broadcast keeps its exact signed transaction in submitted state for receipt recovery',async()=>{
 const store=new Store();try{
  const c=new Chain(store,{}),to=address(1);Object.assign(c,{enabled:true,relayReady:true,address:address(10),relay:{address:address(9)},abi:parseAbi(['function withdrawFor(bytes32,address)'])});
  store.enqueue({id:'uncertain',cupId:'cup',kind:'withdraw',payload:{recipient:to,amount:'1000000'}});
  c.prepare=async()=>({functionName:'withdrawFor',args:[cupHash('cup'),to]});
  c.public={estimateContractGas:async()=>100000n,getTransactionCount:async()=>0,sendRawTransaction:async()=>{throw Error('connection lost after broadcast');}};
  c.wallet={prepareTransactionRequest:async args=>({...args,gasPrice:1n}),signTransaction:async()=> '0x02abcd'};
  await c.poll();let job=row(store,'uncertain');assert.equal(job.state,'submitted');assert.equal(job.tx_nonce,0);assert.equal(job.payload.rawTx,'0x02abcd');assert.equal(job.payload._prepareFailures,undefined);assert.ok(job.tx_hash);
  job.payload._nextTry=0;store.updateOutbox(job.id,{payload:job.payload});c.public.getTransactionReceipt=async()=>({status:'success',transactionHash:job.tx_hash,logs:[]});let recovered=false;c.confirm=async()=>{recovered=true;};await c.poll();assert.equal(recovered,true);
 }finally{store.close();}
});
