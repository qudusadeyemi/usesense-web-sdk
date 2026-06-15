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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { VerificationCaptureEngine } from '../components/VerificationCaptureEngine';
import type { CaptureSessionData } from '../types';
import { createFlowsClient } from './client';
import { FlowError, type FlowRunResult, type FlowRunView, type FormField, type InfoAction, type InfoBulletIcon, type PendingAction, type RunFlowOptions } from './types';

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
  // Per-field server validation errors from the last advance(). Cleared on the
  // next success so a recovered form does not show stale highlights.
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const fail = useCallback((err: unknown) => {
    onError(err instanceof FlowError ? err : new FlowError('unknown', err instanceof Error ? err.message : 'Unknown error'));
  }, [onError]);

  const advance = useCallback(async (inputs: Record<string, unknown> = {}) => {
    setBusy(true);
    try {
      const next = await clientRef.current.advance(inputs);
      setView(next);
      setFieldErrors({});
    } catch (e) {
      // Server form validation: surface per-field errors inline instead of
      // terminating the run via onError. Other FlowErrors propagate.
      if (e instanceof FlowError && e.code === 'invalid_input' && e.details?.errors) {
        const next: Record<string, string> = {};
        for (const item of e.details.errors) next[item.field_key] = item.message;
        setFieldErrors(next);
        return;
      }
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
        fieldErrors={fieldErrors}
        onCancel={() => void clientRef.current.cancel().then(setView).catch(fail)}
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
  fieldErrors: Record<string, string>;
  onStartFace: (toolId?: string) => void;
  onSubmitForm: (values: Record<string, string | number | boolean>) => void;
  onSubmitConsent: () => void;
  onUploadDocument: (base64: string, mimeType: string, documentType?: string) => void;
  onCancel: () => void;
  onUnsupported: () => void;
}

function Surface(props: SurfaceProps) {
  const { action } = props;
  if (action.kind === 'capture' && action.capture === 'face') {
    return <FacePrimer color={props.primary} busy={props.busy} onStart={() => props.onStartFace(action.toolId)} />;
  }
  if (action.kind === 'capture' && action.capture === 'form') {
    return <FormSurface fields={action.fields} color={props.primary} busy={props.busy} serverErrors={props.fieldErrors} onSubmit={props.onSubmitForm} />;
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
  if (action.kind === 'info') {
    return <InfoSurface action={action} color={props.primary} busy={props.busy} onAdvance={props.onSubmitConsent} onCancel={props.onCancel} />;
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

// Normalise a heterogeneous fields array: a plain string becomes a minimal
// FormField (text input with humanised label); a FormField object passes
// through. Mirrors the server-side normaliseFormFields in the watchtower
// repo so client and server agree on the rendered shape.
function normaliseField(entry: string | FormField): FormField {
  if (typeof entry !== 'string') return entry;
  return { key: entry, type: 'text', label: humanise(entry), required: true };
}

/**
 * Client-side echo of the server's form-validation rules (RE2 pattern, length,
 * numeric/date range). The server is still authoritative — these checks just
 * give the subject inline feedback before a round-trip.
 */
function validateFieldValue(field: FormField, raw: string | boolean): string | null {
  const required = field.required !== false;
  const isBlank = typeof raw === 'boolean' ? false : raw === undefined || raw === null || String(raw).trim() === '';
  if (isBlank) return required ? `${field.label ?? field.key} is required` : null;
  const v = field.validators ?? {};
  const fail = (msg: string) => v.error_message ?? msg;
  if (typeof raw === 'string') {
    if (v.pattern) {
      try { if (!new RegExp(v.pattern).test(raw)) return fail(`${field.label ?? field.key} is not in the expected format`); } catch { /* trust server */ }
    }
    if (v.min_length !== undefined && raw.length < v.min_length) return fail(`Must be at least ${v.min_length} characters`);
    if (v.max_length !== undefined && raw.length > v.max_length) return fail(`Must be at most ${v.max_length} characters`);
  }
  if (field.type === 'number') {
    const n = Number(raw);
    if (Number.isNaN(n)) return fail(`${field.label ?? field.key} must be a number`);
    if (typeof v.min === 'number' && n < v.min) return fail(`Must be at least ${v.min}`);
    if (typeof v.max === 'number' && n > v.max) return fail(`Must be at most ${v.max}`);
  }
  if (field.type === 'date' && typeof raw === 'string') {
    if (typeof v.min === 'string' && raw < v.min) return fail(`Must be on or after ${v.min}`);
    if (typeof v.max === 'string' && raw > v.max) return fail(`Must be on or before ${v.max}`);
  }
  return null;
}

function FormSurface({ fields, color, busy, serverErrors, onSubmit }: {
  fields: (string | FormField)[]; color: string; busy: boolean;
  serverErrors: Record<string, string>;
  onSubmit: (values: Record<string, string | number | boolean>) => void;
}) {
  const normalised = useMemo(() => fields.map(normaliseField), [fields]);
  const initial = useMemo(() => {
    const out: Record<string, string | boolean> = {};
    for (const f of normalised) {
      if (f.initial !== undefined) out[f.key] = typeof f.initial === 'boolean' ? f.initial : String(f.initial);
      else if (f.type === 'checkbox') out[f.key] = false;
      else out[f.key] = '';
    }
    return out;
  }, [normalised]);
  const [values, setValues] = useState<Record<string, string | boolean>>(initial);
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});
  const set = (k: string, v: string | boolean) => {
    setValues((p) => ({ ...p, [k]: v }));
    setClientErrors((p) => p[k] ? { ...p, [k]: '' } : p);
  };

  const submit = () => {
    const next: Record<string, string> = {};
    for (const f of normalised) {
      const err = validateFieldValue(f, values[f.key] ?? '');
      if (err) next[f.key] = err;
    }
    if (Object.keys(next).length > 0) { setClientErrors(next); return; }
    // Coerce by type so the server receives the right primitive.
    const out: Record<string, string | number | boolean> = {};
    for (const f of normalised) {
      const raw = values[f.key];
      if (f.type === 'checkbox') out[f.key] = raw === true || raw === 'true';
      else if (f.type === 'number' && raw !== '' && raw !== undefined) out[f.key] = Number(raw);
      else out[f.key] = raw as string;
    }
    onSubmit(out);
  };

  return (
    <form
      style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', maxWidth: 380 }}
      onSubmit={(e) => { e.preventDefault(); submit(); }}
    >
      <h1 style={{ fontSize: 24, fontWeight: 600, margin: 0 }}>A few details</h1>
      {normalised.map((f) => (
        <FieldRow
          key={f.key}
          field={f}
          value={values[f.key] ?? (f.type === 'checkbox' ? false : '')}
          error={serverErrors[f.key] ?? clientErrors[f.key]}
          color={color}
          busy={busy}
          onChange={(v) => set(f.key, v)}
        />
      ))}
      <PrimaryButton color={color} disabled={busy}>{busy ? 'Submitting…' : 'Continue'}</PrimaryButton>
    </form>
  );
}

function FieldRow({ field, value, error, color, busy, onChange }: {
  field: FormField; value: string | boolean; error: string | undefined;
  color: string; busy: boolean; onChange: (v: string | boolean) => void;
}) {
  const label = field.label ?? humanise(field.key);
  const required = field.required !== false;
  const inputStyle: React.CSSProperties = {
    padding: '10px 12px', border: `1px solid ${error ? '#dc2626' : '#ddd'}`, borderRadius: 8, fontSize: 16, width: '100%', boxSizing: 'border-box',
  };
  const wrap = (input: React.ReactNode) => (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 14 }}>
      <span style={{ fontWeight: 500 }}>{label}{required && <span style={{ color: '#dc2626' }}> *</span>}</span>
      {input}
      {field.hint && !error && <span style={{ color: '#888', fontSize: 12 }}>{field.hint}</span>}
      {error && <span style={{ color: '#dc2626', fontSize: 12 }}>{error}</span>}
    </label>
  );

  if (field.type === 'country') {
    return wrap(
      <select disabled={busy} style={inputStyle} value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)}>
        <option value="">{field.placeholder ?? 'Select a country…'}</option>
        {(field.allowed_countries ?? []).map((iso) => <option key={iso} value={iso}>{iso}</option>)}
      </select>,
    );
  }
  if (field.type === 'select') {
    return wrap(
      <select disabled={busy} style={inputStyle} value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)}>
        <option value="">{field.placeholder ?? 'Select…'}</option>
        {(field.options ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>,
    );
  }
  if (field.type === 'checkbox') {
    return (
      <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 14 }}>
        <input type="checkbox" disabled={busy} checked={value === true} style={{ accentColor: color, marginTop: 3 }}
          onChange={(e) => onChange(e.target.checked)} />
        <span style={{ flex: 1 }}>
          {label}{required && <span style={{ color: '#dc2626' }}> *</span>}
          {field.hint && !error && <span style={{ display: 'block', color: '#888', fontSize: 12, marginTop: 2 }}>{field.hint}</span>}
          {error && <span style={{ display: 'block', color: '#dc2626', fontSize: 12, marginTop: 2 }}>{error}</span>}
        </span>
      </label>
    );
  }

  const inputType: React.HTMLInputTypeAttribute = field.type === 'date' ? 'date'
    : field.type === 'email' ? 'email'
    : field.type === 'tel' ? 'tel'
    : field.type === 'number' ? 'number'
    : 'text';
  const inputMode: React.HTMLAttributes<HTMLInputElement>['inputMode'] = field.type === 'tel' ? 'tel' : field.type === 'number' ? 'numeric' : undefined;
  return wrap(
    <input
      style={inputStyle}
      type={inputType}
      inputMode={inputMode}
      maxLength={field.validators?.max_length}
      placeholder={field.placeholder}
      value={(value as string) ?? ''}
      onChange={(e) => onChange(e.target.value)}
      disabled={busy}
    />,
  );
}

