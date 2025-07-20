// mirror.js
// One-off script to mirror new LilNouns on-chain proposals into Snapshot.
// Intended to be run on a schedule (e.g. GitHub Actions every minute).

import { ethers } from 'ethers';
import Snapshot from '@snapshot-labs/snapshot.js';

// — CONFIGURATION — //
// Address of the LilNouns Governor contract on Ethereum Mainnet
const LIL_NOUNS_GOVERNOR = '0x…';
// Your Snapshot space ID
const SNAPSHOT_SPACE     = 'nda-league-of-lils';
// Chain/network IDs
const SNAPSHOT_NETWORK   = '1';  // Ethereum Mainnet
const BASE_CHAIN_ID      = 8453; // Base network for NDA NFT strategy
// RPC endpoint for Ethereum Mainnet
const ETH_RPC            = 'https://rpc.ankr.com/eth';
// Private key (GitHub secret) for signing Snapshot proposals
const RELAY_KEY          = process.env.RELAY_KEY;
// How many blocks back to scan for new events
const BLOCK_RANGE        = 120;

// — SETUP — //
const provider       = new ethers.providers.JsonRpcProvider(ETH_RPC);
const signer         = new ethers.Wallet(RELAY_KEY, provider);
const snapshotClient = new Snapshot.Client712();

// ABI fragment for the ProposalCreated event
const GOVERNOR_ABI = [
  'event ProposalCreated(uint256 id,address proposer,address[] targets,uint256[] values,string[] signatures,bytes[] calldatas,uint256 startBlock,uint256 endBlock,string description)'
];
const govContract    = new ethers.Contract(LIL_NOUNS_GOVERNOR, GOVERNOR_ABI, provider);

async function runMirror() {
  // Determine block range to scan
  const latestBlock = await provider.getBlockNumber();
  const fromBlock   = Math.max(latestBlock - BLOCK_RANGE, 0);
  console.log(`🔍 Scanning blocks ${fromBlock}–${latestBlock} for new proposals`);

  // Fetch new ProposalCreated events in that range
  const logs = await govContract.queryFilter(
    govContract.filters.ProposalCreated(),
    fromBlock,
    latestBlock
  );
  console.log(`✨ Found ${logs.length} proposals in range`);

  for (const log of logs) {
    const { id, startBlock, endBlock, description } = log.args;
    console.log(`↪️  Mirroring proposal #${id.toString()}...`);
    try {
      // Fetch timestamps for start and end blocks
      const startBlkObj = await provider.getBlock(startBlock);
      const endBlkObj   = await provider.getBlock(endBlock);
      const snapshotBlk = startBlkObj.number;
      const startTs     = startBlkObj.timestamp;
      // End off-chain voting 24h before on-chain end
      const endTs       = endBlkObj.timestamp - 24 * 60 * 60;

      // Off-chain voting choices
      const choices = ['For', 'Against', 'Abstain'];

      // Create the Snapshot proposal
      await snapshotClient.proposal(signer, {
        space: SNAPSHOT_SPACE,
        type: 'single-choice',
        title: `LilNouns Proposal #${id.toString()}`,
        body: description,
        choices,
        start: startTs,
        end:   endTs,
        snapshot: snapshotBlk,
        network: SNAPSHOT_NETWORK,
        strategies: [
          {
            name: 'nft-balance-of',
            params: {
              address: '0x<NDA_ERC721_Address>',
              symbol: 'NDA',
              decimals: 0,
              chainId: BASE_CHAIN_ID
            }
          }
        ],
        plugins: {},
        app: 'mirror'
      });
      console.log(`✅ Mirrored #${id.toString()} into Snapshot`);
    } catch (err) {
      console.error(`❌ Failed to mirror #${id.toString()}:`, err);
    }
  }
}

runMirror().catch(err => {
  console.error('❌ mirror.js fatal error:', err);
  process.exit(1);
});