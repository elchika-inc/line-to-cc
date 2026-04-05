import { describe, expect, test, mock, beforeEach } from 'bun:test'
import { createWebhookApp } from '../src/webhook'

// Helper: compute valid signature for a body
async function computeSignature(body: string, secret: string): Promise<string> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(body))
  return btoa(String.fromCharCode(...new Uint8Array(sig)))
}

const SECRET = 'test_secret_key'

describe('webhook', () => {
  test('returns 401 when x-line-signature is missing', async () => {
    const app = createWebhookApp({
      channelSecret: SECRET,
      onTextMessage: mock(() => {}),
      onVerdict: mock(() => {}),
    })
    const res = await app.request('/webhook', { method: 'POST', body: '{}' })
    expect(res.status).toBe(401)
  })

  test('returns 403 when signature is invalid', async () => {
    const app = createWebhookApp({
      channelSecret: SECRET,
      onTextMessage: mock(() => {}),
      onVerdict: mock(() => {}),
    })
    const res = await app.request('/webhook', {
      method: 'POST',
      body: '{}',
      headers: { 'x-line-signature': 'invalidsig==' },
    })
    expect(res.status).toBe(403)
  })

  test('returns 200 for valid empty events (URL verification)', async () => {
    const body = '{"destination":"U123","events":[]}'
    const sig = await computeSignature(body, SECRET)
    const app = createWebhookApp({
      channelSecret: SECRET,
      onTextMessage: mock(() => {}),
      onVerdict: mock(() => {}),
    })
    const res = await app.request('/webhook', {
      method: 'POST',
      body,
      headers: { 'x-line-signature': sig, 'content-type': 'application/json' },
    })
    expect(res.status).toBe(200)
  })

  test('calls onTextMessage for text message events', async () => {
    const onTextMessage = mock(() => {})
    const body = JSON.stringify({
      destination: 'U123',
      events: [{
        type: 'message',
        webhookEventId: 'evt_001',
        timestamp: Date.now(),
        source: { type: 'user', userId: 'U_sender' },
        message: { type: 'text', id: 'msg_001', text: 'Hello' },
      }],
    })
    const sig = await computeSignature(body, SECRET)
    const app = createWebhookApp({
      channelSecret: SECRET,
      onTextMessage,
      onVerdict: mock(() => {}),
    })
    const res = await app.request('/webhook', {
      method: 'POST',
      body,
      headers: { 'x-line-signature': sig, 'content-type': 'application/json' },
    })
    expect(res.status).toBe(200)
    // Wait for async processing
    await new Promise((r) => setTimeout(r, 10))
    expect(onTextMessage).toHaveBeenCalledTimes(1)
    expect(onTextMessage.mock.calls[0][0]).toBe('U_sender')
    expect(onTextMessage.mock.calls[0][1]).toBe('Hello')
  })

  test('calls onVerdict for verdict messages', async () => {
    const onVerdict = mock(() => {})
    const body = JSON.stringify({
      destination: 'U123',
      events: [{
        type: 'message',
        webhookEventId: 'evt_002',
        timestamp: Date.now(),
        source: { type: 'user', userId: 'U_sender' },
        message: { type: 'text', id: 'msg_002', text: 'yes abcde' },
      }],
    })
    const sig = await computeSignature(body, SECRET)
    const app = createWebhookApp({
      channelSecret: SECRET,
      onTextMessage: mock(() => {}),
      onVerdict,
    })
    const res = await app.request('/webhook', {
      method: 'POST',
      body,
      headers: { 'x-line-signature': sig, 'content-type': 'application/json' },
    })
    expect(res.status).toBe(200)
    await new Promise((r) => setTimeout(r, 10))
    expect(onVerdict).toHaveBeenCalledTimes(1)
    expect(onVerdict.mock.calls[0][0]).toBe('allow')
    expect(onVerdict.mock.calls[0][1]).toBe('abcde')
  })

  test('deduplicates events by webhookEventId', async () => {
    const onTextMessage = mock(() => {})
    const event = {
      type: 'message',
      webhookEventId: 'evt_dup',
      timestamp: Date.now(),
      source: { type: 'user', userId: 'U_sender' },
      message: { type: 'text', id: 'msg_dup', text: 'Hello' },
    }
    const body = JSON.stringify({ destination: 'U123', events: [event] })
    const sig = await computeSignature(body, SECRET)
    const app = createWebhookApp({
      channelSecret: SECRET,
      onTextMessage,
      onVerdict: mock(() => {}),
    })

    // Send same event twice
    await app.request('/webhook', {
      method: 'POST', body,
      headers: { 'x-line-signature': sig, 'content-type': 'application/json' },
    })
    await app.request('/webhook', {
      method: 'POST', body,
      headers: { 'x-line-signature': sig, 'content-type': 'application/json' },
    })
    await new Promise((r) => setTimeout(r, 10))
    expect(onTextMessage).toHaveBeenCalledTimes(1)
  })
})
