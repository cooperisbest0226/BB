"""在你自己的電腦上產生旁白（微軟 edge-tts「曉臻」台灣女聲），再把音檔上傳回 repo。

需求：Python 3.9 以上，並先安裝：  pip install edge-tts
用法（在 security-videos 資料夾內執行）：
    python tools/make_voice_local.py video1
產出：voice/video1/ 底下每句一個 mp3（檔名如 s1_inbox_1.mp3），共 11 個。
把整個 voice/video1 資料夾上傳到 GitHub 分支 claude/beautiful-curie-3al0jw 的
security-videos/voice/video1/ 即可（網頁上 Add file → Upload files）。
"""
import asyncio
import json
import sys
from pathlib import Path

import edge_tts

VOICE = "zh-TW-HsiaoChenNeural"
RATE = "+0%"  # 想再快一點可改 "+5%"，慢一點改 "-5%"


async def main(vid: str) -> None:
    root = Path(__file__).resolve().parents[1]
    content = json.loads((root / "content" / f"{vid}.json").read_text(encoding="utf-8"))
    out_dir = root / "voice" / vid
    out_dir.mkdir(parents=True, exist_ok=True)
    for scene in content["scenes"]:
        for i, line in enumerate(scene["lines"]):
            key = f"{scene['id']}_{i + 1}"
            text = line["tts"]  # 曉臻是台灣聲線，直接用繁體原文
            await edge_tts.Communicate(text, VOICE, rate=RATE).save(str(out_dir / f"{key}.mp3"))
            print(f"{key}.mp3  {text}")
    print(f"\n完成：{out_dir}（共 {len(list(out_dir.glob('*.mp3')))} 個檔案）")


if __name__ == "__main__":
    asyncio.run(main(sys.argv[1] if len(sys.argv) > 1 else "video1"))
