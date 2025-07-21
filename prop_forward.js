// prop_forward.js
// Forwards new LilProps into main lils-africa space (Approve/Reject).
// Scheduled every minute via GitHub Actions.

import fs from 'fs';
import { request, gql } from 'graphql-request';
import { ethers } from 'ethers';
import Snapshot from '@snapshot-labs/snapshot.js';

// — CONFIGURATION —
const SOURCE_SPACE  = 'lils-africa-props';
const TARGET_SPACE  = 'lils-africa';
const ETH_RPC       = 'https://rpc.ankr.com/eth';
const SNAPSHOT_API  = 'https://hub.snapshot.org/graphql';
const RELAY_KEY     = process.env.RELAY_KEY;
const BASE_CHAIN_ID = 8453;
const STATE_FILE    = 'prop_forward_state.json';

// — SETUP —
const provider       = new ethers.providers.JsonRpcProvider(ETH_RPC);
const signer         = new ethers.Wallet(RELAY_KEY, provider);
const snapshotClient = new Snapshot.Client712();

const FETCH_PENDING = gql`
  query($space: String!) {
    proposals(where: { space: $space, state: "pending" }) {
      id title body start end snapshot
    }
  }
`;

(async () => {
  let seen = [];
  try { seen = JSON.parse(fs.readFileSync(STATE_FILE)); } catch {}

  const { proposals } = await request(SNAPSHOT_API, FETCH_PENDING, { space: SOURCE_SPACE });
  for (const p of proposals) {
    if (seen.includes(p.id)) continue;
    console.log(`Forwarding #${p.id}`);

    await snapshotClient.proposal(signer, {
      space:    TARGET_SPACE,
      type:     'single-choice',
      title:    p.title,
      body:     p.body,
      choices:  ['Approve','Reject'],
      start:    p.start,
      end:      p.end,
      snapshot: p.snapshot,
      network:  '1',
      strategies: [{
        name: 'nft-balance-of',
        params: {
          address: '0x614d7503a44e6fd67997f9945bb32d02e8c19431',
          symbol:  'NDA', decimals: 0, chainId: BASE_CHAIN_ID
        }
      }],
      plugins: {},
      app: 'prop-forward'
    });
    seen.push(p.id);
  }
  fs.writeFileSync(STATE_FILE, JSON.stringify(seen));
})().catch(e => { console.error(e); process.exit(1); });