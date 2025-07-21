// relay.js
// One-off script to castSnapshot votes on-chain via Gnosis Safe.
// Scheduled every minute via GitHub Actions.

import { request, gql } from 'graphql-request';
import { ethers }      from 'ethers';
import Safe, { EthersAdapter } from '@safe-global/protocol-kit';

if (!process.env.SAFE_OWNER_KEY) {
  console.error('Error: SAFE_OWNER_KEY is not set.');
  process.exit(1);
}
console.log('Starting relay.js...');

// — CONFIGURATION —
const SNAPSHOT_API        = 'https://hub.snapshot.org/graphql';
const SNAPSHOT_SPACE      = 'nda-league-of-lils';
const LIL_NOUNS_GOVERNOR  = '0x5d2C31ce16924C2a71D317e5BbFd5ce387854039';
const GNOSIS_SAFE_ADDRESS = '0xYourGnosisSafeAddressHere';
const ETH_RPC             = 'https://rpc.ankr.com/eth';
const SAFE_OWNER_KEY      = process.env.SAFE_OWNER_KEY;

// — SETUP —
const provider  = new ethers.providers.JsonRpcProvider(ETH_RPC);
const signer    = new ethers.Wallet(SAFE_OWNER_KEY, provider);
const ethAdapter= new EthersAdapter({ ethers, signer });
const safeSdk   = await Safe.create({ ethAdapter, safeAddress: GNOSIS_SAFE_ADDRESS });

const FETCH_CLOSED = gql`
  query($space: String!) {
    proposals(where: { space: $space, state: "closed" }) {
      id
      scores
      scores_total
    }
  }
`;

async function runRelay() {
  const { proposals } = await request(SNAPSHOT_API, FETCH_CLOSED, { space: SNAPSHOT_SPACE });
  const now = (await provider.getBlock('latest')).timestamp;

  for (const p of proposals) {
    try {
      if (p.scores_total === 0) continue;
      const endTs = (await new ethers.Contract(
        LIL_NOUNS_GOVERNOR,
        ['function votingEnd(uint256) view returns (uint256)'],
        provider
      ).votingEnd(p.id)).toNumber();
      if (now >= endTs) continue;

      const choiceIndex = p.scores.findIndex(s => s === Math.max(...p.scores));
      const iface = new ethers.utils.Interface(['function castVote(uint256,uint8)']);
      const data  = iface.encodeFunctionData('castVote', [p.id, choiceIndex]);

      const tx = await safeSdk.createTransaction({ to: LIL_NOUNS_GOVERNOR, data, value: '0' });
      await safeSdk.executeTransaction(tx);
      console.log(`🔗 Voted on #${p.id}`);
    } catch (err) {
      console.error(`Error processing proposal #${p.id}:`, err);
    }
  }
}

runRelay().catch(e => { console.error(e); process.exit(1); });