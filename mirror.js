// mirror.js
// One-off script to mirror new LilNouns on-chain proposals into Snapshot.
// Scheduled every minute via GitHub Actions.

import { ethers } from 'ethers';
import Snapshot from '@snapshot-labs/snapshot.js';

if (!process.env.RELAY_KEY) {
  console.error('Error: RELAY_KEY is not set.');
  process.exit(1);
}
console.log('Starting mirror.js...');

// — CONFIGURATION —
const LIL_NOUNS_GOVERNOR = '0x5d2C31ce16924C2a71D317e5BbFd5ce387854039'; // on-chain Governor
const SNAPSHOT_SPACE     = 'nda-league-of-lils';                          // Snapshot space ID
const SNAPSHOT_NETWORK   = '1';                                           // Ethereum Mainnet
const BASE_CHAIN_ID      = 8453;                                          // Base chain ID
const ETH_RPC            = 'https://rpc.ankr.com/eth';                   // RPC endpoint
const RELAY_KEY          = process.env.RELAY_KEY;                        // signer key
const BLOCK_RANGE        = 120;                                          // blocks to scan

// — SETUP —
const provider       = new ethers.providers.JsonRpcProvider(ETH_RPC);
const signer         = new ethers.Wallet(RELAY_KEY, provider);
const snapshotClient = new Snapshot.Client712();

const GOVERNOR_ABI = [
  'event ProposalCreated(uint256 id,address proposer,address[] targets,uint256[] values,string[] signatures,bytes[] calldatas,uint256 startBlock,uint256 endBlock,string description)'
];
const govContract = new ethers.Contract(LIL_NOUNS_GOVERNOR, GOVERNOR_ABI, provider);

async function runMirror() {
  try {
    const latest = await provider.getBlockNumber();
    const from    = Math.max(latest - BLOCK_RANGE, 0);
    console.log(`🔍 Scanning blocks ${from}–${latest}`);

    const logs = await govContract.queryFilter(
      govContract.filters.ProposalCreated(),
      from,
      latest
    );
    console.log(`✨ Found ${logs.length} proposals`);

    for (const log of logs) {
      const { id, startBlock, endBlock, description } = log.args;
      console.log(`↪️  Mirroring #${id}...`);
      try {
        const startBlk = await provider.getBlock(startBlock);
        const endBlk   = await provider.getBlock(endBlock);
        const snapshot = startBlk.number;
        const startTs  = startBlk.timestamp;
        const endTs    = endBlk.timestamp - 24 * 60 * 60;

        await snapshotClient.proposal(signer, {
          space: SNAPSHOT_SPACE,
          type: 'single-choice',
          title: `LilNouns Proposal #${id}`,
          body:  description,
          choices: ['For','Against','Abstain'],
          start:    startTs,
          end:      endTs,
          snapshot: snapshot,
          network:  SNAPSHOT_NETWORK,
          strategies: [{
            name: 'nft-balance-of',
            params: {
              address: '0x614d7503a44e6fd67997f9945bb32d02e8c19431',
              symbol:  'NDA',
              decimals: 0,
              chainId: BASE_CHAIN_ID
            }
          }],
          plugins: {},
          app: 'mirror'
        });
        console.log(`✅ #${id} mirrored`);
      } catch (e) {
        console.error(`❌ Mirror #${id} failed:`, e);
      }
    }
  } catch (err) {
    console.error('mirror.js fatal error:', err);
  }
}

runMirror().catch(e => { console.error(e); process.exit(1); });