function InfoSurface({ action, color, busy, onAdvance, onCancel }: {
  action: InfoAction; color: string; busy: boolean;
  onAdvance: () => void; onCancel: () => void;
}) {
  const openedRef = useRef(false);
  const onPrimary = () => {
    // Open the external URL in a new tab as an in-app-browser approximation,
    // then wait for the subject to return before advancing. Matches the
    // legacy redirect_to_consent UX.
    if (action.primary_cta.open_url && !openedRef.current) {
      window.open(action.primary_cta.open_url, '_blank', 'noopener,noreferrer');
      openedRef.current = true;
      return;
    }
    onAdvance();
  };
  return (
    <Centered title={action.title} subtitle={action.body}>
      {action.image_url && (
        <img src={action.image_url} alt="" style={{ width: '100%', maxHeight: 192, objectFit: 'contain', borderRadius: 12, marginBottom: 8 }} />
      )}
      {action.bullets && action.bullets.length > 0 && (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 12, textAlign: 'left' }}>
          {action.bullets.map((b, i) => (
            <li key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span aria-hidden style={{ flex: '0 0 24px', height: 24, borderRadius: '50%', background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: '#555' }}>
                {bulletGlyph(b.icon)}
              </span>
              <span style={{ fontSize: 14, color: '#444' }}>{b.text}</span>
            </li>
          ))}
        </ul>
      )}
      <PrimaryButton color={color} disabled={busy} onClick={onPrimary}>
        {busy ? 'Please wait…' : openedRef.current && action.primary_cta.open_url ? "I'm back, continue" : action.primary_cta.label}
      </PrimaryButton>
      {action.secondary_cta && (
        <SecondaryButton disabled={busy}
          onClick={action.secondary_cta.action === 'cancel' ? onCancel : onAdvance}>
          {action.secondary_cta.label}
        </SecondaryButton>
      )}
    </Centered>
  );
}

// Single-char fallback glyphs so the SDK stays icon-library-free. Unknown
// icons render as the info dot (per spec — never block).
function bulletGlyph(icon: InfoBulletIcon | undefined): string {
  switch (icon) {
    case 'check': return '✓';
    case 'shield': return '⛨';
    case 'camera': return '📷';
    case 'warning': return '!';
    default: return 'i';
  }
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
