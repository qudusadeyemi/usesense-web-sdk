/* The story as a list: the good-customer opener first, then the attacks in
   order. Attacks are added from the library, filtered by the four questions. */
import { useState } from 'react';
import { IcX } from '../bank/icons';
import { moveInStory } from '../lib/demos';
import { isOpener, MAX_ATTACKS } from '../lib/story';
import { QUESTION_LABEL, type Question, type Scenario } from '../scenarios/types';
import { QuestionChip } from './BeatView';

export function StoryEditor({ all, story, onChange, extras = [] }: { all: Scenario[]; story: string[]; onChange: (s: string[]) => void; extras?: string[] }) {
  const [adding, setAdding] = useState(false);
  const byId = new Map(all.map((s) => [s.id, s]));
  const attacks = story.filter((id) => byId.has(id) && !isOpener(byId.get(id)!));
  return (
    <div className="story">
      <ol className="story-list">
        {story.map((id, i) => {
          const s = byId.get(id);
          if (!s) return null;
          const opener = isOpener(s);
          return (
            <li key={id} className={opener ? 'opener' : ''}>
              <span className="n">{opener ? 'Opens' : i}</span>
              <span className="grow"><b>{s.title}</b><span className="muted small">{opener ? 'A good customer, through in seconds.' : s.blurb}</span></span>
              {!opener && <QuestionChip s={s} />}
              {!opener && (
                <span className="row" style={{ gap: 2 }}>
                  <button className="btn ghost sm" aria-label={`Move ${s.title} up`} disabled={i <= 1} onClick={() => onChange(moveInStory(story, id, -1))}>↑</button>
                  <button className="btn ghost sm" aria-label={`Move ${s.title} down`} disabled={i >= story.length - 1} onClick={() => onChange(moveInStory(story, id, 1))}>↓</button>
                  <button className="btn ghost sm" aria-label={`Remove ${s.title}`} onClick={() => onChange(story.filter((x) => x !== id))}><IcX width={14} /></button>
                </span>
              )}
            </li>
          );
        })}
      </ol>
      {extras.length > 0 && <p className="small muted">Also shown on a call: {extras.map((id) => byId.get(id)?.title).filter(Boolean).join(', ')}. These go on their link too.</p>}
      <button className="btn sm" disabled={attacks.length >= MAX_ATTACKS} onClick={() => setAdding(true)}>+ Add an attack{attacks.length >= MAX_ATTACKS ? ` (up to ${MAX_ATTACKS})` : ''}</button>
      {adding && <AddAttack all={all} story={story} onAdd={(id) => { onChange([...story, id]); setAdding(false); }} onClose={() => setAdding(false)} />}
    </div>
  );
}

function AddAttack({ all, story, onAdd, onClose }: { all: Scenario[]; story: string[]; onAdd: (id: string) => void; onClose: () => void }) {
  const [q, setQ] = useState<Question | 'all'>('all');
  const list = all.filter((s) => !isOpener(s) && !story.includes(s.id) && (q === 'all' || s.question === q));
  return (
    <div className="modal-back" role="dialog" aria-modal="true" aria-label="Add an attack" onClick={onClose} onKeyDown={(e) => e.key === 'Escape' && onClose()}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="mh"><b>Add an attack</b><button className="btn ghost sm" onClick={onClose} aria-label="Close"><IcX width={15} /></button></div>
        <div className="mb">
          <div className="wrap-row" role="group" aria-label="Filter by question">
            {(['all', 'real', 'right', 'one', 'still'] as const).map((k) => (
              <button key={k} className={`chipbtn${q === k ? ' on' : ''}`} onClick={() => setQ(k)}>{k === 'all' ? 'All' : QUESTION_LABEL[k]}</button>
            ))}
          </div>
          <ul className="add-list">
            {list.map((s) => (
              <li key={s.id}>
                <span className="grow"><b>{s.title}</b><span className="muted small">{s.blurb}</span></span>
                <QuestionChip s={s} />
                <button className="btn sm" onClick={() => onAdd(s.id)}>Add</button>
              </li>
            ))}
            {!list.length && <li className="muted small">Everything for this question is already in the story.</li>}
          </ul>
        </div>
      </div>
    </div>
  );
}
