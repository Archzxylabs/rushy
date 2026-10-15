// Synthetic wrong-resource batches must be rejected, while valid batches still confirm.
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
const result=spawnSync(process.execPath,['--test','--test-force-exit','--test-name-pattern=batch receipts','server/test/mainnet-safety.test.mjs'],{cwd:new URL('../../',import.meta.url),encoding:'utf8'});
const report={checkedAt:new Date().toISOString(),scope:'synthetic receipts decoded with deployed ABIs; no RPC or transactions',wrongCupPayoutRejected:result.status===0,wrongDuelPayoutRejected:result.status===0,validBatchConfirmed:result.status===0};
fs.writeFileSync(new URL('./receipt-fixed-output.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));if(result.status!==0){console.error(result.stdout,result.stderr);process.exitCode=1;}
