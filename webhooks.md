# WEBHOOKS.md

## Alchemy → GitHub Direct Webhook Configuration

This document captures the configuration and usage details for the Alchemy webhook that pushes on-chain `ProposalCreated` events directly into your GitHub Actions via the `repository_dispatch` endpoint—no forwarder necessary.

---

### 1. Webhook Overview

| Field                                                                       | Value                                                                       |
| --------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| **Webhook ID**                                                              | `wh_v18vezrrbetof2a4`                                                       |
| **Type**                                                                    | `CUSTOM`                                                                    |
| **Network**                                                                 | `ETH_MAINNET`                                                               |
| **Filter**                                                                  | Logs from Governor contract at `0x5d2C31ce16924C2a71D317e5BbFd5ce387854039` |
| Topic: `0x7d84a6263ae0d98d3329bd7b46bb4e8d6f98cd35a7adb45c274c8b7fd5ebd5e0` |                                                                             |
| **App ID**                                                                  | (Dashboard > Settings > App Info) `bckt2wi60q01liwk`                        |

---

### 2. Endpoint & Injected Headers

**Endpoint URL**

```
https://api.github.com/repos/swarthyhatter/lils-africa/dispatches
```

**Injected HTTP Headers** (via `headers` array in Alchemy v1 webhook call):

```text
Authorization: Bearer ${{ secrets.GIT_ALCHEMY_ACCESS_TOKEN }}
Content-Type:  application/json
Accept:        application/vnd.github+json
```

> *Note:* Use **Settings > Secrets & variables > Actions** to store `GIT_ALCHEMY_ACCESS_TOKEN`.

---

### 3. Environment & Secrets

#### Local `.env` (gitignored)

```dotenv
ALCHEMY_API_KEY=⟨your Alchemy RPC/API key⟩
ALCHEMY_APP_ID=⟨your Alchemy App ID⟩
NOTIFY_AUTH_TOKEN=⟨your Notify Auth Token⟩
GIT_ALCHEMY_ACCESS_TOKEN=⟨your GitHub Personal Access Token⟩
RELAY_KEY=⟨your Snapshot relay private key⟩
SAFE_OWNER_KEY=⟨your Gnosis Safe owner private key⟩
```

#### `.env.example` (committed template)

```dotenv
ALCHEMY_API_KEY=<YOUR_ALCHEMY_API_KEY>
ALCHEMY_APP_ID=<YOUR_ALCHEMY_APP_ID>
NOTIFY_AUTH_TOKEN=<YOUR_NOTIFY_AUTH_TOKEN>
GIT_ALCHEMY_ACCESS_TOKEN=<YOUR_GIT_ALCHEMY_ACCESS_TOKEN>
RELAY_KEY=<YOUR_SNAPSHOT_RELAY_PRIVATE_KEY>
SAFE_OWNER_KEY=<YOUR_SAFE_OWNER_PRIVATE_KEY>
```

#### GitHub Actions Secrets

* `GIT_ALCHEMY_ACCESS_TOKEN` — GitHub PAT for dispatches
* `ALCHEMY_WEBHOOK_SIGNING_KEY` — signing key from Alchemy
* `RELAY_KEY`
* `SAFE_OWNER_KEY`

---

### 4. Deploying the Webhook

Run this from your terminal (after `export $(grep -v '^#' .env | xargs`):

```bash
curl -v "https://dashboard-api.alchemy.com/v1/webhooks" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $NOTIFY_AUTH_TOKEN" \
  --data '{
    "type":       "CUSTOM",
    "network":    "ETH_MAINNET",
    "webhookUrl": "https://api.github.com/repos/swarthyhatter/lils-africa/dispatches",
    "headers": [
      { "key": "Authorization", "value": "Bearer '$GIT_ALCHEMY_ACCESS_TOKEN'" },
      { "key": "Content-Type",  "value": "application/json" },
      { "key": "Accept",        "value": "application/vnd.github+json" }
    ],
    "filters": [
      {
        "type": "log",
        "params": {
          "address": "0x5d2C31ce16924C2a71D317e5BbFd5ce387854039",
          "topics": [
            "0x7d84a6263ae0d98d3329bd7b46bb4e8d6f98cd35a7adb45c274c8b7fd5ebd5e0"
          ]
        }
      }
    ]
  }'
```

* **Auth**: `X-Alchemy-Token: $NOTIFY_AUTH_TOKEN`
* **Returns**: JSON with `id` & `signing_key`

---

### 5. Verifying & Managing the Webhook

#### Dashboard UI

1. Go to Alchemy Dashboard > Develop > Webhooks
2. Find **ID = wh\_v18vezrrbetof2a4**
3. Check **Active/Inactive**, **Last delivery**, **Test** button

#### CLI

```bash
curl -H "X-Alchemy-Token: $NOTIFY_AUTH_TOKEN" \
     https://dashboard-api.alchemy.com/v1/webhooks/wh_v18vezrrbetof2a4
```

*Inspect*: `is_active`, `time_last_success`, `time_last_error`, `deactivation_reason`

---

*Last updated: 2025-07-21*
