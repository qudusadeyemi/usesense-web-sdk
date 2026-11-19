/* An attack lab run with an ID dial: the lab Flow (Watchtower
   demo-shares/lab-flow.ts) in the web SDK's Flow runner, on this laptop's
   camera. The Flow asks for nothing typed: the BVN is a sandbox test number
   set by the dial. When the runner finishes, the result is read back from
   Watchtower until the run has a decision. */
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { FlowRunner, type FlowRunResult } from '@usesense/web-sdk';
import type { LabFlow } from '../lib/lab';
import type { LiveResult } from '../lib/live';
import { appearanceOf, useDemo } from '../lib/settings';
import { DEMO_API_BASE, readLabCheck, startLabCheck } from '../lib/staffLive';

const TERMINAL = new Set(['completed', 'errored', 'awaiting_review', 'abandoned', 'cancelled']);

export function LabFlowRun({ label, dials, onDone, onFail }: {
  label: string;
  dials: Record<string, string>;
  onDone: (id: string, result: LiveResult | null, flow: LabFlow) => void;
  onFail: (msg: string) => void;
}) {
  const { settings, brand } = useDemo();
  const scope = useParams<{ id: string }>().id;
  const [run, setRun] = useState<{ flowRunId: string; sdkToken: string } | null>(null);
  const [reading, setReading] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    startLabCheck({ label, prospect: settings.prospect, scope, dials })
      .then((s) => (s.kind === 'flow' ? setRun(s.flowRun) : onFail('This run needs an ID option.')))
      .catch((e) => onFail(e?.message || 'Couldn’t start the ID check. Try again.'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finish = async (id: string) => {
    setReading(true);
    for (let i = 0; i < 15; i++) {
      try {
        const r = await readLabCheck(id);
        if (r.flow && TERMINAL.has(r.flow.state)) { onDone(id, r.result, r.flow); return; }
      } catch { /* retry */ }
      await new Promise((res) => setTimeout(res, 1500));
    }
    onFail('The run didn’t reach a decision in time. Open it in Watchtower.');
  };

  if (reading) return <div className="try-wait"><span className="spinner" />Reading the decision from Sense…</div>;
  if (!run) return <div className="try-wait"><span className="spinner" />Starting a real ID check…</div>;
  return (
    <div className="engine-host present-engine">
      <FlowRunner
        options={{ flowRunId: run.flowRunId, sdkToken: run.sdkToken, apiBaseUrl: DEMO_API_BASE, appearance: appearanceOf(brand) }}
        onResult={(r: FlowRunResult) => finish(r.flowRunId)}
        onError={(e) => (e.code === 'cancelled' ? onFail('Cancelled.') : onFail(e.message || 'The ID check stopped.'))}
      />
    </div>
  );
}
