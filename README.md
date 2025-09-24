# NDA ↔ Lil Nouns Governance Bridge (Layer-0, On-Chain)

## 🧭 What’s changing (at a glance)
- **Old:** Off-chain Snapshot spaces + GitHub Actions relays + Gnosis Safe casting votes.
- **New:** **Two smart contracts** (Base + Ethereum) connected via **Layer-0 messaging**.  
  NDA holders vote **on Base** with the **NDA token**; results are **finalized on Base** and **cast on Ethereum** by an **on-chain Executor** that already holds delegated Lil Nouns voting power.

---

## 🎯 Objectives
1. **Mirror Lil Nouns proposals on-chain** to Base in near-real-time.
2. **Allow NDA token holders** (ERC-721 or ERC-20—both supported) to vote on the mirrored proposals **on Base**.
3. **Aggregate and finalize** the Base vote on-chain with quorum/thresholds that **mirror Lil Nouns’ rules** (configurable).
4. **Cast the corresponding vote on Ethereum** through a **mainnet Executor contract** that controls **pre-delegated voting power**.
5. **Eliminate off-chain trust** (no Snapshot, no cron bots) while keeping clear pause/upgrade controls and auditability.

---

## 🏗️ High-Level Architecture
### Chains & Roles
- **Ethereum Mainnet**
  - **Lil Nouns Governor** (existing, read-only).
  - **NDA Mainnet Executor (Agent)** — holds delegated Lil Nouns voting power; **casts `castVote`/`castVoteWithReason`** after Base finalization.
  - **Layer-0 Endpoint** — receives verified messages from Base.

- **Base**
  - **NDA MirrorGovernor** — holds mirrored proposals, runs the NDA vote (using NDA token as voting power), finalizes outcome, and **sends a Layer-0 message** to Mainnet.
  - **Layer-0 Endpoint** — sends verified messages to Mainnet.

### Message Flow
1. **Mirror:** When `ProposalCreated` fires on Lil Nouns Governor, **MirrorFeed** (lightweight on-chain or minimal off-chain pusher operated by us) **emits** a Layer-0 message OR a simple “proposal registration” tx to **NDA MirrorGovernor** with:
   - `proposalId`, `targets`, `values`, `signatures/calldatas` (if exposed), `startBlock`, `endBlock`, `description`, and **snapshotBlock**.
2. **Vote on Base:** NDA holders vote during the **same window** (`start/end`) or a **mapped time window** (block-time alignment handled in config).
3. **Finalize on Base:** MirrorGovernor checks quorum/thresholds, locks the result.
4. **Send Result to Mainnet:** MirrorGovernor sends a **Layer-0 message** with `{proposalId, choice, reason, proofHash}`.
5. **Execute on Mainnet:** NDA Mainnet Executor verifies the message and calls **Lil Nouns Governor `castVote[_WithReason]`** from its **pre-delegated address**.

> **Critical requirement:** The **Mainnet Executor address must have Lil Nouns voting power delegated _before the proposal’s snapshot block_** or it won’t count. We’ll put a standing ops runbook to maintain delegation.

---

## 📦 Contracts (deliverables)
### 1) NDA MirrorGovernor (Base)
- **Standards:** OpenZeppelin `Governor`, `GovernorCountingSimple`, `GovernorVotes` (works with ERC-20Votes or ERC-721Votes; we’ll add an **ERC-721 voting adapter** if NDA is ERC-721 without `getVotes`).
- **Responsibilities:**
  - Maintain a **registry of mirrored proposals** keyed by Lil Nouns `proposalId`.
  - Enforce **voting window** synced/mapped to mainnet.
  - Configurable **quorum** and **vote success rule** (e.g., For > Against; optional `abstain`).
  - **Finalize** result → **emit** `Finalized(proposalId, choice, tally)`.
  - **Layer-0 OApp sender**: packs result → sends to Mainnet Executor.
