import { Hono } from 'hono'
import { verifySignature } from './signature'
import { parseVerdict } from './permission'
import { isTextMessageEvent } from './types'
import type { LineWebhookBody } from './types'
import type { Verdict } from './permission'

const MAX_SEEN_EVENTS = 1000

interface WebhookAppOptions {
  channelSecret: string
  onTextMessage: (userId: string, text: string, eventId: string, replyTo: string) => void
  onVerdict: (behavior: Verdict['behavior'], requestId: string) => void
  getLastRequestId?: () => string | null
}

export function createWebhookApp(options: WebhookAppOptions) {
  const app = new Hono()
  const seenEventIds = new Map<string, number>()

  function dedup(eventId: string): boolean {
    if (seenEventIds.has(eventId)) return true
    seenEventIds.set(eventId, Date.now())
    // Evict oldest entries when exceeding limit
    if (seenEventIds.size > MAX_SEEN_EVENTS) {
      const firstKey = seenEventIds.keys().next().value!
      seenEventIds.delete(firstKey)
    }
    return false
  }

  app.post('/webhook', async (c) => {
    // Step 1: Check signature header
    const signature = c.req.header('x-line-signature')
    if (!signature) {
      return c.text('Missing x-line-signature', 401)
    }

    // Step 2: Get raw body before parsing
    const rawBody = await c.req.text()

    // Step 3: Verify signature
    const valid = await verifySignature(rawBody, options.channelSecret, signature)
    if (!valid) {
      return c.text('Invalid signature', 403)
    }

    // Step 4: Return 200 immediately, process async
    const body: LineWebhookBody = JSON.parse(rawBody)

    // Process events asynchronously
    queueMicrotask(() => {
      // Step 5: Empty events = URL verification
      if (body.events.length === 0) {
        console.error('[line] webhook: empty events (URL verification ping)')
        return
      }

      console.error(`[line] webhook: processing ${body.events.length} event(s)`)
      for (const event of body.events) {
        console.error(`[line] webhook: event type=${event.type} id=${event.webhookEventId}`)

        // Step 6: Filter text message events
        if (!isTextMessageEvent(event)) {
          console.error(`[line] webhook: skipping non-text event type=${event.type}`)
          continue
        }

        // Step 7: Deduplicate
        if (dedup(event.webhookEventId)) {
          console.error(`[line] webhook: dedup skip id=${event.webhookEventId}`)
          continue
        }

        const userId = event.source.userId
        const text = event.message.text
        const replyTo = event.source.groupId ?? event.source.roomId ?? userId

        console.error(`[line] webhook: userId=${userId} replyTo=${replyTo} text="${text.slice(0, 50)}"`)

        // Step 9: Check verdict pattern (bare yes/no uses last pending request_id)
        const verdict = parseVerdict(text, options.getLastRequestId?.() ?? undefined)
        if (verdict) {
          console.error(`[line] webhook: verdict detected behavior=${verdict.behavior} requestId=${verdict.requestId}`)
          options.onVerdict(verdict.behavior, verdict.requestId)
          continue
        }

        // Step 10: Regular message
        Promise.resolve(options.onTextMessage(userId, text, event.webhookEventId, replyTo))
          .catch((err) => console.error('[line] webhook: onTextMessage error:', err))
      }
    })

    return c.text('OK', 200)
  })

  return app
}
