#!/usr/bin/env bash
# 一鍵輸出：旁白 → 時間軸 → 音軌 → Remotion 算繪（無聲）→ FFmpeg 合併 AAC
# 用法：scripts/render.sh video1 Video1
set -euo pipefail
ID=${1:?影片 id，例如 video1}
COMP=${2:?Remotion composition，例如 Video1}
cd "$(dirname "$0")/.."
CONTENT="content/$ID.json"
WORK="../work/$ID"
OUT="../output/$(python3 -c "import json,sys;print(json.load(open(sys.argv[1]))['output'])" "$CONTENT")"
PW_SHELL=/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell
if [[ -z "${REMOTION_BROWSER:-}" && -x "$PW_SHELL" ]]; then export REMOTION_BROWSER="$PW_SHELL"; fi

python3 scripts/tts.py "$CONTENT"
python3 scripts/build_timeline.py "$CONTENT"
python3 scripts/build_audio.py "$CONTENT"
mkdir -p "$WORK" ../output
npx remotion render src/index.ts "$COMP" "$WORK/video_silent.mp4" \
  --codec=h264 --crf=18 --color-space=bt709 --muted --log=warn
ffmpeg -y -v error -i "$WORK/video_silent.mp4" -i "$WORK/audio/mix.wav" \
  -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 192k -ar 48000 -ac 2 \
  -movflags +faststart -shortest "$OUT"
ls -la "$OUT"
