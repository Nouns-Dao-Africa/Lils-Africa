// relay.js
import { request, gql } from 'graphql-request';
import { ethers } from 'ethers';
import Safe, { EthersAdapter, SafeFactory } from '@safe-global/protocol-kit';

// — CONFIGURATION — //
const SNAPSHOT_API      = 'https://hub.snapshot.org/graphql';
const SNAPSHOT_SPACE    = 'nda-league-of-lils';
const LIL_NOUNS_GOVERNOR = '0x…';       // LilNouns Governor on Mainnet
const GNOSIS_SAFE_ADDRESS = '0x…';      // Safe holding LilNouns tokens
const ETH_RPC           = 'https://rpc.ankr.com/eth';
const SAFE_SERVICE_URL  = 'https://safe-transaction-mainnet.safe.global';

// Ethers setup
const provider = new ethers.providers.JsonRpcProvider(ETH_RPC);
const ethSigner = new ethers.Wallet(process.env.SAFE_OWNER_KEY, provider);

// Safe setup
const ethAdapter = new EthersAdapter({ ethers, signer: ethSigner });
const safeSdk = await Safe.create({ ethAdapter, safeAddress: GNOSIS_SAFE_ADDRESS });

// — HELPERS — //
const FETCH_CLOSED = gql`
  query ($space: String!) {
    proposals(where: { space: $space, state: "closed" }) {
      id
      choices
      scores
      scores_total
    }
  }
`;

async function fetchClosedProposals() {
  const res = await request(SNAPSHOT_API, FETCH_CLOSED, { space: SNAPSHOT_SPACE });
  return res.proposals;
}

async function relayVotes() {
  const proposals = await fetchClosedProposals();
  for (const p of proposals) {
    // Skip if already relayed (you’ll want a local DB or tag on Snapshot to track)
    if (p.scores_total === 0) continue;

    // Find winning index
    const max = Math.max(...p.scores);
    const choiceIndex = p.scores.findIndex(s => s === max);
    const support = choiceIndex; // 0=For,1=Against,2=Abstain

    // Encode castVote(uint256 proposalId, uint8 support)
    const govAbi = ['function castVote(uint256 proposalId, uint8 support)'];
    const iface = new ethers.utils.Interface(govAbi);
    const data = iface.encodeFunctionData('castVote', [p.id, support]);

    // Build Safe transaction
    const safeTransaction = await safeSdk.createTransaction({
      to: LIL_NOUNS_GOVERNOR,
      data,
      value: '0'
    });
    const txResponse = await safeSdk.executeTransaction(safeTransaction);
    console.log(`🔗 Relayed vote for proposal ${p.id}: txn ${txResponse.hash}`);
  }
}

relayVotes().catch(console.error);