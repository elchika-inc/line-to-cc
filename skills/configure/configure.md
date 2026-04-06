---
name: configure
description: Configure LINE channel credentials (channel secret and access token)
---

# LINE Channel Configuration

Set up your LINE Messaging API credentials.

## Steps

1. Go to LINE Developers Console (https://developers.line.biz/)
2. Select your Messaging API channel
3. Copy the Channel Secret (Basic settings tab)
4. Copy the Channel Access Token (Messaging API tab -> Issue)

Now save the credentials:

```bash
mkdir -p ~/.claude/channels/line
cat > ~/.claude/channels/line/.env << 'DOTENV'
LINE_CHANNEL_SECRET=<paste your channel secret>
LINE_CHANNEL_ACCESS_TOKEN=<paste your channel access token>
DOTENV
```

## Webhook URL Setup

1. Install cloudflared: `brew install cloudflared`
2. Start tunnel: `cloudflared tunnel --url http://localhost:8788`
3. Copy the generated URL (e.g., `https://xxxxx.trycloudflare.com`)
4. In LINE Developers Console -> Messaging API tab:
   - Set Webhook URL to `https://xxxxx.trycloudflare.com/webhook`
   - Enable "Use webhook"
   - Disable "Auto-reply messages"
5. Click "Verify" to test the connection
