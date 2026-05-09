const { spawn } = require('child_process')

const port = process.env.PORT || '3000'
const nextBin = require.resolve('next/dist/bin/next')

console.log(`[frontend] Starting Next.js on 0.0.0.0:${port}`)

const child = spawn(
  process.execPath,
  [nextBin, 'start', '-H', '0.0.0.0', '-p', port],
  {
    stdio: 'inherit',
    shell: false,
  }
)

child.on('exit', (code) => {
  process.exit(code ?? 0)
})

child.on('error', (error) => {
  console.error('[frontend] Failed to start Next.js:', error)
  process.exit(1)
})