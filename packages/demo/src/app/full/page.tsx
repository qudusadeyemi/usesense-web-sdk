'use client';

/**
 * /full — mixed biometric + document verification demo.
 *
 * Lets you compose a flow from biometric and document steps in any order,
 * then runs <VerificationFlow/> to drive them. Demonstrates all supported
 * combinations: biometric only, document only, biometric -> doc,
 * doc -> biometric, multi-document (passport + utility bill style), etc.
 */

import { useCallback, useMemo, useState } from 'react';
import {
  VerificationFlow,
  StraightLineCaptureEngine,
  detectEnvironmentFromKey,
} from '@usesense/web-sdk';
import type {
  CaptureResult,
  CaptureSessionData,
  DocumentSide,
  DocumentType,
  FlowStep,
  MixedFlowResult,
} from '@usesense/web-sdk';

// ---------------------------------------------------------------------------
// Mock biometric session (mirrors /page.tsx generator, trimmed)
// ---------------------------------------------------------------------------

function makeMockBiometricSession(): CaptureSessionData {
  return {
    session_id: `mock_sess_${Date.now()}`,
    session_token: `mock_tok_${Date.now()}`,
    nonce: `mock_nonce_${Date.now()}`,
    upload: { max_frames: 30, target_fps: 4, capture_duration_ms: 7500 },
    geometric_coherence: {
      mesh_binding_challenge:
        'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
    },
    policy: {
      challenge_type: 'none',
    },
  } as CaptureSessionData;
}

// ---------------------------------------------------------------------------
// Step builder UI
// ---------------------------------------------------------------------------

interface StepDraft {
  id: string;
  kind: 'biometric' | 'document';
  documentType: DocumentType;
  side: DocumentSide;
}

function nextId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function draftToStep(d: StepDraft): FlowStep {
  if (d.kind === 'biometric') return { kind: 'biometric' };
  return { kind: 'document', documentType: d.documentType, side: d.side };
}

