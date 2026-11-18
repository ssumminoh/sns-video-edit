import { Config } from '@remotion/cli/config';

Config.setVideoImageFormat('jpeg');
Config.setOverwriteOutput(true);
Config.setPublicDir('public');

// scripts/run-with-tools.mjs가 이 기기에 있는 헤드리스 크롬 경로를 넣어준다.
// 비어 있으면 Remotion이 크롬을 직접 내려받는다.
if (process.env.REMOTION_BROWSER_EXECUTABLE) {
  Config.setBrowserExecutable(process.env.REMOTION_BROWSER_EXECUTABLE);
}
