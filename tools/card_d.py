"""제산제(알약) 카드 D 생성: A6 세로 (874x1240 px, 212 dpi). 사용: python3 card_d.py <출력폴더>"""
import random, sys
from PIL import Image, ImageDraw, ImageFont

OUT = sys.argv[1]
W, H = 874, 1240
BOLD = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
f = lambda s: ImageFont.truetype(BOLD, s)
rng = random.Random(44)

im = Image.new('RGB', (W, H), (255, 140, 30))
d = ImageDraw.Draw(im)
pal = [(255, 255, 255), (40, 40, 60), (255, 214, 90), (200, 60, 30), (90, 50, 140), (30, 150, 140)]
cell = 54
for gy in range(190, H, cell):
    for gx in range(0, W, cell):
        col = rng.choice(pal)
        b = (gx + 5, gy + 5, gx + cell - 5, gy + cell - 5)
        r = rng.random()
        if r < 0.3:      # 캡슐
            if rng.random() < 0.5:
                d.rounded_rectangle((b[0], b[1] + 12, b[2], b[3] - 12), radius=12, fill=col)
            else:
                d.rounded_rectangle((b[0] + 12, b[1], b[2] - 12, b[3]), radius=12, fill=col)
        elif r < 0.55:
            d.ellipse(b, fill=col)
        elif r < 0.75:
            d.rectangle(b, fill=col)
        elif r < 0.9:
            d.polygon([(b[0], b[3]), (b[2], b[3]), ((b[0] + b[2]) / 2, b[1])], fill=col)
# 가운데 큰 알약
cx, cy = W / 2, H * 0.6
d.ellipse((cx - 230, cy - 150, cx + 230, cy + 150), fill=(255, 255, 255), outline=(40, 40, 60), width=16)
d.line((cx - 200, cy, cx + 200, cy), fill=(40, 40, 60), width=12)
d.text((cx, cy - 70), 'Mg(OH)₂', font=f(64), fill=(40, 40, 60), anchor='mm')
d.text((cx, cy + 75), '145 mg', font=f(56), fill=(40, 40, 60), anchor='mm')
d.rectangle((0, 0, W, 180), fill=(40, 40, 60))
d.text((50, 40), 'ANTACID', font=f(80), fill=(255, 255, 255))
d.text((52, 132), 'LENS · CARD D', font=f(30), fill=(255, 214, 90))
d.rectangle((0, 0, W - 1, H - 1), outline=(0, 0, 0), width=8)
im.save(f'{OUT}/cardD.png')
im.convert('RGB').resize((636, 902)).save(f'{OUT}/cardD.jpg', quality=90)
im.save(f'{OUT}/cardD_A6.pdf', resolution=212)
print('ok')
