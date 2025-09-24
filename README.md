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
  - **Lil Nouns Governor (Compound Bravo fork)** — existing, read-only.
  - **NDA Mainnet Executor (Agent)** — holds delegated Lil Nouns voting power; **casts `castVote`/`castVoteWithReason`** after Base finalization.
  - **Layer-0 Endpoint** — receives verified messages from Base.

- **Base**
  - **NDA MirrorGovernor** — holds mirrored proposals, runs the NDA vote (using NDA token as voting power), finalizes outcome, and **sends a Layer-0 message** to Mainnet.
  - **Layer-0 Endpoint** — sends verified messages to Mainnet.

### Message Flow
1. **Mirror:** When `ProposalCreated` fires on Lil Nouns Governor, **MirrorFeed** (lightweight on-chain or minimal off-chain pusher operated by us) **emits** a Layer-0 message OR a simple “proposal registration” tx to **NDA MirrorGovernor** with:
   - `proposalId`, `targets`, `values`, `signatures/calldatas` (from `getActions`), `startBlock`, `endBlock`, `description`, and **snapshotBlock**.
2. **Vote on Base:** NDA holders vote during the **same window** (`start/end`) or a **mapped time window** (block-time alignment handled in config).
3. **Finalize on Base:** MirrorGovernor checks quorum/thresholds, locks the result.
4. **Send Result to Mainnet:** MirrorGovernor sends a **Layer-0 message** with `{proposalId, support (0/1/2), reason, proofHash}`.
5. **Execute on Mainnet:** NDA Mainnet Executor verifies the message and calls **Lil Nouns Governor `castVote[_WithReason]`** from its **pre-delegated address**.

> **Critical requirement:** The **Mainnet Executor address must have Lil Nouns voting power delegated _before the proposal’s snapshot block_** or it won’t count.

---

## 📦 Contracts (deliverables)
### 1) NDA MirrorGovernor (Base)
- **Standards:** Custom voting contract (can leverage OZ modules internally) but must **mirror Compound Bravo semantics**.
- **Responsibilities:**
  - Maintain a **registry of mirrored proposals** keyed by Lil Nouns `proposalId`.
  - Enforce **voting window** congruent with Compound (`startBlock` → `endBlock`).
  - Configurable **quorum** and **vote success rule**.
  - Support mapping of votes into Compound support codes (0 = Against, 1 = For, 2 = Abstain).
  - **Finalize** result → **emit** `Finalized(proposalId, support, tally)`.
  - **Layer-0 OApp sender**: packs result → sends to Mainnet Executor.
- **Safety:**
  - **Pausable** mirroring/voting; **upgradeable** via UUPS/Transparent Proxy (optional).
  - **Replay protection** and **proposalId binding**.

### 2) NDA Mainnet Executor (Ethereum)
- **Interface:**
  ```solidity
  interface ICompoundBravoLike {
      function castVote(uint256 proposalId, uint8 support) external;
      function castVoteWithReason(uint256 proposalId, uint8 support, string calldata reason) external;
      function proposals(uint256 proposalId)
        external
        view
        returns (
            uint256 id,
            address proposer,
            uint256 eta,
            uint256 startBlock,
            uint256 endBlock,
            uint256 forVotes,
            uint256 againstVotes,
            uint256 abstainVotes,
            bool canceled,
            bool executed
        );
      function getActions(uint256 proposalId)
        external
        view
        returns (address[] memory targets, uint256[] memory values, string[] memory signatures, bytes[] memory calldatas);
      function getReceipt(uint256 proposalId, address voter) external view returns (bool hasVoted, uint8 support, uint96 votes);
  }
  ```
- **Responsibilities:**
  - **Layer-0 OApp receiver**: validates message origin (Base MirrorGovernor + endpoint/DVN/ISM).
  - After acceptance → call `castVoteWithReason(proposalId, support, reason)`.
  - **Check idempotency** using `getReceipt` to prevent double-votes.
- **Voting Power:**
  - Must be **delegatee** of Lil Nouns voting tokens **before `startBlock`**.
- **Safety:**
  - **Only accept messages** from our Base app/endpoint.
  - **Pausable**; **emergency delegation controls**.

### 3) (Optional) MirrorFeed
- **Helper:** listens to `ProposalCreated` and **pushes** registration tx to Base MirrorGovernor, or does on-chain emit via a Mainnet MirrorEmitter + Layer-0.

---

## ⚙️ Governance Parameters (configurable)
- **Voting token:** NDA (ERC-721 or ERC-20).  
- **Support mapping:** For, Against, Abstain → map to Compound’s `{0,1,2}`.
- **Quorum:** Read from Lil Nouns’ quorum semantics for consistency (display + config).
- **Thresholds:** Majority (For > Against) or stricter.
- **Windows:** Align with Compound’s `startBlock`/`endBlock`.

---

## 🔐 Security & Trust Model
- **Cross-chain Security:** Use LayerZero v2 OApp (or Hyperlane ISM) with **multi-DVN/ISM**.
- **Replay Protection:** Store mirrored proposal root; bind to proposalId.
- **Pausing & Upgrades:** Proxy-based with DAO multisig.
- **Delegation Ops:** Ensure voting power delegated **before startBlock**.

---

## 🧪 Testing Plan
- **Unit:** Vote tallying, quorum checks, Compound support mapping.
- **Integration:** Mirror Compound proposal → vote on Base → finalize → L0 message → mainnet executor casts vote.
- **Fork Tests:** Validate against Lil Nouns Governor on mainnet fork.

---

## 🧭 Migration From Old Scope
- Replace OZ Governor references with **Compound Bravo-like interface**.
- Map Base tallies into Compound enums.
- Mirror `startBlock` and `endBlock` accurately.
- Use `getReceipt` to prevent duplicate votes.

---

## 🖥️ Frontend Changes
- **Proposal List:** MirrorGovernor events + Compound proposal data.
- **Voting UI:** Cast Base votes mapped to For/Against/Abstain.
- **Results:** Show mirrored tallies + mainnet vote status (receipt).

---

## 🔧 Key Config & Addresses (placeholders)
```ts
export const CONFIG = {
  // Ethereum Mainnet
  LIL_NOUNS_GOVERNOR: "0x...",       // Compound Bravo contract
  MAINNET_EXECUTOR:    "0x...",       // our on-chain voter (delegatee)
  L0_ENDPOINT_MAINNET: "0x...",       // Layer-0 endpoint
  DVN_SET_MAINNET:     ["0x...", "..."],

  // Base
  NDA_TOKEN:           "0x...",       // ERC-721 or ERC-20
  MIRROR_GOVERNOR:     "0x...",       // voting + finalize
  L0_ENDPOINT_BASE:    "0x...",
  DVN_SET_BASE:        ["0x...", "..."],

  // Params
  QUORUM_BPS:          2000,
  ABSTAIN_ENABLED:     true,
  SUPPORT_ENUM:        { Against:0, For:1, Abstain:2 }
};
```

---

## 📒 Runbooks (ops highlights)
- **Delegation:** Keep delegation stable before `startBlock`.
- **Pausing:** Disable finalization if DVNs unhealthy.
- **Upgrades:** DAO multisig controls.

---

### Quick Decision Log
- **Why Compound-based?** Lil Nouns uses Governor Bravo fork, not OZ. Must mirror its semantics.
- **Why Layer-0?** To eliminate off-chain relayers.
- **Why Executor-as-Delegate?** Voting power snapshot happens at `startBlock`.
