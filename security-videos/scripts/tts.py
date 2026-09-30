"""逐句產生旁白音檔，量測每句實際長度與句內各片語（以標點切分）的起點。

用法：python3 scripts/tts.py content/video1.json [--engine kokoro|edge]
輸出：../work/<video id>/tts/<scene>_<n>.wav 與 tts_meta.json

引擎：
- edge   ：edge-tts（zh-TW-HsiaoChenNeural），需要能連到 speech.platform.bing.com。
- kokoro ：Kokoro v1.1-zh（sherpa-onnx 離線推論，Apache-2.0），模型放在 ../work/models。
- google ：Google Cloud Text-to-Speech，API 金鑰放在環境變數 GOOGLE_TTS_API_KEY。
- files  ：使用現成音檔（本機產生的 edge-tts 或真人錄音），放在 voice/<id>/<場景>_<句>.mp3|wav|m4a。
每句產生後會用 SenseVoice 離線語音辨識回聽，計算字錯率（CER）當作發音檢查。
"""
import argparse
import asyncio
import hashlib
import json
import os
import re
import ssl
import subprocess
from pathlib import Path

import numpy as np
import opencc
from pypinyin import Style, lazy_pinyin
import soundfile as sf

ROOT = Path(__file__).resolve().parents[2]
WORK = ROOT / "work"
MODELS = WORK / "models"
SAMPLE_RATE = 48000
PUNCT = "，、？。！；："
T2S = opencc.OpenCC("t2s")  # 逐字繁轉簡，不做詞彙替換（例如「滑鼠」維持原詞）


# ---------------------------------------------------------------- engines
def synth_edge(text: str, cfg: dict, out: Path) -> None:
    import aiohttp
    import certifi
    import edge_tts

    async def run():
        ctx = ssl.create_default_context(cafile=certifi.where())
        extra = os.environ.get("SSL_CERT_FILE")
        if extra and Path(extra).exists():
            ctx.load_verify_locations(cafile=extra)
        comm = edge_tts.Communicate(
            text, cfg["voice"], rate=cfg["rate"],
            connector=aiohttp.TCPConnector(ssl=ctx), proxy=os.environ.get("HTTPS_PROXY"),
        )
        await comm.save(str(out.with_suffix(".mp3")))

    asyncio.run(run())
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(out.with_suffix(".mp3")),
                    "-ac", "1", "-ar", str(SAMPLE_RATE), "-c:a", "pcm_s16le", str(out)], check=True)


def to_wav_trimmed(src: Path, out: Path, threshold_db: int = -50) -> None:
    """轉成 48 kHz 單聲道 wav；開頭靜音修到 30 ms、結尾保留 80 ms 尾音（前後留白交給時間軸控制）。"""
    trim = (f"silenceremove=start_periods=1:start_threshold={threshold_db}dB:start_silence=0.03,"
            f"areverse,silenceremove=start_periods=1:start_threshold={threshold_db}dB:start_silence=0.08,areverse")
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(src), "-af", f"highpass=f=60,{trim}",
                    "-ac", "1", "-ar", str(SAMPLE_RATE), "-c:a", "pcm_s16le", str(out)], check=True)


def synth_google(text: str, cfg: dict, out: Path) -> None:
    """Google Cloud Text-to-Speech（REST），API 金鑰從環境變數 GOOGLE_TTS_API_KEY 讀取。"""
    import base64
    import urllib.request

    key = os.environ.get("GOOGLE_TTS_API_KEY")
    if not key:
        raise SystemExit("找不到環境變數 GOOGLE_TTS_API_KEY")
    body = {
        "input": {"text": text},
        "voice": {"languageCode": cfg["languageCode"], "name": cfg["voice"]},
        "audioConfig": {"audioEncoding": "LINEAR16", "sampleRateHertz": SAMPLE_RATE,
                        "speakingRate": cfg.get("speakingRate", 1.0), "pitch": cfg.get("pitch", 0.0)},
    }
    req = urllib.request.Request(
        "https://texttospeech.googleapis.com/v1/text:synthesize",
        data=json.dumps(body).encode(), headers={"Content-Type": "application/json", "X-Goog-Api-Key": key})
    with urllib.request.urlopen(req, timeout=60) as r:
        audio = base64.b64decode(json.loads(r.read())["audioContent"])
    raw = out.with_suffix(".raw.wav")
    raw.write_bytes(audio)
    to_wav_trimmed(raw, out)
    raw.unlink()


AUDIO_EXTS = (".wav", ".mp3", ".m4a", ".aac", ".ogg", ".flac")


