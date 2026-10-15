// Read-only verification of the existing Arc deployments. No signer or key is used.
import fs from 'node:fs';
import path from 'node:path';
import {createPublicClient, encodeDeployData, formatEther, http, parseAbi} from 'viem';

const root = path.resolve(import.meta.dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'deployments/arc-mainnet.json'), 'utf8'));
const same = (a, b) => a?.toLowerCase() === b?.toLowerCase();
function check(condition, message) { if (!condition) throw Error(message); }
function runtimeMatches(code, artifact) {
  if (!code || code === '0x') return false;
  const actual = Buffer.from(code.slice(2), 'hex');
  const expected = Buffer.from(artifact.deployedBytecode.object.replace(/^0x/, ''), 'hex');
  if (actual.length !== expected.length) return false;
  for (const refs of Object.values(artifact.deployedBytecode.immutableReferences || {})) {
    for (const {start, length} of refs) {
      actual.fill(0, start, start + length);
      expected.fill(0, start, start + length);
    }
  }
  return actual.equals(expected);
}

try {
  const client = createPublicClient({transport: http(process.env.ARC_MAINNET_RPC_URL || manifest.rpcUrl, {timeout: 15000, retryCount: 2, retryDelay: 300})});
  check(await client.getChainId() === manifest.chainId, 'RPC is not Arc mainnet chain 5042');
  const blockNumber = await client.getBlockNumber();
  const decimals = await client.readContract({address: manifest.token.address, abi: parseAbi(['function decimals() view returns (uint8)']), functionName: 'decimals', blockNumber});
  check(decimals === manifest.token.decimals, 'USDC decimals differ from manifest');
  const contracts = await Promise.all(Object.entries(manifest.contracts).map(async ([name, deployment]) => {
    const artifact = JSON.parse(fs.readFileSync(path.join(root, `deployed-artifacts/${name}.json`), 'utf8'));
    const address = deployment.address;
    const roles = manifest.roles;
    const args = name === 'PaidDuelEscrow'
      ? [manifest.token.address, roles.RESULT_SIGNER, roles.RELAY, roles.TREASURY, manifest.feeBps, roles.OWNER]
      : [manifest.token.address, roles.RESULT_SIGNER, roles.RELAY, roles.OWNER];
    const [receipt, tx, code] = await Promise.all([
      client.getTransactionReceipt({hash: deployment.transactionHash}),
      client.getTransaction({hash: deployment.transactionHash}),
      client.getBytecode({address, blockNumber}),
    ]);
    check(receipt.status === 'success' && same(receipt.contractAddress, address), `${name}: deployment receipt mismatch`);
    check(same(tx.from, manifest.deployer) && !tx.to && tx.value === 0n, `${name}: deployer or creation transaction mismatch`);
    check(tx.input.toLowerCase() === encodeDeployData({abi: artifact.abi, bytecode: artifact.bytecode.object, args}).toLowerCase(), `${name}: creation bytecode or constructor arguments differ`);
    check(runtimeMatches(code, artifact), `${name}: runtime differs from pinned deployed artifact`);
    const fields = ['token', 'owner', 'relay', 'nextSigner', 'nextSignerEpoch', 'paused', 'eip712Domain', 'POOL',
      ...(name === 'PaidDuelEscrow' ? ['treasury', 'feeBps', 'ENTRY'] : ['CHAMPION_AWARD', 'RUNNER_UP_AWARD'])];
    const values = await Promise.all(fields.map(functionName => client.readContract({address, abi: artifact.abi, functionName, blockNumber})));
    const state = Object.fromEntries(fields.map((field, index) => [field, values[index]]));
    for (const [field, expected] of Object.entries({token: manifest.token.address, owner: roles.OWNER, relay: roles.RELAY, nextSigner: roles.RESULT_SIGNER, ...(name === 'PaidDuelEscrow' ? {treasury: roles.TREASURY} : {})})) {
      check(same(state[field], expected), `${name}: current ${field} differs from deployment manifest`);
    }
    check(Number(state.nextSignerEpoch) === 1 && state.paused === false, `${name}: initial epoch or pause state changed`);
    const domain = state.eip712Domain;
    const expectedDomain = manifest.domains[name];
    check(domain[1] === expectedDomain.name && domain[2] === expectedDomain.version && domain[3] === BigInt(manifest.chainId) && same(domain[4], address), `${name}: EIP-712 domain mismatch`);
    if (name === 'PaidDuelEscrow') {
      check(Number(state.feeBps) === manifest.feeBps && state.ENTRY === 1_000_000n && state.POOL === 2_000_000n, 'Duel terms mismatch');
    } else {
      check(state.POOL === 100_000_000n && state.CHAMPION_AWARD === 70_000_000n && state.RUNNER_UP_AWARD === 30_000_000n, 'Cup terms mismatch');
    }
    return {contract: name, address, transactionHash: deployment.transactionHash, receiptStatus: receipt.status,
      deploymentBlock: receipt.blockNumber.toString(), feeUSDC: formatEther(receipt.gasUsed * receipt.effectiveGasPrice),
      creationInputMatches: true, runtimeMatches: true, configurationMatches: true, domainMatches: true};
  }));
  const report = {checkedAt: new Date().toISOString(), chainId: manifest.chainId, blockNumber: blockNumber.toString(),
    status: 'DEPLOYMENT_VERIFIED', tokenDecimals: decimals, contracts, transactionBroadcast: false,
    scope: 'Read-only deployment/configuration checks; no payment acceptance test or security audit.'};
  fs.writeFileSync(path.join(root, 'deployments/verification.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  // A provider error can include a credential-bearing RPC URL. Keep it out of logs.
  const reasons = [];
  for (let cause = error, depth = 0; cause && depth < 4; cause = cause.cause, depth++) {
    const message = cause.shortMessage || (depth === 0 && !error.shortMessage ? cause.message : cause.name);
    reasons.push({error: cause.name, message: message?.replace(/https?:\/\/[^\s"'<>]+/g, '[RPC]'), code: cause.code, status: cause.status});
  }
  console.error(JSON.stringify({status: 'VERIFICATION_FAILED', reasons}));
  process.exitCode = 1;
}
