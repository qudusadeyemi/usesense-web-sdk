'use client';

/**
 * /flows -- interactive flow configuration demo
 *
 * Shows every supported flow mode:
 *   1. Document only         -- single DocumentCapture step, no biometrics
 *   2. Biometric only        -- single liveness step, no documents
 *   3. Biometric then doc    -- liveness first, document second
 *   4. Doc then biometric    -- document first, liveness second
 *   5. Multi-doc             -- front + back of an identity card, no biometrics
 *
 * All flows run through <VerificationFlow/> except "document only", which
 * uses <DocumentCapture/> + submitDocumentImage directly to show the
 * lower-level API.
 */

import { useCallback, useMemo, useState } from 'react';
import {
  detectEnvironmentFromKey,
  startDocumentExtraction,
  submitDocumentImage,
  prepareDocumentImage,
  DocumentCapture,
  VerificationFlow,
} from '@usesense/web-sdk';
import type {
  DocumentResult,
  DocumentSide,
  DocumentType,
  IdSubtype,
  FlowStep,
  MixedFlowResult,
  CaptureSessionData,
} from '@usesense/web-sdk';

// ---------------------------------------------------------------------------
// Flow presets
// ---------------------------------------------------------------------------

type FlowPreset = {
  id: string;
  label: string;
  description: string;
  steps: FlowStep[] | null; // null = document-only (raw API)
};

const PRESETS: FlowPreset[] = [
  {
    id: 'doc-only',
    label: 'Document only',
    description: 'Single document capture via <DocumentCapture/> + submitDocumentImage directly. No biometrics.',
    steps: null,
  },
  {
    id: 'biometric-only',
    label: 'Biometric only',
    description: 'Single liveness check via <VerificationFlow/>. No documents.',
    steps: [{ kind: 'biometric' }],
  },
  {
    id: 'biometric-then-doc',
    label: 'Biometric then document',
    description: 'Liveness first, then passport front capture.',
    steps: [
      { kind: 'biometric' },
      { kind: 'document', documentType: 'identity', idSubtype: 'passport', side: 'front' },
    ],
  },
  {
    id: 'doc-then-biometric',
    label: 'Document then biometric',
    description: 'Passport front first, then liveness check.',
    steps: [
      { kind: 'document', documentType: 'identity', idSubtype: 'passport', side: 'front' },
      { kind: 'biometric' },
    ],
  },
  {
    id: 'multi-doc',
    label: 'Multi-document (front + back)',
    description: 'Front then back of a driver\'s licence. No biometrics.',
    steps: [
      { kind: 'document', documentType: 'identity', idSubtype: 'drivers_license', side: 'front' },
      { kind: 'document', documentType: 'identity', idSubtype: 'drivers_license', side: 'back' },
    ],
  },
  {
    id: 'kyb',
    label: 'KYB: organisation doc + proof of address',
    description: 'Business document followed by a proof of address.',
    steps: [
      { kind: 'document', documentType: 'organisation_doc', side: 'front' },
      { kind: 'document', documentType: 'proof_of_address', side: 'front' },
    ],
  },
];

// ---------------------------------------------------------------------------
// Mock biometric session (mirrors page.tsx)
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
      challenge_type: 'head_turn',
      challenge: {
        type: 'head_turn',
        seed: 'mock_seed',
        sequence: [
          { direction: 'left', duration_ms: 1500, index: 0 },
          { direction: 'center', duration_ms: 1000, index: 1 },
          { direction: 'right', duration_ms: 1500, index: 2 },
        ],
        total_duration_ms: 4000,
      },
    },
  };
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const C = {
  bg: '#FDFCFA',
  surface: '#FFFFFF',
  border: '#E8E5DE',
  muted: '#6B6760',
  text: '#1C1A17',
  accent: '#4F7CFF',
  success: '#00D4AA',
  danger: '#FF6B4A',
  warn: '#FFB84D',
} as const;

