// prop_submit.js
// Submits approved LilProps to LilNouns Governor.propose(...).
// Scheduled every minute via GitHub Actions.

import fs from 'fs';
import { request, gql } from 'graphql-request';
import { ethers } from 'ethers';

if (!process.env.SAFE_OWNER_KEY) {
  console.error('Error: SAFE_OWNER_KEY is not set.');
  process.exit(1);
}
console.log('Starting prop_submit.js...');

// — CONFIGURATION —
const SNAPSHOT_API     = 'https://hub.snapshot.org/graphql';
const TARGET_SPACE     = 'lils-africa';
const ETH_RPC          = 'https://rpc.ankr.com/eth';
const GOVERNOR_ADDRESS = '0x5d2C31ce16924C2a71D317e5BbFd5ce387854039';
const STATE_FILE       = 'prop_submit_state.json';
const PASS_THRESHOLD   = 0.5;
const SAFE_OWNER_KEY   = process.env.SAFE_OWNER_KEY;

// — SETUP —
const provider = new ethers.providers.JsonRpcProvider(ETH_RPC);
const signer   = new ethers.Wallet(SAFE_OWNER_KEY, provider);
const GOVERNOR_ABI = [
  'function propose(address[] targets,uint256[] values,string[] signatures,bytes[] calldatas,string description) returns (uint256)'
];
const governor = new ethers.Contract(GOVERNOR_ADDRESS, GOVERNOR_ABI, signer);

const FETCH_CLOSED = gql`
  query($space: String!) {
    proposals(where: { space: $space, state: "closed" }) {
      id scores scores_total body
    }
  }
`;

(async () => {
  let seen = [];
  try { seen = JSON.parse(fs.readFileSync(STATE_FILE)); } catch {}

  const { proposals } = await request(SNAPSHOT_API, FETCH_CLOSED, { space: TARGET_SPACE });
  for (const p of proposals) {
    try {
      if (seen.includes(p.id)) continue;
      if (p.scores_total === 0) { seen.push(p.id); continue; }

      const approved = p.scores[0];
      const ratio    = approved / p.scores_total;
      if (ratio < PASS_THRESHOLD) {
        seen.push(p.id); continue;
      }
      let params;
      try { params = JSON.parse(p.body); } catch { seen.push(p.id); continue; }

      if (!Array.isArray(params.targets) || !params.targets.every(addr => ethers.utils.isAddress(addr))) {
        console.error(`Invalid targets in prop #${p.id}`);
        seen.push(p.id);
        continue;
      }
      if (!Array.isArray(params.values) || params.values.some(v => isNaN(Number(v)))) {
        console.error(`Invalid values in prop #${p.id}`);
        seen.push(p.id);
        continue;
      }
      if (!Array.isArray(params.signatures) || !params.signatures.every(sig => typeof sig === 'string')) {
        console.error(`Invalid signatures in prop #${p.id}`);
        seen.push(p.id);
        continue;
      }
      if (!Array.isArray(params.calldatas) || !params.calldatas.every(cd => /^0x[0-9a-fA-F]*$/.test(cd))) {
        console.error(`Invalid calldatas in prop #${p.id}`);
        seen.push(p.id);
        continue;
      }
      if (typeof params.description !== 'string') {
        console.error(`Invalid description in prop #${p.id}`);
        seen.push(p.id);
        continue;
      }
      const { targets, values, signatures, calldatas, description } = params;

      const gasEstimate = await governor.estimateGas.propose(targets, values, signatures, calldatas, description);
      if (gasEstimate.gt(ethers.BigNumber.from('10000000'))) {
        console.error(`Gas estimate too high (${gasEstimate.toString()}) for prop #${p.id}`);
        seen.push(p.id);
        continue;
      }

      try {
        const tx = await governor.propose(targets, values, signatures, calldatas, description);
        console.log(`On-chain tx: ${tx.hash}`);
      } catch (e) {
        console.error(`Submission failed for prop #${p.id}:`, e);
      }
      seen.push(p.id);
    } catch (err) {
      console.error(`Error processing proposal #${p.id}:`, err);
    }
  }
  fs.writeFileSync(STATE_FILE, JSON.stringify(seen));
})().catch(e => { console.error(e); process.exit(1); });