- **Safety:**
  - **Pausable** mirroring/voting; **upgradeable** via UUPS/Transparent Proxy (optional).
  - **Replay protection** and **proposalId binding**.
  - **Timelock** (optional) for governance parameter changes.

### 2) NDA Mainnet Executor (Ethereum)
- **Responsibilities:**
  - **Layer-0 OApp receiver**: validates message origin (Base MirrorGovernor + endpoint/DVN/ISM).
  - After acceptance → call **`castVote` or `castVoteWithReason`** on Lil Nouns Governor for `proposalId`.
  - **Single-vote policy** with idempotency (no double cast).
- **Voting Power:**
  - Holds or is **delegatee of Lil Nouns voting tokens** (ensure **delegation is set _prior to proposal snapshot_**).
- **Safety:**
  - **Only accept messages** from our Base app/endpoint.
  - **Pausable**; **emergency withdraw** of delegation (ops runbook).
  - **No custody** of ETH/tokens beyond gas; minimal surface.

### 3) (Optional) MirrorFeed
- **Tiny helper**: listens to `ProposalCreated` and **pushes** a registration tx to Base MirrorGovernor (or sends a cross-chain msg if you prefer **pure on-chain emit** on Ethereum via a small **Mainnet MirrorEmitter** contract + Layer-0).  
- We’ll choose **pure on-chain → Layer-0** if we want *zero off-chain steps*; otherwise a minimal relayer is acceptable, but not required.

---

## ⚙️ Governance Parameters (configurable)
- **Voting token:** NDA (ERC-721 or ERC-20).  
  - If **ERC-721**, 1 NFT = 1 vote (with optional **`tokenId` to `getVotes` snapshot** adapter).
  - If **ERC-20Votes**, weight from checkpoints at Base snapshot block.
- **Quorum:** % of total supply (or absolute). Default to mirror Lil Nouns quorum semantics conceptually.
- **Thresholds:** Simple majority (For > Against) or stricter.  
- **Windows:** Map mainnet `startBlock`/`endBlock` to Base block-time. We’ll **lock to the same UTC window** using block-to-time estimation with guards.
- **Abstain:** Enabled to mirror Governor Bravo behavior.

---

## 🔐 Security & Trust Model
- **Cross-chain Security:** Use LayerZero v2 OApp (or Hyperlane ISM if directed) with **multi-DVN** or appropriate ISM for robust message validation.
- **Replay/Reorg Handling:** MirrorGovernor stores **proposal root** (proposalId + metadata hash). Mainnet Executor verifies **binding**.
- **Pausing & Upgrades:** Both contracts **Pausable**; parameter updates via **multi-sig** on each chain. Upgrade keys gated by DAO multisigs.
- **Delegation Ops:** Procedures to:
  - Keep **Lil Nouns voting power** delegated to **Executor** continuously.
  - Re-delegate if ownership changes.
  - **Pre-check active proposals** for snapshot timing before any re-delegation.

---

## 🧪 Testing Plan
- **Unit:** Governor math, quorum, finalization, message packing/unpacking, replay protection.
- **Integration (local + testnets):**
  - Deploy a **mock Lil Nouns Governor** on an Ethereum testnet.
  - Deploy **MirrorGovernor** on Base Sepolia.
  - Emit `ProposalCreated` → mirror → vote with multiple voters → finalize → L0 message → **Executor casts vote** on mock Governor.
- **Property/Fuzz:** Voting edge cases, tie, abstain, late messages, duplicate finalize, DVN drop/retry.
- **Fork Tests:** Mainnet fork to validate **`castVote` ABI** and **snapshot rules**.

---

## 🧭 Migration From Old Scope
- **Remove:** Snapshot spaces, GitHub Actions (`mirror/relay/prop_forward/prop_submit`), state JSONs.
- **Keep:** Frontend **(Next.js)** — re-point to **MirrorGovernor** reads (no Snapshot GraphQL).
- **Replace:** Gnosis Safe casting with **on-chain Mainnet Executor**.
- **New Ops:** Delegate Lil Nouns votes to **Executor** address and **monitor delegation**.

