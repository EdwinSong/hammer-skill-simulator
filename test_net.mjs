import { LuaRuntime } from './src/bc08/core/LuaRuntime.js'

const code = `
local PAGE = 1
local W, H = claw.display.get_size()
claw.display.create_page(PAGE, "Net Test")
claw.display.container(PAGE, 1, 0, 0, W, H, 0x000000, 0)
claw.display.label(PAGE, 2, 40, 40, "Net API Test", 0x02FFB5, 36)

sys.log("info", "net.get type: " .. tostring(net.get))

net.get("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd", {}, function(status, body)
    sys.log("info", "callback status=" .. tostring(status))
    if status == 200 then
        local data = net.parse_json(body)
        if data and data.bitcoin and data.bitcoin.usd then
            sys.log("info", "BTC USD=" .. tostring(data.bitcoin.usd))
        end
    end
end)

while true do
    delay.delay_ms(1000)
end
`

const runtime = new LuaRuntime({
  onLog: (level, msg) => console.log(`[${level}] ${msg}`),
  onFrame: ({ pages, rgb }) => console.log('frame', Object.keys(pages)),
  onStop: () => console.log('stopped'),
})

runtime.start(code)

// Exit after a few seconds so the infinite loop does not hang the test.
setTimeout(() => process.exit(0), 15000)
