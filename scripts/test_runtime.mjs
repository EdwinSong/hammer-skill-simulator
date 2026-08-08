import { LuaRuntime } from '../src/bc08/core/LuaRuntime.js'

const code = `
local PAGE = 1
local W, H = claw.display.get_size()
claw.display.create_page(PAGE, "Hello")
claw.display.container(PAGE, 1, 0, 0, W, H, 0x000000, 0)
claw.display.label(PAGE, 2, W / 2 - 130, H / 2 - 30, "Hello BC08!", 0x02FFB5, 40)
sys.log("info", "before loop")
local n = 0
while n < 3 do
    n = n + 1
    sys.log("info", "tick " .. n)
    delay.delay_ms(100)
end
sys.log("info", "done")
`

const runtime = new LuaRuntime({
  onLog: ({ level, message }) => console.log(`[${level}] ${message}`),
  onScreenUpdate: ({ pages }) => console.log('frame', pages.map((p) => p.id)),
  onStop: () => console.log('stopped'),
})

runtime.run(code)
