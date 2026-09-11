from pathlib import Path
from PIL import Image

assets = Path(r'c:\svnroot\hammer-skill-simulator\public\skills\hammer-claw-skills-lab\skills\watercooling_light_timer\assets')
for f in sorted(assets.glob('*.png')):
    try:
        with Image.open(f) as img:
            print(f'{f.name}: {img.size[0]}x{img.size[1]}')
    except Exception as e:
        print(f'{f.name}: error {e}')
