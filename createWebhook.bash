# 1. Make sure you’re using your **Notify Auth Token** (not your node/API key):
export NOTIFY_AUTH_TOKEN=whsec_YOUR_NOTIFY_TOKEN_HERE

# 2. Run this exact command:
curl -v \
  "https://dashboard.alchemy.com/api/create-webhook" \
  -H "Content-Type: application/json" \
  -H "X-Alchemy-Token: $NOTIFY_AUTH_TOKEN" \
  --data '{
    "network":       "ETH_MAINNET",
    "webhook_type":  "GRAPHQL",
    "webhook_url":   "https://api.github.com/repos/swarthyhatter/lils-africa/dispatches",
    "graphql_query": "{ block { logs(filter: { addresses: [\"0x5d2C31ce16924C2a71D317e5BbFd5ce387854039\"], topics: [\"0x7d84a6263ae0d98d3329bd7b46bb4e8d6f98cd35a7adb45c274c8b7fd5ebd5e0\"] }) { data topics transaction { hash } } } }"
  }'