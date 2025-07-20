# Lils-Africa
Proposal Mirror and Vote Relay bridging Nouns Dao Africa &amp; LIl Nouns

# NDA ↔ LilNouns Governance Bridge

This repository implements a scheduled, one-off integration between **NounsDaoAfrica (NDA)** on Base (chainId 8453) and **LilNouns DAO** on Ethereum Mainnet. It enables off-chain voting via Snapshot for NDA ERC-721 token holders and on-chain vote execution through a Gnosis Safe.

---

## Repository Structure

```
nda-lilnouns-relay/
├── mirror.js                # Script to mirror on-chain proposals into Snapshot
├── relay.js                 # Script to tally Snapshot votes and relay on-chain
├── package.json             # Dependencies & npm scripts
├── .env.example             # Example environment variables
└── .github/
    └── workflows/
        ├── mirror.yml       # GitHub Action to run mirror.js on schedule
        └── relay.yml        # GitHub Action to run relay.js on schedule
```

---

## Prerequisites

* Node.js v18 or later
* GitHub repository with Actions enabled
* Gnosis Safe multisig on Ethereum Mainnet holding LilNouns tokens
* Snapshot space configured (e.g. `nda-league-of-lils`)
* NDA ERC-721 contract deployed on Base

---

## Installation

1. **Clone the repository**

   ```bash
   git clone git@github.com:YOUR_ORG/nda-lilnouns-relay.git
   cd nda-lilnouns-relay
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Configure environment**
   Copy `.env.example` to `.env`, or set GitHub Secrets:

   ```env
   RELAY_KEY=           # ETH key for mirror.js (must hold some ETH)
   SAFE_OWNER_KEY=      # Private key for one Gnosis Safe owner
   ```

---

## Configuration

Edit the following constants in the scripts before running:

* **mirror.js**

  * `LIL_NOUNS_GOVERNOR` — LilNouns governor contract address
  * `SNAPSHOT_SPACE` — Snapshot space ID
  * `0x<NDA_ERC721_Address>` — NDA ERC-721 contract on Base
  * `BLOCK_RANGE` — how many blocks back to scan for new events

* **relay.js**

  * `SNAPSHOT_SPACE` — Snapshot space ID
  * `LIL_NOUNS_GOVERNOR` — LilNouns governor address
  * `GNOSIS_SAFE_ADDRESS` — Gnosis Safe address

---

## Usage

### Local

* Mirror on-chain proposals:

  ```bash
  node mirror.js
  ```

* Relay Snapshot votes:

  ```bash
  node relay.js
  ```

### GitHub Actions

* Workflows in `.github/workflows/mirror.yml` and `.github/workflows/relay.yml` run each script every minute.
* Ensure both workflows reference the correct secrets:

  ```yaml
  env:
    RELAY_KEY:      ${{ secrets.RELAY_KEY }}
    SAFE_OWNER_KEY: ${{ secrets.SAFE_OWNER_KEY }}
  ```

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