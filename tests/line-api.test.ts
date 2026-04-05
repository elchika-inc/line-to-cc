import { describe, expect, test, mock, beforeEach } from 'bun:test'
import { splitText, createLineClient } from '../src/line-api'

describe('splitText', () => {
  test('short text returns single chunk', () => {
    const result = splitText('hello', 5000)
    expect(result).toEqual(['hello'])
  })

  test('text at exact limit returns single chunk', () => {
    const text = 'a'.repeat(5000)
    const result = splitText(text, 5000)
    expect(result).toEqual([text])
  })

  test('text exceeding limit is split', () => {
    const text = 'a'.repeat(7500)
    const result = splitText(text, 5000)
    expect(result).toHaveLength(2)
    expect(result[0]).toHaveLength(5000)
    expect(result[1]).toHaveLength(2500)
  })

  test('empty text returns single empty chunk', () => {
    const result = splitText('', 5000)
    expect(result).toEqual([''])
  })
})

describe('createLineClient', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    globalThis.fetch = originalFetch
  })

  test('pushMessage sends correct request', async () => {
    const fetchMock = mock(() =>
      Promise.resolve(new Response('{}', { status: 200 }))
    )
    globalThis.fetch = fetchMock

    const client = createLineClient('test-token')
    await client.pushMessage('U1234567890abcdef', 'Hello')

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.line.me/v2/bot/message/push')
    expect(options.method).toBe('POST')
    expect(options.headers['Authorization']).toBe('Bearer test-token')

    const body = JSON.parse(options.body)
    expect(body.to).toBe('U1234567890abcdef')
    expect(body.messages[0].type).toBe('text')
    expect(body.messages[0].text).toBe('Hello')
  })

  test('pushMessage splits long text into multiple calls', async () => {
    const fetchMock = mock(() =>
      Promise.resolve(new Response('{}', { status: 200 }))
    )
    globalThis.fetch = fetchMock

    const client = createLineClient('test-token')
    await client.pushMessage('U1234567890abcdef', 'a'.repeat(7500))

    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  test('pushMessage logs error on API failure', async () => {
    const fetchMock = mock(() =>
      Promise.resolve(new Response('{"message":"error"}', { status: 400 }))
    )
    globalThis.fetch = fetchMock

    const client = createLineClient('test-token')
    // Should not throw, just log to stderr
    await client.pushMessage('U1234567890abcdef', 'Hello')
  })
})
