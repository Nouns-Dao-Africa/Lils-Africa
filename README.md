# NDA ↔ LilNouns Governance Bridge

> A GitHub-Actions-driven pipeline enabling **NounsDaoAfrica** (NDA) ERC‑721 holders to:
>
> 1. **Mirror** on-chain LilNouns DAO proposals into Snapshot
> 2. **Relay** community votes back on‑chain via Gnosis Safe
> 3. **Forward** community‑created “LilProps” for off‑chain Approve/Reject voting
> 4. **Submit** approved LilProps on‑chain to the LilNouns Governor

---

## Repository Structure

```
nda-lilnouns-relay/
├── mirror.js                  # Detect & mirror on-chain proposals → Snapshot
├── relay.js                   # Tally Snapshot votes → castVote on-chain
├── prop_forward.js            # Forward community LilProps → main vote space
├── prop_submit.js             # Submit approved LilProps on-chain
├── prop_forward_state.json    # Tracks forwarded prop IDs (auto-generated)
├── prop_submit_state.json     # Tracks submitted prop IDs  (auto-generated)
├── package.json               # npm scripts & dependencies
├── .env.example               # Sample environment variables
└── .github/workflows/
    ├── mirror.yml             # Schedule for mirror.js
    ├── relay.yml              # Schedule for relay.js
    ├── prop_forward.yml       # Schedule for prop_forward.js
    └── prop_submit.yml        # Schedule for prop_submit.js
```

---

## How It Works

### mirror.js

* Listens for `ProposalCreated` events on the LilNouns Governor contract.
* Creates matching off‑chain proposals in Snapshot (`nda-league-of-lils`).
* Ensures the community sees every new on‑chain proposal instantly.

### relay.js

* Queries Snapshot for proposals closed in `nda-league-of-lils`.
* Verifies on‑chain `votingEnd` timestamp.
* Submits the Gnosis Safe’s vote via the `castVote` function on‑chain.

### prop\_forward.js

* Polls the community Snapshot space `lils-africa-props` for new proposals.
* Forwards each as a **single-choice** off‑chain vote (`Approve`/`Reject`) into `lils-africa`.

### prop\_submit.js

* Tallies closed votes in `lils-africa`.
* If “Approve” ≥ configured threshold (default 50%), parses the JSON‑encoded body for on‑chain parameters.
* Calls `Governor.propose(...)` on LilNouns Governor to create the on‑chain proposal.

*All scripts run every minute via GitHub Actions, using encrypted secrets for keys.*

---

## Configuration Variables & Addresses

| File                 | Variable / Placeholder   | Description                                    |
| -------------------- | ------------------------ | ---------------------------------------------- |
| **mirror.js**        | `LIL_NOUNS_GOVERNOR`     | Governor contract address (Ethereum Mainnet)   |
|                      | `SNAPSHOT_SPACE`         | Snapshot space ID (`nda-league-of-lils`)       |
|                      | `0x<NDA_ERC721_Address>` | NDA ERC‑721 contract address (Base)            |
|                      | `BLOCK_RANGE`            | Blocks back to scan for new on‑chain proposals |
|                      | `RELAY_KEY` (env)        | Private key for mirror.js (must hold ETH)      |
| **relay.js**         | `LIL_NOUNS_GOVERNOR`     | Same as above                                  |
|                      | `GNOSIS_SAFE_ADDRESS`    | Gnosis Safe address holding LilNouns tokens    |
|                      | `ETH_RPC`                | Ethereum RPC endpoint URL                      |
|                      | `SAFE_OWNER_KEY` (env)   | Private key for relay.js                       |
| **prop\_forward.js** | `SOURCE_SPACE`           | Community space ID (`lils-africa-props`)       |
|                      | `TARGET_SPACE`           | Main vote space ID (`lils-africa`)             |
|                      | `0x<NDA_ERC721_Address>` | NDA ERC‑721 contract address (Base)            |
|                      | `RELAY_KEY` (env)        | Private key for prop\_forward.js               |
| **prop\_submit.js**  | `GOVERNOR_ADDRESS`       | Governor contract address                      |
|                      | `TARGET_SPACE`           | Main vote space ID (`lils-africa`)             |
|                      | `PASS_THRESHOLD`         | Approval ratio threshold (e.g. `0.5` = 50%)    |
|                      | `SAFE_OWNER_KEY` (env)   | Private key for prop\_submit.js                |

> **Tip:** Add both state JSON files to `.gitignore` so they don’t get committed.

---

## Next Steps

1. **Create Snapshot Spaces**

   * **Community**: `lils-africa-props` (allow NDA NFT holders to propose)
   * **Main**:      `lils-africa` (locked to bot-driven forwarding)
   * **Mirror**:    `nda-league-of-lils` (mirror of official proposals)
