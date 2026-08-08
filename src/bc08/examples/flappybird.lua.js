export const FLAPPY_BIRD = `local PAGE = 1
local W, H = claw.display.get_size()
local BIRD_X = 120
local BIRD_SIZE = 48
local GRAVITY = 0.7
local JUMP = -12
local PIPE_W = 100
local PIPE_GAP = 340
local PIPE_SPEED = 4
local birdY = H / 2
local birdVel = 0
local pipes = {}
local score = 0
local gameOver = false

math.randomseed(sys.millis())

claw.display.create_page(PAGE, "Flappy Bird")

local function initPipes()
    for i = 1, 3 do
        pipes[i] = { x = W + 500 + (i - 1) * 350, gapY = math.random(300, H - 300) }
    end
end

initPipes()

local function draw()
    claw.display.clear_page(PAGE)
    claw.display.container(PAGE, 1, 0, 0, W, H, 0x111827, 0)
    claw.display.container(PAGE, 2, BIRD_X, birdY, BIRD_SIZE, BIRD_SIZE, 0xFACC15, 8)
    for i, p in ipairs(pipes) do
        local topH = p.gapY - PIPE_GAP / 2
        local bottomY = p.gapY + PIPE_GAP / 2
        claw.display.container(PAGE, 10 + i, p.x, 0, PIPE_W, topH, 0x22C55E, 0)
        claw.display.container(PAGE, 20 + i, p.x, bottomY, PIPE_W, H - bottomY, 0x22C55E, 0)
    end
    claw.display.label(PAGE, 50, W / 2 - 40, 80, tostring(score), 0xFFFFFF, 48)
    claw.display.button(PAGE, 100, W / 2 - 80, H - 160, 160, 80, "JUMP", 0x02FFB5)
    if gameOver then
        claw.display.label(PAGE, 60, W / 2 - 120, H / 2 - 30, "GAME OVER", 0xEF4444, 40)
    end
end

draw()

while not gameOver do
    local p, obj = claw.display.pop_event()
    if obj ~= nil then
        birdVel = JUMP
        sys.log("debug", "jump: obj=" .. tostring(obj) .. " y=" .. tostring(birdY))
    end

    birdVel = birdVel + GRAVITY
    birdY = birdY + birdVel

    for i, p in ipairs(pipes) do
        p.x = p.x - PIPE_SPEED
        if p.x + PIPE_W < 0 then
            p.x = W
            p.gapY = math.random(200, H - 200)
            score = score + 1
        end
        if BIRD_X + BIRD_SIZE > p.x and BIRD_X < p.x + PIPE_W then
            if birdY < p.gapY - PIPE_GAP / 2 or birdY + BIRD_SIZE > p.gapY + PIPE_GAP / 2 then
                gameOver = true
            end
        end
    end

    if birdY < 0 or birdY + BIRD_SIZE > H then
        gameOver = true
    end

    draw()
    delay.delay_ms(40)
end
`;
