const PUSH_API_URL = 'https://api.line.me/v2/bot/message/push'
const MAX_TEXT_LENGTH = 5000

export function splitText(text: string, maxLength: number): string[] {
  if (text.length <= maxLength) return [text]
  const chunks: string[] = []
  for (let i = 0; i < text.length; i += maxLength) {
    chunks.push(text.slice(i, i + maxLength))
  }
  return chunks
}

export function createLineClient(accessToken: string) {
  let messageCount = 0

  async function pushMessage(userId: string, text: string): Promise<void> {
    const chunks = splitText(text, MAX_TEXT_LENGTH)
    for (const chunk of chunks) {
      const res = await fetch(PUSH_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          to: userId,
          messages: [{ type: 'text', text: chunk }],
        }),
      })
      messageCount++
      if (!res.ok) {
        const body = await res.text()
        console.error(`[line] Push API error (${res.status}): ${body}`)
      }
      if (messageCount % 50 === 0) {
        console.error(`[line] ${messageCount} messages sent this session`)
      }
    }
  }

  return { pushMessage }
}

export type LineClient = ReturnType<typeof createLineClient>
