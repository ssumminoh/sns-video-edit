# sns-video-edit

브이로그·일상 원본으로 담백한 릴스를 만드는 편집기. 화면 설계(와이어프레임)는 별도 아티팩트에 있고, 이 저장소에는 렌더링과 영상 처리 도구가 들어 있습니다.

## 화면 구성 (렌더 결과)

- 9:16 (1080×1920) 검은 화면 정중앙에 1:1 (1080×1080) 영상
- 영상 위: 위치/도시 (명조체)
- 영상 안 아래쪽: 노랫말·문장 자막 (명조체, 원문 위 / 번역 아래 작게), 첫 자막 위에 〈 아티스트 - 곡 〉

## 도구

| 도구 | 하는 일 | 명령 |
| --- | --- | --- |
| Remotion | React로 영상 조립·렌더 | `npm run remotion:studio`, `npm run remotion:render` |
| HyperFrames | HTML로 영상 조립·렌더 | `npm run hf:preview`, `npm run hf:check`, `npm run hf:render` |
| FFmpeg | 변환, 샘플 생성, 고정 앵글 보정(vidstab) | `npm run stabilize -- 입력.mp4 출력.mp4 tripod` |
| Whisper (whisper.cpp) | 말소리 받아쓰기 → .srt | `npm run transcribe -- inbox/영상.mp4 ko` |
| yt-dlp | 영상·음원 내려받기 → `inbox/` | `npm run fetch -- <URL> [--audio]` |

## 설치

필요: Node.js 22 이상, Python 3, FFmpeg(libvidstab 포함), cmake·g++ (whisper.cpp 빌드용)

```bash
npm run setup
```

```bash
npm run check
```

`setup`은 npm 패키지, `.venv`의 yt-dlp, whisper.cpp와 `small` 모델(약 490MB)을 설치합니다. 모델은 huggingface.co에서 받습니다. 다른 크기를 쓰려면 `SNS_WHISPER_MODEL=medium npm run whisper:install`.

렌더용 크롬은 이 기기에 있는 것을 먼저 찾고(`SNS_HEADLESS_SHELL`, `SNS_CHROME`으로 지정 가능), 없으면 Remotion·HyperFrames가 직접 내려받습니다.

## 데모

```bash
npm run samples
```

```bash
npm run remotion:render
```

```bash
npm run hf:render
```

결과는 `out/remotion.mp4`, `out/hyperframes.mp4`.

## 고정 앵글 보정 모드

- `tripod`: 첫 프레임 배경에 완전히 고정. 사람·차만 움직이는 고정 앵글 (기본 12% 확대)
- `horizon`: 크게 흔들리는 것만 잡고 천천히 흐르게. 버스·지하철 창밖 (6%)
- `smooth`: 일반 손떨림 보정 (4%)

## 알아둘 점

- Whisper는 말소리용입니다. 음악 위 노랫말은 잘 못 알아들으니, 가사 자막은 가사 원문을 넣고 타이밍만 맞추세요.
- yt-dlp는 본인 영상이나 사용 권한이 있는 콘텐츠에만 쓰세요. 릴스 배경음악은 인스타그램 앱의 음악 기능으로 넣어야 음소거되지 않습니다.
- 위치/도시 줄은 릴스 상단 UI와, 자막은 틱톡 하단 UI와 일부 겹칠 수 있습니다(`hf:check` 경고). 요청한 레이아웃을 그대로 따른 결과입니다.