def find_voice_file(cfg: dict, key: str) -> Path:
    """外部音檔（本機產生的 edge-tts 或真人錄音）：<dir>/<場景>_<句>.<副檔名>"""
    d = Path(__file__).resolve().parents[1] / cfg["dir"]
    for ext in AUDIO_EXTS:
        if (d / f"{key}{ext}").exists():
            return d / f"{key}{ext}"
    raise SystemExit(f"找不到音檔：{d / key}.*（支援 {' '.join(AUDIO_EXTS)}）")


_kokoro = None


def synth_kokoro(text: str, cfg: dict, out: Path) -> None:
    global _kokoro
    import sherpa_onnx

    if _kokoro is None:
        d = MODELS / "kokoro-multi-lang-v1_1"
        _kokoro = sherpa_onnx.OfflineTts(sherpa_onnx.OfflineTtsConfig(
            model=sherpa_onnx.OfflineTtsModelConfig(
                kokoro=sherpa_onnx.OfflineTtsKokoroModelConfig(
                    model=str(d / "model.onnx"), voices=str(d / "voices.bin"),
                    tokens=str(d / "tokens.txt"), data_dir=str(d / "espeak-ng-data"),
                    dict_dir=str(d / "dict"),
                    lexicon=f"{d}/lexicon-us-en.txt,{d}/lexicon-zh.txt"),
                num_threads=4),
            rule_fsts=f"{d}/date-zh.fst,{d}/phone-zh.fst,{d}/number-zh.fst"))
    audio = _kokoro.generate(T2S.convert(text), sid=cfg["sid"], speed=cfg["speed"])
    raw = out.with_suffix(".raw.wav")
    sf.write(raw, np.asarray(audio.samples, dtype=np.float32), audio.sample_rate)
    to_wav_trimmed(raw, out)
    raw.unlink()


# ---------------------------------------------------------------- analysis
_asr = None


def asr(wav: Path) -> tuple[str, list[tuple[str, float]]]:
    """回傳辨識文字與逐字時間戳 [(字, 秒), ...]"""
    global _asr
    import sherpa_onnx

    if _asr is None:
        d = MODELS / "sherpa-onnx-sense-voice-zh-en-ja-ko-yue-2024-07-17"
        _asr = sherpa_onnx.OfflineRecognizer.from_sense_voice(
            model=str(d / "model.int8.onnx"), tokens=str(d / "tokens.txt"),
            language="zh", use_itn=False, num_threads=4)
    x, sr = sf.read(wav, dtype="float32")
    s = _asr.create_stream()
    s.accept_waveform(sr, x)
    _asr.decode_stream(s)
    toks = [(t, ts) for t, ts in zip(s.result.tokens, s.result.timestamps) if norm(t)]
    return s.result.text, toks


def norm(s: str) -> str:
    return re.sub(r"[^一-鿿0-9a-zA-Z]", "", T2S.convert(s))


def pinyin(s: str) -> list[str]:
    return lazy_pinyin(norm(s), style=Style.TONE3, neutral_tone_with_five=True)


def tone_error_rate(ref: str, hyp: str) -> float:
    """帶聲調拼音的音節錯誤率：同音字（例如 連結／廉潔）不算錯，聲調或聲母韻母不同才算。"""
    return cer_seq(pinyin(ref), pinyin(hyp))


def cer(ref: str, hyp: str) -> float:
    return cer_seq(list(norm(ref)), list(norm(hyp)))


def cer_seq(r: list, h: list) -> float:
    dp = list(range(len(h) + 1))
    for i in range(1, len(r) + 1):
        prev, dp[0] = dp[0], i
        for j in range(1, len(h) + 1):
            cur = dp[j]
            dp[j] = min(dp[j] + 1, dp[j - 1] + 1, prev + (r[i - 1] != h[j - 1]))
            prev = cur
    return dp[-1] / max(1, len(r))


def pauses(wav: Path) -> list[tuple[float, float]]:
    """句中停頓（-38 dB 以下、至少 60 ms）。"""
    log = subprocess.run(["ffmpeg", "-hide_banner", "-i", str(wav), "-af",
                          "silencedetect=noise=-38dB:d=0.06", "-f", "null", "-"],
                         capture_output=True, text=True).stderr
    starts = [float(m) for m in re.findall(r"silence_start: ([\d.]+)", log)]
    ends = [float(m) for m in re.findall(r"silence_end: ([\d.]+)", log)]
    return list(zip(starts, ends))


def split_phrases(text: str) -> list[str]:
    parts = re.findall(rf"[^{PUNCT}]+[{PUNCT}]*", text)
    return [p for p in parts if norm(p)]


