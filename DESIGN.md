---
version: alpha
name: Reel Editor Autumn Dark
description: 브이로그 원본으로 담백한 릴스를 만드는 개인용 편집기. 어두운 패널 위에 가을 호박색 하나로 강조한다.
colors:
  # 기초 값 (primitive)
  neutral-950: "#131314"
  neutral-900: "#1d1d1f"
  neutral-850: "#232326"
  neutral-800: "#2c2c30"
  neutral-700: "#3a3a3f"
  neutral-400: "#9c9a97"
  neutral-100: "#e7e5e2"
  neutral-0: "#ffffff"
  black: "#000000"
  amber-950: "#1b1206"
  amber-900: "#3a2a17"
  amber-700: "#8a5a22"
  amber-500: "#e8963a"
  amber-200: "#ffd9a3"
  maple-900: "#3a2416"
  maple-600: "#c2552d"
  olive-700: "#5f6b2e"
  wine-700: "#7a3b4a"
  # 역할 (semantic)
  primary: "{colors.amber-500}"
  on-primary: "{colors.amber-950}"
  surface-app: "{colors.neutral-950}"
  surface-panel: "{colors.neutral-900}"
  surface-panel-raised: "{colors.neutral-850}"
  surface-control: "{colors.neutral-800}"
  surface-selected: "{colors.amber-900}"
  surface-critical: "{colors.maple-900}"
  surface-media: "{colors.black}"
  border-default: "{colors.neutral-700}"
  border-hover: "{colors.neutral-400}"
  text-default: "{colors.neutral-100}"
  text-muted: "{colors.neutral-400}"
  text-on-track: "{colors.neutral-0}"
  text-on-track-accent: "{colors.amber-200}"
  action-primary: "{colors.amber-500}"
  ai-suggestion: "{colors.amber-500}"
  status-critical: "{colors.maple-600}"
  timeline-playhead: "{colors.maple-600}"
  track-video: "{colors.amber-700}"
  track-original-audio: "{colors.olive-700}"
  track-music: "{colors.wine-700}"
typography:
  title:
    fontFamily: Noto Sans KR
    fontSize: 13px
    fontWeight: 700
    lineHeight: 1.5
  body:
    fontFamily: Noto Sans KR
    fontSize: 11px
    fontWeight: 400
    lineHeight: 1.5
  body-strong:
    fontFamily: Noto Sans KR
    fontSize: 11px
    fontWeight: 700
    lineHeight: 1.5
  caption:
    fontFamily: Noto Sans KR
    fontSize: 10px
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: Noto Sans KR
    fontSize: 10px
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: 0.06em
  timecode:
    fontFamily: ui-monospace
    fontSize: 13px
    fontWeight: 700
    lineHeight: 1.5
rounded:
  control: 4px
  card: 6px
  pill: 12px
spacing:
  panel-gap: 2px
  tight: 6px
  default: 8px
  section: 12px
  panel-padding: 14px
  control-small: 22px
  control: 28px
  control-primary: 34px
  topbar: 38px
