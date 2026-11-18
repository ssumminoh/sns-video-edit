// 화면 아무 곳에나 댓글을 찍으면 AI가 읽고 편집 내용을 바로 고친 뒤 답을 단다.
import { useState } from 'react';
import { api } from './api';
import type { ScreenProps, StepId } from './App';
import { applyOps } from './shared/ops';
import type { Comment, Project } from './shared/types';

type Draft = Pick<Comment, 'x' | 'y' | 'target'>;

/** AI에게 보내는 프로젝트 요약. 파일 경로나 분석 수치처럼 수정에 필요 없는 값은 뺀다. */
const summarize = (p: Project) => ({
  order: p.order,
  bpm: p.bpm,
  rhythm: p.rhythm,
  place: p.place,
  credit: p.credit,
  captionLang: p.captionLang,
  musicVolume: p.musicVolume,
  originalVolume: p.originalVolume,
  fadeOut: p.fadeOut,
  music: p.music ? { name: p.music.name, duration: p.music.duration, offset: p.music.offset } : null,
  clips: p.clips.map((c) => ({
    id: c.id, name: c.title ?? c.name, scene: c.scene, shot: c.shot, duration: c.duration, fixability: c.fixability, steadyStart: c.steadyStart,
    included: c.included, beats: c.beats, trimStart: c.trimStart, speed: c.speed, fixMode: c.fixMode, transition: c.transition, caption: c.caption,
  })),
});

/** 클릭한 자리 아래에 있는 화면 요소에서 "무엇에 대한 댓글인지"를 읽는다. */
function targetAt(x: number, y: number): Comment['target'] {
  const el = document.elementsFromPoint(x, y).find((e) => !e.closest('.comment-layer'));
  if (!el) return { label: '화면' };
  const clipEl = el.closest<HTMLElement>('[data-clip]');
  // 컷 위에 찍었으면 그 컷 전체의 글자를, 아니면 누른 요소의 글자를 이름표로 쓴다.
  const source = clipEl ?? el;
  const text = (el instanceof HTMLInputElement ? el.placeholder || el.value : source.textContent ?? '').replace(/\s+/g, ' ').trim();
  return { label: text.slice(0, 60) || '화면', clipId: clipEl?.dataset.clip };
}

export function Comments({ step, project, update, ai, notify }: Pick<ScreenProps, 'project' | 'update' | 'ai' | 'notify'> & { step: StepId }) {
  const [placing, setPlacing] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [text, setText] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const here = project.comments.filter((c) => c.step === step);
  const patch = (id: string, change: Partial<Comment>) => update((p) => ({ ...p, comments: p.comments.map((c) => (c.id === id ? { ...c, ...change } : c)) }));

  async function send() {
    if (!draft || !text.trim()) return;
    const comment: Comment = { id: crypto.randomUUID().slice(0, 8), step, ...draft, text: text.trim(), status: 'pending', reply: '', applied: 0 };
    update((p) => ({ ...p, comments: [...p.comments, comment] }));
    setDraft(null);
    setText('');
    setPlacing(false);
    setOpen(comment.id);
    try {
      const answer = await api.comment({ comment: comment.text, screen: step, target: comment.target, project: summarize(project) });
      let applied = 0;
      let skipped = 0;
      update((p) => {
        const result = applyOps(p, answer.ops);
        applied = result.applied.length;
        skipped = result.skipped.length;
        return result.project;
      });
      patch(comment.id, { status: 'done', reply: answer.reply + (skipped ? ` (반영하지 못한 수정 ${skipped}개)` : ''), applied });
    } catch (err) {
      patch(comment.id, { status: 'error', reply: (err as Error).message });
      notify((err as Error).message);
    }
  }

  const pinStyle = (c: Pick<Comment, 'x' | 'y'>) => ({ left: `${c.x * 100}%`, top: `${c.y * 100}%` });

  return (
    <div className={`comment-layer ${placing && !draft ? 'placing' : ''}`}>
      {placing ? (
        <div
          className="comment-catch"
          onClick={(e) => {
            setDraft({ x: e.clientX / innerWidth, y: e.clientY / innerHeight, target: targetAt(e.clientX, e.clientY) });
            setOpen(null);
          }}
        />
      ) : null}

      {here.map((c, i) => (
        <div key={c.id} className="comment-pin-wrap" style={pinStyle(c)}>
          <button className={`comment-pin ${c.status}`} aria-label={`댓글 ${i + 1}`} onClick={() => setOpen(open === c.id ? null : c.id)}>{i + 1}</button>
          {open === c.id ? (
            <div className="comment-pop">
              <div className="muted small ellipsis">{c.target.label}</div>
              <div className="b">{c.text}</div>
              <div className={c.status === 'done' ? 'ai' : 'muted'}>
                {c.status === 'pending' ? 'AI가 읽고 있어요…' : c.reply}
                {c.status === 'done' ? <span className="muted small"> · 수정 {c.applied}개 반영</span> : null}
              </div>
              <div className="row">
                <div className="grow" />
                <button className="btn sm" onClick={() => update((p) => ({ ...p, comments: p.comments.filter((x) => x.id !== c.id) }))}>해결됨으로 지우기</button>
              </div>
            </div>
          ) : null}
        </div>
      ))}

      {draft ? (
        <div className="comment-pin-wrap" style={pinStyle(draft)}>
          <div className="comment-pin">+</div>
          <form className="comment-pop" onSubmit={(e) => { e.preventDefault(); send(); }}>
            <div className="muted small ellipsis">{draft.target.label}</div>
            <textarea id="comment-text" className="input" style={{ height: 72, padding: 8 }} autoFocus placeholder="예: 이 컷 좀 더 길게, 자막은 영어로" value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} />
            {!ai ? <div className="muted small">AI가 연결되지 않아 지금은 반영되지 않아요.</div> : null}
            <div className="row">
              <div className="grow" />
              <button type="button" className="btn sm" onClick={() => { setDraft(null); setText(''); }}>취소</button>
              <button type="submit" className="btn sm ai" disabled={!text.trim()}>보내기</button>
            </div>
          </form>
        </div>
      ) : null}

      <button className={`btn comment-toggle ${placing ? 'on' : ''}`} onClick={() => { setPlacing(!placing); setDraft(null); setOpen(null); }}>
        {placing ? '고칠 곳을 누르세요 · 취소' : `댓글로 고치기${here.length ? ` (${here.length})` : ''}`}
      </button>
    </div>
  );
}