def align(ref: str, hyp: str) -> list[int | None]:
    """編輯距離對齊：回傳 ref 每個字對到的 hyp 索引（刪除則為 None）。"""
    n, m = len(ref), len(hyp)
    dp = [[0] * (m + 1) for _ in range(n + 1)]
    for i in range(n + 1):
        dp[i][0] = i
    for j in range(m + 1):
        dp[0][j] = j
    for i in range(1, n + 1):
        for j in range(1, m + 1):
            dp[i][j] = min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (ref[i - 1] != hyp[j - 1]))
    out: list[int | None] = [None] * n
    i, j = n, m
    while i > 0 and j > 0:
        if dp[i][j] == dp[i - 1][j - 1] + (ref[i - 1] != hyp[j - 1]):
            out[i - 1] = j - 1
            i, j = i - 1, j - 1
        elif dp[i][j] == dp[i - 1][j] + 1:
            i -= 1
        else:
            j -= 1
    return out


def phrase_starts(text: str, wav: Path, dur: float, toks: list[tuple[str, float]]) -> list[dict]:
    """每個片語（以標點切分）的開始時間。

    先把 ASR 逐字時間戳對齊回原文，取片語第一個字的時間；
    若該時間前 0.3 秒內有真正的停頓，就對齊到停頓結束點（更貼近發聲起點）。
    """
    phrases = split_phrases(text)
    ref = norm(text)
    hyp = "".join(norm(t) for t, _ in toks)
    stamps = [ts for t, ts in toks for _ in norm(t)]
    mapping = align(ref, hyp)
    gaps = pauses(wav)
    out, pos = [], 0
    for k, ph in enumerate(phrases):
        n = len(norm(ph))
        if k == 0:
            out.append({"text": ph, "start": 0.0, "source": "start"})
            pos += n
            continue
        idx = next((mapping[i] for i in range(pos, pos + n) if mapping[i] is not None), None)
        if idx is None:
            t, src = dur * pos / len(ref), "estimated"
        else:
            t, src = max(0.0, stamps[idx] - 0.06), "asr"
            near = [g for g in gaps if t - 0.3 <= g[1] <= t + 0.08]
            if near:
                t, src = near[-1][1], "asr+pause"
        out.append({"text": ph, "start": round(t, 3), "source": src})
        pos += n
    return out


def probe_seconds(path: Path) -> float:
    return float(subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=nw=1:nk=1", str(path)], check=True, capture_output=True, text=True,
    ).stdout.strip())


# ---------------------------------------------------------------- main
def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("content")
    ap.add_argument("--engine", choices=["kokoro", "edge", "google", "files"])
    args = ap.parse_args()

    content = json.loads(Path(args.content).read_text(encoding="utf-8"))
    tts_cfg = content["tts"]
    engine = args.engine or tts_cfg["engine"]
    cfg = tts_cfg[engine]
    synth = {"kokoro": synth_kokoro, "edge": synth_edge, "google": synth_google}.get(engine)

    out_dir = WORK / content["id"] / "tts"
    out_dir.mkdir(parents=True, exist_ok=True)
    meta_path = out_dir / "tts_meta.json"
    old = json.loads(meta_path.read_text(encoding="utf-8")) if meta_path.exists() else {}

    meta = {}
    for scene in content["scenes"]:
        for i, line in enumerate(scene["lines"]):
            key = f"{scene['id']}_{i + 1}"
            src = find_voice_file(cfg, key) if engine == "files" else None
            basis = hashlib.sha1(src.read_bytes()).hexdigest() if src else line.get("say", line["tts"])
            sig = hashlib.sha1(f"{basis}|{engine}|{json.dumps(cfg, sort_keys=True)}".encode()).hexdigest()[:12]
            wav = out_dir / f"{key}.wav"
            cached = old.get(key, {}).get("sig") == sig and wav.exists()
            if not cached:
                if src:
                    to_wav_trimmed(src, wav, threshold_db=-45)
                else:
                    synth(line.get("say", line["tts"]), cfg, wav)
            dur = probe_seconds(wav)
            hyp, toks = asr(wav)
            meta[key] = {
                "sig": sig, "engine": engine, "text": line["tts"], "file": wav.name,
                "duration": round(dur, 3),
                "phrases": phrase_starts(line["tts"], wav, dur, toks),
                "asr": hyp, "cer": round(cer(line["tts"], hyp), 3),
                "toneErrorRate": round(tone_error_rate(line["tts"], hyp), 3),
            }
            flag = "  <-- 請檢查發音" if meta[key]["toneErrorRate"] > 0.1 else ""
            print(f"[{'cache' if cached else 'tts'}] {key}  {dur:.2f}s  拼音錯誤率={meta[key]['toneErrorRate']:.2f}  ASR={hyp}{flag}")

    meta_path.write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"wrote {meta_path}")


if __name__ == "__main__":
    main()