function describeStep(d: StepDraft, i: number): string {
  if (d.kind === 'biometric') return `${i + 1}. Biometric capture`;
  return `${i + 1}. Document — ${d.documentType} (${d.side})`;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

const PRIMARY = '#4F7CFF';

const styles = {
  page: {
    minHeight: '100vh',
    fontFamily: "'DM Sans', sans-serif",
    background: '#FDFCFA',
    color: '#1C1A17',
  } as const,
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 32px',
    background: '#FFFFFF',
    borderBottom: '1px solid #E8E5DE',
  } as const,
  title: {
    fontSize: '1rem',
    fontWeight: 700,
    fontFamily: "'Outfit', sans-serif",
    letterSpacing: '-0.02em',
  } as const,
  badge: {
    fontSize: '0.72rem',
    fontWeight: 600,
    fontFamily: "'JetBrains Mono', monospace",
    background: 'rgba(79,124,255,0.08)',
    color: PRIMARY,
    padding: '4px 10px',
    borderRadius: '6px',
    marginLeft: '10px',
    border: '1px solid rgba(79,124,255,0.2)',
  } as const,
  content: {
    maxWidth: '860px',
    margin: '0 auto',
    padding: '32px 24px',
  } as const,
  card: {
    background: '#FFFFFF',
    borderRadius: '14px',
    border: '1px solid #E8E5DE',
    padding: '28px',
    marginBottom: '20px',
  } as const,
  cardTitle: {
    fontSize: '1rem',
    fontWeight: 700,
    fontFamily: "'Outfit', sans-serif",
    letterSpacing: '-0.02em',
    marginBottom: '20px',
  } as const,
  fieldGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '16px',
  } as const,
  label: {
    display: 'block',
    fontSize: '0.72rem',
    fontWeight: 600,
    color: '#6B6760',
    marginBottom: '6px',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.06em',
  } as const,
  input: {
    width: '100%',
    height: '44px',
    padding: '0 16px',
    border: '1px solid #E8E5DE',
    borderRadius: '10px',
    fontSize: '0.88rem',
    background: '#FFFFFF',
    color: '#1C1A17',
    boxSizing: 'border-box' as const,
  } as const,
  select: {
    width: '100%',
    height: '40px',
    padding: '0 12px',
    border: '1px solid #E8E5DE',
    borderRadius: '8px',
    fontSize: '0.85rem',
    background: '#FFFFFF',
    cursor: 'pointer',
    boxSizing: 'border-box' as const,
  } as const,
  primaryBtn: (disabled: boolean): React.CSSProperties => ({
    height: '44px',
    padding: '0 24px',
    border: 'none',
    borderRadius: '10px',
    fontSize: '0.88rem',
    fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
    background: disabled ? '#9E9A92' : PRIMARY,
    color: '#FFFFFF',
    opacity: disabled ? 0.4 : 1,
  }),
  secondaryBtn: {
    height: '36px',
    padding: '0 14px',
    border: '1px solid #E8E5DE',
    borderRadius: '8px',
    fontSize: '0.82rem',
    fontWeight: 600,
    background: '#FFFFFF',
    color: '#1C1A17',
    cursor: 'pointer',
  } as const,
  stepRow: {
    display: 'grid',
    gridTemplateColumns: '24px 1fr 120px 100px auto auto auto',
    alignItems: 'center',
    gap: '10px',
    padding: '12px',
    border: '1px solid #E8E5DE',
    borderRadius: '10px',
    marginBottom: '8px',
    background: '#FAFAF7',
  } as const,
  preset: {
    display: 'inline-block',
    marginRight: '8px',
    marginBottom: '8px',
  } as const,
  json: {
    background: '#F5F3EF',
    borderRadius: '10px',
    padding: '14px',
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: '0.75rem',
    overflowX: 'auto' as const,
    margin: 0,
    whiteSpace: 'pre-wrap' as const,
    wordBreak: 'break-all' as const,
  } as const,
  notice: {
    padding: '20px 24px',
    background: 'rgba(255,184,77,0.06)',
    border: '1px solid rgba(255,184,77,0.2)',
    borderRadius: '14px',
    fontSize: '0.85rem',
    color: '#6B6760',
    marginBottom: '20px',
    lineHeight: 1.6,
  } as const,
};

const PRESETS: { name: string; build: () => StepDraft[] }[] = [
  {
    name: 'Biometric only',
    build: () => [{ id: nextId(), kind: 'biometric', documentType: 'identity', side: 'front' }],
  },
  {
    name: 'Document only (ID front)',
    build: () => [{ id: nextId(), kind: 'document', documentType: 'identity', side: 'front' }],
  },
  {
    name: 'Biometric → Document (ID front+back)',
    build: () => [
      { id: nextId(), kind: 'biometric', documentType: 'identity', side: 'front' },
      { id: nextId(), kind: 'document', documentType: 'identity', side: 'front' },
      { id: nextId(), kind: 'document', documentType: 'identity', side: 'back' },
    ],
  },
  {
    name: 'Document → Biometric',
    build: () => [
      { id: nextId(), kind: 'document', documentType: 'identity', side: 'front' },
      { id: nextId(), kind: 'biometric', documentType: 'identity', side: 'front' },
    ],
  },
  {
    name: 'Multi-doc: Passport + ID back (KYC + POA style)',
    build: () => [
      { id: nextId(), kind: 'document', documentType: 'identity', side: 'front' },
      { id: nextId(), kind: 'document', documentType: 'identity', side: 'back' },
      { id: nextId(), kind: 'biometric', documentType: 'identity', side: 'front' },
    ],
  },
  {
    name: 'Full KYC + KYB + POA (identity + organization + address + biometric)',
    build: () => [
      { id: nextId(), kind: 'document', documentType: 'identity', side: 'front' },
      { id: nextId(), kind: 'document', documentType: 'identity', side: 'back' },
      { id: nextId(), kind: 'document', documentType: 'organisation_doc', side: 'front' },
      { id: nextId(), kind: 'document', documentType: 'proof_of_address', side: 'front' },
      { id: nextId(), kind: 'biometric', documentType: 'identity', side: 'front' },
    ],
  },
];

