import { useEffect, useMemo, useRef, useState } from 'react';
import { Player } from '@remotion/player';
import { api, type RenderJob } from '../api';
import type { ScreenProps } from '../App';
import { Reel } from '../reel/Reel';
import { patchClip } from '../shared/clips';
import { CANVAS, FIX_MODES, FPS, SUB_LANGS, buildReelProps, formatTime, layout, orderedClips, type Note } from '../shared/reel';
import type { CaptionLang, Clip, Project } from '../shared/types';

const LANGS: { code: CaptionLang; label: string }[] = [
  { code: 'ko', label: '한국어' },
  { code: 'ja', label: '日本語' },
  { code: 'en', label: 'English' },
];

/** 올리기 전 점검. 프로젝트 값에서 바로 계산한다. */
function checklist(p: Project, clips: Clip[], seconds: number): Note[] {
  const notes: Note[] = [];
  if (clips.length === 0) return [{ ok: false, text: '고른 영상이 없어요.' }];
  notes.push(p.place.title.trim() ? { ok: true, text: `영상 위에 "${p.place.title.trim()}"이 들어가요.` } : { ok: false, text: '위치/도시가 비어 있어요.' });
  notes.push(clips[0].fixability === 'hard' && clips[0].fixMode === 'none' ? { ok: false, text: '첫 컷이 많이 흔들려요.' } : { ok: true, text: '첫 컷이 안정적이에요.' });
  const pending = clips.filter((c) => c.fixMode !== 'none' && c.stabilized?.mode !== c.fixMode);
  if (pending.length) notes.push({ ok: false, text: `고정 변환을 아직 실행하지 않은 컷이 ${pending.length}개 있어요. 지금은 원본 그대로 나가요.` });
  for (const c of clips.filter((x) => x.fixMode !== 'none' && x.stabilized?.mode === x.fixMode)) {
    notes.push({ ok: true, text: `${c.title ?? c.name}: ${FIX_MODES[c.fixMode].name}으로 ${c.stabilized!.zoom}% 확대됐어요. 화질을 확인해 주세요.` });
  }
  if (p.music) notes.push(p.music.duration - p.music.offset >= seconds ? { ok: true, text: '음악이 영상 끝까지 이어져요.' } : { ok: false, text: '음악이 영상보다 짧아요. 뒤쪽은 소리가 비어요.' });
  else notes.push({ ok: false, text: '음악이 없어요. 현장음만 나가요.' });
  notes.push({ ok: seconds <= 90, text: `전체 길이 ${formatTime(seconds)}${seconds > 90 ? ' · 릴스는 90초 안쪽이 좋아요.' : ''}` });
  return notes;
}

