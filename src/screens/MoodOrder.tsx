import { useEffect, useState } from 'react';
import { api } from '../api';
import type { ScreenProps } from '../App';
import { applyRhythm, moveInOrder } from '../shared/clips';
import { FIX_LABEL, RHYTHMS, formatTime, orderNotes, orderedClips } from '../shared/reel';

export function MoodOrder({ project, update, go, notify }: ScreenProps) {
  const [loading, setLoading] = useState(false);
  const [drag, setDrag] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const clips = orderedClips(project);
  const ids = clips.map((c) => c.id);
  const mood = project.mood !== null ? project.moods[project.mood] : undefined;

  async function analyze() {
    if (clips.length === 0) return;
    setLoading(true);
    try {
      const out = await api.analyze(clips);
      if (out.warning) notify(out.warning);
      const tags = new Map(out.clips.map((c) => [c.id, c]));
      update((p) => ({
        ...p,
        moods: out.moods,
        moodSource: out.source,
        suggestedOrder: out.order,
        mood: null,
        clips: p.clips.map((c) => ({ ...c, ...tags.get(c.id) })),
      }));
    } catch (err) {
      notify((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  // 처음 들어왔을 때 한 번 읽는다. 그 뒤로는 "다시 읽기"를 눌러야 바뀐다.
  useEffect(() => {
    if (project.moods.length === 0) analyze();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pickMood = (i: number) => update((p) => applyRhythm({ ...p, mood: i }, p.moods[i].rhythm));
  const move = (from: number, to: number) => update((p) => moveInOrder(p, from, to));
  const suggested = project.suggestedOrder.filter((id) => ids.includes(id));
  const canSuggest = suggested.length === ids.length;
  const uploadOrder = project.clips.filter((c) => c.included).map((c) => c.id);

  return (
    <div className="screen">
      <main className="main">
        <div className="row">
          <div className="label ai">내 영상에서 읽은 분위기</div>
          <div className="muted small">
            {loading ? '영상을 읽는 중…' : project.moodSource === 'ai' ? '썸네일을 보고 낸 제안이에요.' : project.moodSource === 'heuristic' ? '색, 밝기, 움직임 수치만 보고 낸 제안이에요.' : ''}
          </div>
          <div className="grow" />
          <button className="btn sm" disabled={loading || clips.length === 0} onClick={analyze}>다시 읽기</button>
        </div>

        <div className="grid3">
          {project.moods.map((m, i) => (
            <button key={i} className={`mood ${project.mood === i ? 'on' : ''}`} onClick={() => pickMood(i)}>
              <div className="swatches">{m.colors.map((c, j) => <i key={j} style={{ background: c }} />)}</div>
              <div className="b" style={{ fontSize: 14 }}>{m.name}</div>
              <div className="muted">{m.read}</div>
              <div className="small">박자 · {RHYTHMS[m.rhythm].name} ({RHYTHMS[m.rhythm].sub})</div>
              <div className="small">자막 · {m.captionHint}</div>
            </button>
          ))}
        </div>
        {clips.length === 0 ? <div className="muted">고른 영상이 없어요. 1단계에서 영상을 올리고 골라주세요.</div> : null}

        <div className="row">
          <div className="b" style={{ fontSize: 15 }}>순서</div>
          <div className="muted small">썸네일을 끌어다 놓아 순서를 바꾸세요 · 키보드는 ← → 버튼</div>
          <div className="grow" />
          <button className="btn sm ai" disabled={!canSuggest} onClick={() => update((p) => ({ ...p, order: suggested }))}>순서 제안 적용</button>
          <button className="btn sm" onClick={() => update((p) => ({ ...p, order: uploadOrder }))}>올린 순서로</button>
        </div>

        <div className="grid4">
          {clips.map((c, pos) => (
            <div
              key={c.id}
              data-clip={c.id}
              draggable
              className={`card sortable ${drag === pos ? 'drag' : ''} ${over === pos && drag !== null && drag !== pos ? 'over' : ''}`}
              onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', c.id); setDrag(pos); }}
              onDragOver={(e) => { e.preventDefault(); setOver(pos); }}
              onDrop={(e) => { e.preventDefault(); if (drag !== null) move(drag, pos); setDrag(null); setOver(null); }}
              onDragEnd={() => { setDrag(null); setOver(null); }}
            >
              <div className="thumb" style={{ backgroundImage: `url(${c.thumb})` }}>
                <span className="no">{pos + 1}</span>
                <span className="tr">{formatTime(c.duration)}</span>
              </div>
              <div className="row" style={{ flexWrap: 'nowrap' }}>
                <div className="grow" style={{ minWidth: 0 }}>
                  <div className="b ellipsis">{c.title ?? c.name}</div>
                  <div className="muted small ellipsis">{c.shot ? `${c.shot} · ` : ''}{FIX_LABEL[c.fixability]}</div>
                </div>
                <button className="btn sm" aria-label="앞으로" disabled={pos === 0} onClick={() => move(pos, pos - 1)}>←</button>
                <button className="btn sm" aria-label="뒤로" disabled={pos === clips.length - 1} onClick={() => move(pos, pos + 1)}>→</button>
              </div>
            </div>
          ))}
        </div>
      </main>

      <aside className="panel">
        <div className="label ai">고른 분위기</div>
        {mood ? (
          <>
            <div className="b" style={{ fontSize: 15 }}>{mood.name}</div>
            <div className="muted">{mood.why}</div>
          </>
        ) : (
          <div className="muted">{project.ownMood ? project.ownMood : '제안 중 하나를 고르거나 아래에 직접 써주세요. 고르면 그 분위기에 맞는 박자가 적용돼요.'}</div>
        )}
        <div className="rule" />
        <div className="label ai">지금 순서에 대한 메모</div>
        <div className="stack tight">
          {orderNotes(clips).map((n, i) => (
            <div key={i} className={`note ${n.ok ? 'ok' : ''}`}><b>{n.ok ? '✓' : '!'}</b><span>{n.text}</span></div>
          ))}
        </div>
        <div className="muted small">메모는 제안일 뿐이에요. 순서는 직접 정한 대로 갑니다.</div>
        <div className="grow" />
        <label className="field">
          <span className="muted small">분위기를 직접 한 줄로 쓰기</span>
          <input id="own-mood" className="input" value={project.ownMood} placeholder="예: 비 오기 직전의 공원" onChange={(e) => update((p) => ({ ...p, ownMood: e.target.value }))} />
        </label>
        <button className="btn primary" disabled={clips.length === 0} onClick={() => go('rhythm')}>박자 맞추기 →</button>
      </aside>
    </div>
  );
}
