// Isolated, disposable browser fixture. Public Anvil accounts; localhost only.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import {spawn} from 'node:child_process';
import {createPublicClient,createWalletClient,defineChain,http} from '../../server/node_modules/viem/_esm/index.js';
import {mnemonicToAccount} from '../../server/node_modules/viem/_esm/accounts/index.js';
import {startServer} from '../../server/app.mjs';
const port=await new Promise(resolve=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p));});});
const rpc=`http://127.0.0.1:${port}`,child=spawn('anvil',['--silent','--port',String(port),'--chain-id','31337'],{stdio:'ignore'});
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'rushy-browser-'));
const accounts=Array.from({length:10},(_,i)=>mnemonicToAccount('test test test test test test test test test test test junk',{addressIndex:i}));
const network=defineChain({id:31337,name:'Local test',nativeCurrency:{name:'ETH',symbol:'ETH',decimals:18},rpcUrls:{default:{http:[rpc]}}});
const client=createPublicClient({chain:network,transport:http(rpc,{retryCount:0})}),wallet=createWalletClient({chain:network,account:accounts[0],transport:http(rpc)});
let server;
const cleanup=async()=>{if(server)await server.close();child.kill('SIGTERM');fs.rmSync(dir,{recursive:true,force:true});process.exit(0);};
process.on('SIGTERM',cleanup);process.on('SIGINT',cleanup);
try{
 for(let n=0;n<100;n++){try{if(await client.getChainId()===31337)break;}catch{}await new Promise(r=>setTimeout(r,50));}
 const artifact=name=>JSON.parse(fs.readFileSync(new URL('../../contracts/out/'+name,import.meta.url)));
 const deploy=async(a,args=[])=>{const receipt=await client.waitForTransactionReceipt({hash:await wallet.deployContract({abi:a.abi,bytecode:a.bytecode.object,args})});return receipt.contractAddress;};
 const a=artifact('HouseCupEscrow.t.sol/MockToken.json'),token=await deploy(a),cup=await deploy(artifact('HouseCupEscrow.sol/HouseCupEscrow.json'),[token,accounts[8].address,accounts[9].address,accounts[0].address]);
 const duel=await deploy(artifact('PaidDuelEscrow.sol/PaidDuelEscrow.json'),[token,accounts[8].address,accounts[9].address,accounts[0].address,500,accounts[0].address]);
 for(const acc of [accounts[1],accounts[2]])await client.waitForTransactionReceipt({hash:await wallet.writeContract({address:token,abi:a.abi,functionName:'mint',args:[acc.address,10000000n]})});
 server=await startServer({port:5197,dbPath:path.join(dir,'browser.sqlite'),env:{CHAIN_MODE:'local-mock',LOCAL_MOCK_RPC_URL:rpc,LOCAL_MOCK_TOKEN:token,CUP_ESCROW_ADDRESS:cup,DUEL_ESCROW_ADDRESS:duel,DUEL_TREASURY_ADDRESS:accounts[0].address,RESULT_SIGNER_PRIVATE_KEY:'0x'+Buffer.from(accounts[8].getHdKey().privateKey).toString('hex'),RELAY_PRIVATE_KEY:'0x'+Buffer.from(accounts[9].getHdKey().privateKey).toString('hex')}});
 fs.writeFileSync('/tmp/rushy-browser-fixture.json',JSON.stringify({base:'http://127.0.0.1:5197',rpc,accounts:accounts.slice(1,3).map(a=>a.address),token,cup,duel}));
 console.log('Local browser fixture ready on 5197, chain 31337.');
}catch(error){console.error(error.shortMessage||error.message);await cleanup();}
