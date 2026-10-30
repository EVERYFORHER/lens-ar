"""장면별 카드 F(열 흐름)·G(조리 용기)·H(무질서도) 생성: 카드 C식 무늬 + 장면과 같은 자리의 흰 윤곽 (A5 세로, 1240x1748).
사용: python3 card_scene.py <출력폴더>. 좌표는 scenes/*.js와 같음 (카드 가로 = 1, 가운데가 0, 위가 +y)."""
import random, sys
from PIL import Image, ImageDraw, ImageFont

OUT = sys.argv[1]
W, H = 1240, 1748
BOLD = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
KO = '/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc'
f = lambda s, p=BOLD: ImageFont.truetype(p, s)
px = lambda x, y: ((x + 0.5) * W, (H / W / 2 - y) * W)
u = lambda v: v * W
DARK, WHITE, YEL = (16, 24, 38), (255, 255, 255), (255, 210, 63)

def mosaic(seed):
    rng = random.Random(seed)
    im = Image.new('RGB', (W, H), DARK); d = ImageDraw.Draw(im)
    pal = [(226, 61, 61), (46, 160, 67), (40, 98, 214), (120, 120, 130), (80, 180, 230), (255, 200, 40), (250, 250, 250)]
    cell = 62
    for gy in range(0, H, cell):
        for gx in range(0, W, cell):
            col = rng.choice(pal); k = rng.random(); b = (gx + 6, gy + 6, gx + cell - 6, gy + cell - 6)
            if k < 0.35: d.rectangle(b, fill=col)
            elif k < 0.65: d.ellipse(b, fill=col)
            elif k < 0.85:
                c = [(b[0], b[3]), (b[2], b[3]), ((b[0] + b[2]) / 2, b[1])]
                if rng.random() < 0.5: c = [(b[0], b[1]), (b[2], b[1]), ((b[0] + b[2]) / 2, b[3])]
                d.polygon(c, fill=col)
    return im, d

# 흰 선 (아래에 어두운 테두리를 깔아 무늬 위에서도 잘 보이게)
def circle(d, x, y, r, col=WHITE, w=22, dash=False):
    cx, cy = px(x, y); R = u(r)
    for ww, cc in [(w + 18, DARK), (w, col)]:
        if dash:
            for a in range(0, 360, 20): d.arc((cx - R, cy - R, cx + R, cy + R), a, a + 11, fill=cc, width=ww)
        else: d.ellipse((cx - R, cy - R, cx + R, cy + R), outline=cc, width=ww)
def ellipse(d, x, y, rx, ry, col=WHITE, w=22, fill=None):
    cx, cy = px(x, y)
    for ww, cc in [(w + 18, DARK), (w, col)]: d.ellipse((cx - u(rx), cy - u(ry), cx + u(rx), cy + u(ry)), outline=cc, width=ww, fill=fill)
def rect(d, x, y, hw, hh, col=WHITE, w=22, r=30):
    x0, y0 = px(x - hw, y + hh); x1, y1 = px(x + hw, y - hh)
    for ww, cc in [(w + 18, DARK), (w, col)]: d.rounded_rectangle((x0, y0, x1, y1), radius=r, outline=cc, width=ww)
def line(d, a, b, col=WHITE, w=22):
    for ww, cc in [(w + 18, DARK), (w, col)]: d.line([px(*a), px(*b)], fill=cc, width=ww)
def tag(d, x, y, text, size=46, bg=DARK, ink=WHITE):
    cx, cy = px(x, y); fo = f(size, KO); b = d.textbbox((0, 0), text, font=fo); tw, th = b[2] - b[0], b[3] - b[1]
    d.rounded_rectangle((cx - tw / 2 - 18, cy - th / 2 - 14, cx + tw / 2 + 18, cy + th / 2 + 18), radius=16, fill=bg, outline=WHITE, width=4)
    d.text((cx, cy + 2), text, font=fo, fill=ink, anchor='mm')
def name(d, text):
    d.rounded_rectangle((W - 470, H - 120, W - 30, H - 30), radius=20, fill=DARK, outline=WHITE, width=4)
    d.text((W - 450, H - 75), text, font=f(32), fill=WHITE, anchor='lm')
def thermo(d, x, y, h):
    line(d, (x, y + 0.03), (x, y + h), w=26); circle(d, x, y, 0.035, col=(230, 60, 60), w=20)

def save(im, d, key):
    d.rectangle((0, 0, W - 1, H - 1), outline=(0, 0, 0), width=8)
    im.save(f'{OUT}/card{key}.png'); im.resize((900, 1269)).save(f'{OUT}/card{key}.jpg', quality=90)

# F 열 흐름: 비커(0, 0.08) r 0.15, 계 경계 r 0.2, 온도계 (0.36, -0.38)
im, d = mosaic(41)
circle(d, 0, 0.08, 0.20, col=YEL, w=16, dash=True)
circle(d, 0, 0.08, 0.15)
thermo(d, 0.36, -0.38, 0.3)
tag(d, 0, 0.36, '계', bg=(120, 90, 0)); tag(d, -0.3, -0.5, '주위')
name(d, 'LENS · HEAT CARD F'); save(im, d, 'F')

# G 조리 용기: 도시락 (0, 0.02) 0.6 × 0.46, 달걀 (-0.05, 0.04), 온도계 (0.06, 0.04)
im, d = mosaic(52)
rect(d, 0, 0.02, 0.30, 0.23)
ellipse(d, -0.05, 0.04, 0.085, 0.062)
circle(d, 0.06, 0.04, 0.022, col=(230, 60, 60), w=14)
for x in (-0.18, 0, 0.18): circle(d, x, 0.22, 0.02, w=10)
tag(d, 0, -0.32, '산화 칼슘 도시락')
name(d, 'LENS · COOK CARD G'); save(im, d, 'G')

# H 무질서도: 분자 상자 (0, 0.3) 0.56 × 0.2, 플라스크 (±0.24, -0.36) r 0.15, 관·꼭지
im, d = mosaic(63)
rect(d, 0, 0.3, 0.28, 0.10, r=12)
line(d, (-0.24 + 0.15, -0.36), (0.24 - 0.15, -0.36), w=30)
for s in (-1, 1): circle(d, s * 0.24, -0.36, 0.15)
circle(d, 0, -0.36, 0.04, col=(230, 60, 60), w=16)
tag(d, 0, 0.5, '물 분자 상자'); tag(d, -0.24, -0.6, 'A'); tag(d, 0.24, -0.6, 'B')
name(d, 'LENS · MIX CARD H'); save(im, d, 'H')
print('ok')
