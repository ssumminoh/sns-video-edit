import { useRef, useState } from 'react';
import { api } from '../api';
import type { ScreenProps } from '../App';
import { addClip, newClip, removeClip, setIncluded, verdict } from '../shared/clips';
import { FIX_LABEL, formatTime } from '../shared/reel';
import type { Clip, Fixability } from '../shared/types';

const fixLine = (c: Clip) =>
  c.fixability === 'fixed'
    ? `◼ 원래 고정 · ${c.steadyLen.toFixed(1)}초 구간`
    : c.fixability === 'convertible'
      ? `◼ 고정 변환 가능 · 안정 구간 ${c.steadyLen.toFixed(1)}초`
      : '많이 움직임 · 고정 어려움';

const BADGE = { good: '추천', trim: '다듬기', exclude: '제외 추천' } as const;

export function Library({ project, update, ai, go, notify }: ScreenProps) {
  const [uploading, setUploading] = useState<string[]>([]);
  const [over, setOver] = useState(false);
  const [scene, setScene] = useState<string | null>(null);
  const [fix, setFix] = useState<Fixability | null>(null);
  const picker = useRef<HTMLInputElement>(null);
  const { clips } = project;

  async function upload(files: File[]) {
    const videos = files.filter((f) => f.type.startsWith('video/') || /\.(mp4|mov|m4v|webm|mkv)$/i.test(f.name));
    if (videos.length < files.length) notify('영상 파일만 올릴 수 있어요. 다른 파일은 건너뛰었어요.');
    setUploading((u) => [...u, ...videos.map((f) => f.name)]);
    // 서버가 FFmpeg로 분석하므로 한 번에 하나씩 올린다.
    for (const file of videos) {
      try {
        const stats = await api.uploadClip(file);
        update((p) => addClip(p, newClip(stats)));
      } catch (err) {
        notify(`${file.name}: ${(err as Error).message}`);
      }
      setUploading((u) => u.filter((n, i) => i !== u.indexOf(file.name)));
    }
  }

  function remove(id: string) {
    update((p) => removeClip(p, id));
    api.deleteClip(id).catch(() => {});
  }

  const scenes = [...new Set(clips.map((c) => c.scene).filter(Boolean))] as string[];
  const shown = clips.filter((c) => (!scene || c.scene === scene) && (!fix || c.fixability === fix));
  const count = (f: Fixability) => clips.filter((c) => c.fixability === f).length;
  const verdicts = clips.map((c) => ({ clip: c, v: verdict(c) }));
  const total = clips.reduce((s, c) => s + c.duration, 0);
  const included = clips.filter((c) => c.included).length;

  return (
    <div className="screen">
      <aside className="side">
        <div className="stack tight">
          <div className="label">장면 종류</div>
          {scenes.length === 0 ? (
            <div className="muted small">{ai ? '다음 단계에서 분위기를 읽을 때 장면 종류도 함께 붙여요.' : 'AI를 연결하면 장면 종류(공간, 손, 음식…)로 나눠 볼 수 있어요.'}</div>
          ) : (
            <div className="row">
              <button className={`chip ${scene === null ? 'selected' : ''}`} onClick={() => setScene(null)}>전체 {clips.length}</button>
              {scenes.map((s) => (
                <button key={s} className={`chip ${scene === s ? 'selected' : ''}`} onClick={() => setScene(s)}>
                  {s} {clips.filter((c) => c.scene === s).length}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="stack tight">
          <div className="label ai-suggestion">고정 앵글로 쓸 수 있나</div>
          <div className="row">
            <button className={`chip ${fix === null ? 'selected' : ''}`} onClick={() => setFix(null)}>전체</button>
            {(['fixed', 'convertible', 'hard'] as const).map((f) => (
              <button key={f} className={`chip ${fix === f ? 'selected' : f === 'hard' ? '' : 'ai-suggestion'}`} onClick={() => setFix(f)}>
                {FIX_LABEL[f]} {count(f)}
              </button>
            ))}
          </div>
          <div className="muted small">화면이 얼마나 움직이는지 재서 나눈 값이에요. 사람이 크게 움직이는 컷은 실제보다 흔들린 것으로 나올 수 있어요.</div>
        </div>
      </aside>

      <main className="main">
        <div className="row">
          <div className="heading">영상 {clips.length}개 · 총 {formatTime(total)}</div>
          <div className="muted">고른 영상 {included}개</div>
          <div className="grow" />
          <button className="button" onClick={() => picker.current?.click()}>+ 영상 추가</button>
          <input ref={picker} id="clip-files" type="file" accept="video/*" multiple hidden onChange={(e) => { upload([...(e.target.files ?? [])]); e.target.value = ''; }} />
        </div>
        <button
          className={`drop ${over ? 'over' : ''}`}
          onClick={() => picker.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setOver(true); }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => { e.preventDefault(); setOver(false); upload([...e.dataTransfer.files]); }}
        >
          {uploading.length > 0
            ? `분석 중 ${uploading.length}개 · ${uploading[0]}`
            : '영상을 여기로 끌어오거나 눌러서 고르세요 · 올리는 즉시 밝기, 색, 흔들림, 가장 안정적인 구간을 분석합니다'}
        </button>

        <div className="grid4">
          {shown.map((c) => {
            const v = verdict(c);
            return (
              <div key={c.id} data-clip={c.id} className={`card ${c.included ? '' : 'excluded'}`}>
                <div className="thumb" style={{ backgroundImage: `url(${c.thumb})` }}>
                  <span className={`thumb-badge status ${v.kind === 'good' ? 'ai-suggestion' : ''}`}>{BADGE[v.kind]}</span>
                  <span className="thumb-badge duration">{formatTime(c.duration)}</span>
                </div>
                <div className="bold ellipsis" title={c.name}>{c.title ?? c.name}</div>
                {c.scene ? <div className="muted small">{c.scene} · {c.shot}</div> : null}
                <div className={`small ${c.fixability === 'hard' ? 'muted' : 'ai-suggestion'}`}>{fixLine(c)}</div>
                <div className="row">
                  <label className="row grow small">
                    <input type="checkbox" checked={c.included} onChange={(e) => update((p) => setIncluded(p, c.id, e.target.checked))} /> 이 영상 쓰기
                  </label>
                  <button className="button small" onClick={() => remove(c.id)} aria-label={`${c.name} 삭제`}>삭제</button>
                </div>
              </div>
            );
          })}
        </div>
        {clips.length === 0 ? <div className="muted">아직 올린 영상이 없어요. 브이로그나 일상 영상을 그대로 올리면 됩니다.</div> : null}
      </main>

      <aside className="panel">
        <div className="label ai-suggestion">분류 요약</div>
        <div>
          쓸 만한 컷 <b>{verdicts.filter((x) => x.v.kind === 'good').length}개</b>, 다듬으면 쓸 컷 <b>{verdicts.filter((x) => x.v.kind === 'trim').length}개</b>, 빼는 걸 추천{' '}
          <b>{verdicts.filter((x) => x.v.kind === 'exclude').length}개</b>
        </div>
        <div className="rule" />
        <div className="stack tight">
          <div className="bold">살펴볼 컷</div>
          {verdicts.filter((x) => x.v.kind !== 'good').length === 0 ? <div className="muted">없어요.</div> : null}
          {verdicts.filter((x) => x.v.kind !== 'good').map(({ clip, v }) => (
            <div key={clip.id} className="row">
              <span className="grow ellipsis">{clip.title ?? clip.name}</span>
              <span className="muted">{v.reason}</span>
            </div>
          ))}
        </div>
        <div className="rule" />
        <div className="stack tight">
          <div className="bold">고정 앵글 컷</div>
          <div className="muted">
            원래 고정된 컷 {count('fixed')}개, 흔들림을 지워 삼각대로 찍은 것처럼 바꿀 수 있는 컷 {count('convertible')}개예요. 변환은 3단계에서 컷마다 고릅니다.
          </div>
          <div className="muted">다음에 찍을 때 휴대폰을 어딘가에 올려두고 10초만 찍어두면 가장 자연스러운 고정 컷이 돼요.</div>
        </div>
        <div className="grow" />
        <button className="button primary" disabled={included === 0} onClick={() => go('mood')}>분위기 제안 받기 →</button>
      </aside>
    </div>
  );
}
