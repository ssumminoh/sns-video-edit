// 수정 기록과 취향 메모 패널.
// 사용자가 AI의 판단을 고친 기록을 보여주고, 그 기록으로 다듬어 가는 취향 메모를 직접 고칠 수 있다.
import { useEffect, useState } from 'react';
import { api, type HistoryEntry } from './api';
import type { ScreenProps } from './App';

const KIND_LABEL: Record<string, string> = {
  comment: '댓글',
  include: '영상 고르기',
  mood: '분위기',
  order: '순서',
  rhythm: '박자',
  fix: '고정 변환',
  transition: '전환',
  undo: '되돌리기',
};

export function History({ ai, notify }: Pick<ScreenProps, 'ai' | 'notify'>) {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<HistoryEntry[] | null>(null);
  const [taste, setTaste] = useState('');
  const [saved, setSaved] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    api
      .history()
      .then((h) => {
        setEntries(h.entries);
        setTaste(h.taste);
        setSaved(true);
      })
      .catch((err: Error) => notify(err.message));
  }, [open, notify]);

  async function save() {
    try {
      await api.saveTaste(taste);
      setSaved(true);
    } catch (err) {
      notify((err as Error).message);
    }
  }

  async function refresh() {
    setBusy(true);
    try {
      const out = await api.refreshTaste();
      setTaste(out.taste);
      setSaved(true);
    } catch (err) {
      notify((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button className={`button history-toggle ${open ? 'selected' : ''}`} onClick={() => setOpen(!open)}>
        수정 기록
      </button>
      {open ? (
        <aside className="history-panel" aria-label="수정 기록과 취향 메모">
          <div className="row">
            <div className="heading grow">수정 기록과 취향 메모</div>
            <button className="button small" onClick={() => setOpen(false)}>닫기</button>
          </div>

          <div className="stack tight">
            <div className="label ai-suggestion">취향 메모</div>
            <div className="muted small">AI가 분위기·순서를 제안하고 댓글을 반영할 때 먼저 읽는 글이에요. 직접 고쳐도 돼요.</div>
            <textarea id="taste-memo" className="input history-memo" aria-label="취향 메모" value={taste} onChange={(e) => { setTaste(e.target.value); setSaved(false); }} />
            <div className="row">
              <span className="muted small grow">{saved ? '저장됨' : '고친 내용이 아직 저장되지 않았어요'}</span>
              <button className="button small ai-suggestion" disabled={!ai || busy || !entries?.length} onClick={refresh}>
                {busy ? '정리 중…' : '기록으로 메모 다듬기'}
              </button>
              <button className="button small" disabled={saved || !taste.trim()} onClick={save}>저장</button>
            </div>
            {!ai ? <div className="muted small">AI가 연결되지 않아 자동으로 다듬을 수는 없어요. 기록은 계속 쌓여요.</div> : null}
          </div>

          <div className="rule" />
          <div className="label">수정 기록 {entries ? `${entries.length}개` : ''}</div>
          <div className="stack tight history-list">
            {entries === null ? <div className="muted">불러오는 중…</div> : null}
            {entries?.length === 0 ? <div className="muted">아직 기록이 없어요. 추천과 다르게 고르거나 댓글로 고치면 여기에 쌓여요.</div> : null}
            {entries?.slice().reverse().map((e, i) => (
              <div key={`${e.at}-${i}`} className="history-entry">
                <div className="muted small">{e.at.slice(0, 16).replace('T', ' ')} · {KIND_LABEL[e.kind] ?? e.kind}</div>
                <div>{e.summary}</div>
              </div>
            ))}
          </div>
        </aside>
      ) : null}
    </>
  );
}