components:
  button:
    backgroundColor: "{colors.surface-control}"
    textColor: "{colors.text-default}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    height: "{spacing.control}"
    padding: 10px
  button-selected:
    backgroundColor: "{colors.surface-selected}"
    textColor: "{colors.action-primary}"
    typography: "{typography.body-strong}"
  button-primary:
    backgroundColor: "{colors.action-primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.body-strong}"
    rounded: "{rounded.control}"
    height: "{spacing.control-primary}"
  button-ai-suggestion:
    backgroundColor: "{colors.surface-panel}"
    textColor: "{colors.ai-suggestion}"
  button-small:
    height: "{spacing.control-small}"
    padding: 7px
  chip:
    backgroundColor: "{colors.surface-control}"
    textColor: "{colors.text-default}"
    rounded: "{rounded.pill}"
    padding: 8px
  chip-selected:
    backgroundColor: "{colors.surface-selected}"
    textColor: "{colors.action-primary}"
  input:
    backgroundColor: "{colors.surface-app}"
    textColor: "{colors.text-default}"
    rounded: "{rounded.control}"
    height: "{spacing.control}"
    padding: 8px
  clip-card:
    backgroundColor: "{colors.surface-panel-raised}"
    textColor: "{colors.text-default}"
    rounded: "{rounded.card}"
    padding: 5px
  mood-card:
    backgroundColor: "{colors.surface-panel-raised}"
    textColor: "{colors.text-default}"
    rounded: "{rounded.card}"
    padding: 10px
  timeline-block:
    backgroundColor: "{colors.track-video}"
    textColor: "{colors.text-on-track}"
    typography: "{typography.body-strong}"
    rounded: 3px
    height: 56px
  timeline-wave-original-audio:
    backgroundColor: "{colors.track-original-audio}"
    height: 30px
  timeline-wave-music:
    backgroundColor: "{colors.track-music}"
    height: 30px
  banner-critical:
    backgroundColor: "{colors.surface-critical}"
    textColor: "{colors.text-default}"
  comment-pin:
    backgroundColor: "{colors.action-primary}"
    textColor: "{colors.on-primary}"
    size: 24px
---

# 릴스 편집기 DESIGN.md

이 파일이 디자인 값의 원본이다. 위 YAML은 값, 아래 글은 그 값을 쓰는 이유다.
코드에서는 `src/styles.css`의 CSS 변수가 같은 이름을 따른다 (`colors.surface-panel` → `--color-surface-panel`, `rounded.card` → `--radius-card`, `spacing.section` → `--space-section`).
계층·네이밍 규칙과 아직 정하지 않은 기획 항목은 `DESIGN_SYSTEM.md`에 있다.

## Overview

혼자 쓰는 영상 편집 도구다. 프리미어 프로 같은 편집 프로그램의 어두운 패널 구성을 따르되, 훨씬 단순하다.
화면은 조용해야 한다. 주인공은 사용자의 영상이고, 화면 색은 영상을 방해하지 않는 무채색이다.
강조는 가을 호박색 하나뿐이다. "다음에 누를 것", "지금 선택된 것", "AI가 낸 값" 세 가지만 이 색을 쓴다.
글은 한국어 해요체로 짧게 쓴다.

## Colors

- **바탕(neutral 950→800)**: 네 단계의 어두운 회색으로 깊이를 만든다. 앱 바탕이 가장 어둡고, 패널, 떠 있는 패널, 버튼 순으로 밝아진다.
- **primary / action-primary (amber-500 `#e8963a`)**: 가을 호박색. 주 버튼, 선택 상태, 현재 시간에만 쓴다. 장식으로 쓰지 않는다.
- **ai-suggestion**: 지금은 primary와 같은 값이다. AI가 제안한 값과 판단을 사용자가 정한 값과 구분하는 표시다. 이름을 따로 둔 이유는 나중에 색을 갈라도 코드가 그대로이기 때문이다.
- **status-critical / timeline-playhead (maple-600 `#c2552d`)**: 단풍 붉은색. 재생 위치와 문제 알림에만 쓴다.
- **track-video / track-original-audio / track-music**: 타임라인 트랙을 구분하는 가을 색 세 가지(갈색, 올리브, 와인). 타임라인 밖에서는 쓰지 않는다.
- 글자 대비: text-default와 text-muted는 모든 바탕 위에서 4.5:1 이상이다.

## Typography

- 글꼴은 Noto Sans KR 하나다. 시간 표기만 고정폭 글꼴을 써서 숫자가 흔들리지 않게 한다.
- 크기는 네 단계뿐이다: title 13px, body 11px, caption 10px, label 10px(자간 넓게).
- 편집 화면은 정보가 많아서 글자를 작게 잡았다. 위계는 크기보다 굵기(400 / 700)와 색(default / muted)으로 만든다.
- 완성 영상 안의 글자(은디나루, 조선신명조 등)는 이 시스템 밖이다. `DESIGN_SYSTEM.md` 5장을 따른다.

