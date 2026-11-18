# 릴스 편집기

브이로그 원본으로 담백한 릴스를 만드는 개인용 웹 편집기. 구조와 실행 방법은 `README.md`.

## 화면을 고칠 때

- 먼저 `DESIGN.md`(값의 원본)와 `DESIGN_SYSTEM.md`(계층·네이밍 규칙)를 읽고 따른다. 토큰에 없는 색·크기·글꼴을 새로 쓰지 않는다.
- 코드에서는 역할 토큰(`--color-*`, `--space-*`, `--radius-*`, `--font-size-*`)만 쓴다. 토큰을 고치면 `DESIGN.md`와 `src/styles.css`를 함께 고친다.
- 순서: 의도 파악 → 패턴 선택 → 컴포넌트 선택 → 토큰 적용.
- `DESIGN_SYSTEM.md` 6장의 [미정] 항목에 걸리는 결정은 추측하지 말고 묻는다.
- 화면에 보이는 글자는 한국어 해요체, 용어는 `DESIGN_SYSTEM.md` 2장의 표를 따른다.

## 확인

- `npm run typecheck`, `npm run build`가 통과해야 한다.
- 화면을 바꿨으면 `npm run dev`로 띄워 직접 본다.
