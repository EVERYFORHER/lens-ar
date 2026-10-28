"""몸 카드 E 생성: 카드 C 무늬 + AR 장면과 같은 자리의 머리·몸통 윤곽 (A5 세로, 1240x1748).
사용: python3 card_e.py <출력폴더>. 좌표는 sim.js와 같음 (카드 가로 = 1, 가운데가 0, 위가 +y)."""
import random, sys
from PIL import Image, ImageDraw, ImageFont

OUT = sys.argv[1]
W, H = 1240, 1748
BOLD = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
f = lambda s: ImageFont.truetype(BOLD, s)
px = lambda x, y: ((x + 0.5) * W, (H / W / 2 - y) * W)
rng = random.Random(33)

im = Image.new('RGB', (W, H), (16, 24, 38))
d = ImageDraw.Draw(im)
pal = [(226, 61, 61), (46, 160, 67), (40, 98, 214), (120, 120, 130), (80, 180, 230), (255, 200, 40), (250, 250, 250)]
cell = 62
for gy in range(0, H, cell):
    for gx in range(0, W, cell):
        col = rng.choice(pal)
        k = rng.random()
        b = (gx + 6, gy + 6, gx + cell - 6, gy + cell - 6)
        if k < 0.35:
            d.rectangle(b, fill=col)
        elif k < 0.65:
            d.ellipse(b, fill=col)
        elif k < 0.85:
            c = [(b[0], b[3]), (b[2], b[3]), ((b[0] + b[2]) / 2, b[1])]
            if rng.random() < 0.5:
                c = [(b[0], b[1]), (b[2], b[1]), ((b[0] + b[2]) / 2, b[3])]
            d.polygon(c, fill=col)

def quad(p0, p1, p2, n=16):
    return [((1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0],
             (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1]) for t in [i / n for i in range(1, n + 1)]]

# 몸통 (sim.js makeBody와 같은 모양: 목 → 어깨 → 팔 → 겨드랑이 → 옆구리, 오른쪽은 거울)
LEFT = [('M', (-0.06, 0.40)), ('L', (-0.06, 0.35)), ('Q', (-0.10, 0.31), (-0.30, 0.30)), ('Q', (-0.42, 0.28), (-0.44, 0.15)),
        ('L', (-0.47, -0.32)), ('Q', (-0.46, -0.40), (-0.40, -0.38)), ('L', (-0.35, 0.08)), ('Q', (-0.34, 0.12), (-0.31, 0.06)),
        ('L', (-0.31, -0.68))]
def trace(cmds):
    out, cur = [], None
    for c in cmds:
        if c[0] in 'ML': cur = c[1]; out.append(cur)
        else: out += quad(cur, c[1], c[2]); cur = c[2]
    return out
left = trace(LEFT)
pts = left + [(-x, y) for x, y in reversed(left)]
poly = [px(*p) for p in pts]
for wdt, col in [(40, (16, 24, 38)), (22, (255, 255, 255))]:
    d.line(poly + [poly[0]], fill=col, width=wdt, joint='curve')
    hx, hy = px(0, 0.52); r = 0.13 * W
    d.ellipse((hx - r, hy - r, hx + r, hy + r), outline=col, width=wdt)
# 입
mx, my = px(0, 0.455)
d.ellipse((mx - 42, my - 20, mx + 42, my + 20), fill=(200, 50, 50), outline=(255, 255, 255), width=6)
# 이름표 (아래 오른쪽)
d.rounded_rectangle((W - 470, H - 120, W - 30, H - 30), radius=20, fill=(16, 24, 38), outline=(255, 255, 255), width=4)
d.text((W - 450, H - 75), 'LENS · BODY CARD E', font=f(32), fill=(255, 255, 255), anchor='lm')
d.rectangle((0, 0, W - 1, H - 1), outline=(0, 0, 0), width=8)
im.save(f'{OUT}/cardE.png')
im.resize((900, 1269)).save(f'{OUT}/cardE.jpg', quality=90)
print('ok')
