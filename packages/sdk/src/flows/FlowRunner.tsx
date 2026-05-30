/**
 * FlowRunner.tsx — React component that drives a Flow Run end to end.
 *
 * One state machine, four surfaces (face / document / form / consent), one
 * authoritative outcome. The action loop mirrors the watchtower hosted runner
 * (frontend/src/app/pages/hosted-flow-runner-page.tsx) so the subject UX is
 * identical across the dashboard hosted page and any in-app SDK embedding.
 *
 * Face capture reuses the existing VerificationCaptureEngine — the SDK ships
 * a single liveness engine and Sessions and Flows both call into it.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { VerificationCaptureEngine } from '../components/VerificationCaptureEngine';
import type { CaptureSessionData } from '../types';
import { createFlowsClient } from './client';
import { FlowError, type FlowRunResult, type FlowRunView, type PendingAction, type RunFlowOptions } from './types';

const TERMINAL_STATES = new Set(['completed', 'errored', 'cancelled', 'abandoned']);
const DEFAULT_PRIMARY = '#4F7CFF';

export interface FlowRunnerProps {
  options: RunFlowOptions;
  onResult: (result: FlowRunResult) => void;
  onError: (error: FlowError) => void;
}

export function FlowRunner({ options, onResult, onError }: FlowRunnerProps) {
  const clientRef = useRef(createFlowsClient(options));
  const [view, setView] = useState<FlowRunView | null>(null);
  const [busy, setBusy] = useState(false);
  const [captureSession, setCaptureSession] = useState<CaptureSessionData | null>(null);

  const fail = useCallback((err: unknown) => {
    onError(err instanceof FlowError ? err : new FlowError('unknown', err instanceof Error ? err.message : 'Unknown error'));
  }, [onError]);

  const advance = useCallback(async (inputs: Record<string, unknown> = {}) => {
    setBusy(true);
    try {
      const next = await clientRef.current.advance(inputs);
      setView(next);
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  }, [fail]);

  // Initial state load + auto-start if the run was just created.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const v = await clientRef.current.get();
        if (cancelled) return;
        setView(v);
        if (v.flowRun.state === 'pending' && !v.flowRun.pendingAction) {
          await advance();
        }
      } catch (e) { if (!cancelled) fail(e); }
    })();
    return () => { cancelled = true; };
  }, [advance, fail]);

  // Resolve when the run reaches a terminal state.
  useEffect(() => {
    if (!view) return;
    if (TERMINAL_STATES.has(view.flowRun.state)) {
      onResult({ flowRunId: view.flowRun.id, state: view.flowRun.state, outcome: view.flowRun.outcome });
    }
  }, [view, onResult]);

  if (!view) return <LoadingScreen primary={DEFAULT_PRIMARY} />;

  const brand = view.branding;
  const primary = brand?.primary_color || DEFAULT_PRIMARY;

  if (TERMINAL_STATES.has(view.flowRun.state)) {
    return <TerminalScreen outcome={view.flowRun.outcome} state={view.flowRun.state} brand={brand} primary={primary} />;
  }

  // Face capture: hand off to the existing engine; advance with the produced refs.
  if (captureSession) {
    return (
      <VerificationCaptureEngine
        sessionData={captureSession}
        environment={view.flowRun.environment === 'sandbox' ? 'sandbox' : 'production'}
        apiBaseUrl={options.apiBaseUrl ? `${options.apiBaseUrl.replace(/\/+$/, '')}/v1` : undefined}
        primaryColor={primary}
        onComplete={(result) => {
          const identityId = (result as { identity_id?: string }).identity_id;
          setCaptureSession(null);
          void advance({ sessionId: captureSession.session_id, identityId });
        }}
        onError={(msg) => { setCaptureSession(null); fail(new FlowError('provider_unavailable', msg)); }}
      />
    );
  }

  const action = view.flowRun.pendingAction;
  if (busy || !action) return <LoadingScreen primary={primary} brand={brand} />;

  return (
    <Frame brand={brand} onCancel={() => {
      void clientRef.current.cancel().then(setView).catch(fail);
      options.onCancel?.();
    }}>
      <Surface
        action={action}
        primary={primary}
        busy={busy}
        onStartFace={async (toolId) => {
          setBusy(true);
          try {
            const s = await clientRef.current.initSession(toolId);
            setCaptureSession({
              session_id: s.session_id, session_token: s.session_token, nonce: s.nonce,
              policy: s.policy as CaptureSessionData['policy'],
              upload: s.upload as CaptureSessionData['upload'],
              geometric_coherence: (s.geometric_coherence as CaptureSessionData['geometric_coherence']) ?? null,
            });
          } catch (e) { fail(e); } finally { setBusy(false); }
        }}
        onSubmitForm={(values) => void advance(values)}
        onSubmitConsent={() => void advance()}
        onUploadDocument={async (data, mimeType, documentType) => {
          setBusy(true);
          try {
            const r = await clientRef.current.uploadDocument({ data, mimeType, side: 'single', documentType });
            if (r.status === 'failed') {
              fail(new FlowError(r.reason === 'provider' ? 'provider_unavailable' : 'unknown',
                r.reason === 'provider'
                  ? 'Verification is temporarily unavailable.'
                  : "We couldn't read that document. Please retake it."));
              return;
            }
            await advance({ document_id: r.document_id });
          } catch (e) { fail(e); } finally { setBusy(false); }
        }}
        onUnsupported={() => fail(new FlowError('unsupported_action', `Unsupported pendingAction.kind: ${action.kind}`))}
      />
    </Frame>
  );
}

// ─── Surfaces ────────────────────────────────────────────────────────────────

interface SurfaceProps {
  action: PendingAction;
  primary: string;
  busy: boolean;
  onStartFace: (toolId?: string) => void;
  onSubmitForm: (values: Record<string, string>) => void;
  onSubmitConsent: () => void;
  onUploadDocument: (base64: string, mimeType: string, documentType?: string) => void;
  onUnsupported: () => void;
}

function Surface(props: SurfaceProps) {
  const { action } = props;
  if (action.kind === 'capture' && action.capture === 'face') {
    return <FacePrimer color={props.primary} busy={props.busy} onStart={() => props.onStartFace(action.toolId)} />;
  }
  if (action.kind === 'capture' && action.capture === 'form') {
    return <FormSurface fields={action.fields} color={props.primary} busy={props.busy} onSubmit={props.onSubmitForm} />;
  }
  if (action.kind === 'capture' && action.capture === 'document') {
    return <DocumentSurface
      documentCategory={action.documentCategory}
      documentTypes={action.documentTypes ?? []}
      color={props.primary}
      busy={props.busy}
      onUpload={props.onUploadDocument}
    />;
  }
  if (action.kind === 'redirect_to_consent') {
    return <ConsentSurface consentUrl={action.consentUrl} color={props.primary} busy={props.busy} onConfirm={props.onSubmitConsent} />;
  }
  // Future kinds the SDK doesn't recognise — fail-fast per the spec.
  props.onUnsupported();
  return null;
}

function FacePrimer({ color, busy, onStart }: { color: string; busy: boolean; onStart: () => void }) {
  return (
    <Centered title="Take a selfie" subtitle="A quick face scan confirms you're a real, live person.">
      <PrimaryButton color={color} disabled={busy} onClick={onStart}>{busy ? 'Please wait…' : 'Start face scan'}</PrimaryButton>
    </Centered>
  );
}

function FormSurface({ fields, color, busy, onSubmit }: { fields: string[]; color: string; busy: boolean; onSubmit: (values: Record<string, string>) => void }) {
  const [values, setValues] = useState<Record<string, string>>({});
  const missing = fields.filter((k) => !values[k]?.trim());
  return (
    <form
      style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', maxWidth: 380 }}
      onSubmit={(e) => { e.preventDefault(); if (missing.length === 0) onSubmit(values); }}
    >
      <h1 style={{ fontSize: 24, fontWeight: 600, margin: 0 }}>A few details</h1>
      {fields.map((key) => (
        <label key={key} style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 14 }}>
          <span style={{ fontWeight: 500 }}>{humanise(key)}</span>
          <input
            style={{ padding: '10px 12px', border: '1px solid #ddd', borderRadius: 8, fontSize: 16 }}
            value={values[key] ?? ''}
            onChange={(e) => setValues((p) => ({ ...p, [key]: e.target.value }))}
            disabled={busy}
          />
        </label>
      ))}
      <PrimaryButton color={color} disabled={busy || missing.length > 0}>{busy ? 'Submitting…' : 'Continue'}</PrimaryButton>
    </form>
  );
}

function DocumentSurface({ documentCategory, documentTypes, color, busy, onUpload }: {
  documentCategory: string; documentTypes: string[]; color: string; busy: boolean;
  onUpload: (base64: string, mimeType: string, documentType?: string) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  function pick() { ref.current?.click(); }
  function chosen(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result);
      const base64 = dataUrl.split(',')[1] ?? '';
      onUpload(base64, file.type || 'image/jpeg', documentCategory);
    };
    reader.readAsDataURL(file);
  }
  const label = documentTypes[0] ?? humanise(documentCategory);
  return (
    <Centered title={`Upload your ${label.toLowerCase()}`} subtitle="A clear photo of the document, with all four corners visible.">
      <input
        ref={ref}
        type="file"
        accept="image/jpeg,image/png,application/pdf"
        style={{ display: 'none' }}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) chosen(f); e.target.value = ''; }}
      />
      <PrimaryButton color={color} disabled={busy} onClick={pick}>{busy ? 'Uploading…' : 'Choose a file'}</PrimaryButton>
    </Centered>
  );
}

function ConsentSurface({ consentUrl, color, busy, onConfirm }: { consentUrl: string; color: string; busy: boolean; onConfirm: () => void }) {
  return (
    <Centered title="Consent required" subtitle="Open the secure consent page, grant consent, then come back and continue.">
      <a href={consentUrl} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
        <PrimaryButton color={color}>Open consent page</PrimaryButton>
      </a>
      <SecondaryButton onClick={onConfirm} disabled={busy}>I've granted consent</SecondaryButton>
    </Centered>
  );
}

// ─── Layout primitives ───────────────────────────────────────────────────────

function Frame({ brand, onCancel, children }: { brand: FlowRunView['branding']; onCancel: () => void; children: React.ReactNode }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#fff', display: 'flex', flexDirection: 'column', zIndex: 2147483600, fontFamily: 'system-ui, sans-serif' }}>
      <Header brand={brand} onCancel={onCancel} />
      <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>{children}</main>
      <Footer brand={brand} />
    </div>
  );
}

function LoadingScreen({ primary, brand }: { primary: string; brand?: FlowRunView['branding'] }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#fff', display: 'flex', flexDirection: 'column', zIndex: 2147483600 }}>
      {brand && <Header brand={brand} />}
      <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spinner color={primary} />
      </main>
      {brand && <Footer brand={brand} />}
    </div>
  );
}

function TerminalScreen({ outcome, state, brand, primary }: { outcome: string | null; state: string; brand: FlowRunView['branding']; primary: string }) {
  const approved = outcome === 'APPROVE';
  const review = outcome === 'MANUAL_REVIEW';
  const title = approved ? 'Verification complete' : review ? 'Under review' : state === 'cancelled' ? 'Cancelled' : 'Not verified';
  const subtitle = approved
    ? 'Thank you. You can close this page.'
    : review
      ? 'Your details are being reviewed.'
      : state === 'cancelled'
        ? 'No problem — you can try again whenever you are ready.'
        : 'We could not complete your verification.';
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#fff', display: 'flex', flexDirection: 'column', zIndex: 2147483600 }}>
      <Header brand={brand} />
      <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Centered title={title} subtitle={subtitle}>
          {approved && brand?.redirect_url && (
            <a href={brand.redirect_url} style={{ textDecoration: 'none' }}>
              <PrimaryButton color={primary}>Continue</PrimaryButton>
            </a>
          )}
        </Centered>
      </main>
      <Footer brand={brand} />
    </div>
  );
}

function Header({ brand, onCancel }: { brand: FlowRunView['branding']; onCancel?: () => void }) {
  const name = brand?.display_name || 'UseSense';
  return (
    <div style={{ height: 56, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', borderBottom: '1px solid #eee' }}>
      {brand?.logo_url
        ? <img src={brand.logo_url} alt={name} style={{ height: 28, maxWidth: 160, objectFit: 'contain' }} />
        : <span style={{ fontWeight: 600 }}>{name}</span>}
      {onCancel && (
        <button onClick={onCancel} aria-label="Cancel" style={{ position: 'absolute', right: 16, background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 14 }}>Cancel</button>
      )}
    </div>
  );
}

function Footer({ brand }: { brand: FlowRunView['branding'] }) {
  const co = brand?.display_name && brand.display_name !== 'UseSense' ? `${brand.display_name} · UseSense` : 'UseSense';
  return <div style={{ padding: 12, textAlign: 'center', fontSize: 11, color: '#888' }}>Secured by {co}</div>;
}

function Centered({ title, subtitle, children }: { title: string; subtitle?: string; children?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, maxWidth: 380, textAlign: 'center' }}>
      <h1 style={{ fontSize: 24, fontWeight: 600, margin: 0 }}>{title}</h1>
      {subtitle && <p style={{ color: '#555', margin: 0 }}>{subtitle}</p>}
      {children && <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>{children}</div>}
    </div>
  );
}

function PrimaryButton({ color, disabled, onClick, children }: { color: string; disabled?: boolean; onClick?: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} disabled={disabled} type={onClick ? 'button' : 'submit'} style={{
      background: color, color: '#fff', border: 'none', borderRadius: 10, padding: '14px 16px',
      fontSize: 16, fontWeight: 600, cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.6 : 1, width: '100%',
    }}>{children}</button>
  );
}

function SecondaryButton({ onClick, disabled, children }: { onClick?: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button onClick={onClick} disabled={disabled} type="button" style={{
      background: '#f5f5f5', color: '#333', border: 'none', borderRadius: 10, padding: '14px 16px',
      fontSize: 16, fontWeight: 600, cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.6 : 1, width: '100%',
    }}>{children}</button>
  );
}

function Spinner({ color }: { color: string }) {
  return (
    <div style={{
      width: 32, height: 32, border: `3px solid ${color}20`, borderTopColor: color,
      borderRadius: '50%', animation: 'usesense-flow-spin 0.9s linear infinite',
    }}>
      <style>{`@keyframes usesense-flow-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function humanise(s: string): string {
  return s.replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/\b\w/g, (c) => c.toUpperCase());
}
