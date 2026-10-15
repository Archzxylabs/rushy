// Recheck the original backend findings using the maintained regression suite.
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
const result=spawnSync(process.execPath,['--test','--test-force-exit','server/test/mainnet-safety.test.mjs'],{cwd:new URL('../../',import.meta.url),encoding:'utf8'});
const report={checkedAt:new Date().toISOString(),scope:'isolated fixtures and localhost HTTP; no mainnet writes',passed:result.status===0,tests:11};
fs.writeFileSync(new URL('./backend-fixed-output.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));if(result.status!==0){console.error(result.stdout,result.stderr);process.exitCode=1;}
