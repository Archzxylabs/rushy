import fs from 'node:fs';
import path from 'node:path';
import {createPublicClient,createWalletClient,defineChain,http,keccak256,stringToHex,encodeAbiParameters,encodeFunctionData,decodeEventLog,zeroAddress,parseEther,isAddress} from 'viem';
import {privateKeyToAccount} from 'viem/accounts';
import {BUILD_HASH} from '../online/build.mjs';
import {FundingRecovery} from './funding-recovery.mjs';
import {gasWithBuffer} from '../online/payments.mjs';
export const USDC='0x3600000000000000000000000000000000000000';
const fields=[['cupId','bytes32'],['matchId','bytes32'],['stage','uint8'],['participantA','address'],['participantB','address'],['winnerRecipient','address'],['outcomeType','uint8'],['rulesetHash','bytes32'],['replayHash','bytes32'],['finishedAt','uint64'],['resultSequence','uint32'],['signerEpoch','uint32'],['expiresAt','uint64']].map(([name,type])=>({name,type}));
const types={Result:fields};
const tokenAbi=[{type:'function',name:'approve',inputs:[{name:'spender',type:'address'},{name:'amount',type:'uint256'}],outputs:[{type:'bool'}],stateMutability:'nonpayable'},{type:'function',name:'decimals',inputs:[],outputs:[{type:'uint8'}],stateMutability:'view'},{type:'function',name:'balanceOf',inputs:[{name:'account',type:'address'}],outputs:[{type:'uint256'}],stateMutability:'view'}];
const transferAbi=[{type:'event',name:'Transfer',inputs:[{name:'from',type:'address',indexed:true},{name:'to',type:'address',indexed:true},{name:'value',type:'uint256',indexed:false}]}];
export function verifiedRuntime(code,artifact){if(!code)return false;const expected=Buffer.from(artifact.deployedBytecode.object.replace(/^0x/,''),'hex'),actual=Buffer.from(code.slice(2),'hex');if(actual.length!==expected.length)return false;for(const refs of Object.values(artifact.deployedBytecode.immutableReferences))for(const {start,length} of refs){actual.fill(0,start,start+length);expected.fill(0,start,start+length);}return actual.equals(expected);}
const normalize=value=>JSON.parse(JSON.stringify(value,(_,v)=>typeof v==='bigint'?v.toString():v));
export const cupHash=id=>keccak256(stringToHex(id));
export const slotHash=(id,stage)=>keccak256(encodeAbiParameters([{type:'bytes32'},{type:'uint8'}],[cupHash(id),stage]));
export class Chain {
 constructor(store,env=process.env) {
  this.store=store;this.enabled=false;this.busy=false;this.onAccepted=()=>{};
  const local=env.CHAIN_MODE==='local-mock';
  this.chainId=local?31337:5042;this.label=local?'Local mock token · no monetary value':'Arc mainnet · USDC (real funds)';this.mode=local?'local-mock':'mainnet';
  this.token=local?env.LOCAL_MOCK_TOKEN:USDC;this.address=env.CUP_ESCROW_ADDRESS;this.rpc=env.ARC_MAINNET_RPC_URL||env.LOCAL_MOCK_RPC_URL||'https://rpc.mainnet.arc.io';
  this.reason='Arc Cup prizes are not configured on this host. Practice Cup and free PvP are available.';
  this.accepting=false;this.activationRequested=local||env.ENABLE_ARC_PRIZES==='1';this.minRelayBalance=parseEther(env.RELAY_MIN_BALANCE_USDC||'0.1');
  if(!isAddress(this.address||'')||!isAddress(this.token||''))return;
  if(local&&!['127.0.0.1','localhost','::1'].includes(new URL(this.rpc).hostname))throw Error('Local mock mode requires a localhost RPC');
  const artifact=path.resolve(import.meta.dirname,'../contracts/out/HouseCupEscrow.sol/HouseCupEscrow.json');
  if(!fs.existsSync(artifact)){this.reason='Prize service is preparing its contract build.';return;}
  this.artifact=JSON.parse(fs.readFileSync(artifact));this.abi=this.artifact.abi;
  const chain=defineChain({id:this.chainId,name:local?'Local mock development':'Arc mainnet',nativeCurrency:{name:local?'Test Ether':'USD Coin',symbol:local?'ETH':'USDC',decimals:18},rpcUrls:{default:{http:[this.rpc]}}});
  try{if(env.RESULT_SIGNER_PRIVATE_KEY)this.signer=privateKeyToAccount(env.RESULT_SIGNER_PRIVATE_KEY);if(env.RELAY_PRIVATE_KEY)this.relay=privateKeyToAccount(env.RELAY_PRIVATE_KEY);}catch{this.credentialsInvalid=true;}
  if(this.signer&&this.relay&&this.signer.address.toLowerCase()===this.relay.address.toLowerCase())this.credentialsInvalid=true;
  this.public=createPublicClient({chain,transport:http(this.rpc,{timeout:8000,retryCount:0})});
  if(this.relay)this.wallet=createWalletClient({chain,account:this.relay,transport:http(this.rpc,{timeout:8000,retryCount:0})});
  this.buildHash=BUILD_HASH;this.fundingRecovery=new FundingRecovery(this,cupHash);
  this.configured=true;
 }
 async initialize(){await this.refreshReadiness(true);}
 // Verification enables recovery reads; admission additionally needs healthy operational wallets.
 async refreshReadiness(force=false){
  if(!this.configured)return;
  if(this.readinessWork)return this.readinessWork;
  if(!force&&this.readinessAt&&Date.now()-this.readinessAt<5000)return;
  this.readinessWork=(async()=>{this.accepting=false;this.relayReady=false;try{
   if(await this.public.getChainId()!==this.chainId){this.enabled=false;throw Error('Wrong chain');}
   if(!this.enabled||!this.verifiedAt||Date.now()-this.verifiedAt>60000){
    const [code,token,relay,decimals]=await Promise.all([this.public.getBytecode({address:this.address}),this.read('token'),this.read('relay'),this.public.readContract({address:this.token,abi:tokenAbi,functionName:'decimals'})]);
    if(!verifiedRuntime(code,this.artifact)||token.toLowerCase()!==this.token.toLowerCase()||decimals!==6){this.enabled=false;throw Error('Contract configuration mismatch');}
    this.contractRelay=relay;this.enabled=true;this.verifiedAt=Date.now();
   }
   const [paused,signer,balance]=await Promise.all([this.read('paused'),this.read('nextSigner'),this.public.getBalance({address:this.contractRelay})]);
   this.relayBalance=balance;this.paused=paused;this.nextSigner=signer;
   this.relayReady=!!this.relay&&this.relay.address.toLowerCase()===this.contractRelay.toLowerCase();
   if(!this.activationRequested)this.reason='Paid modes are disabled by this host.';
   else if(this.credentialsInvalid||!this.signer||!this.relay)this.reason='Paid modes await the configured result signer and relay credentials.';
   else if(!this.relayReady||signer.toLowerCase()!==this.signer.address.toLowerCase())this.reason='Operational wallets do not match the contract roles.';
   else if(paused)this.reason='The Cup escrow is paused. Existing claims remain available.';
   else if(balance<this.minRelayBalance)this.reason='The relay needs network gas before new entries can be accepted.';
   else {this.accepting=true;this.reason=null;}
  }catch{this.reason='Prize service could not verify the network or contract. Existing credits can be recovered after connectivity returns.';}
  finally{this.readinessAt=Date.now();}})();
  try{await this.readinessWork;}finally{this.readinessWork=null;}
 }
 async requireAccepting(){await this.refreshReadiness();if(!this.accepting)throw Error(this.reason||'New funded prizes are unavailable');}

