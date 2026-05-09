const { createServer } = require('http')
const next = require('next')

const dev = false
const hostname = '0.0.0.0'
const port = Number(process.env.PORT || 3000)

console.log('[frontend] Starting custom Next server')
console.log('[frontend] NODE_ENV:', process.env.NODE_ENV)
console.log('[frontend] PORT:', process.env.PORT)
console.log('[frontend] NEXT_PUBLIC_API_URL:', process.env.NEXT_PUBLIC_API_URL)

const app = next({
  dev,
  hostname,
  port,
})

const handle = app.getRequestHandler()

app
  .prepare()
  .then(() => {
    createServer((req, res) => {
      handle(req, res)
    }).listen(port, hostname, () => {
      console.log(`[frontend] Ready on http://${hostname}:${port}`)
    })
  })
  .catch((error) => {
    console.error('[frontend] Failed to start Next server:', error)
    process.exit(1)
  })