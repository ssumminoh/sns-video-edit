import { useRef, useState } from 'react';
import { api } from '../api';
import type { ScreenProps } from '../App';
import { applyRhythm, patchClip, setBpm } from '../shared/clips';
import { FIX_MODES, RHYTHMS, beatSeconds, formatTime, formatTimecode, maxBeats, orderedClips } from '../shared/reel';
import type { Clip, FixMode, Rhythm as RhythmId } from '../shared/types';

const SPEEDS = [1, 1.5, 2];
const MODES: FixMode[] = ['tripod', 'horizon', 'none'];

export function Rhythm({ project, update, go, notify }: ScreenProps) {
  const clips = orderedClips(project);
  const [selected, setSelected] = useState<string | null>(clips[0]?.id ?? null);
  const [busy, setBusy] = useState<string | null>(null);
  const [musicBusy, setMusicBusy] = useState(false);
  const picker = useRef<HTMLInputElement>(null);
  const clip = clips.find((c) => c.id === selected) ?? clips[0];
  const index = clip ? clips.indexOf(clip) : -1;
  const totalBeats = clips.reduce((s, c) => s + c.beats, 0);
  const seconds = totalBeats * beatSeconds(project.bpm);
  const patch = (change: Partial<Clip>) => clip && update((p) => patchClip(p, clip.id, change));

  async function uploadMusic(file?: File) {
    if (!file) return;
    setMusicBusy(true);
    try {
      const music = await api.uploadMusic(file);
      update((p) => setBpm({ ...p, music, credit: p.credit || music.name }, music.bpm));
    } catch (err) {
      notify((err as Error).message);
    } finally {
      setMusicBusy(false);
    }
  }

  async function stabilize(target: Clip) {
    setBusy(target.id);
    try {
      const stabilized = await api.stabilize(target.file, target.fixMode);
      update((p) => patchClip(p, target.id, { stabilized }));
    } catch (err) {
      notify(`고정 변환 실패: ${(err as Error).message}`);
    } finally {
      setBusy(null);
    }
  }

  if (!clip) {
    return (
      <div className="screen">
        <main className="main muted">고른 영상이 없어요. 1단계에서 영상을 올리고 골라주세요.</main>
      </div>
    );
  }

  const mode = FIX_MODES[clip.fixMode];
  const converted = clip.fixMode === 'none' || clip.stabilized?.mode === clip.fixMode;
  const limit = maxBeats(clip, project.bpm);
  const startBeat = clips.slice(0, index).reduce((sum, c) => sum + c.beats, 0);
  const cols = { gridTemplateColumns: `repeat(${totalBeats}, minmax(0, 1fr))` };

  return (
    <div className="screen" style={{ flexDirection: 'column', overflowY: 'auto' }}>
      <div className="split">
        <section className="preview-col">
          <div className="square" style={{ backgroundImage: `url(${clip.thumb})` }}>
            {mode.zoom > 0 ? <div className="crop" style={{ inset: `${mode.zoom / 2}%` }} /> : null}
          </div>
          <div className="small ai">{mode.zoom > 0 ? `점선 안만 남아요 · ${mode.zoom}% 확대` : '잘림 없음'}</div>
          <div className="muted small">{index + 1}번 · {clip.title ?? clip.name}</div>
        </section>

        <section className="main">
          <div className="stack tight">
            <div className="label">음악</div>
            <div className="row boxed">
              <div className="grow" style={{ minWidth: 0 }}>
                <div className="b ellipsis">{project.music ? project.music.name : '음악 없음'}</div>
                <div className="muted small">
                  {project.music ? `박자 자동 감지 · 길이 ${formatTime(project.music.duration)} · 영상에 ${formatTime(seconds)} 사용` : '음악 파일을 올리면 박자를 자동으로 찾아요. 없으면 아래 BPM을 직접 정하세요.'}
                </div>
              </div>
              <label className="row small">BPM <input id="bpm" className="input num" type="number" min={40} max={220} value={project.bpm} onChange={(e) => update((p) => setBpm(p, Math.min(220, Math.max(40, Number(e.target.value) || 84))))} /></label>
              {project.music ? (
                <label className="row small">시작(초) <input id="music-offset" className="input num" type="number" min={0} step={0.5} value={project.music.offset} onChange={(e) => update((p) => (p.music ? { ...p, music: { ...p.music, offset: Math.max(0, Number(e.target.value) || 0) } } : p))} /></label>
              ) : null}
              <button className="btn" disabled={musicBusy} onClick={() => picker.current?.click()}>{musicBusy ? '분석 중…' : project.music ? '바꾸기' : '음악 올리기'}</button>
              <input ref={picker} id="music-file" type="file" accept="audio/*" hidden onChange={(e) => { uploadMusic(e.target.files?.[0]); e.target.value = ''; }} />
            </div>
          </div>

          <div className="stack tight">
            <div className="label">화면 전환 박자</div>
            <div className="row" style={{ alignItems: 'stretch' }}>
              {(Object.keys(RHYTHMS) as RhythmId[]).map((r) => (
                <button key={r} className={`btn grow ${project.rhythm === r ? 'on' : ''}`} style={{ height: 'auto', padding: '10px 12px', textAlign: 'left' }} onClick={() => update((p) => applyRhythm(p, r))}>
                  <div className="b">{RHYTHMS[r].name}</div>
                  <div className="small">{RHYTHMS[r].sub}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="inspector" data-clip={clip.id}>
            <div className="row">
              <div className="label ai">선택한 컷 · {index + 1}번 {clip.title ?? clip.name}</div>
              <div className="grow" />
              <span className="small muted">박자</span>
              <button className="btn sm" aria-label="박자 줄이기" disabled={clip.beats <= 1} onClick={() => patch({ beats: clip.beats - 1 })}>−</button>
              <b>{clip.beats}박</b>
              <button className="btn sm" aria-label="박자 늘리기" disabled={clip.beats >= limit} onClick={() => patch({ beats: clip.beats + 1 })}>+</button>
            </div>
            <div className="row">
              {MODES.map((m) => (
                <button key={m} className={`btn grow ${clip.fixMode === m ? 'on' : ''}`} onClick={() => patch({ fixMode: m })}>{FIX_MODES[m].name}</button>
              ))}
            </div>
            <div className="row">
              <div className="muted small grow">{mode.help}</div>
              {clip.fixMode !== 'none' ? (
                <button className="btn sm ai" disabled={busy !== null || converted} onClick={() => stabilize(clip)}>
                  {busy === clip.id ? '변환 중…' : converted ? '변환됨' : '고정 변환 실행'}
                </button>
              ) : null}
            </div>
            <div className="row small">
              <span className="muted">속도</span>
              {SPEEDS.map((s) => (
                <button key={s} className={`chip ${clip.speed === s ? 'on' : ''}`} onClick={() => patch({ speed: s, beats: Math.min(clip.beats, maxBeats({ ...clip, speed: s }, project.bpm)) })}>{s}배</button>
              ))}
              <span className="muted" style={{ marginLeft: 12 }}>앞 컷에서 넘어올 때</span>
              <button className={`chip ${clip.transition === 'cut' ? 'on' : ''}`} disabled={index === 0} onClick={() => patch({ transition: 'cut' })}>컷</button>
              <button className={`chip ${clip.transition === 'dissolve' ? 'on' : ''}`} disabled={index === 0} onClick={() => patch({ transition: 'dissolve' })}>디졸브 0.3초</button>
              <label className="row" style={{ marginLeft: 12 }}>
                <span className="muted">시작 지점(초)</span>
                <input id="trim-start" className="input num" type="number" min={0} max={Math.max(0, clip.duration - 0.5)} step={0.1} value={clip.trimStart}
                  onChange={(e) => { const t = Math.min(Math.max(0, Number(e.target.value) || 0), Math.max(0, clip.duration - 0.5)); patch({ trimStart: t, beats: Math.min(clip.beats, maxBeats({ ...clip, trimStart: t }, project.bpm)) }); }} />
              </label>
              <button className="btn sm" onClick={() => patch({ trimStart: clip.steadyStart })}>가장 안정적인 구간 ({clip.steadyStart}초)</button>
            </div>
          </div>
        </section>

        <aside className="panel">
          <div className="label ai">이 박자에 대한 팁</div>
          <div>{RHYTHMS[project.rhythm].tip}</div>
          <div className="rule" />
          <div className="b">전체 길이 {formatTime(seconds)} · {totalBeats}박</div>
          <div className="muted">
            {clip.fixability === 'hard' && clip.fixMode === 'tripod'
              ? '이 컷은 많이 움직여서 삼각대 고정이 어색할 수 있어요. 창틀·수평만 고정을 써보세요.'
              : clip.fixability === 'convertible' && clip.fixMode === 'none'
                ? '이 컷은 삼각대 고정으로 바꾸면 고정 앵글처럼 쓸 수 있어요.'
                : `이 컷은 원본에서 최대 ${limit}박까지 쓸 수 있어요.`}
          </div>
          <div className="grow" />
          <button className="btn primary" onClick={() => go('export')}>미리보기·내보내기 →</button>
        </aside>
      </div>

      <section className="timeline">
        <div className="row">
          <span className="tc now">{formatTimecode(startBeat * beatSeconds(project.bpm))}</span>
          <span className="tc muted">/ {formatTimecode(seconds)}</span>
          <div className="muted small">세로선 = 음악 박자 · 컷은 박자선에 붙습니다 · 블록을 누르면 위에서 고칠 수 있어요</div>
        </div>
        <div className="tl">
          <div className="tl-heads">
            <div className="h-ruler">박자</div>
            <div className="h-video"><i style={{ background: 'var(--track-video)' }} />V1 영상</div>
            <div className="h-audio"><i style={{ background: 'var(--track-original)' }} />A1 현장음</div>
            {project.music ? <div className="h-audio"><i style={{ background: 'var(--track-music)' }} />A2 음악</div> : null}
          </div>
          <div className="tl-lanes">
            <div className="lane ruler h-ruler" style={cols}>
              {Array.from({ length: totalBeats }, (_, i) => <div key={i} className={i % 4 === 0 ? 'bar' : ''}>{i % 4 === 0 ? i / 4 + 1 : ''}</div>)}
            </div>
            <div className="lane h-video" style={cols}>
              {clips.map((c, i) => (
                <button key={c.id} data-clip={c.id} className={`block ${c.id === clip.id ? 'on' : ''}`} style={{ gridColumn: `span ${c.beats}` }} onClick={() => setSelected(c.id)}>
                  <span className="tag">{i === 0 ? '시작' : c.transition === 'dissolve' ? '디졸브' : '컷'}</span>
                  <span className="b ellipsis">{c.title ?? c.name}</span>
                  <span className="meta ellipsis">{c.beats}박{c.fixMode !== 'none' ? ` · ${FIX_MODES[c.fixMode].name}${c.stabilized?.mode === c.fixMode ? '' : ' (변환 전)'}` : ''}</span>
                </button>
              ))}
            </div>
            <div className="lane h-audio" style={cols}>
              {clips.map((c) => <div key={c.id} className="wave" style={{ gridColumn: `span ${c.beats}` }} />)}
            </div>
            {project.music ? <div className="lane h-audio"><div className="wave music" /></div> : null}
            <div className="playhead" style={{ left: `${(startBeat / totalBeats) * 100}%` }} />
          </div>
        </div>
      </section>
    </div>
  );
}
