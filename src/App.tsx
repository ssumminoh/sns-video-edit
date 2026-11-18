import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api';
import { Comments } from './Comments';
import { emptyProject, type Project } from './shared/types';
import { Library } from './screens/Library';
import { MoodOrder } from './screens/MoodOrder';
import { Rhythm } from './screens/Rhythm';
import { Export } from './screens/Export';

const STEPS = [
  { id: 'library', label: '1 불러오기·분류', Screen: Library },
  { id: 'mood', label: '2 분위기·순서', Screen: MoodOrder },
  { id: 'rhythm', label: '3 박자·전환', Screen: Rhythm },
  { id: 'export', label: '4 내보내기', Screen: Export },
] as const;
export type StepId = (typeof STEPS)[number]['id'];

export type ScreenProps = {
  project: Project;
  /** 프로젝트를 바꾼다. 바뀐 내용은 잠시 뒤 서버에 저장된다. */
  update: (change: (p: Project) => Project) => void;
  ai: boolean;
  go: (step: StepId) => void;
  /** 화면 위쪽에 오류·안내를 띄운다. */
  notify: (message: string) => void;
};

const stepFromHash = (): StepId => STEPS.find((s) => '#' + s.id === location.hash)?.id ?? 'library';

export function App() {
  const [project, setProject] = useState<Project | null>(null);
  const [ai, setAi] = useState(false);
  const [step, setStep] = useState<StepId>(stepFromHash);
  const [saved, setSaved] = useState<'saved' | 'saving' | 'failed'>('saved');
  const [message, setMessage] = useState('');
  const dirty = useRef(false);

  useEffect(() => {
    api
      .loadProject()
      .then((r) => {
        setProject({ ...emptyProject(), ...r.project });
        setAi(r.ai);
      })
      .catch((err: Error) => {
        setProject(emptyProject());
        setMessage(err.message);
      });
    const onHash = () => setStep(stepFromHash());
    addEventListener('hashchange', onHash);
    return () => removeEventListener('hashchange', onHash);
  }, []);

  // 바뀌고 0.6초 뒤에 저장한다.
  useEffect(() => {
    if (!project || !dirty.current) return;
    setSaved('saving');
    const timer = setTimeout(() => {
      api.saveProject(project).then(
        () => setSaved('saved'),
        () => setSaved('failed'),
      );
    }, 600);
    return () => clearTimeout(timer);
  }, [project]);

  const update = useCallback<ScreenProps['update']>((change) => {
    dirty.current = true;
    setProject((p) => (p ? change(p) : p));
  }, []);
  const go = useCallback((id: StepId) => {
    location.hash = id;
    setStep(id);
  }, []);

  if (!project) return <div className="main muted">불러오는 중…</div>;
  const { Screen } = STEPS.find((s) => s.id === step)!;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">담백 편집기</div>
        <nav className="steps">
          {STEPS.map((s) => (
            <button key={s.id} className={`step ${s.id === step ? 'on' : ''}`} onClick={() => go(s.id)}>
              {s.label}
            </button>
          ))}
        </nav>
        <div className="status">
          {saved === 'saved' ? '자동 저장됨' : saved === 'saving' ? '저장 중…' : '저장 실패'} · AI {ai ? '연결됨' : '미연결'}
        </div>
      </header>
      {message ? (
        <div className="banner" role="alert">
          <span>{message}</span>
          <button className="btn sm" onClick={() => setMessage('')}>
            닫기
          </button>
        </div>
      ) : null}
      <Screen project={project} update={update} ai={ai} go={go} notify={setMessage} />
      <Comments step={step} project={project} update={update} ai={ai} notify={setMessage} />
    </div>
  );
}
