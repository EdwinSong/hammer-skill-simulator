import http from 'http'
import { LuaRuntime } from './src/bc08/core/LuaRuntime.js'
import fs from 'fs'

const PORT = 3002

const server = http.createServer((req, res) => {
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Access-Control-Allow-Origin', '*')
  if (req.url.startsWith('/api/coingecko/simple/price')) {
    res.end(JSON.stringify({ bitcoin: { usd: 12345.67 } }))
  } else if (req.url.startsWith('/api/mempool/blocks/tip/height')) {
    res.end('111111')
  } else {
    res.statusCode = 404
    res.end('{}')
  }
})

server.listen(PORT, async () => {
  let code = fs.readFileSync(
    '../skills/miner_dashboard/scripts/miner_dashboard.lua',
    'utf8'
  )
  code = code.replace(
    '/api/coingecko/simple/price?ids=bitcoin&vs_currencies=usd',
    `http://localhost:${PORT}/api/coingecko/simple/price?ids=bitcoin&vs_currencies=usd`
  )
  code = code.replace(
    '/api/mempool/blocks/tip/height',
    `http://localhost:${PORT}/api/mempool/blocks/tip/height`
  )
  // Shorten refresh interval for testing so the updated API values render.
  code = code.replace('delay.delay_ms(30000)', 'delay.delay_ms(500)')

  const runtime = new LuaRuntime({
    onLog: (level, msg) => console.log(`[${level}] ${msg}`),
    onFrame: ({ pages, rgb }) => {
      const page = pages[9]
      if (page) {
        const labels = Object.values(page.controls)
          .filter((c) => c.type === 'label')
          .map((c) => c.text)
        console.log('[frame] labels:', labels.slice(0, 6).join(' | '))
      }
      const btcLabel = Object.values(page.controls).find((c) => c.type === 'label' && c.text === '12345')
      const netLabel = Object.values(page.controls).find((c) => c.type === 'label' && c.text === '111111')
      if (btcLabel) console.log('[frame] BTC price updated:', btcLabel.text)
      if (netLabel) console.log('[frame] Network height updated:', netLabel.text)
    },
    onStop: () => console.log('stopped'),
  })

  runtime.start(code)

  setTimeout(() => {
    runtime.stop()
    server.close()
    process.exit(0)
  }, 8000)
})
