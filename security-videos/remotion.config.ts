import {Config} from '@remotion/cli/config';

// 旁白與配樂由 scripts/build_audio.py 另外混音，影像先輸出無聲版再以 FFmpeg 合併
Config.setVideoImageFormat('jpeg');
Config.setJpegQuality(95);
Config.setConcurrency(4);
// 環境無法下載 Remotion 的 Chrome Headless Shell，改用預裝的 Playwright headless shell
if (process.env.REMOTION_BROWSER) {
  Config.setBrowserExecutable(process.env.REMOTION_BROWSER);
}
