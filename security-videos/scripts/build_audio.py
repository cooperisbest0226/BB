"""依時間軸合成完整音軌：旁白 + 自製背景音樂 + 少量提示音效。

- 旁白：每句 wav 放在時間軸指定的幀（取樣精準），在立體聲混音中標準化到 -14 LUFS，
  瞬間峰值以前視限制器壓在 -3 dBFS。
- 背景音樂：以 numpy 合成（和弦鋪底 + 輕撥琶音 + 低音），無任何外部素材；
  響度設定為比旁白低 BGM_DB（預設 -20 dB，約為旁白音量的 10%）。
- 音效：新郵件提示音、點擊、完成音，同樣為程式合成。

用法：python3 scripts/build_audio.py content/video1.json
輸出：../work/<id>/audio/{narration,bgm,sfx,mix}.wav 與 audio_report.json
"""
import json
import sys
from pathlib import Path

import numpy as np
import pyloudnorm as pyln
import soundfile as sf
from scipy.ndimage import minimum_filter1d, uniform_filter1d
from scipy.signal import lfilter

HERE = Path(__file__).resolve().parents[1]
WORK = HERE.parent / "work"
SR = 48000
NARRATION_LUFS = -14.0  # 旁白在立體聲混音中的響度
BGM_DB = -20.0  # 配樂相對旁白的響度差（-20 dB ≈ 10%，規格上限為 15% ≈ -16.5 dB）
SFX_DB = -14.0


def midi(n: float) -> float:
    return 440.0 * 2 ** ((n - 69) / 12)


def env_adsr(n: int, a: float, r: float) -> np.ndarray:
    """起音 a 秒、釋音 r 秒的包絡；片段比起音或釋音還短時也能處理。"""
    e = np.ones(n)
    na, nr = min(int(a * SR), n), min(int(r * SR), n)
    if na:
        e[:na] = np.linspace(0, 1, na)
    if nr:
        e[-nr:] *= np.linspace(1, 0, nr)
    return e


def lowpass(x: np.ndarray, cutoff: float) -> np.ndarray:
    a = np.exp(-2 * np.pi * cutoff / SR)
    return lfilter([1 - a], [1, -a], x)


def lufs(meter: pyln.Meter, x: np.ndarray) -> float:
    """立體聲混音中的響度（單聲道訊號視為左右聲道相同）。"""
    return meter.integrated_loudness(np.column_stack([x, x]) if x.ndim == 1 else x)


def limit_peaks(x: np.ndarray, ceiling_db: float) -> np.ndarray:
    """前視峰值限制器：只在瞬間峰值超過上限時降低增益（5 ms 前視、平滑）。"""
    ceil = 10 ** (ceiling_db / 20)
    need = np.minimum(1.0, ceil / np.maximum(np.abs(x), 1e-9))
    w = int(0.005 * SR)
    g = minimum_filter1d(need, size=2 * w + 1)
    g = uniform_filter1d(g, size=w)
    g = np.minimum(g, minimum_filter1d(need, size=w))
    return np.clip(x * g, -ceil, ceil)


def bgm(total: float) -> np.ndarray:
    """溫和、穩定的配樂：Am–F–C–G 循環，96 BPM。回傳 (n, 2)。"""
    bpm = 96
    bar = 4 * 60 / bpm
    chords = [[57, 60, 64], [53, 57, 60], [48, 55, 60, 64], [55, 59, 62]]  # Am F C G
    n = int(total * SR)
    out = np.zeros((n, 2))
    t_bar = np.arange(int(bar * SR)) / SR
    k = 0
    start = 0.0
    while start < total:
        chord = chords[k % 4]
        i0 = int(start * SR)
        seg = min(len(t_bar), n - i0)
        if seg <= 0:
            break
        t = t_bar[:seg]
        # 鋪底（左右微幅失諧，較寬的聲場）
        pad = np.zeros((seg, 2))
        for note in chord:
            f = midi(note)
            for ch, det in ((0, -0.0017), (1, 0.0017)):
                ff = f * (1 + det)
                pad[:, ch] += np.sin(2 * np.pi * ff * t) + 0.3 * np.sin(2 * np.pi * 2 * ff * t) + 0.12 * np.sin(2 * np.pi * 3 * ff * t)
        pad *= env_adsr(seg, 0.6, 0.6)[:, None] * 0.12
        # 低音
        root = midi(chord[0] - 12)
        bass = (np.sin(2 * np.pi * root * t) * env_adsr(seg, 0.05, 0.4) * 0.22)[:, None]
        # 八分音符琶音（高八度，快速衰減）
        arp = np.zeros((seg, 2))
        step = bar / 8
        tones = [chord[0] + 12, chord[1] + 12, chord[2] + 12, chord[1] + 12]
        for j in range(8):
            s0 = int(j * step * SR)
            if s0 >= seg:
                break
            L = min(int(0.6 * SR), seg - s0)
            tt = np.arange(L) / SR
            f = midi(tones[j % 4])
            note = (np.sin(2 * np.pi * f * tt) + 0.25 * np.sin(2 * np.pi * 2 * f * tt)) * np.exp(-tt / 0.22)
            pan = 0.35 if j % 2 else -0.35
            arp[s0:s0 + L, 0] += note * 0.07 * (1 - pan)
            arp[s0:s0 + L, 1] += note * 0.07 * (1 + pan)
        out[i0:i0 + seg] += pad + bass + arp
        start += bar
        k += 1
    # 柔化高頻、頭尾淡入淡出
    for ch in range(2):
        out[:, ch] = lowpass(out[:, ch], 3200)
    fade_in, fade_out = int(1.5 * SR), int(3.0 * SR)
    out[:fade_in] *= np.linspace(0, 1, fade_in)[:, None]
    out[-fade_out:] *= np.linspace(1, 0, fade_out)[:, None]
    return out


