"""依旁白實際長度排出時間軸（全部以 30fps 幀為單位）。

每個場景長度 = 進場前導(lead) + 各句實長 + 句間停頓(gapBefore) + 收尾停留(tail)。
收尾停留只保留閱讀畫面說明所需的時間；可選填 minSeconds 當場景最短長度。

用法：python3 scripts/build_timeline.py content/video1.json
輸出：src/data/<id>.timeline.json、../work/<id>/timeline.md
"""
import json
import math
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parents[1]
WORK = HERE.parent / "work"
FPS = 30
DEFAULT_TAIL = 1.0


def f(sec: float) -> int:
    return int(round(sec * FPS))


def norm_len(text: str) -> int:
    """去掉強調標記與標點後的字數（中文字與英數字）。"""
    text = re.sub(r"\{[rgy]:([^}]+)\}", r"\1", text)
    return len(re.findall(r"[\u4e00-\u9fff0-9A-Za-z]", text))


def split_subs(sub: str, phrases: list[dict]) -> list[dict]:
    """字幕以「|」分段：每段從字數對應的片語開始出現。"""
    parts = sub.split("|")
    starts, acc = [], 0
    for ph in phrases:
        starts.append((acc, ph["from"]))
        acc += norm_len(ph["text"])
    out, pos = [], 0
    for part in parts:
        frame = min(starts, key=lambda s: abs(s[0] - pos))[1]
        out.append({"text": part, "from": frame})
        pos += norm_len(part)
    return out


def resolve_cue(expr: str, scene_from: int, length: int, lines: list) -> int:
    """「phrase:1.4+1.1」→ 全片絕對幀。錨點：start、end、line:N、lineEnd:N、phrase:N.M"""
    m = re.fullmatch(r"(start|end|line:\d+|lineEnd:\d+|phrase:\d+\.\d+)([+-][\d.]+)?", expr)
    if not m:
        raise ValueError(f"bad cue: {expr}")
    anchor, offset = m.group(1), float(m.group(2) or 0)
    if anchor == "start":
        base = scene_from
    elif anchor == "end":
        base = scene_from + length
    elif anchor.startswith("lineEnd:"):
        ln = lines[int(anchor[8:]) - 1]
        base = ln["from"] + ln["duration"]
    elif anchor.startswith("line:"):
        base = lines[int(anchor[5:]) - 1]["from"]
    else:
        li, pi = (int(x) for x in anchor[7:].split("."))
        base = lines[li - 1]["phrases"][pi - 1]["from"]
    return base + f(offset)


def main(content_path: Path) -> None:
    content = json.loads(content_path.read_text(encoding="utf-8"))
    meta = json.loads((WORK / content["id"] / "tts" / "tts_meta.json").read_text(encoding="utf-8"))

    scenes, cursor, rows, sfx = [], 0, [], []
    for scene in content["scenes"]:
        t = f(scene["lead"])
        lines = []
        for i, line in enumerate(scene["lines"]):
            key = f"{scene['id']}_{i + 1}"
            m = meta[key]
            if i > 0:
                t += f(line.get("gapBefore", 0.6))
            dur = math.ceil(m["duration"] * FPS)
            lines.append({
                "key": key, "file": m["file"], "sub": line["sub"],
                "from": t, "duration": dur, "seconds": m["duration"],
                "phrases": [{"text": p["text"], "from": t + f(p["start"])} for p in m["phrases"]],
            })
            t += dur
        length = max(t + f(scene.get("tail", DEFAULT_TAIL)), f(scene.get("minSeconds", 0)))
        for ln in lines:
            ln["from"] += cursor
            for ph in ln["phrases"]:
                ph["from"] += cursor
            ln["subs"] = split_subs(ln["sub"], ln["phrases"])
        cues = {name: resolve_cue(c["at"], cursor, length, lines) for name, c in scene.get("cues", {}).items()}
        sfx += [{"frame": cues[name], "sound": c["sfx"]} for name, c in scene.get("cues", {}).items() if c.get("sfx")]
        scenes.append({"id": scene["id"], "from": cursor, "duration": length, "lines": lines, "cues": cues})
        speech = sum(l["seconds"] for l in lines)
        rows.append((scene["id"], cursor / FPS, length / FPS, speech, (length - t) / FPS))
        cursor += length

    timeline = {"id": content["id"], "fps": FPS, "width": 1920, "height": 1080,
                "durationInFrames": cursor, "scenes": scenes, "sfx": sfx}
    out = HERE / "src" / "data" / f"{content['id']}.timeline.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(timeline, ensure_ascii=False, indent=1), encoding="utf-8")

    md = ["| 場景 | 起點 | 場景長度 | 旁白實長 | 收尾停留 | 旁白 |", "|---|---|---|---|---|---|"]
    for (sid, start, length, speech, tail), scene in zip(rows, content["scenes"]):
        text = " / ".join(l["tts"] for l in scene["lines"])
        md.append(f"| {sid} | {start:5.2f}s | {length:5.2f}s | {speech:5.2f}s | {tail:4.2f}s | {text} |")
    md.append(f"\n總長：{cursor / FPS:.2f} 秒（{cursor} 幀）")
    (WORK / content["id"] / "timeline.md").write_text("\n".join(md) + "\n", encoding="utf-8")
    print("\n".join(md))


if __name__ == "__main__":
    main(Path(sys.argv[1]))
