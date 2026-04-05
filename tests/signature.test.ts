import { describe, expect, test } from 'bun:test'
import { verifySignature } from '../src/signature'

describe('verifySignature', () => {
  const secret = '8c570fa6dd201bb328f1c1eac23a96d8'
  const body = '{"destination":"U8e742f61d673b39c7fff3cecb7536ef0","events":[]}'
  // openssl で算出した正しい署名
  const validSignature = 'GhRKmvmHys4Pi8DxkF4+EayaH0OqtJtaZxgTD9fMDLs='

  test('valid signature returns true', async () => {
    const result = await verifySignature(body, secret, validSignature)
    expect(result).toBe(true)
  })

  test('invalid signature returns false', async () => {
    const result = await verifySignature(body, secret, 'invalidsignature==')
    expect(result).toBe(false)
  })

  test('tampered body returns false', async () => {
    const tampered = body.replace('events', 'hacked')
    const result = await verifySignature(tampered, secret, validSignature)
    expect(result).toBe(false)
  })

  test('wrong secret returns false', async () => {
    const result = await verifySignature(body, 'wrong_secret', validSignature)
    expect(result).toBe(false)
  })
})