def sfx_sound(kind: str) -> np.ndarray:
    def bell(freq: float, dur: float, decay: float) -> np.ndarray:
        t = np.arange(int(dur * SR)) / SR
        return (np.sin(2 * np.pi * freq * t) + 0.35 * np.sin(2 * np.pi * 2.01 * freq * t)
                + 0.12 * np.sin(2 * np.pi * 3.02 * freq * t)) * np.exp(-t / decay) * env_adsr(len(t), 0.004, 0.02)

    if kind == "chime":  # 新郵件：兩個上行音
        a, b = bell(midi(79), 0.7, 0.18), bell(midi(84), 0.9, 0.25)
        out = np.zeros(int(1.1 * SR))
        out[:len(a)] += a
        out[int(0.14 * SR):int(0.14 * SR) + len(b)] += b
        return out
    if kind == "click":  # 滑鼠點擊
        t = np.arange(int(0.05 * SR)) / SR
        rng = np.random.default_rng(7)
        return (rng.standard_normal(len(t)) * 0.5 + np.sin(2 * np.pi * 2400 * t)) * np.exp(-t / 0.006)
    if kind == "success":  # 完成：三個上行音
        out = np.zeros(int(1.2 * SR))
        for i, n in enumerate([72, 76, 79]):
            s = bell(midi(n), 0.9, 0.22)
            o = int(i * 0.09 * SR)
            out[o:o + len(s)] += s[: len(out) - o]
        return out
    raise ValueError(kind)


def main(content_path: Path) -> None:
    content = json.loads(content_path.read_text(encoding="utf-8"))
    vid = content["id"]
    tl = json.loads((HERE / "src" / "data" / f"{vid}.timeline.json").read_text(encoding="utf-8"))
    fps = tl["fps"]
    total = tl["durationInFrames"] / fps
    n = int(round(total * SR))
    meter = pyln.Meter(SR)
    out_dir = WORK / vid / "audio"
    out_dir.mkdir(parents=True, exist_ok=True)

    # 旁白
    narr = np.zeros(n)
    speech_mask = np.zeros(n, dtype=bool)
    for scene in tl["scenes"]:
        for line in scene["lines"]:
            x, sr = sf.read(WORK / vid / "tts" / line["file"], dtype="float64")
            assert sr == SR, sr
            i0 = int(round(line["from"] / fps * SR))
            narr[i0:i0 + len(x)] += x[: n - i0]
            speech_mask[i0:i0 + len(x)] = True
    for _ in range(3):  # 標準化 → 壓峰值 → 再微調回目標響度
        narr *= 10 ** ((NARRATION_LUFS - lufs(meter, narr[speech_mask])) / 20)
        narr = limit_peaks(narr, -3.0)

    # 配樂
    music = bgm(total)
    music_lufs = lufs(meter, music)
    music *= 10 ** ((NARRATION_LUFS + BGM_DB - music_lufs) / 20)

    # 音效
    fx = np.zeros(n)
    for cue in tl.get("sfx", []):
        s = sfx_sound(cue["sound"])
        i0 = int(round(cue["frame"] / fps * SR))
        fx[i0:i0 + len(s)] += s[: n - i0]
    if np.abs(fx).max() > 0:
        fx *= 10 ** ((NARRATION_LUFS + SFX_DB) / 20) / np.sqrt(np.mean(fx[np.abs(fx) > 1e-4] ** 2))

    mix = music + (narr + fx)[:, None]
    peak = np.abs(mix).max()
    limit = 10 ** (-1.5 / 20)
    for ch in range(2):  # 保險：混音後峰值不超過 -1.5 dBFS
        mix[:, ch] = limit_peaks(mix[:, ch], -1.5)

    sf.write(out_dir / "narration.wav", narr, SR, subtype="PCM_24")
    sf.write(out_dir / "bgm.wav", music, SR, subtype="PCM_24")
    sf.write(out_dir / "sfx.wav", fx, SR, subtype="PCM_24")
    sf.write(out_dir / "mix.wav", mix, SR, subtype="PCM_24")

    # 量測：旁白（有聲段）與配樂的響度、RMS 振幅比
    m_narr = lufs(meter, narr[speech_mask])
    m_music = lufs(meter, music)
    rms_narr = np.sqrt(np.mean(narr[speech_mask] ** 2))
    rms_music = np.sqrt(np.mean(music[speech_mask] ** 2))
    report = {
        "durationSeconds": round(total, 3),
        "narrationLUFS": round(m_narr, 2),
        "bgmLUFS": round(m_music, 2),
        "bgmMinusNarrationDB": round(m_music - m_narr, 2),
        "bgmToNarrationAmplitudeRatio": round(10 ** ((m_music - m_narr) / 20), 3),
        "bgmToNarrationRMSRatioDuringSpeech": round(rms_music / rms_narr, 3),
        "mixLUFS": round(lufs(meter, mix), 2),
        "mixPeakDBFS": round(20 * np.log10(np.abs(mix).max()), 2),
        "mixPeakBeforeLimiterDBFS": round(20 * np.log10(peak), 2),
    }
    (out_dir / "audio_report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main(Path(sys.argv[1]))
