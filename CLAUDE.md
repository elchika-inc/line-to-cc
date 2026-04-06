# CLAUDE.md

## Project Overview

LINE Messaging API を Claude Code Channels のカスタムチャネルプラグインとして実装したプロジェクト。MCP (Model Context Protocol) Server として動作し、LINE Webhook を受信して Claude Code セッションに転送する。

## Tech Stack

- Runtime: Bun
- HTTP: Hono
- MCP: @modelcontextprotocol/sdk
- Validation: zod
- Tunnel: cloudflared (Quick tunnel)

## Key Commands

```bash
# Run tests
bun test

# Start in development mode (with Claude Code)
claude --dangerously-load-development-channels server:line

# Type check (src/ only, test files have known bun mock type issues)
bunx tsc --noEmit
```

## Architecture

- `src/server.ts` がエントリポイント。MCP Server (stdio) + HTTP Server (Hono) + cloudflared tunnel を起動
- LINE Webhook は `POST /webhook` で受信。署名検証 -> sender gating -> verdict 判定 -> MCP notification の順で処理
- 200 を即座に返却し、イベント処理は `queueMicrotask` で非同期実行 (LINE 公式推奨)
- Permission relay は Flex Message カード + footer ボタンで LINE に転送。bare `yes`/`no` テキスト入力にも対応

## File Responsibilities

| File | Responsibility |
|------|---------------|
| `src/server.ts` | Orchestrator: MCP + HTTP + tunnel + all wiring |
| `src/webhook.ts` | Hono app: signature check, dedup, event routing |
| `src/line-api.ts` | LINE API client: push, webhook URL set/get/test |
| `src/signature.ts` | HMAC-SHA256 via Web Crypto API (timing-safe) |
| `src/access-control.ts` | Pairing + allowlist + 3-mode gating |
| `src/permission.ts` | Verdict parsing + Flex Message builder |
| `src/tunnel.ts` | cloudflared spawn + URL parse + cleanup |
| `src/types.ts` | LINE Webhook event types + type guards |

## State Files

- `~/.claude/channels/line/access.json` - Paired users and access mode
- `.env` - LINE credentials (never commit)

## Testing

- 46 tests across 5 files
- Test files have TypeScript errors due to Bun mock type definitions -- these are expected and do not affect runtime
- `tests/webhook.test.ts` uses `computeSignature` helper to generate valid HMAC signatures for testing

## Security Notes

- Signature verification uses `crypto.subtle.verify` (timing-safe)
- Raw request body is verified before JSON parsing
- `webhookEventId` deduplication prevents replay attacks
- HTTP server binds to `127.0.0.1` only (localhost)
- `pkill -f "cloudflared tunnel"` runs on startup to avoid stale tunnels