const s = {
  page: { display: 'flex', flexDirection: 'column' as const, minHeight: '100vh', fontFamily: "'DM Sans', sans-serif", background: C.bg, color: C.text },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 32px', background: C.surface, borderBottom: `1px solid ${C.border}`, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' },
  title: { fontSize: '1rem', fontWeight: 700, fontFamily: "'Outfit', sans-serif", letterSpacing: '-0.02em' },
  badge: { fontSize: '0.72rem', fontWeight: 600, fontFamily: "'JetBrains Mono', monospace", background: 'rgba(79,124,255,0.08)', color: C.accent, padding: '4px 10px', borderRadius: '6px', marginLeft: '10px', border: '1px solid rgba(79,124,255,0.2)' },
  nav: { fontSize: '0.82rem', fontWeight: 600, color: C.muted, textDecoration: 'none' as const },
  content: { maxWidth: '900px', width: '100%', margin: '0 auto', padding: '32px 24px' },
  card: { background: C.surface, borderRadius: '14px', border: `1px solid ${C.border}`, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', padding: '28px', marginBottom: '20px' },
  cardTitle: { fontSize: '1rem', fontWeight: 700, fontFamily: "'Outfit', sans-serif", letterSpacing: '-0.02em', marginBottom: '20px', color: C.text },
  label: { display: 'block', fontSize: '0.72rem', fontWeight: 600, color: C.muted, marginBottom: '6px', textTransform: 'uppercase' as const, letterSpacing: '0.06em', fontFamily: "'DM Sans', sans-serif" },
  input: { width: '100%', height: '44px', padding: '0 16px', border: `1px solid ${C.border}`, borderRadius: '10px', fontSize: '0.88rem', fontFamily: "'DM Sans', sans-serif", outline: 'none', boxSizing: 'border-box' as const, background: C.surface, color: C.text },
  select: { width: '100%', height: '44px', padding: '0 16px', border: `1px solid ${C.border}`, borderRadius: '10px', fontSize: '0.88rem', fontFamily: "'DM Sans', sans-serif", outline: 'none', background: C.surface, color: C.text, cursor: 'pointer', boxSizing: 'border-box' as const },
  presetGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '12px', marginBottom: '8px' },
  presetCard: (active: boolean): React.CSSProperties => ({
    border: `2px solid ${active ? C.accent : C.border}`,
    borderRadius: '12px',
    padding: '16px',
    cursor: 'pointer',
    background: active ? 'rgba(79,124,255,0.04)' : C.surface,
    transition: 'border-color 150ms ease, background 150ms ease',
  }),
  presetLabel: (active: boolean): React.CSSProperties => ({
    fontSize: '0.88rem',
    fontWeight: 700,
    color: active ? C.accent : C.text,
    marginBottom: '6px',
    fontFamily: "'Outfit', sans-serif",
  }),
  presetDesc: { fontSize: '0.78rem', color: C.muted, lineHeight: '1.5', fontFamily: "'DM Sans', sans-serif" },
  stepPills: { display: 'flex', gap: '8px', flexWrap: 'wrap' as const, marginTop: '16px' },
  pill: (kind: string): React.CSSProperties => ({
    fontSize: '0.72rem',
    fontWeight: 600,
    fontFamily: "'JetBrains Mono', monospace",
    padding: '4px 10px',
    borderRadius: '6px',
    background: kind === 'biometric' ? 'rgba(0,212,170,0.1)' : 'rgba(79,124,255,0.1)',
    color: kind === 'biometric' ? '#008066' : C.accent,
    border: `1px solid ${kind === 'biometric' ? 'rgba(0,212,170,0.2)' : 'rgba(79,124,255,0.2)'}`,
  }),
  primaryBtn: (disabled: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: '100%', height: '44px', padding: '0 24px', border: 'none', borderRadius: '10px',
    fontSize: '0.88rem', fontWeight: 600, fontFamily: "'DM Sans', sans-serif",
    cursor: disabled ? 'not-allowed' : 'pointer',
    background: disabled ? '#9E9A92' : C.accent,
    color: '#FFFFFF', opacity: disabled ? 0.4 : 1, marginTop: '8px',
  }),
  errorCard: { background: 'rgba(255,107,74,0.06)', border: '1px solid rgba(255,107,74,0.2)', borderRadius: '14px', padding: '20px 24px', marginBottom: '20px', color: '#B73520', fontSize: '0.85rem', fontFamily: "'DM Sans', sans-serif" },
  successCard: { background: 'rgba(0,212,170,0.06)', border: '1px solid rgba(0,212,170,0.2)', borderRadius: '14px', padding: '20px 24px', marginBottom: '20px' },
  json: { background: '#F5F3EF', borderRadius: '10px', padding: '14px', fontFamily: "'JetBrains Mono', monospace", fontSize: '0.75rem', color: C.text, overflowX: 'auto' as const, margin: 0, whiteSpace: 'pre-wrap' as const, wordBreak: 'break-all' as const },
  debugPanel: { background: '#1C1A17', borderRadius: '14px', padding: '16px', maxHeight: '240px', overflowY: 'auto' as const, fontFamily: "'JetBrains Mono', monospace", fontSize: '0.78rem', lineHeight: '1.8' },
  debugLine: { color: '#D0CCBF', whiteSpace: 'pre-wrap' as const, wordBreak: 'break-all' as const },
  fieldGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' },
  docOnlyGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '16px' },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function FlowsDemoPage() {
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.usesense.ai/v1';
  const defaultApiKey = process.env.NEXT_PUBLIC_DEMO_API_KEY || '';

  const [apiKey, setApiKey] = useState(defaultApiKey);
  const [selectedPreset, setSelectedPreset] = useState<FlowPreset>(PRESETS[0]!);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<MixedFlowResult | DocumentResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  // Doc-only state
  const [docType, setDocType] = useState<DocumentType>('identity');
  const [docSubtype, setDocSubtype] = useState<IdSubtype>('passport');
  const [docSide, setDocSide] = useState<DocumentSide>('front');

  const environment = useMemo(() => detectEnvironmentFromKey(apiKey), [apiKey]);

  const log = useCallback((msg: string) => {
    const ts = new Date().toISOString().slice(11, 23);
    setLogs((p) => [`[${ts}] ${msg}`, ...p]);
  }, []);

  const resolveBiometricSession = useCallback(async (): Promise<CaptureSessionData> => {
    log('Resolving biometric session (mock)...');
    // In production, call your backend here to create a session.
    await new Promise((r) => setTimeout(r, 300));
    const session = makeMockBiometricSession();
    log(`Biometric session ready: ${session.session_id}`);
    return session;
  }, [log]);

  // -- Doc-only flow (raw API, no VerificationFlow) -------------------------
  const handleDocOnlyCapture = useCallback(
    async (blob: Blob, side: DocumentSide) => {
      log(`Image captured (${side}), starting session...`);
      try {
        const session = await startDocumentExtraction({
          apiKey,
          apiBaseUrl,
          environment,
          documentType: docType,
          ...(docType === 'identity' ? { idSubtype: docSubtype } : {}),
        });
        log(`Session started: ${session.documentId}`);
        const prepared = await prepareDocumentImage({ source: blob });
        log(`Image prepared: ${prepared.width}x${prepared.height}, ${(prepared.byteLength / 1024).toFixed(1)} KB`);
        const submitted = await submitDocumentImage({
          apiKey,
          apiBaseUrl,
          environment,
          session,
          image: { blob: prepared.blob, width: prepared.width, height: prepared.height, byteLength: prepared.byteLength },
          side,
        });
        log(`Submitted: status=${submitted.status}`);
        setResult(submitted);
        setRunning(false);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        log(`Error: ${msg}`);
        setRunning(false);
      }
    },
    [apiKey, apiBaseUrl, environment, docType, docSubtype, log],
  );

  // -- Mixed flow callbacks ------------------------------------------------
  const handleFlowComplete = useCallback(
    (r: MixedFlowResult) => {
      log(`Flow complete. Steps: ${r.steps.length}`);
      setResult(r);
      setRunning(false);
    },
    [log],
  );

  const handleFlowError = useCallback(
    (msg: string) => {
      setError(msg);
      log(`Flow error: ${msg}`);
      setRunning(false);
    },
    [log],
  );

  const handleFlowCancel = useCallback(() => {
    log('Flow cancelled by user');
    setRunning(false);
  }, [log]);

  const startFlow = () => {
    setError(null);
    setResult(null);
    setRunning(true);
    log(`Starting flow: "${selectedPreset.label}"`);
  };

  const canStart = apiKey.length > 0 && !running;

  return (
    <div style={s.page}>
      <header style={s.header}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <span style={s.title}>
            <span style={{ color: C.text }}>Use</span>
            <span style={{ color: C.accent }}>Sense</span> Flow Configurations
          </span>
          <span style={s.badge}>/flows</span>
        </div>
        <div style={{ display: 'flex', gap: '16px' }}>
          <a href="/document" style={s.nav}>Document demo</a>
          <a href="/" style={s.nav}>Biometric demo</a>
        </div>
      </header>

      <main style={s.content}>

        {/* API Key */}
        <div style={s.card}>
          <div style={s.cardTitle}>Configuration</div>
          <div style={s.fieldGrid}>
            <div>
              <label style={s.label}>API Key</label>
              <input
                style={s.input}
                type="password"
                placeholder="sk-..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
            </div>
            <div>
              <label style={s.label}>Environment</label>
              <input style={{ ...s.input, opacity: 0.6 }} value={environment} readOnly />
            </div>
          </div>
        </div>

        {/* Preset picker */}
        <div style={s.card}>
          <div style={s.cardTitle}>Select a flow</div>
          <div style={s.presetGrid}>
            {PRESETS.map((p) => (
              <button
                key={p.id}
                style={{ ...s.presetCard(p.id === selectedPreset.id), textAlign: 'left', fontFamily: 'inherit' }}
                onClick={() => { setSelectedPreset(p); setResult(null); setError(null); }}
              >
                <div style={s.presetLabel(p.id === selectedPreset.id)}>{p.label}</div>
                <div style={s.presetDesc}>{p.description}</div>
                {p.steps && (
                  <div style={s.stepPills}>
                    {p.steps.map((step, i) => (
                      <span key={i} style={s.pill(step.kind)}>
                        {step.kind === 'biometric'
                          ? 'biometric'
                          : `${step.documentType}${step.kind === 'document' && step.idSubtype ? ` (${step.idSubtype})` : ''} · ${step.kind === 'document' ? step.side : ''}`}
                      </span>
                    ))}
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Doc-only options (shown only for that preset) */}
        {selectedPreset.id === 'doc-only' && (
          <div style={s.card}>
            <div style={s.cardTitle}>Document options</div>
            <div style={s.docOnlyGrid}>
              <div>
                <label style={s.label}>Document type</label>
                <select style={s.select} value={docType} onChange={(e) => setDocType(e.target.value as DocumentType)}>
                  <option value="identity">identity</option>
                  <option value="organisation_doc">organisation_doc</option>
                  <option value="proof_of_address">proof_of_address</option>
                  <option value="tax_doc">tax_doc</option>
                  <option value="invoice">invoice</option>
                </select>
              </div>
              {docType === 'identity' && (
                <div>
                  <label style={s.label}>ID subtype</label>
                  <select style={s.select} value={docSubtype} onChange={(e) => setDocSubtype(e.target.value as IdSubtype)}>
                    <option value="passport">passport</option>
                    <option value="drivers_license">drivers_license</option>
                    <option value="national_id">national_id</option>
                    <option value="residence_permit">residence_permit</option>
                  </select>
                </div>
              )}
              <div>
                <label style={s.label}>Side</label>
                <select style={s.select} value={docSide} onChange={(e) => setDocSide(e.target.value as DocumentSide)}>
                  <option value="front">front</option>
                  <option value="back">back</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Launch */}
        {!running && (
          <button style={s.primaryBtn(!canStart)} disabled={!canStart} onClick={startFlow}>
            Start: {selectedPreset.label}
          </button>
        )}

        {/* Errors */}
        {error && (
          <div style={{ ...s.errorCard, marginTop: '20px' }}>
            <div style={{ fontWeight: 700, marginBottom: '6px' }}>Error</div>
            <div>{error}</div>
            <button
              onClick={() => { setError(null); setRunning(false); }}
              style={{ marginTop: '12px', background: 'none', border: `1px solid rgba(255,107,74,0.4)`, borderRadius: '8px', padding: '6px 14px', color: '#B73520', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 }}
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Result */}
        {result && !running && (
          <div style={{ ...s.successCard, marginTop: '20px' }}>
            <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#008066', marginBottom: '12px', fontFamily: "'Outfit', sans-serif" }}>
              Flow complete
            </div>
            <pre style={s.json}>{JSON.stringify(result, null, 2)}</pre>
          </div>
        )}

        {/* Debug log */}
        <div style={{ ...s.card, marginTop: '20px' }}>
          <div style={s.cardTitle}>Debug logs ({logs.length})</div>
          <div style={s.debugPanel}>
            {logs.length === 0
              ? <div style={{ color: C.muted }}>No events yet.</div>
              : logs.map((l, i) => <div key={i} style={s.debugLine}>{l}</div>)
            }
          </div>
        </div>

      </main>

      {/* Running: doc-only */}
      {running && selectedPreset.id === 'doc-only' && (
        <DocumentCapture
          documentType={docType}
          idSubtype={docType === 'identity' ? docSubtype : undefined}
          side={docSide}
          primaryColor={C.accent}
          onCapture={handleDocOnlyCapture}
          onCancel={() => { log('Cancelled'); setRunning(false); }}
          onError={(msg) => { setError(msg); log(`Capture error: ${msg}`); setRunning(false); }}
        />
      )}

      {/* Running: VerificationFlow-based presets */}
      {running && selectedPreset.steps && (
        <VerificationFlow
          steps={selectedPreset.steps}
          apiKey={apiKey}
          apiBaseUrl={apiBaseUrl}
          environment={environment}
          resolveBiometricSession={resolveBiometricSession}
          primaryColor={C.accent}
          onComplete={handleFlowComplete}
          onError={handleFlowError}
          onCancel={handleFlowCancel}
        />
      )}
    </div>
  );
}
