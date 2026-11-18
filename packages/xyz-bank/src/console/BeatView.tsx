/* One beat of one attack: the prospect's app on a phone, and beside it either
   a caption (the attack) or the decision card (their KYC, then Sense). Used by
   Present, the prospect's page and booth mode, so all three tell it the same way. */
import { BankScreen, Phone, screenIsDark } from '../bank/Screens';
import { useDemo } from '../lib/settings';
import type { Beat } from '../lib/story';
import { QUESTION_LABEL, type Scenario } from '../scenarios/types';
import { DecisionPanel } from './Panel';
import { useStepper } from './useStepper';

const Q_CLASS = { real: 'q-real', right: 'q-right', one: 'q-one', still: 'q-still' } as const;

export function QuestionChip({ s }: { s: Scenario }) {
  return <span className={`qchip ${Q_CLASS[s.question]}`}>{QUESTION_LABEL[s.question]}</span>;
}

export function BeatProgress({ beats, index }: { beats: Beat[]; index: number }) {
  return (
    <div className="beatbar" aria-label={`Beat ${index + 1} of ${beats.length}`}>
      {beats.map((b, i) => (
        <span key={b.id} className={i < index ? 'done' : i === index ? 'cur' : ''}><i />{b.label}</span>
      ))}
    </div>
  );
}

export function BeatView({ scenario, beat, runKey, speed = 1, compact = false }: {
  scenario: Scenario;
  beat: Beat;
  /** Changes when the beat restarts, so the phone replays from the top. */
  runKey: string;
  speed?: number;
  compact?: boolean;
}) {
  const demo = useDemo();
  const st = useStepper(beat.steps.length ? beat.steps : [{ id: 'blank', label: '', screen: { kind: 'welcome' } }], runKey, speed);
  const screen = st.step.screen;
  const showPanel = !!beat.panel && (beat.id !== 'sense' || st.decided || beat.steps.length === 0);
  return (
    <div className={`beat-view${compact ? ' compact' : ''} beat-${beat.id}`}>
      <div className="bv-phone">
        <Phone dark={screenIsDark(screen)} brand={demo.brand}>
          <BankScreen screen={screen} ctx={{ brand: demo.brand, market: demo.market, industry: demo.industry }} stepKey={`${runKey}-${st.step.id}-${st.runId}`} />
        </Phone>
      </div>
      <div className="bv-side">
        <div className="bv-head">
          <span className="eyebrow">{beat.label}</span>
          <h2>{scenario.title}</h2>
          <QuestionChip s={scenario} />
        </div>
        {beat.id === 'attack' || beat.id === 'journey'
          ? <p className="bv-caption" key={runKey}>{beat.caption}</p>
          : (
            <div className="bv-decision" key={runKey}>
              {beat.headline && <p className={`bv-headline ${beat.id}`}>{beat.headline}</p>}
              {showPanel && beat.panel && <DecisionPanel panel={beat.panel} decided feed={[]} />}
            </div>
          )}
      </div>
    </div>
  );
}
