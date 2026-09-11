from pathlib import Path
from PIL import Image

assets = Path(r'c:\svnroot\hammer-skill-simulator\public\skills\hammer-claw-skills-lab\skills\watercooling_light_timer\assets')

targets = {
    'title_aqua_core.png': (220, 44),
    'ring_bg.png': (440, 440),
    'preset_active.png': (200, 64),
    'preset_inactive.png': (200, 64),
    'btn_minus.png': (84, 84),
    'btn_plus.png': (84, 84),
    'start_btn.png': (670, 90),
    'stop_btn.png': (670, 90),
    'digit_colon.png': (26, 78),
    'chevron_up.png': (56, 56),
    'chevron_down.png': (56, 56),
}

for d in range(10):
    targets[f'digit_{d}.png'] = (52, 78)

for name, (w, h) in targets.items():
    p = assets / name
    if not p.exists():
        print(f'missing: {name}')
        continue
    with Image.open(p) as img:
        resized = img.convert('RGBA').resize((w, h), Image.LANCZOS)
        resized.save(p, 'PNG')
        print(f'{name} -> {w}x{h}')
