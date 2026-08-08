export const CLOCK_DIAL_DEMO = `local PAGE = 2
local W, H = claw.display.get_size()

claw.display.create_page(PAGE, "Clock Dial")

local function drawClock()
    claw.display.clear_page(PAGE)
    claw.display.container(PAGE, 1, 0, 0, W, H, 0x000000, 0)
    local t = sys.date("*t")
    local timeStr = string.format("%02d:%02d:%02d", t.hour, t.min, t.sec)
    local dateStr = string.format("%04d-%02d-%02d", t.year, t.month, t.day)
    claw.display.label(PAGE, 2, W / 2 - 180, H / 2 - 60, timeStr, 0x02FFB5, 72)
    claw.display.label(PAGE, 3, W / 2 - 120, H / 2 + 40, dateStr, 0xFFFFFF, 36)
end

drawClock()

while true do
    drawClock()
    delay.delay_ms(1000)
end
`;