export function Export({ project, update, ai, notify }: ScreenProps) {
  const clips = orderedClips(project);
  const props = useMemo(() => buildReelProps(project), [project]);
  const frames = layout(props.clips).total;
  const seconds = frames / FPS;
  const subs = SUB_LANGS[project.captionLang];
  const [translating, setTranslating] = useState<string | null>(null);
  const [job, setJob] = useState<RenderJob | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const setCaption = (clip: Clip, main: string, subLines = clip.caption.subs) => update((p) => patchClip(p, clip.id, { caption: { main, subs: subLines } }));
  const setSub = (clip: Clip, i: number, text: string) => {
    const next = subs.map((_, j) => (j === i ? text : clip.caption.subs[j] ?? ''));
    setCaption(clip, clip.caption.main, next);
  };

  async function translate(clip: Clip) {
    setTranslating(clip.id);
    try {
      const out = await api.translate(clip.caption.main, project.captionLang, subs.map((s) => s.code));
      setCaption(clip, clip.caption.main, out.subs);
    } catch (err) {
      notify((err as Error).message);
    } finally {
      setTranslating(null);
    }
  }

  async function render() {
    setJob({ status: 'rendering', progress: 0, file: null, error: null });
    try {
      const { job: id } = await api.render(props);
      const poll = async () => {
        const status = await api.renderStatus(id);
        setJob(status);
        if (status.status === 'rendering') timer.current = setTimeout(() => poll().catch(fail), 1000);
      };
      await poll();
    } catch (err) {
      fail(err as Error);
    }
  }
  const fail = (err: Error) => setJob({ status: 'error', progress: 0, file: null, error: err.message });

  return (
    <div className="screen" style={{ flexWrap: 'wrap', overflowY: 'auto' }}>
      <aside className="side" style={{ width: 320, overflow: 'visible' }}>
        <div className="stack tight">
          <div className="label">영상 위 · 위치/도시 (은디나루)</div>
          <input id="place-title" className="input" placeholder="예: 서울, 올림픽공원" value={project.place.title} onChange={(e) => update((p) => ({ ...p, place: { ...p.place, title: e.target.value } }))} />
          <input id="place-sub" className="input" placeholder="아랫줄 (선택) 예: 여름의 끝" value={project.place.sub} onChange={(e) => update((p) => ({ ...p, place: { ...p.place, sub: e.target.value } }))} />
        </div>
        <div className="stack tight">
          <div className="label">음악 표기 (첫 자막 위)</div>
          <input id="credit" className="input" placeholder="예: TOIL, Gist - 몇 번의 여름" value={project.credit} onChange={(e) => update((p) => ({ ...p, credit: e.target.value }))} />
        </div>
        <div className="stack tight">
          <div className="label">자막 원문 언어 → 아래 번역</div>
          <div className="row">
            {LANGS.map((l) => (
              <button key={l.code} className={`button grow ${project.captionLang === l.code ? 'selected' : ''}`} onClick={() => update((p) => ({ ...p, captionLang: l.code }))}>{l.label}</button>
            ))}
          </div>
          <div className="muted small">원문 아래에 {subs.map((s) => s.label).join(', ')} 번역이 작게 붙어요. 한국어는 조선신명조, 일본어·영어는 톤을 맞춘 명조·세리프예요.</div>
        </div>
        <div className="stack tight">
          <div className="label">컷별 자막 (비워두면 자막 없음)</div>
          {clips.map((c, i) => (
            <div key={c.id} data-clip={c.id} className="caption-row">
              <div className="mini" style={{ backgroundImage: `url(${c.thumb})` }} />
              <div className="stack tight grow" style={{ minWidth: 0 }}>
                <input id={`cap-${c.id}`} className="input" aria-label={`${i + 1}번 컷 자막 원문`} placeholder={`${i + 1}번 컷 · 원문`} value={c.caption.main} onChange={(e) => setCaption(c, e.target.value)} />
                {c.caption.main.trim()
                  ? subs.map((s, j) => (
                      <input key={s.code} id={`cap-${c.id}-${s.code}`} className="input" aria-label={`${i + 1}번 컷 ${s.label} 번역`} placeholder={`${s.label} 번역`} value={c.caption.subs[j] ?? ''} onChange={(e) => setSub(c, j, e.target.value)} />
                    ))
                  : null}
                {c.caption.main.trim() && ai ? (
                  <button className="button small ai-suggestion" disabled={translating !== null} onClick={() => translate(c)}>{translating === c.id ? '번역 중…' : 'AI로 번역 채우기'}</button>
                ) : null}
              </div>
            </div>
          ))}
          {!ai ? <div className="muted small">AI가 연결되지 않아 번역은 직접 입력해야 해요.</div> : null}
        </div>
        <div className="stack tight">
          <div className="label">소리</div>
          <label className="field">음악 크기<input id="music-volume" type="range" min={0} max={1} step={0.05} value={project.musicVolume} onChange={(e) => update((p) => ({ ...p, musicVolume: Number(e.target.value) }))} /></label>
          <label className="field">현장음 크기<input id="original-volume" type="range" min={0} max={1} step={0.05} value={project.originalVolume} onChange={(e) => update((p) => ({ ...p, originalVolume: Number(e.target.value) }))} /></label>
          <label className="row"><input id="fade-out" type="checkbox" checked={project.fadeOut} onChange={(e) => update((p) => ({ ...p, fadeOut: e.target.checked }))} /> 마지막 1초 페이드아웃</label>
        </div>
      </aside>

      <main className="stage">
        <div className="player">
          {props.clips.length > 0 ? (
            <Player component={Reel} inputProps={props} durationInFrames={frames} fps={FPS} compositionWidth={CANVAS.width} compositionHeight={CANVAS.height} controls style={{ width: '100%', height: '100%' }} />
          ) : (
            <span>고른 영상이 없어요</span>
          )}
        </div>
        <div className="muted small">9:16 화면 정중앙에 1:1 영상 · {formatTime(seconds)}</div>
      </main>

      <aside className="panel" style={{ width: 320, overflow: 'visible' }}>
        <div className="label ai-suggestion">올리기 전 마지막 점검</div>
        <div className="stack tight">
          {checklist(project, clips, seconds).map((n, i) => (
            <div key={i} className={`note ${n.ok ? 'ok' : ''}`}><b>{n.ok ? '✓' : '!'}</b><span>{n.text}</span></div>
          ))}
        </div>
        <div className="rule" />
        <div className="label">내보내기</div>
        <div className="muted">1080 × 1920 · MP4 · 릴스, 쇼츠, 틱톡</div>
        <div className="muted small">릴스에 올릴 때 음악은 인스타그램 앱의 음악 기능으로 넣어야 음소거되지 않아요. 그럴 땐 음악 크기를 0으로 두고 저장하세요.</div>
        <div className="grow" />
        {job?.status === 'rendering' ? (
          <div className="stack tight"><div>영상을 만드는 중… {Math.round(job.progress * 100)}%</div><progress value={job.progress} max={1} /></div>
        ) : null}
        {job?.status === 'error' ? <div role="alert" style={{ whiteSpace: 'pre-wrap' }}>영상을 만들지 못했어요. {job.error}</div> : null}
        {job?.status === 'done' && job.file ? <a className="button" style={{ display: 'grid', placeItems: 'center', textDecoration: 'none' }} href={job.file} target="_blank" rel="noreferrer">완성된 영상 열기</a> : null}
        <button className="button primary" disabled={props.clips.length === 0 || job?.status === 'rendering'} onClick={render}>영상 저장</button>
      </aside>
    </div>
  );
}