 read(functionName,args=[]){return this.public.readContract({address:this.address,abi:this.abi,functionName,args});}
 info(){return {enabled:!!this.accepting,recoveryEnabled:!!this.enabled,mode:this.mode,label:this.label,chainId:this.chainId,contract:this.enabled?this.address:null,token:this.enabled?this.token:null,pool:'100',split:[70,30],reason:this.reason};}
 async funding(cup,session){await this.requireAccepting();if(!session.wallet||session.wallet_expires<Date.now())throw Error('Verify the sponsor wallet first');
  if(cup.mode!==this.mode||cup.state!=='Draft')throw Error('Cup cannot be funded in this mode or state');
  const status=await this.fundingRecovery.plan(cup,session);if(status.alreadyFunded)return status;
  const steps=[...(status.approvalNeeded?[{phase:'approval',transaction:{to:this.token,data:encodeFunctionData({abi:tokenAbi,functionName:'approve',args:[this.address,100000000n]}),value:'0x0'}}]:[]),{phase:'deposit',transaction:{to:this.address,data:encodeFunctionData({abi:this.abi,functionName:'createFundedCup',args:[cupHash(cup.id),session.wallet,BUILD_HASH]}),value:'0x0'}}];
  return {chainId:this.chainId,contract:this.address,label:this.label,token:this.token,amount:'100000000',steps,transactions:steps.map(step=>step.transaction),status};
 }
 async fundingStatus(cup,session){await this.refreshReadiness();if(!this.enabled)throw Error('Arc Cup prizes are unavailable');return this.fundingRecovery.status(cup,session);}
 async noteFunding(cup,session,phase,hash){if(!this.enabled)throw Error('Arc Cup prizes are unavailable');return this.fundingRecovery.note(cup,session,phase,hash);}
 async confirmFunding(cup,session,hash){if(!this.enabled)throw Error('Arc Cup prizes unavailable');if(!/^0x[0-9a-f]{64}$/i.test(hash||''))throw Error('Invalid transaction hash');
  if(cup.state!=='Draft'&&cup.funding_tx?.toLowerCase()===hash.toLowerCase())return;
  const receipt=await this.public.getTransactionReceipt({hash});if(receipt.status!=='success'||receipt.to?.toLowerCase()!==this.address.toLowerCase())throw Error('Funding is not confirmed');
  const event=this.events(receipt).find(e=>e.eventName==='CupFunded'&&e.args.cupId===cupHash(cup.id)&&e.args.sponsor.toLowerCase()===session.wallet&&e.args.amount===100000000n);
  const state=await this.read('getCup',[cupHash(cup.id)]);if(!event||state.state!==1||state.rulesetHash!==BUILD_HASH||state.sponsor.toLowerCase()!==session.wallet)throw Error('Funding event does not match this Cup');
  this.store.updateCup(cup.id,{state:'Funded',sponsor:state.sponsor,chain_id:String(this.chainId),chain_cup_id:cupHash(cup.id),contract:this.address,funding_tx:hash});
 }
 async lock(cup,participants){await this.requireAccepting();if(!this.enabled||cup.state!=='Funded'||participants.some(p=>!p.checked||!p.accepted||!p.wallet))throw Error('Funding and four verified participants are required');
  if(new Set(participants.map(p=>p.wallet)).size!==4)throw Error('Recipients must be unique');
  this.store.enqueue({id:cup.id+':lock',cupId:cup.id,kind:'lock',payload:{recipients:participants.map(p=>p.wallet)}});this.store.updateCup(cup.id,{state:'Locking'});
 }
 cancelFunding(cup,session){if(!this.enabled||cup.state!=='Funded'||session.wallet!==cup.sponsor.toLowerCase())throw Error('Only the verified sponsor can cancel before lock');return {to:this.address,data:encodeFunctionData({abi:this.abi,functionName:'cancelBeforeLock',args:[cupHash(cup.id)]}),value:'0x0'};}
 async confirmCancellation(cup,hash){if(!this.enabled)throw Error('Prize recovery is unavailable until the network is verified');const receipt=await this.public.getTransactionReceipt({hash});const state=await this.read('getCup',[cupHash(cup.id)]);if(receipt.status!=='success'||!this.events(receipt).some(e=>e.eventName==='CupCancelled'&&e.args.cupId===cupHash(cup.id))||state.state!==4)throw Error('Sponsor cancellation is not confirmed');this.store.updateCup(cup.id,{state:'Cancelled',cancel_reason:'sponsor_cancelled'});this.store.enqueue({id:cup.id+':refund',cupId:cup.id,kind:'withdraw',payload:{recipient:state.sponsor,amount:'100000000'}});}
 retry(cupId){for(const job of this.store.db.prepare('SELECT * FROM outbox WHERE cup_id=? AND state IN (?,?)').all(cupId,'failed','submitted')){const payload=JSON.parse(job.payload);if(job.state==='submitted'&&job.tx_hash&&payload.rawTx){payload._nextTry=0;this.store.updateOutbox(job.id,{attempts:0,payload,error:null});continue;}if(job.tx_hash&&!payload._reverted)continue;delete payload.rawTx;delete payload._reverted;payload._prepareFailures=0;payload._nextTry=0;this.store.updateOutbox(job.id,{state:'pending',attempts:0,tx_hash:null,tx_nonce:null,payload,error:null});}}
 recipient(cup,session){const player=this.store.participants(cup.id).find(p=>p.session_id===session.id);const recipient=cup.state==='Cancelled'&&cup.host===session.id?cup.sponsor:cup.state==='Complete'?player?.wallet:null;if(!recipient)throw Error('No award or sponsor refund belongs to this session');return recipient;}
 async claim(cup,session){if(!this.enabled||cup.mode==='practice')throw Error('USDC prize claims are unavailable');const recipient=this.recipient(cup,session),amount=await this.read('credits',[cupHash(cup.id),recipient]);if(amount<=0n)throw Error('No unpaid credit remains');return {recipient,amount:amount.toString(),chainId:this.chainId,to:this.address,data:encodeFunctionData({abi:this.abi,functionName:'withdrawFor',args:[cupHash(cup.id),recipient]}),value:'0x0'};}
 async confirmClaim(cup,session,hash){if(!this.enabled||!/^0x[0-9a-f]{64}$/i.test(hash||''))throw Error('Invalid claim confirmation');const recipient=this.recipient(cup,session),row=this.store.db.prepare('SELECT * FROM outbox WHERE cup_id=? AND kind=?').all(cup.id,'withdraw').find(j=>JSON.parse(j.payload).recipient.toLowerCase()===recipient.toLowerCase());if(!row)throw Error('Award has not been recorded yet');const job={...row,payload:JSON.parse(row.payload)},receipt=await this.public.getTransactionReceipt({hash});if(receipt.status!=='success')throw Error('Claim was not successful');await this.confirm(job,receipt);}
 events(receipt){return receipt.logs.filter(l=>l.address.toLowerCase()===this.address.toLowerCase()).map(l=>{try{return decodeEventLog({abi:this.abi,...l});}catch{return null;}}).filter(Boolean);}
 enqueueResult(cupId,matchId,result){return {id:matchId+':result',cupId,matchId,kind:'result',payload:{result}};}
 async prepare(job) {
  if(job.kind.startsWith('duel-'))return this.duelService.prepare(job);
  const cup=this.store.cup(job.cup_id),id=cupHash(cup.id),state=await this.read('getCup',[id]);
  if(job.kind==='lock')return {functionName:'lockCup',args:[id,job.payload.recipients]};
  if(job.kind==='withdraw')return {functionName:'withdrawFor',args:[id,job.payload.recipient]};
  if(job.kind==='refund-expired')return {functionName:'refundExpired',args:[id]};
  if(job.kind!=='result')throw Error('Relay method is not allowed');
  if(!job.payload.signed){
   const row=this.store.db.prepare('SELECT * FROM matches WHERE id=?').get(job.match_id),players=JSON.parse(row.players),participantMap=new Map(this.store.participants(cup.id).map(p=>[p.session_id,p]));
   const stage={SF1:0,SF2:1,FINAL:2}[row.stage],r=job.payload.result;
   if(stage===undefined||!players.every(id=>participantMap.get(id)?.wallet))throw Error('Result participants are not eligible');
   const message={cupId:id,matchId:slotHash(cup.id,stage),stage,participantA:participantMap.get(players[0]).wallet,participantB:participantMap.get(players[1]).wallet,winnerRecipient:r.winnerSession?participantMap.get(r.winnerSession).wallet:zeroAddress,outcomeType:{Finished:0,Forfeit:1,Void:2}[r.outcome],rulesetHash:state.rulesetHash,replayHash:r.replayHash,finishedAt:BigInt(r.finishedAt),resultSequence:1,signerEpoch:state.signerEpoch,expiresAt:state.settlementDeadline};
   if(state.signer.toLowerCase()!==this.signer.address.toLowerCase())throw Error('Locked signer is unavailable');
   const signature=await this.signer.signTypedData({domain:{name:'CHOG House Cup',version:'1',chainId:this.chainId,verifyingContract:this.address},types,primaryType:'Result',message});
   job.payload.signed={message:normalize(message),signature};this.store.updateOutbox(job.id,{payload:job.payload});
  }
  const {message,signature}=job.payload.signed;
  return {functionName:'submitResult',args:[{...message,finishedAt:BigInt(message.finishedAt),expiresAt:BigInt(message.expiresAt)},signature]};
 }
 async poll() {
  if(this.busy)return;this.busy=true;
  try{await this.refreshReadiness();if(!this.enabled||!this.relayReady)return;for(const job of this.store.outbox()){
   this.store.checkOutbox(job.id);
   try{if(job.tx_hash){let receipt;try{receipt=await this.public.getTransactionReceipt({hash:job.tx_hash});}catch{}
    if(receipt){if(receipt.status!=='success'){job.payload._reverted=true;this.store.updateOutbox(job.id,{state:'failed',payload:job.payload,error:'Transaction reverted; no payout was confirmed'});continue;}await this.confirm(job,receipt);continue;}
    if(job.payload.rawTx&&job.attempts<3){
     const usage=this.store.relayUsage(job);
     if(usage.resourceBroadcasts>=20||usage.dailyBroadcasts>=(job.kind==='duel-create'?20:100)){this.store.updateOutbox(job.id,{error:'Relay attempt budget reached; checking the existing receipt'});continue;}
     job.payload._broadcasts=(job.payload._broadcasts||0)+1;job.payload._nextTry=Date.now()+3000;
     this.store.transaction(()=>{this.store.reserveRelay(job);this.store.updateOutbox(job.id,{attempts:job.attempts+1,payload:job.payload});});
     await this.public.sendRawTransaction({serializedTransaction:job.payload.rawTx});
    }continue;
   }
   if(job.attempts>=3)continue;
   if(job.kind==='duel-create'){await this.requireAccepting();await this.duelService.requireAccepting();}
   const {address=this.address,abi=this.abi,...call}=await this.prepare(job),gas=await this.public.estimateContractGas({address,abi,account:this.relay.address,...call});
   const gasLimit=gasWithBuffer(gas);
   // A provider can report a stale pending nonce immediately after broadcast.
   // Reserve against durable jobs too; both semifinal results may be queued together.
   const [pendingNonce,latestNonce]=await Promise.all(['pending','latest'].map(blockTag=>this.public.getTransactionCount({address:this.relay.address,blockTag})));
   const reservedNonce=this.store.db.prepare('SELECT max(tx_nonce) n FROM outbox WHERE tx_nonce IS NOT NULL').get().n;
   const nonce=Math.max(pendingNonce,latestNonce,reservedNonce===null?0:reservedNonce+1);
   const request=await this.wallet.prepareTransactionRequest({to:address,data:encodeFunctionData({abi,...call}),gas:gasLimit,nonce});
   const estimate=gasLimit*(request.maxFeePerGas??request.gasPrice);
   const usage=this.store.relayUsage(job);
   if(estimate+usage.resourceGas>parseEther('2')||estimate+usage.dailyGas>parseEther(job.kind==='duel-create'?'0.5':'10')||usage.resourceBroadcasts>=20||usage.dailyBroadcasts>=(job.kind==='duel-create'?20:100))throw Error('Relay budget limit reached');
   if(job.kind==='duel-create'&&await this.public.getBalance({address:this.relay.address})<estimate+this.minRelayBalance)throw Error('Relay gas reserve is reserved for existing settlements');
   const rawTx=await this.wallet.signTransaction(request),hash=keccak256(rawTx);job.payload.rawTx=rawTx;job.payload._gasReserved=(BigInt(job.payload._gasReserved||'0')+estimate).toString();job.payload._broadcasts=(job.payload._broadcasts||0)+1;job.payload._nextTry=Date.now()+1000;
   // An activation may be cancelled while RPC preparation awaits its response.
   if(this.store.db.prepare('SELECT state FROM outbox WHERE id=?').get(job.id)?.state!=='pending')continue;
   // Save exact signed bytes/hash BEFORE sending. Retry broadcasts the same transaction.
   this.store.transaction(()=>{this.store.reserveRelay(job,estimate);this.store.updateOutbox(job.id,{state:'submitted',attempts:job.attempts+1,tx_hash:hash,tx_nonce:nonce,payload:job.payload,error:null});});
   job.tx_hash=hash;await this.public.sendRawTransaction({serializedTransaction:rawTx});
   }catch(error){if(!job.tx_hash){job.payload._prepareFailures=(job.payload._prepareFailures||0)+1;job.payload._nextTry=Date.now()+3000;}this.store.updateOutbox(job.id,{payload:job.payload,...(!job.tx_hash&&job.payload._prepareFailures>=3?{state:'failed'}:{}),error:typeof error.shortMessage==='string'?error.shortMessage.slice(0,160):'Chain operation pending; check network, budget or locked contract state'});}
  }}finally{this.busy=false;}
 }
 async confirm(job,receipt) {
  if(job.kind.startsWith('duel-'))return this.duelService.confirm(job,receipt);
  if(receipt.status!=='success')throw Error('Transaction was not successful');
  const id=cupHash(job.cup_id),events=this.events(receipt).filter(e=>e.args.cupId===id);
  if(!events.length)throw Error('Receipt does not contain this Cup');
  const state=await this.read('getCup',[id]);
  if(job.kind==='lock'){if(!events.some(e=>e.eventName==='CupLocked')||state.state!==2||state.participants.some((a,i)=>a.toLowerCase()!==job.payload.recipients[i].toLowerCase()))throw Error('Locked participant mismatch');this.store.updateCup(job.cup_id,{state:'Active',locked:Number(state.lockedAt)*1000});}
  else if(job.kind==='result'){
   const r=job.payload.signed.message,e=events.find(e=>e.eventName==='MatchAccepted'&&e.args.stage===r.stage);
   if(!e||e.args.stage!==r.stage||e.args.winner.toLowerCase()!==r.winnerRecipient.toLowerCase()||e.args.outcomeType!==r.outcomeType||e.args.replayHash!==r.replayHash)throw Error('Result event mismatch');
   if(state.state===3){this.store.updateCup(job.cup_id,{state:'Complete'});const awards=events.filter(e=>e.eventName==='CreditAwarded');for(const a of awards)this.store.enqueue({id:job.cup_id+':withdraw:'+a.args.recipient.toLowerCase(),cupId:job.cup_id,kind:'withdraw',payload:{recipient:a.args.recipient,amount:a.args.amount.toString()}});}
   else if(state.state===4){this.store.updateCup(job.cup_id,{state:'Cancelled',cancel_reason:'verified_void'});this.store.enqueue({id:job.cup_id+':refund',cupId:job.cup_id,kind:'withdraw',payload:{recipient:state.sponsor,amount:'100000000'}});}
  }else if(job.kind==='withdraw'){
   const e=events.find(e=>e.eventName==='Paid'&&e.args.recipient.toLowerCase()===job.payload.recipient.toLowerCase()&&e.args.amount===BigInt(job.payload.amount)&&e.args.token.toLowerCase()===this.token.toLowerCase());if(!e)throw Error('Payout event mismatch');
   const transferred=receipt.logs.some(log=>{if(log.address.toLowerCase()!==this.token.toLowerCase())return false;try{const event=decodeEventLog({abi:transferAbi,...log});return event.args.from.toLowerCase()===this.address.toLowerCase()&&event.args.to.toLowerCase()===job.payload.recipient.toLowerCase()&&event.args.value===BigInt(job.payload.amount);}catch{return false;}});
   if(!transferred)throw Error('Token transfer was not verified');
  }else if(job.kind==='refund-expired'){if(state.state!==4)throw Error('Refund state mismatch');this.store.updateCup(job.cup_id,{state:'Cancelled',cancel_reason:'settlement_deadline'});this.store.enqueue({id:job.cup_id+':refund',cupId:job.cup_id,kind:'withdraw',payload:{recipient:state.sponsor,amount:'100000000'}});}
  this.store.transaction(()=>{this.store.db.prepare('INSERT OR IGNORE INTO chain_receipts VALUES(?,?,?,?)').run(receipt.transactionHash,job.cup_id,job.kind,JSON.stringify(normalize(receipt)));
   this.store.updateOutbox(job.id,{state:job.kind==='withdraw'?'paid':'confirmed',tx_hash:receipt.transactionHash,error:null});});
  await this.onAccepted(job);
 }
}
