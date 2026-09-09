# Aqua Core 水冷灯光计时器 UI 重设计计划

## 背景
用户反馈当前界面美观度不足，内容和逻辑已满足需求，需要对整体视觉进行重设计。选择方向为「霓虹电竞 Aqua」：深色背景 + 青色/紫色霓虹强调色，模拟高端水冷控制面板。

## 目标
- 保留所有现有逻辑（延时/定时模式、状态持久化、RGB 控制、事件处理）
- 完全重绘界面，消除拥挤、重叠、文字截断问题
- 建立统一的视觉层级、间距系统和居中对齐
- 用 `claw.display.button` 替代图片按钮，避免缩放失真

## 视觉规范

### 配色
- 背景：`BG = 0x0A0D12`
- 卡片：`CARD_BG = 0x121820`
- 卡片描边/分隔：`STROKE = 0x1E2733`
- 主强调色（青色）：`CYAN = 0x00E5FF`
- 次强调色（紫色）：`PURPLE = 0xA855F7`
- 标题文字：`TEXT = 0xFFFFFF`
- 次级文字：`SUBTEXT = 0x8B9BB4`
- 激活状态按钮背景：`CYAN`，文字：`BG`
- 非激活状态按钮背景：`STROKE`，文字：`SUBTEXT`

### 间距
- `PAD = 24`
- `GAP = 16`
- 卡片圆角 `16`，按钮圆角 `12`

### 字体层级
- 顶部标题：22px 白色
- 时区/状态：16px 次级色
- 模式切换按钮：16px
- 环形中心倒计时：44px 青色
- 环形上下说明：16px / 14px
- 预设按钮：18px
- 输入框数字：32px，单位 14px
- 开始/停止按钮：20px

## 布局结构（按从上到下顺序，基于 W×H 自适应）

1. **顶部栏 (y=20, h=56)**
   - 左侧："AQUA CORE" 标题
   - 右侧：电源图标 + 当前时区标签

2. **状态卡片 (y=90, h=110)**
   - 左侧垂直：状态文字 "Light Effect On/Off" + RGB 颜色点横排
   - 右侧：光球图标 64×64
   - 使用 container 做圆角卡片背景

3. **模式切换条 (y=220, h=50)**
   - 居中的 pill 形状 segmented control
   - "Countdown" / "Schedule" 两个按钮，激活态反色高亮

4. **环形计时区 (y=290, h=380)**
   - 保留 `ring_bg.png` 作为视觉中心
   - 圆环内文字全部使用 `draw_label_center` 水平居中
   - Schedule 激活态显示 `HH:MM:SS`，上方 "Now HH:MM"，下方 "Remaining HH:MM:SS"
   - Countdown 模式显示剩余时间，上方 "Turn off after"，下方 "Remaining ..."

5. **预设/输入区 (y=690, h=150)**
   - Countdown 模式：4 个等宽文字按钮（15m / 30m / 1h / 2h），激活态高亮
   - Schedule 模式：Hour / Minute 两个圆角输入盒，数字大号 + H/M 小标签，± 按钮在每个盒子正下方

6. **开始/停止按钮 (y=860, h=80)**
   - 全宽圆角按钮
   - 停止态使用紫色背景，文字 "Stop Timer"
   - 启动态使用青色背景，文字 "Start Timer"
   - 文字通过 `text_width` 动态计算居中，不写死偏移

7. **页脚 (y=960, h=40)**
   - 居中显示 "LED will turn off automatically"

## 需要修改的函数

- `text_width`：系数从 0.55 调整为 0.5，使居中对齐更准确
- `draw_header`：重绘为顶部栏，时区移到右侧
- `draw_status_card`：改为水平卡片，左侧文字+彩点，右侧光球
- `draw_timer_section`：改为 pill 分段按钮，使用 `claw.display.button`
- `draw_ring`：保留 ring 图片，所有文字调用 `draw_label_center`
- `draw_presets`：用文字按钮替代图片按钮
- `draw_custom_input`：保留 Hour/Minute 盒子布局，调整视觉样式
- `draw_start_button`：使用 `claw.display.button` 绘制全宽按钮，文字动态居中
- `draw_footer`：居中显示提示文字

## 保留与废弃资源

保留：
- `ring_bg.png`
- `power_btn.png`
- `light_ball.png`
- `color_dot_*.png`
- `btn_minus2.png`、`btn_plus2.png`

废弃（代码中不再使用，但文件可保留）：
- `mode_btn.png` / `mode_btn_active.png`
- `preset_btn.png` / `preset_btn_active.png`
- `btn_start2.png` / `btn_stop.png`

## 防重叠/截断措施
- 每个区域的 `y` 用常量推进，不复用空间
- 所有居中文本通过 `text_width` 计算
- 输入框和按钮尺寸固定，± 按钮严格 70×70
- 每帧 `draw_ui` 先 `clear_page` 再全量重绘

## 验证步骤
1. 启动开发服务器，在模拟器中打开技能
2. 检查顶部栏、状态卡片、模式切换、圆环、输入区、开始按钮无重叠
3. 切换 Countdown / Schedule 模式，确认布局自适应
4. 点击预设按钮，确认激活态样式正确
5. 点击 ± 调整时间，确认数值和文字不截断
6. 点击 Start，观察圆环内倒计时居中刷新
7. 调整模拟器窗口尺寸，确认布局按 W/H 自适应
8. 重启技能，验证状态持久化和界面恢复一致

## 关键文件
- `c:\svnroot\hammer-skill-simulator\public\skills\hammer-claw-skills-lab\skills\watercooling_light_timer\scripts\watercooling_light_timer.lua`