2. **Configure Strategies**

   * Use `nft-balance-of` with your NDA ERC‑721 contract on Base (chainId 8453).
3. **Add Secrets**

   * In GitHub Settings → Secrets: `RELAY_KEY`, `SAFE_OWNER_KEY`.
4. **Commit & Push**

   * Ensure all scripts and workflows are in `main` branch.
5. **Verify Workflows**

   * Check GitHub Actions tab to confirm each workflow runs without errors.
6. **Test End‑to‑End**

   * Create a dummy LilProp, vote in `lils-africa`, and verify on‑chain proposal creation.


---

## Customization

* Adjust polling intervals by editing the `cron` schedules in the workflow YAMLs.
* Modify `BLOCK_RANGE` for mirror sensitivity.
* Update voting choices, time-margin, or strategy parameters as needed.

---

## Security

* **Never commit** private keys to source control.
* Use GitHub Secrets, hardware wallets, or a secrets management service.
* Rotate keys periodically and audit multisig owners.

---

## Troubleshooting

* **No proposals mirrored**: verify the governor address and `BLOCK_RANGE`.
* **Relay failures**: check Gnosis Safe permissions, validate deadlines, inspect logs.
* Review GitHub Actions logs for errors or rate-limit warnings.

---
⸻
## Init Keys: GitHub → Settings → Secrets → Actions:
	•	NEW REPOSITORY SECRET
	•	RELAY_KEY = your snapshot relayer private key
	•	SAFE_OWNER_KEY = your Ethereum multisig signer key

**Verify & Monitor**
	1.	Go to Actions tab: you should see “Mirror Proposals” run every minute, “Relay Votes” every 5 minutes.
	2.	Inspect logs for successful connections, errors, etc.
	3.	As proposals appear on-chain, within ~1 min you’ll see them created in your Snapshot space; after close, votes get relayed on-chain.

⸻

You now have a fully GitHub-hosted, cron-scheduled integration:
	•	Mirror new LilNouns proposals → Snapshot
	•	Relay NDA holder votes → LilNouns governor via Gnosis Safe

Feel free to iterate on error-handling, add a DynamoDB or JSON file to track which proposals you’ve already processed, or swap to serverless if you prefer.


1. Snapshot Relay Private Key (RELAY_KEY)
	1.	Purpose
This key is used by your mirror service to sign the off-chain “proposal creation” calls to Snapshot.
	2.	How to get it
	•	Generate a fresh Ethereum account (e.g. via MetaMask, ethers.Wallet.createRandom(), or openssl rand -hex 32).
	•	Fund it with a tiny amount of ETH on Mainnet (a few cents worth) so it can pay the ~1–2 gwei gas to post to Snapshot.
	•	Secure it in your CI/CD secrets (e.g. GitHub Actions “Secrets”) or a vault like AWS Secrets Manager.
	3.	Usage
	•	Export it in your environment as RELAY_KEY.
	•	In mirror.js you instantiate new ethers.Wallet(process.env.RELAY_KEY, provider) and pass that signer to snapshot.js.

⸻

2. Gnosis Safe Signer Key (SAFE_OWNER_KEY)
	1.	Purpose
This key is one of the owners of the Gnosis Safe that actually holds and controls your pool of LilNouns tokens. When your relay script builds a Safe transaction to cast the DAO’s vote on LilNouns proposals, it needs access to at least one Safe owner key (or better, you wire up a Safe-specific signing service).
	2.	How to get it
	•	Create a new EOAs (Externally Owned Account) for each multisig member (e.g., via MetaMask or ethers.Wallet.createRandom()).
	•	Add these public addresses as owners of your Gnosis Safe (via the Safe web UI or Safe SDK) and configure the Safe’s threshold (e.g. 2-of-3).
	•	Distribute the private keys only to trusted individuals or secure signing infrastructure (e.g. hardware wallets, Gnosis Safe Signer App).
	3.	Usage
	•	For simple GitHub-hosted relayers, you might store one owner’s key as SAFE_OWNER_KEY in your repo secrets. The relay script uses that key to propose or confirm the Safe transaction via the Safe Transaction Service.
	•	In production, consider using a more secure flow: e.g. the Safe Transaction Service + a UI where multiple owners approve, or a hardware-wallet signer integration so no raw private key ever lives in CI.

⸻

**Security Best Practices**
	•	Never commit private keys to source code.
	•	Rotate keys periodically and remove old ones from the Safe’s owner list.
	•	Use hardware wallets or a key-management system (AWS KMS, HashiCorp Vault) for all signing.
	•	Monitor Safe transactions via the Safe Transaction Service’s webhooks or dashboard to ensure no unexpected votes happen.

Once you’ve generated those two keys and injected them into your GitHub Secrets (or other vault), your mirror.js and relay.js scripts will be able to authenticate and sign exactly as intended.