export default function FullFlowPage() {
  const apiBaseUrl =
    process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.usesense.ai/v1';
  const defaultApiKey = process.env.NEXT_PUBLIC_DEMO_API_KEY || '';

  const [apiKey, setApiKey] = useState(defaultApiKey);
  const [drafts, setDrafts] = useState<StepDraft[]>(PRESETS[2].build());
  const [running, setRunning] = useState(false);
  const [tracerRunning, setTracerRunning] = useState(false);
  const [tracerSession, setTracerSession] = useState<CaptureSessionData | null>(null);
  const [result, setResult] = useState<MixedFlowResult | null>(null);
  const [tracerResult, setTracerResult] = useState<CaptureResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  const environment = useMemo(() => detectEnvironmentFromKey(apiKey), [apiKey]);
  const steps = useMemo(() => drafts.map(draftToStep), [drafts]);
  const canStart = drafts.length > 0 && apiKey.length > 0;

  const log = useCallback((msg: string) => {
    const ts = new Date().toISOString().slice(11, 23);
    setLogs((prev) => [`[${ts}] ${msg}`, ...prev]);
  }, []);

  const updateDraft = (id: string, patch: Partial<StepDraft>) => {
    setDrafts((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  };
  const removeDraft = (id: string) => setDrafts((prev) => prev.filter((d) => d.id !== id));
  const moveDraft = (id: string, dir: -1 | 1) => {
    setDrafts((prev) => {
      const i = prev.findIndex((d) => d.id === id);
      if (i < 0) return prev;
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const copy = prev.slice();
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });
  };
  const addStep = (kind: 'biometric' | 'document') => {
    setDrafts((prev) => [
      ...prev,
      { id: nextId(), kind, documentType: 'identity', side: 'front' },
    ]);
  };

  const resolveBiometricSession = useCallback(async (): Promise<CaptureSessionData> => {
    log('Resolving biometric session (mock)');
    return makeMockBiometricSession();
  }, [log]);

  const handleStart = () => {
    setResult(null);
    setError(null);
    setLogs([]);
    log(`Starting flow with ${drafts.length} step(s)`);
    setRunning(true);
  };

  const handleComplete = useCallback(
    (r: MixedFlowResult) => {
      log(`Flow complete with ${r.steps.length} result(s)`);
      setResult(r);
      setRunning(false);
    },
    [log],
  );

  const handleError = useCallback(
    (msg: string) => {
      log(`Error: ${msg}`);
      setError(msg);
      setRunning(false);
    },
    [log],
  );

  const handleCancel = useCallback(() => {
    log('Cancelled by user');
    setRunning(false);
  }, [log]);

  const startTracer = () => {
    setTracerResult(null);
    setError(null);
    setLogs([]);
    const session = makeMockBiometricSession();
    log(`Starting straight-line tracer: session=${session.session_id}`);
    setTracerSession(session);
    setTracerRunning(true);
  };

  const handleTracerComplete = useCallback(
    (r: CaptureResult) => {
      log(`Tracer complete: decision=${r.decision}`);
      setTracerResult(r);
      setTracerRunning(false);
    },
    [log],
  );

  const handleTracerError = useCallback(
    (msg: string) => {
      log(`Tracer error: ${msg}`);
      setError(msg);
      setTracerRunning(false);
    },
    [log],
  );

  const handleTracerCancel = useCallback(() => {
    log('Tracer cancelled by user');
    setTracerRunning(false);
  }, [log]);

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div>
          <span style={styles.title}>
            <span>Use</span>
            <span style={{ color: PRIMARY }}>Sense</span> Mixed Flow Demo
          </span>
          <span style={styles.badge}>VerificationFlow</span>
        </div>
        <div style={{ display: 'flex', gap: 16, fontSize: '0.82rem' }}>
          <a href="/" style={{ color: '#6B6760', textDecoration: 'none' }}>
            ← Biometric demo
          </a>
          <a href="/document" style={{ color: '#6B6760', textDecoration: 'none' }}>
            ← Document demo
          </a>
        </div>
      </header>

      <main style={styles.content}>
        <div style={styles.notice}>
          Compose a flow from biometric and document steps in any order.
          Document API calls hit <code>{apiBaseUrl}</code>; the backend
          <code> /v1/documents</code> is not deployed yet, so document steps
          will surface a session-creation error today. The biometric step
          uses a mock session and runs end-to-end.
        </div>

        <div style={styles.card}>
          <div style={styles.cardTitle}>1. Configuration</div>
          <div style={styles.fieldGrid}>
            <div>
              <label style={styles.label}>API Key</label>
              <input
                style={styles.input}
                type="password"
                placeholder="sk-..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
            </div>
            <div>
              <label style={styles.label}>Environment (inferred)</label>
              <input style={{ ...styles.input, opacity: 0.6 }} value={environment} readOnly />
            </div>
          </div>
        </div>

        <div style={styles.card}>
          <div style={styles.cardTitle}>2. Presets</div>
          <div>
            {PRESETS.map((p) => (
              <button
                key={p.name}
                style={{ ...styles.secondaryBtn, ...styles.preset }}
                onClick={() => setDrafts(p.build())}
                type="button"
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>

        <div style={styles.card}>
          <div style={styles.cardTitle}>3. Steps ({drafts.length})</div>
          {drafts.length === 0 && (
            <div style={{ color: '#6B6760', fontSize: '0.85rem', marginBottom: 12 }}>
              No steps yet. Pick a preset or add one below.
            </div>
          )}
          {drafts.map((d, i) => (
            <div key={d.id} style={styles.stepRow}>
              <div style={{ fontSize: '0.78rem', color: '#6B6760' }}>{i + 1}</div>
              <div>
                <select
                  style={styles.select}
                  value={d.kind}
                  onChange={(e) =>
                    updateDraft(d.id, { kind: e.target.value as StepDraft['kind'] })
                  }
                >
                  <option value="biometric">Biometric</option>
                  <option value="document">Document</option>
                </select>
              </div>
              <div>
                <select
                  style={{ ...styles.select, opacity: d.kind === 'document' ? 1 : 0.4 }}
                  value={d.documentType}
                  disabled={d.kind !== 'document'}
                  onChange={(e) =>
                    updateDraft(d.id, { documentType: e.target.value as DocumentType })
                  }
                >
                  <option value="identity">identity</option>
                  <option value="passport">passport</option>
                  <option value="organization">organization</option>
                  <option value="address">address</option>
                </select>
              </div>
              <div>
                <select
                  style={{ ...styles.select, opacity: d.kind === 'document' ? 1 : 0.4 }}
                  value={d.side}
                  disabled={d.kind !== 'document'}
                  onChange={(e) =>
                    updateDraft(d.id, { side: e.target.value as DocumentSide })
                  }
                >
                  <option value="front">front</option>
                  <option value="back">back</option>
                </select>
              </div>
              <button
                type="button"
                style={styles.secondaryBtn}
                onClick={() => moveDraft(d.id, -1)}
                disabled={i === 0}
                aria-label="Move up"
              >
                ↑
              </button>
              <button
                type="button"
                style={styles.secondaryBtn}
                onClick={() => moveDraft(d.id, 1)}
                disabled={i === drafts.length - 1}
                aria-label="Move down"
              >
                ↓
              </button>
              <button
                type="button"
                style={styles.secondaryBtn}
                onClick={() => removeDraft(d.id)}
                aria-label="Remove"
              >
                ✕
              </button>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button
              type="button"
              style={styles.secondaryBtn}
              onClick={() => addStep('biometric')}
            >
              + Biometric
            </button>
            <button
              type="button"
              style={styles.secondaryBtn}
              onClick={() => addStep('document')}
            >
              + Document
            </button>
          </div>
        </div>

        <div style={styles.card}>
          <div style={styles.cardTitle}>4. Run</div>
          <button
            type="button"
            style={styles.primaryBtn(!canStart || running)}
            disabled={!canStart || running}
            onClick={handleStart}
          >
            {running ? 'Running…' : `Start ${drafts.length}-step flow`}
          </button>
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #E8E5DE' }}>
            <div style={{ fontSize: '0.78rem', color: '#6B6760', marginBottom: 8 }}>
              Tracer-bullet (bypasses VerificationFlow): straight-line biometric path,
              challenge_type=&quot;none&quot; only, mock session.
            </div>
            <button
              type="button"
              style={{ ...styles.secondaryBtn, height: 40 }}
              disabled={tracerRunning}
              onClick={startTracer}
            >
              {tracerRunning ? 'Tracer running…' : 'Start straight-line tracer'}
            </button>
          </div>
        </div>

        {error && (
          <div
            style={{
              ...styles.card,
              borderColor: 'rgba(255,107,74,0.2)',
              background: 'rgba(255,107,74,0.06)',
              color: '#B73520',
            }}
          >
            <strong>Error:</strong> {error}
          </div>
        )}

        {result && (
          <div style={styles.card}>
            <div style={styles.cardTitle}>Result ({result.steps.length} step(s))</div>
            <pre style={styles.json}>{JSON.stringify(result, null, 2)}</pre>
          </div>
        )}

        <div style={styles.card}>
          <div style={styles.cardTitle}>Debug Logs ({logs.length})</div>
          <div
            style={{
              background: '#1C1A17',
              borderRadius: 14,
              padding: 16,
              maxHeight: 260,
              overflowY: 'auto',
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '0.78rem',
              color: '#D0CCBF',
            }}
          >
            {logs.length === 0 ? <div style={{ color: '#6B6760' }}>No events yet.</div> : null}
            {logs.map((l, i) => (
              <div key={i} style={{ whiteSpace: 'pre-wrap' }}>
                {l}
              </div>
            ))}
          </div>
        </div>

        <div style={styles.card}>
          <div style={styles.cardTitle}>Computed FlowStep[] (for reference)</div>
          <pre style={styles.json}>{JSON.stringify(steps, null, 2)}</pre>
        </div>
      </main>

      {running && (
        <VerificationFlow
          steps={steps}
          apiKey={apiKey}
          apiBaseUrl={apiBaseUrl}
          environment={environment}
          resolveBiometricSession={resolveBiometricSession}
          primaryColor={PRIMARY}
          onComplete={handleComplete}
          onError={handleError}
          onCancel={handleCancel}
        />
      )}

      {tracerRunning && tracerSession && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(28,26,23,0.92)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div style={{ background: '#fff', borderRadius: 14, padding: 24 }}>
            <StraightLineCaptureEngine
              sessionData={tracerSession}
              environment={environment}
              apiBaseUrl={apiBaseUrl}
              primaryColor={PRIMARY}
              onComplete={handleTracerComplete}
              onError={handleTracerError}
              onCancel={handleTracerCancel}
              onPhaseChange={(p, l) => log(`tracer phase: ${p} -- ${l}`)}
            />
          </div>
        </div>
      )}

      {tracerResult && (
        <div style={{ ...styles.content }}>
          <div style={styles.card}>
            <div style={styles.cardTitle}>Tracer result</div>
            <pre style={styles.json}>{JSON.stringify(tracerResult, null, 2)}</pre>
          </div>
        </div>
      )}
    </div>
  );
}
