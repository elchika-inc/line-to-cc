import { spawn, execFileSync } from 'child_process'

const TUNNEL_URL_PATTERN = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/

// Kill any existing cloudflared tunnel processes to avoid port/URL conflicts
function killExistingTunnels(): void {
  try {
    execFileSync('pkill', ['-f', 'cloudflared tunnel'], { stdio: 'ignore' })
    // Brief wait for processes to actually die
    Bun.sleepSync(1000)
  } catch {
    // No existing processes, that's fine
  }
}

export function startTunnel(port: number): Promise<{ url: string; kill: () => void }> {
  killExistingTunnels()

  return new Promise((resolve, reject) => {
    const proc = spawn('cloudflared', ['tunnel', '--url', `http://localhost:${port}`], {
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    let resolved = false
    const timeout = setTimeout(() => {
      if (!resolved) {
        reject(new Error('[tunnel] Timed out waiting for tunnel URL (30s)'))
        proc.kill()
      }
    }, 30_000)

    function handleOutput(data: Buffer) {
      const text = data.toString()
      const match = text.match(TUNNEL_URL_PATTERN)
      if (match && !resolved) {
        resolved = true
        clearTimeout(timeout)
        resolve({
          url: match[0],
          kill: () => proc.kill(),
        })
      }
    }

    proc.stdout.on('data', handleOutput)
    proc.stderr.on('data', handleOutput)

    proc.on('error', (err) => {
      if (!resolved) {
        clearTimeout(timeout)
        reject(new Error(`[tunnel] Failed to start cloudflared: ${err.message}`))
      }
    })

    proc.on('exit', (code) => {
      if (!resolved) {
        clearTimeout(timeout)
        reject(new Error(`[tunnel] cloudflared exited with code ${code}`))
      }
    })
  })
}
