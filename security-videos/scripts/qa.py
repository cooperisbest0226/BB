"""成品檢查：規格、音畫同步、字幕寬度、依場景抽幀。

用法：python3 scripts/qa.py content/video1.json
輸出：../work/<id>/qa/*.png、qa_report.json
"""
import json
import re
import subprocess
import sys
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parents[1]
ROOT = HERE.parent
SR = 16000


def ffprobe(path: Path) -> dict:
    out = subprocess.run(["ffprobe", "-v", "error", "-show_format", "-show_streams", "-of", "json", str(path)],
                         check=True, capture_output=True, text=True).stdout
    return json.loads(out)


def decode_audio(path: Path) -> np.ndarray:
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(path), "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"],
                         check=True, capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32)


def onset(x: np.ndarray, t0: float, t1: float, thresh: float) -> float | None:
    """t0～t1 之間第一個 10 ms 能量超過門檻的時間點。"""
    hop = int(0.01 * SR)
    a, b = int(t0 * SR), int(t1 * SR)
    for i in range(max(0, a), min(len(x) - hop, b), hop):
        if np.sqrt(np.mean(x[i:i + hop] ** 2)) > thresh:
            return i / SR
    return None


def main(content_path: Path) -> None:
    content = json.loads(content_path.read_text(encoding="utf-8"))
    vid = content["id"]
    mp4 = ROOT / "output" / content["output"]
    tl = json.loads((HERE / "src" / "data" / f"{vid}.timeline.json").read_text(encoding="utf-8"))
    fps = tl["fps"]
    qa_dir = ROOT / "work" / vid / "qa"
    qa_dir.mkdir(parents=True, exist_ok=True)

    info = ffprobe(mp4)
    v = next(s for s in info["streams"] if s["codec_type"] == "video")
    a = next(s for s in info["streams"] if s["codec_type"] == "audio")
    size_mb = int(info["format"]["size"]) / 1024 / 1024
    lo, hi = content.get("durationRange", [85, 95])
    dur = float(info["format"]["duration"])
    spec = {
        "file": str(mp4.relative_to(ROOT)),
        "durationSeconds": round(dur, 3),
        "sizeMB": round(size_mb, 2),
        "video": f"{v['codec_name']} {v.get('profile')} {v['width']}x{v['height']} {v['r_frame_rate']} {v['pix_fmt']}",
        "videoFrames": int(v.get("nb_frames", 0)),
        "videoDuration": float(v["duration"]),
        "audio": f"{a['codec_name']} {a['sample_rate']}Hz {a['channels']}ch {int(a.get('bit_rate', 0)) // 1000}kbps",
        "audioDuration": float(a["duration"]),
    }
    checks = {
        f"長度 {lo}–{hi} 秒": lo <= dur <= hi,
        "檔案 < 100 MB": size_mb < 100,
        "H.264 + AAC": v["codec_name"] == "h264" and a["codec_name"] == "aac",
        "1920x1080": (v["width"], v["height"]) == (1920, 1080),
        "30 fps": v["r_frame_rate"] == "30/1",
        "影音長度差 < 50 ms": abs(float(v["duration"]) - float(a["duration"])) < 0.05,
    }

    # 音畫同步：每句字幕的起始時間 vs 成品音訊中旁白的實際起音
    x = decode_audio(mp4)
    speech_rms = np.sqrt(np.mean(x[np.abs(x) > 0.01] ** 2))
    sync = []
    for scene in tl["scenes"]:
        for line in scene["lines"]:
            t_sub = line["from"] / fps
            t_voice = onset(x, t_sub - 0.4, t_sub + 0.6, speech_rms * 0.25)
            sync.append({"line": line["key"], "subtitle": round(t_sub, 3),
                         "voiceOnset": None if t_voice is None else round(t_voice, 3),
                         "diffMs": None if t_voice is None else round((t_voice - t_sub) * 1000)})
    diffs = [abs(s["diffMs"]) for s in sync if s["diffMs"] is not None]
    checks["旁白起音與字幕差 ≤ 100 ms"] = len(diffs) == len(sync) and max(diffs) <= 100

    # 字幕寬度估算（58px 粗體＋字距 2px、左右留白 80px；畫面可用寬度 1760px）
    widths = {}
    for scene in tl["scenes"]:
        for line in scene["lines"]:
            for k, part in enumerate(line["sub"].split("|")):
                text = re.sub(r"\{[rgy]:([^}]+)\}", r"\1", part)
                widths[f"{line['key']}.{k + 1}"] = len(text) * 60 + 80
    checks["字幕寬度 ≤ 1760px"] = max(widths.values()) <= 1760

    # 抽幀：每個場景開頭 +1s、每句旁白中段、場景結尾前 0.5s
    shots = []
    for scene in tl["scenes"]:
        shots.append((scene["id"], "start", scene["from"] + fps))
        for line in scene["lines"]:
            shots.append((scene["id"], line["key"], line["from"] + line["duration"] // 2))
        shots.append((scene["id"], "end", scene["from"] + scene["duration"] - fps // 2))
    for sid, tag, fr in shots:
        out = qa_dir / f"{fr:04d}_{tag}.png"
        subprocess.run(["ffmpeg", "-y", "-v", "error", "-ss", f"{fr / fps:.3f}", "-i", str(mp4),
                        "-frames:v", "1", str(out)], check=True)

    report = {"spec": spec, "checks": checks, "sync": sync, "subtitleWidthPx": widths,
              "frames": [f"{fr:04d}_{tag}.png" for _, tag, fr in shots]}
    (qa_dir / "qa_report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(spec, ensure_ascii=False, indent=2))
    for k, ok in checks.items():
        print(("PASS " if ok else "FAIL ") + k)
    print("sync diff (ms):", [s["diffMs"] for s in sync])
    print(f"{len(shots)} frames -> {qa_dir}")


if __name__ == "__main__":
    main(Path(sys.argv[1]))