## Layout

- 패널은 2px 틈(panel-gap)으로 나눈다. 틈 사이로 앱 바탕이 보여서 선 없이 구분된다.
- 기본 배치는 3단 패널이다: 왼쪽 210px(걸러 보기·설정), 가운데(작업 대상), 오른쪽 280px(AI 안내와 다음 단계 버튼).
- 패널 안쪽 여백은 14px, 묶음 사이 12px, 요소 사이 8px 또는 6px.
- 조작 요소 높이: 작은 버튼 22px, 버튼·입력칸 28px, 주 버튼 34px, 위쪽 바 38px.
- 타임라인은 박자 단위 격자다. 컷의 길이는 박자 수로만 정해진다.

## Elevation & Depth

- 그림자를 쓰지 않고 바탕 밝기 단계로 깊이를 만든다.
- 그림자는 화면 위에 떠 있는 두 가지(댓글 말풍선, 댓글 버튼)에만 쓴다.
- 영상과 썸네일 뒤는 항상 순수한 검정이다.

## Shapes

- 모서리는 세 단계: control 4px(버튼, 입력칸, 블록), card 6px(카드, 말풍선), pill 12px(칩, 번호표).
- 테두리는 1px. 선택된 것은 테두리 색을 primary로 바꾼다. 두께를 바꾸지 않는다.
- 점선 테두리는 "여기에 놓을 수 있음"(영상 놓는 곳, 끌어다 놓을 자리)과 "잘려나갈 영역"에만 쓴다.

## Components

- **button**: 기본은 조용한 회색. `button-primary`는 화면당 하나(다음 단계로 가는 버튼). `button-selected`는 여러 개 중 고른 것. `button-ai-suggestion`은 AI 제안을 적용하는 버튼.
- **chip**: 걸러 보기와 작은 선택지(속도, 전환).
- **input**: 바탕이 패널보다 어둡다. 파인 느낌을 준다.
- **clip-card**: 썸네일 + 이름 + 상태 한 줄. 썸네일 위 배지는 왼쪽 위에 판정, 오른쪽 아래에 길이. 순서 화면에서는 왼쪽 위에 번호표.
- **mood-card**: 색 견본 줄 + 이름 + 읽은 내용 + 박자·자막 제안.
- **timeline-block**: 트랙 색 바탕에 흰 글자. 위에서부터 전환 종류, 이름, 박자 수. 선택되면 흰 테두리.
- **timeline-wave-***: 소리 트랙. 가는 세로 줄무늬로 파형을 표현한다.
- **banner-critical**: 화면 위쪽 오류·안내 띠. 왼쪽에 critical 색 줄.
- **comment-pin**: 화면에 찍는 댓글 표시. 대기 중은 회색, 반영되면 primary, 오류는 critical.

모든 컴포넌트는 기본·올림·선택·비활성 상태를 가진다. 비활성은 불투명도 45%로 통일한다.

## Do's and Don'ts

**하세요**
- 색·크기·간격은 반드시 위 토큰으로 쓴다. 코드에서는 역할 토큰(`--color-*`, `--space-*`, `--radius-*`, `--font-size-*`)만 쓴다.
- 새 화면은 3단 패널, 인스펙터, 타임라인 같은 기존 패턴에서 시작한다.
- AI가 낸 값에는 ai-suggestion 색을, 문제에는 기호(!)와 글을 함께 쓴다.
- 불러오는 중·비어 있음·오류 상태를 항상 함께 만든다.

**하지 마세요**
- 토큰에 없는 색이나 크기를 새로 쓰지 않는다. 필요하면 이 파일에 토큰을 먼저 추가한다.
- primary를 장식이나 넓은 면에 쓰지 않는다.
- 한 화면에 주 버튼을 두 개 두지 않는다.
- 트랙 색을 타임라인 밖에서 쓰지 않는다.
- 그림자, 그라데이션, 이모지를 쓰지 않는다.
- 글자 크기 단계를 늘리지 않는다.
