"""把多張幀拼成 2x2 對照圖（半解析度，左上角標註幀號與秒數）：python3 scripts/contact_sheet.py out.png a.png b.png ..."""
import sys
from PIL import Image, ImageDraw, ImageFont

out, files = sys.argv[1], sys.argv[2:]
font = ImageFont.truetype("/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc", 28)
sheet = Image.new("RGB", (1920, 540 * ((len(files) + 1) // 2)), "black")
for i, fp in enumerate(files):
    im = Image.open(fp).convert("RGB").resize((960, 540))
    d = ImageDraw.Draw(im)
    fr = int("".join(c for c in fp.split("/")[-1] if c.isdigit()))
    d.rectangle((0, 0, 230, 40), fill="black")
    d.text((8, 2), f"#{fr}  {fr / 30:.2f}s", font=font, fill="yellow")
    sheet.paste(im, ((i % 2) * 960, (i // 2) * 540))
    ImageDraw.Draw(sheet).rectangle(((i % 2) * 960, (i // 2) * 540, (i % 2) * 960 + 959, (i // 2) * 540 + 539), outline="gray")
sheet.save(out)
print(out)
