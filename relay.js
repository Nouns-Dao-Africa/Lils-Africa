// relay.js
// One-off script to tally closed Snapshot votes and relay them on-chain via Gnosis Safe.
// Intended to be run on a schedule (e.g. GitHub Actions every minute).

import { request, gql } from 'graphql-request';
import { ethers }      from 'ethers';
import Safe, { EthersAdapter } from '@safe-global/protocol-kit';

// — CONFIGURATION — //
// Snapshot GraphQL API and space
const SNAPSHOT_API        = 'https://hub.snapshot.org/graphql';
const SNAPSHOT_SPACE      = 'nda-league-of-lils';
// LilNouns Governor contract on Ethereum Mainnet
const LIL_NOUNS_GOVERNOR  = '0x5d2C31ce16924C2a71D317e5BbFd5ce387854039';
// Ethereum RPC endpoint
const ETH_RPC             = 'https://rpc.ankr.com/eth';
// Gnosis Safe address holding the LilNouns tokens
const GNOSIS_SAFE_ADDRESS = '0x…';

// Private key for one Safe owner (GitHub secret)
const SAFE_OWNER_KEY      = process.env.SAFE_OWNER_KEY;

// — SETUP — //
const provider  = new ethers.providers.JsonRpcProvider(ETH_RPC);
const signer    = new ethers.Wallet(SAFE_OWNER_KEY, provider);
const ethAdapter= new EthersAdapter({ ethers, signer });
const safeSdk   = await Safe.create({ ethAdapter, safeAddress: GNOSIS_SAFE_ADDRESS });

// ABI fragments for reading the on-chain deadline and casting votes
const GOV_ABI = [
  'function votingEnd(uint256 proposalId) view returns (uint256)',
  'function castVote(uint256 proposalId,uint8 support)'
];
const gov     = new ethers.Contract(LIL_NOUNS_GOVERNOR, GOV_ABI, provider);

// GraphQL query to fetch closed Snapshot proposals
const FETCH_CLOSED = gql`
  query ($space: String!) {
    proposals(where: { space: $space, state: "closed" }) {
      id
      scores
      scores_total
    }
  }
`;

async function runRelay() {
  console.log('🔍 Fetching closed Snapshot proposals…');
  const { proposals } = await request(SNAPSHOT_API, FETCH_CLOSED, { space: SNAPSHOT_SPACE });
  if (!proposals.length) {
    console.log('– No closed proposals to process.');
    return;
  }

  // Get current on-chain timestamp
  const nowTs = (await provider.getBlock('latest')).timestamp;

  for (const p of proposals) {
    if (p.scores_total === 0) {
      console.log(`#${p.id} has no votes—skipping.`);
      continue;
    }
    // Read on-chain vote end timestamp
    const endTs = (await gov.votingEnd(p.id)).toNumber();
    if (nowTs >= endTs) {
      console.log(`#${p.id} ended on-chain at ${endTs} (now=${nowTs})—too late.`);
      continue;
    }

    // Determine the winning choice
    const maxScore     = Math.max(...p.scores);
    const choiceIndex  = p.scores.findIndex(s => s === maxScore);
    const support      = choiceIndex;  // 0 = For, 1 = Against, 2 = Abstain

    console.log(`↪️  Relaying vote for proposal #${p.id}: support=${support}`);

    // Encode and dispatch Safe transaction
    const iface   = new ethers.utils.Interface([GOV_ABI[1]]);
    const data    = iface.encodeFunctionData('castVote', [p.id, support]);
    const safeTx  = await safeSdk.createTransaction({
      to:    LIL_NOUNS_GOVERNOR,
      data,
      value: '0'
    });
    const txRes   = await safeSdk.executeTransaction(safeTx);
    console.log(`✅ Vote cast for proposal #${p.id} — tx ${txRes.hash}`);
  }
}

runRelay().catch(err => {
  console.error('❌ relay.js fatal error:', err);
  process.exit(1);
});