---

## 🖥️ Frontend Changes
- **Proposal List:** Read mirrored proposals from **MirrorGovernor** (events + view fns).
- **Voting UI:** Sign/send votes to MirrorGovernor; show quorum/threshold and countdown to **Base end time**.
- **Result & Bridge Status:** Show **“Finalized on Base”** + **“Vote delivered to Mainnet”** with receipt links (Base + Ethereum).
- **Admin Panel:** Parameters (read-only), contract addresses, DVN/Endpoint status, pause indicators.

---

## 🔧 Key Config & Addresses (placeholders)
```ts
export const CONFIG = {
  // Ethereum Mainnet
  LIL_NOUNS_GOVERNOR: "0x...",       // read-only
  MAINNET_EXECUTOR:    "0x...",       // our on-chain voter (delegatee)
  L0_ENDPOINT_MAINNET: "0x...",       // Layer-0 endpoint
  DVN_SET_MAINNET:     ["0x...", "..."],

  // Base
  NDA_TOKEN:           "0x...",       // ERC-721 or ERC-20
  MIRROR_GOVERNOR:     "0x...",       // voting + finalize
  L0_ENDPOINT_BASE:    "0x...",
  DVN_SET_BASE:        ["0x...", "..."],

  // Params
  QUORUM_BPS:          2000,          // 20% example
  ABSTAIN_ENABLED:     true,
  TIME_SYNC_MODE:      "UTC_WINDOW",  // or "BLOCK_MAPPED"
};
````

---

## 🗓️ Timeline (2 weeks to MVP)

* **Day 1–2:** Contracts scaffolding (OZ Governor adapters), interface with Layer-0 OApp, config stubs.
* **Day 3–4:** Mirror registration path (Emitter or direct registration), proposal registry & hashing, vote logic + snapshots.
* **Day 5–6:** Finalization, Layer-0 message packing/receiving, Mainnet Executor `castVote[_WithReason]`.
* **Day 7:** ERC-721 voting adapter (if needed), pause/upgrade guards, idempotency/replay controls.
* **Day 8–9:** Testnet deployments (Base Sepolia + Ethereum Sepolia), end-to-end tests.
* **Day 10:** Frontend rewiring (contracts → UI), explorer links, status toasts.
* **Day 11:** Fuzz/property tests, boundary cases, gas profiling.
* **Day 12–13:** Security review checklist, runbook (delegation ops, pause, upgrades), docs.
* **Day 14:** Mainnet/Base deploy gates (behind pause), dry-run with a live Lil proposal window.

---

## 📊 Success Metrics

* **0 off-chain trust** in vote path (no Snapshot/GitHub Actions).
* **< 2 min** mirror latency from proposal creation to Base availability.
* **100%** deterministic on-chain finalization and single cast per proposal.
* **No missed snapshots** (delegation maintained prior to each proposal).

---

## 📒 Runbooks (ops highlights)

* **Delegation:** Ensure all Lil Nouns voting power intended for NDA is **delegated to `MAINNET_EXECUTOR`**. Verify before each active window; never change delegate between **proposal snapshot** and **proposal end**.
* **Pausing:** If cross-chain validation degrades (DVN issues), **Pause** MirrorGovernor finalizations that would emit messages; resume after DVN health returns.
* **Upgrades:** Proxy-based, gated by DAO multisigs. Publish ABI & verified source.

---

## 🧰 Documentation & Handover

* Contract specs (NatSpec), state diagrams, message schemas.
* Deployment guide (addresses, DVNs, endpoints, env).
* Frontend integration notes (ABIs, event indexing).
* Troubleshooting (common revert reasons, DVN misconfig, replay protection).

---

### Quick Decision Log

* **Why Layer-0?** Strong cross-chain verification; removes off-chain relays and Snapshot trust.
* **Why Executor-as-Delegate?** Lil Nouns Governor tallies voting power at **snapshot block**; delegation must exist **before** voting starts — a stable on-chain delegate is the only robust path.



