# 資安宣導動畫影片

公司內部資安宣導用的圖文動畫（1920×1080、30fps、H.264＋AAC，繁體中文旁白＋燒入字幕）。

| 影片 | 內容設定 | 輸出 |
|---|---|---|
| 影片一：釣魚信辨識（三看一不點，有疑問就回報） | `content/video1.json` | `../output/video1_phishing.mp4` |

## 製作流程

```
content/<id>.json ──► scripts/tts.py ──► scripts/build_timeline.py ──► scripts/build_audio.py
   旁白/字幕/同步點      逐句產生旁白、量長度      依實測長度排時間軸          旁白＋配樂＋音效混音
                                                        │
                                                        ▼
                                  Remotion 算繪（無聲） ──► FFmpeg 合併 AAC ──► ../output/*.mp4
```

1. **旁白**（`scripts/tts.py`）：逐句合成，量測實際長度；用 SenseVoice 離線語音辨識回聽每一句，
   以帶聲調拼音比對當發音檢查（同音字不算錯），並取得逐字時間戳，定位句中每個片語（以標點切分）的起點，
   讓畫面動作（打叉、螢光標示）對上唸到的字。
2. **時間軸**（`scripts/build_timeline.py`）：場景長度 = 進場前導 + 各句實長 + 句間停頓 + 收尾停留，
   全部換算成幀（收尾只保留閱讀畫面說明所需的時間）。輸出 `src/data/<id>.timeline.json`（Remotion 讀取）與 `../work/<id>/timeline.md`（秒數表）。
3. **音軌**（`scripts/build_audio.py`）：旁白按幀精準擺放、標準化到 -14 LUFS；
   配樂與音效都是程式即時合成（無外部素材），配樂響度比旁白低 20 dB（約 10%）。
4. **畫面**（`src/`）：Remotion（React）繪製，所有圖示與插畫皆為程式繪製的 SVG／CSS。
5. **檢查**（`scripts/qa.py`）：驗證規格、從成品音訊逐句比對旁白起音與字幕時間、依場景抽幀。

一鍵輸出：

```bash
scripts/render.sh video1 Video1   # 產生 ../output/video1_phishing.mp4
python3 scripts/qa.py content/video1.json
```

## 環境需求

- Node 18+、Python 3.10+、FFmpeg
- 字型：思源黑體 TC（Debian/Ubuntu：`apt install fonts-noto-cjk`），網址與網域用 DejaVu Sans Mono
- `npm install`；`pip install sherpa-onnx opencc-python-reimplemented soundfile numpy scipy pyloudnorm pillow`
- Remotion 需要 Chrome Headless Shell；無法下載時可設定 `REMOTION_BROWSER` 指向既有的 headless shell

### TTS 引擎

`content/<id>.json` 的 `tts.engine` 決定引擎：

- `edge`：edge-tts `zh-TW-HsiaoChenNeural`，語速 -5%。需要能連到 `speech.platform.bing.com`。
- `kokoro`：Kokoro v1.1-zh（Apache-2.0），經 sherpa-onnx 離線推論，聲線 sid 48、speed 1.3（約每秒 4.5 字）。

離線模型放在 `../work/models/`（從 sherpa-onnx 的 GitHub Releases 下載）：

```bash
B=https://github.com/k2-fsa/sherpa-onnx/releases/download
cd ../work/models
curl -LO $B/tts-models/kokoro-multi-lang-v1_1.tar.bz2 && tar xjf kokoro-multi-lang-v1_1.tar.bz2
curl -LO $B/asr-models/sherpa-onnx-sense-voice-zh-en-ja-ko-yue-2024-07-17.tar.bz2 && tar xjf sherpa-onnx-sense-voice-zh-en-ja-ko-yue-2024-07-17.tar.bz2
```

### 修改內容

- 改旁白或字幕：編輯 `content/<id>.json` 的 `tts`／`sub`（`{r:…}` 紅、`{g:…}` 綠、`{y:…}` 黃）。
  讀音不對時加 `say`（實際送進 TTS 的文字），字幕不受影響。
- 改節奏：調整各場景的 `lead`、`gapBefore`、`refSeconds`。
- 同步點（`cues`）用 `start`、`end`、`line:N`、`lineEnd:N`、`phrase:N.M` 加減秒數表示。
