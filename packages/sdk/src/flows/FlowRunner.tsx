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
 *
 * Presentation is driven by a warm-neutral theme (theme.ts) that mirrors the
 * hosted page's design tokens and supports light + dark. Every presentational
 * component reads the active FlowTheme from context.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { VerificationCaptureEngine } from '../components/VerificationCaptureEngine';
import type { CaptureSessionData } from '../types';
import { createFlowsClient } from './client';
import { FlowError, type CameraFacing, type CaptureHints, type FlowRunResult, type FlowRunView, type FormField, type IdTypeOption, type InfoAction, type InfoBulletIcon, type PendingAction, type RunFlowOptions } from './types';
import { assessDocumentFrame, DEFAULT_DOCUMENT_THRESHOLDS, guidanceFor, isCaptureReady } from './capture-quality';
import { isPdf, pdfFirstPageToJpegBase64 } from './pdf';
import { injectBrandFonts, LIGHT_THEME, mergeAppearance, useFlowTheme, type FlowAppearance, type FlowTheme } from './theme';
import { mergeCopy, txt, type FlowCopy } from './copy';

const TERMINAL_STATES = new Set(['completed', 'errored', 'cancelled', 'abandoned']);

// Active theme, provided once at the top of the runner and read by every
// presentational component via useTheme(). Defaults to LIGHT_THEME so any
// component rendered outside the provider (defensive) still has tokens.
const ThemeCtx = createContext<FlowTheme>(LIGHT_THEME);
function useTheme(): FlowTheme {
  return useContext(ThemeCtx);
}

// Active white-label copy, resolved once at the top of the runner (SDK-init
// copy over server branding copy) and read by every surface via useCopy().
// Defaults to undefined so each txt() call falls back to its built-in default.
const CopyCtx = createContext<FlowCopy | undefined>(undefined);
function useCopy(): FlowCopy | undefined {
  return useContext(CopyCtx);
}

export interface FlowRunnerProps {
  options: RunFlowOptions;
  onResult: (result: FlowRunResult) => void;
  onError: (error: FlowError) => void;
}

export function FlowRunner({ options, onResult, onError }: FlowRunnerProps) {
  const clientRef = useRef(createFlowsClient(options));
  const [view, setView] = useState<FlowRunView | null>(null);
  const [busy, setBusy] = useState(false);
  // Contextual copy shown under the full-page spinner while busy. Set alongside
  // setBusy(true) at the call sites that know what they're waiting on; reset in
  // the matching finally so the next wait starts from the generic default.
  const [busyMessage, setBusyMessage] = useState<string>('Verifying');
  const [busySubtitle, setBusySubtitle] = useState<string | undefined>('This only takes a moment.');
  const [captureSession, setCaptureSession] = useState<CaptureSessionData | null>(null);
  // Per-field server validation errors from the last advance(). Cleared on the
  // next success so a recovered form does not show stale highlights.
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Resolve the active theme from the merged appearance: the developer's SDK-init
  // `appearance` over the operator's dashboard appearance (branding) over the
  // built-in default. Inject the brand fonts once (custom fontCss if supplied).
  // Legacy single primary_color folds in as the lowest-priority colour so
  // existing branding still drives the runner when no full appearance is set.
  const legacyColor: FlowAppearance | undefined = view?.branding?.primary_color
    ? { colors: { primary: view.branding.primary_color } } : undefined;
  const appearance = mergeAppearance(
    options.appearance,
    mergeAppearance(view?.branding?.appearance ?? undefined, legacyColor),
  );
  const theme = useFlowTheme(appearance);
  useEffect(() => { injectBrandFonts(options.appearance); }, [options.appearance]);

  // Resolve the active copy the same way as appearance: the developer's SDK-init
  // `copy` over the operator's dashboard copy (branding) over the built-in
  // defaults. Provided via CopyCtx; every surface reads it through useCopy().
  const copy = mergeCopy(options.copy, view?.branding?.copy ?? undefined);
  // Stable handle to the latest resolved copy so the busy-message set-sites in
  // the existing callbacks can read overrides without widening their dependency
  // lists (which would otherwise re-run the init effect on every transition).
  const copyRef = useRef<FlowCopy | undefined>(copy);
  copyRef.current = copy;

  const fail = useCallback((err: unknown) => {
    onError(err instanceof FlowError ? err : new FlowError('unknown', err instanceof Error ? err.message : txt(copyRef.current?.errors?.generic, 'Unknown error')));
  }, [onError]);

  const advance = useCallback(async (inputs: Record<string, unknown> = {}) => {
    setBusyMessage(txt(copyRef.current?.loading?.verifying, 'Verifying'));
    setBusySubtitle('This only takes a moment.');
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

  // Wrap the whole rendered tree so every component can read the theme. The
  // render branches below are unchanged in control flow; only chrome differs.
  return (
    <ThemeCtx.Provider value={theme}>
      <CopyCtx.Provider value={copy}>
      <RunnerBody
        view={view}
        busy={busy}
        busyMessage={busyMessage}
        busySubtitle={busySubtitle}
        captureSession={captureSession}
        options={options}
        fieldErrors={fieldErrors}
        clientRef={clientRef}
        advance={advance}
        fail={fail}
        setView={setView}
        setBusy={setBusy}
        setBusyMessage={setBusyMessage}
        setBusySubtitle={setBusySubtitle}
        setCaptureSession={setCaptureSession}
        onResult={onResult}
      />
      </CopyCtx.Provider>
    </ThemeCtx.Provider>
  );
}

// Render body split out so the ThemeCtx.Provider wraps every branch (including
// the early returns). Pure presentation + the existing handler wiring; no
// control-flow changes from the original FlowRunner.
function RunnerBody({
  view, busy, busyMessage, busySubtitle, captureSession, options, fieldErrors,
  clientRef, advance, fail, setView, setBusy, setBusyMessage, setBusySubtitle, setCaptureSession,
}: {
  view: FlowRunView | null;
  busy: boolean;
  busyMessage: string;
  busySubtitle: string | undefined;
  captureSession: CaptureSessionData | null;
  options: RunFlowOptions;
  fieldErrors: Record<string, string>;
  clientRef: React.MutableRefObject<ReturnType<typeof createFlowsClient>>;
  advance: (inputs?: Record<string, unknown>) => Promise<void>;
  fail: (err: unknown) => void;
  setView: React.Dispatch<React.SetStateAction<FlowRunView | null>>;
  setBusy: React.Dispatch<React.SetStateAction<boolean>>;
  setBusyMessage: React.Dispatch<React.SetStateAction<string>>;
  setBusySubtitle: React.Dispatch<React.SetStateAction<string | undefined>>;
  setCaptureSession: React.Dispatch<React.SetStateAction<CaptureSessionData | null>>;
  onResult: (result: FlowRunResult) => void;
}) {
  const t = useTheme();
  const copy = useCopy();
  if (!view) return <LoadingScreen primary={t.primary} title={txt(copy?.loading?.default, 'Loading')} />;

  const brand = view.branding;
  const primary = t.primary;

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
  if (busy || !action) return <LoadingScreen primary={primary} brand={brand} title={busyMessage} subtitle={busySubtitle} />;

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
          setBusyMessage(txt(copy?.loading?.submittingDocument, 'Submitting your document…'));
          setBusySubtitle(undefined);
          setBusy(true);
          try {
            const r = await clientRef.current.uploadDocument({ data, mimeType, side: 'single', documentType });
            if (r.status === 'failed') {
              fail(new FlowError(r.reason === 'provider' ? 'provider_unavailable' : 'unknown',
                r.reason === 'provider'
                  ? txt(copy?.errors?.providerUnavailable, 'Verification is temporarily unavailable.')
                  : txt(copy?.errors?.documentUnreadable, "We couldn't read that document. Please retake it.")));
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
  if (action.kind === 'capture' && action.capture === 'id_number') {
    return <IdNumberSurface idTypes={action.idTypes ?? []} color={props.primary} busy={props.busy} onSubmit={props.onSubmitForm} />;
  }
  if (action.kind === 'capture' && action.capture === 'document') {
    return <DocumentSurface
      documentCategory={action.documentCategory}
      documentTypes={action.documentTypes ?? []}
      camera={action.camera}
      captureMethods={action.captureMethods}
      captureHints={action.captureHints}
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
  const copy = useCopy();
  return (
    <Centered title={txt(copy?.face?.title, 'Take a selfie')} subtitle={txt(copy?.face?.body, "A quick face scan confirms you're a real, live person.")}>
      <PrimaryButton color={color} disabled={busy} onClick={onStart}>{busy ? 'Please wait…' : txt(copy?.face?.start, 'Start face scan')}</PrimaryButton>
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
  const t = useTheme();
  const copy = useCopy();
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
      style={{ display: 'flex', flexDirection: 'column', gap: 14, width: '100%', maxWidth: 380 }}
      onSubmit={(e) => { e.preventDefault(); submit(); }}
    >
      <div style={{ marginBottom: 2 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: t.fg, fontFamily: t.fontDisplay, letterSpacing: '-0.01em' }}>{txt(copy?.form?.title, 'A few details')}</h1>
        <p style={{ color: t.muted, margin: '6px 0 0', fontFamily: t.fontBody, fontSize: 15 }}>Please enter the information below to continue.</p>
      </div>
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
      <PrimaryButton color={color} disabled={busy}>{busy ? txt(copy?.buttons?.submitting, 'Submitting…') : txt(copy?.buttons?.continue, 'Continue')}</PrimaryButton>
    </form>
  );
}

function FieldRow({ field, value, error, color, busy, onChange }: {
  field: FormField; value: string | boolean; error: string | undefined;
  color: string; busy: boolean; onChange: (v: string | boolean) => void;
}) {
  const t = useTheme();
  const label = field.label ?? humanise(field.key);
  const required = field.required !== false;
  const [focused, setFocused] = useState(false);
  const borderColor = error ? t.destructive : focused ? color : t.border;
  const inputStyle: React.CSSProperties = {
    padding: '12px 14px', border: `1px solid ${borderColor}`, borderRadius: 12, fontSize: 16, width: '100%', boxSizing: 'border-box',
    background: t.card, color: t.fg, fontFamily: t.fontBody, outline: 'none',
    boxShadow: focused && !error ? `0 0 0 3px ${color}33` : 'none', transition: 'border-color 0.15s, box-shadow 0.15s',
  };
  const focusProps = {
    onFocus: () => setFocused(true),
    onBlur: () => setFocused(false),
  };
  const wrap = (input: React.ReactNode) => (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 14, fontFamily: t.fontBody }}>
      <span style={{ fontWeight: 600, color: t.fg }}>{label}{required && <span style={{ color: t.destructive }}> *</span>}</span>
      {input}
      {field.hint && !error && <span style={{ color: t.muted, fontSize: 12 }}>{field.hint}</span>}
      {error && <span style={{ color: t.destructive, fontSize: 12 }}>{error}</span>}
    </label>
  );

  if (field.type === 'country') {
    return wrap(
      <select disabled={busy} style={inputStyle} value={(value as string) ?? ''} {...focusProps} onChange={(e) => onChange(e.target.value)}>
        <option value="">{field.placeholder ?? 'Select a country…'}</option>
        {(field.allowed_countries ?? []).map((iso) => <option key={iso} value={iso}>{iso}</option>)}
      </select>,
    );
  }
  if (field.type === 'select') {
    return wrap(
      <select disabled={busy} style={inputStyle} value={(value as string) ?? ''} {...focusProps} onChange={(e) => onChange(e.target.value)}>
        <option value="">{field.placeholder ?? 'Select…'}</option>
        {(field.options ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>,
    );
  }
  if (field.type === 'checkbox') {
    return (
      <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 14, fontFamily: t.fontBody, background: t.card, border: `1px solid ${t.border}`, borderRadius: 12, padding: '12px 14px' }}>
        <input type="checkbox" disabled={busy} checked={value === true} style={{ accentColor: color, marginTop: 3, width: 16, height: 16 }}
          onChange={(e) => onChange(e.target.checked)} />
        <span style={{ flex: 1, color: t.fg }}>
          {label}{required && <span style={{ color: t.destructive }}> *</span>}
          {field.hint && !error && <span style={{ display: 'block', color: t.muted, fontSize: 12, marginTop: 2 }}>{field.hint}</span>}
          {error && <span style={{ display: 'block', color: t.destructive, fontSize: 12, marginTop: 2 }}>{error}</span>}
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
      {...focusProps}
      onChange={(e) => onChange(e.target.value)}
      disabled={busy}
    />,
  );
}

/**
 * ID-number capture surface: an ID-type picker (one chip per allowed type, with
 * an optional hint) plus a single numeric/text input. Continue submits
 * `{ id_type, [field]: value }` through the same advance() path the form uses.
 * Mirrors the hosted IdNumberFlow copy + layout.
 */
function IdNumberSurface({ idTypes, color, busy, onSubmit }: {
  idTypes: IdTypeOption[]; color: string; busy: boolean;
  onSubmit: (values: Record<string, string | number | boolean>) => void;
}) {
  const t = useTheme();
  const copy = useCopy();
  const [chosen, setChosen] = useState<string | null>(idTypes.length === 1 ? idTypes[0].value : null);
  const [value, setValue] = useState('');
  const [focused, setFocused] = useState(false);
  const selected = idTypes.find((it) => it.value === chosen) ?? null;
  const tooShort = selected?.maxLength ? value.trim().length < selected.maxLength : value.trim().length === 0;
  const submit = () => {
    if (selected && !tooShort) onSubmit({ id_type: selected.value, [selected.field]: value.trim() });
  };

  const inputBorder = focused ? color : t.border;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', maxWidth: 380 }}>
      <div style={{ marginBottom: 2 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: t.fg, fontFamily: t.fontDisplay, letterSpacing: '-0.01em' }}>{txt(copy?.idNumber?.title, 'Select an option')}</h1>
        <p style={{ color: t.muted, margin: '6px 0 0', fontFamily: t.fontBody, fontSize: 15 }}>{txt(copy?.idNumber?.body, 'Choose the type of ID to validate.')}</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {idTypes.map((it) => {
          const isSel = it.value === chosen;
          return (
            <button
              key={it.value}
              type="button"
              disabled={busy}
              onClick={() => { setChosen(it.value); setValue(''); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left',
                borderRadius: 12, padding: '14px 16px', cursor: busy ? 'default' : 'pointer',
                border: `${isSel ? 2 : 1}px solid ${isSel ? color : t.border}`,
                background: isSel ? `${color}14` : t.card, color: t.fg, fontFamily: t.fontBody,
              }}
            >
              <span aria-hidden style={{ flex: '0 0 36px', height: 36, borderRadius: 10, background: t.bg, border: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, color: t.muted, fontFamily: t.fontDisplay }}>#</span>
              <span style={{ flex: 1 }}>
                <span style={{ display: 'block', fontWeight: 600, color: t.fg }}>{it.label}</span>
                {it.hint && <span style={{ display: 'block', fontSize: 12, color: t.muted, marginTop: 2 }}>{it.hint}</span>}
              </span>
              <span style={{ width: 20, height: 20, borderRadius: '50%', border: `2px solid ${isSel ? color : t.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {isSel && <span style={{ width: 10, height: 10, borderRadius: '50%', background: color }} />}
              </span>
            </button>
          );
        })}
      </div>

      {selected && (
        <form onSubmit={(e) => { e.preventDefault(); submit(); }} style={{ marginTop: 4 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 14, fontFamily: t.fontBody }}>
            <span style={{ fontWeight: 600, color: t.fg }}>Enter your {selected.label}</span>
            <input
              autoFocus
              value={value}
              disabled={busy}
              inputMode={selected.numeric ? 'numeric' : undefined}
              maxLength={selected.maxLength}
              placeholder={selected.hint}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onChange={(e) => setValue(selected.numeric ? e.target.value.replace(/\D/g, '') : e.target.value)}
              style={{
                padding: '12px 14px', border: `1px solid ${inputBorder}`, borderRadius: 12, fontSize: 16, width: '100%', boxSizing: 'border-box',
                background: t.card, color: t.fg, fontFamily: t.fontBody, outline: 'none',
                boxShadow: focused ? `0 0 0 3px ${color}33` : 'none', transition: 'border-color 0.15s, box-shadow 0.15s',
              }}
            />
          </label>
        </form>
      )}

      <PrimaryButton color={color} disabled={busy || !selected || tooShort} onClick={submit}>
        {busy ? 'Please wait…' : txt(copy?.buttons?.continue, 'Continue')}
      </PrimaryButton>
    </div>
  );
}

function InfoSurface({ action, color, busy, onAdvance, onCancel }: {
  action: InfoAction; color: string; busy: boolean;
  onAdvance: () => void; onCancel: () => void;
}) {
  const t = useTheme();
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
              <span aria-hidden style={{ flex: '0 0 24px', height: 24, borderRadius: '50%', background: t.card, border: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: t.muted }}>
                {bulletGlyph(b.icon)}
              </span>
              <span style={{ fontSize: 14, color: t.fg, fontFamily: t.fontBody }}>{b.text}</span>
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

interface TorchCapabilities { torch?: boolean }

/**
 * Document capture surface. Camera-first: opens the contract-specified camera
 * (rear for documents) at full resolution, runs the pure quality gates
 * (brightness/focus/glare) on a downscaled preview, guides the subject, and
 * auto-captures a good frame. Falls back to file upload if the camera is
 * unavailable or the subject prefers it. Shows a retake/confirm step.
 */
function DocumentSurface({ documentCategory, documentTypes, camera, captureMethods, captureHints, color, busy, onUpload }: {
  documentCategory: string; documentTypes: string[]; camera?: CameraFacing; captureMethods?: ('camera' | 'upload')[]; captureHints?: CaptureHints;
  color: string; busy: boolean;
  onUpload: (base64: string, mimeType: string, documentType?: string) => void;
}) {
  const t = useTheme();
  const copy = useCopy();
  // The subject is offered every allowed method; default both. Operator can narrow.
  const allowCamera = !captureMethods || captureMethods.includes('camera');
  const allowUpload = !captureMethods || captureMethods.includes('upload');
  const fileRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [mode, setMode] = useState<'camera' | 'upload' | 'review'>(allowCamera ? 'camera' : 'upload');
  const [preview, setPreview] = useState<string | null>(null);
  const [guidance, setGuidance] = useState<string | null>(null);
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [torchOn, setTorchOn] = useState(false);

  const label = documentTypes[0] ?? humanise(documentCategory);
  const facing: 'user' | 'environment' = camera === 'front' ? 'user' : 'environment';
  const autoCapture = captureHints?.autoCapture !== false;
  const fullRes = captureHints?.fullResolution !== false;
  const allowTorch = captureHints?.allowTorch === true;
  const reqFocus = captureHints?.requireFocus;
  const detGlare = captureHints?.detectGlare;

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const doCapture = useCallback(() => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const c = document.createElement('canvas');
    c.width = v.videoWidth; c.height = v.videoHeight;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(v, 0, 0);
    setPreview(c.toDataURL('image/jpeg', 0.92));
    stopStream();
    setMode('review');
  }, [stopStream]);

  const onFile = useCallback((file: File) => {
    // A PDF can't be displayed on the dashboard or used for face matching, so
    // render its first page to a JPEG and upload that. Images upload as-is.
    if (isPdf(file)) {
      setGuidance('Preparing your document…');
      void file.arrayBuffer()
        .then(pdfFirstPageToJpegBase64)
        .then((b64) => { setGuidance(null); onUpload(b64, 'image/jpeg', documentCategory); })
        .catch(() => setGuidance('We could not read that PDF. Please upload a clear photo of your document instead.'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => onUpload(String(reader.result).split(',')[1] ?? '', file.type || 'image/jpeg', documentCategory);
    reader.readAsDataURL(file);
  }, [onUpload, documentCategory]);

  useEffect(() => {
    if (mode !== 'camera') return;
    let cancelled = false;
    let raf = 0;
    let streak = 0;
    (async () => {
      try {
        const video: MediaTrackConstraints = { facingMode: { ideal: facing } };
        if (fullRes) { video.width = { ideal: 3840 }; video.height = { ideal: 2160 }; }
        const stream = await navigator.mediaDevices.getUserMedia({ video });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        const track = stream.getVideoTracks()[0];
        const caps = track?.getCapabilities?.() as TorchCapabilities | undefined;
        setTorchAvailable(allowTorch && Boolean(caps?.torch));
        if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play().catch(() => {}); }

        const probe = document.createElement('canvas');
        const tick = () => {
          if (cancelled) return;
          const v = videoRef.current;
          if (v && v.videoWidth) {
            const w = 320;
            const h = Math.max(1, Math.round((w * v.videoHeight) / v.videoWidth));
            probe.width = w; probe.height = h;
            const ctx = probe.getContext('2d');
            if (ctx) {
              ctx.drawImage(v, 0, 0, w, h);
              const q = assessDocumentFrame(ctx.getImageData(0, 0, w, h), DEFAULT_DOCUMENT_THRESHOLDS);
              setGuidance(guidanceFor(q.issues));
              if (autoCapture && isCaptureReady(q, { requireFocus: reqFocus, detectGlare: detGlare })) {
                if (++streak >= 5) { doCapture(); return; }
              } else { streak = 0; }
            }
          }
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      } catch {
        if (!cancelled) setMode('upload');
      }
    })();
    return () => { cancelled = true; cancelAnimationFrame(raf); stopStream(); };
  }, [mode, facing, fullRes, autoCapture, allowTorch, reqFocus, detGlare, doCapture, stopStream]);

  const toggleTorch = useCallback(async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const next = !torchOn;
    try {
      await track.applyConstraints({ advanced: [{ torch: next }] } as unknown as MediaTrackConstraints);
      setTorchOn(next);
    } catch { /* torch unsupported on this device */ }
  }, [torchOn]);

  const hiddenInput = (
    <input ref={fileRef} type="file" accept="image/jpeg,image/png,application/pdf" style={{ display: 'none' }}
      onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }} />
  );

  if (mode === 'review' && preview) {
    return (
      <Centered title={txt(copy?.document?.confirmTitle, 'Does this look clear?')} subtitle={txt(copy?.document?.confirmBody, 'All four corners visible, no glare, text readable.')}>
        <img src={preview} alt="Captured document" style={{ maxWidth: '100%', maxHeight: '50vh', borderRadius: 12, marginBottom: 16, border: `1px solid ${t.border}` }} />
        <PrimaryButton color={color} disabled={busy} onClick={() => { const b = preview.split(',')[1] ?? ''; onUpload(b, 'image/jpeg', documentCategory); }}>
          {busy ? 'Uploading…' : txt(copy?.buttons?.useThisPhoto, 'Use this photo')}
        </PrimaryButton>
        <SecondaryButton disabled={busy} onClick={() => { setPreview(null); setMode(allowCamera ? 'camera' : 'upload'); }}>{txt(copy?.buttons?.retake, 'Retake')}</SecondaryButton>
      </Centered>
    );
  }

  if (mode === 'upload') {
    return (
      <Centered title={txt(copy?.document?.uploadTitle, `Upload your ${label.toLowerCase()}`)} subtitle={txt(copy?.document?.uploadBody, 'A clear photo of the document, with all four corners visible.')}>
        {hiddenInput}
        <PrimaryButton color={color} disabled={busy} onClick={() => fileRef.current?.click()}>{busy ? 'Uploading…' : txt(copy?.buttons?.upload, 'Choose a file')}</PrimaryButton>
      </Centered>
    );
  }

  return (
    <Centered title={txt(copy?.document?.scanTitle, `Scan your ${label.toLowerCase()}`)} subtitle={txt(copy?.document?.scanBody, autoCapture ? 'Hold the document inside the frame; we capture it automatically.' : 'Hold the document inside the frame and tap to capture.')}>
      <div style={{ position: 'relative', width: '100%', maxWidth: 480, marginBottom: 16 }}>
        <video ref={videoRef} playsInline muted style={{ width: '100%', borderRadius: 16, background: '#000', aspectRatio: '3 / 2', objectFit: 'cover' }} />
        <div style={{ position: 'absolute', inset: '8%', border: '2px solid rgba(255,255,255,0.85)', borderRadius: 12, pointerEvents: 'none' }} />
        {guidance && (
          <div style={{ position: 'absolute', bottom: 8, left: 0, right: 0, textAlign: 'center', color: '#fff', background: 'rgba(0,0,0,0.5)', padding: '6px 0', fontSize: 14, fontFamily: t.fontBody }}>{guidance}</div>
        )}
      </div>
      {hiddenInput}
      {!autoCapture && <PrimaryButton color={color} disabled={busy} onClick={doCapture}>{txt(copy?.buttons?.scan, 'Capture')}</PrimaryButton>}
      {torchAvailable && <SecondaryButton onClick={toggleTorch}>{torchOn ? 'Turn off light' : 'Turn on light'}</SecondaryButton>}
      {allowUpload && <SecondaryButton disabled={busy} onClick={() => { stopStream(); setMode('upload'); }}>{txt(copy?.buttons?.uploadInstead, 'Upload a file instead')}</SecondaryButton>}
    </Centered>
  );
}

function ConsentSurface({ consentUrl, color, busy, onConfirm }: { consentUrl: string; color: string; busy: boolean; onConfirm: () => void }) {
  const copy = useCopy();
  return (
    <Centered title={txt(copy?.privacy?.consentTitle, 'Consent required')} subtitle={txt(copy?.privacy?.consentBody, 'Open the secure consent page, grant consent, then come back and continue.')}>
      <a href={consentUrl} target="_blank" rel="noreferrer" style={{ textDecoration: 'none', width: '100%' }}>
        <PrimaryButton color={color}>Open consent page</PrimaryButton>
      </a>
      <SecondaryButton onClick={onConfirm} disabled={busy}>I've granted consent</SecondaryButton>
    </Centered>
  );
}

// ─── Layout primitives ───────────────────────────────────────────────────────

function Frame({ brand, onCancel, children }: { brand: FlowRunView['branding']; onCancel: () => void; children: React.ReactNode }) {
  const t = useTheme();
  return (
    <div style={{
      position: 'fixed', inset: 0, background: t.bg, color: t.fg, display: 'flex', flexDirection: 'column',
      zIndex: 2147483600, fontFamily: t.fontBody,
      ...(t.backgroundImage ? { backgroundImage: `url(${t.backgroundImage})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}),
    }}>
      <Header brand={brand} onCancel={onCancel} />
      <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>{children}</main>
      <Footer brand={brand} />
    </div>
  );
}

function LoadingScreen({ primary, brand, title, subtitle }: { primary: string; brand?: FlowRunView['branding']; title?: string; subtitle?: string }) {
  const t = useTheme();
  return (
    <div style={{ position: 'fixed', inset: 0, background: t.bg, color: t.fg, display: 'flex', flexDirection: 'column', zIndex: 2147483600, fontFamily: t.fontBody }}>
      {brand && <Header brand={brand} />}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24, textAlign: 'center' }}>
        <Spinner color={primary} />
        {title && <p style={{ margin: 0, fontSize: 18, fontWeight: 600, color: t.fg, fontFamily: t.fontDisplay }}>{title}</p>}
        {subtitle && <p style={{ margin: 0, fontSize: 14, color: t.muted, fontFamily: t.fontBody, maxWidth: 280 }}>{subtitle}</p>}
      </main>
      {brand && <Footer brand={brand} />}
    </div>
  );
}

function TerminalScreen({ outcome, state, brand, primary }: { outcome: string | null; state: string; brand: FlowRunView['branding']; primary: string }) {
  const t = useTheme();
  const copy = useCopy();
  const approved = outcome === 'APPROVE';
  const review = outcome === 'MANUAL_REVIEW';
  const title = approved
    ? txt(copy?.result?.successTitle, 'Verification complete')
    : review
      ? txt(copy?.result?.reviewTitle, 'Under review')
      : state === 'cancelled'
        ? txt(copy?.result?.cancelledTitle, 'Cancelled')
        : txt(copy?.result?.notVerifiedTitle, 'Not verified');
  const subtitle = approved
    ? txt(copy?.result?.successBody, 'Thank you. You can close this page.')
    : review
      ? txt(copy?.result?.reviewBody, 'Your details are being reviewed.')
      : state === 'cancelled'
        ? 'No problem — you can try again whenever you are ready.'
        : txt(copy?.result?.notVerifiedBody, 'We could not complete your verification.');
  return (
    <div style={{ position: 'fixed', inset: 0, background: t.bg, color: t.fg, display: 'flex', flexDirection: 'column', zIndex: 2147483600, fontFamily: t.fontBody }}>
      <Header brand={brand} />
      <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Centered title={title} subtitle={subtitle}>
          {approved && brand?.redirect_url && (
            <a href={brand.redirect_url} style={{ textDecoration: 'none', width: '100%' }}>
              <PrimaryButton color={primary}>{txt(copy?.buttons?.continue, 'Continue')}</PrimaryButton>
            </a>
          )}
        </Centered>
      </main>
      <Footer brand={brand} />
    </div>
  );
}

function Header({ brand, onCancel }: { brand: FlowRunView['branding']; onCancel?: () => void }) {
  const t = useTheme();
  const copy = useCopy();
  const name = brand?.display_name || 'UseSense';
  const cancelLabel = txt(copy?.buttons?.cancel, 'Cancel');
  return (
    <div style={{ height: 56, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', borderBottom: `1px solid ${t.border}` }}>
      {brand?.logo_url
        ? <img src={brand.logo_url} alt={name} style={{ height: 28, maxWidth: 160, objectFit: 'contain' }} />
        : <span style={{ fontWeight: 600, color: t.fg, fontFamily: t.fontDisplay }}>{name}</span>}
      {onCancel && (
        <button onClick={onCancel} aria-label={cancelLabel} style={{ position: 'absolute', right: 16, background: 'none', border: 'none', color: t.muted, cursor: 'pointer', fontSize: 14, fontFamily: t.fontBody }}>{cancelLabel}</button>
      )}
    </div>
  );
}

function Footer({ brand }: { brand: FlowRunView['branding'] }) {
  const t = useTheme();
  const co = brand?.display_name && brand.display_name !== 'UseSense' ? `${brand.display_name} · UseSense` : 'UseSense';
  return <div style={{ padding: 12, textAlign: 'center', fontSize: 11, color: t.muted, fontFamily: t.fontBody }}>Secured by {co}</div>;
}

function Centered({ title, subtitle, children }: { title: string; subtitle?: string; children?: React.ReactNode }) {
  const t = useTheme();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, maxWidth: 380, textAlign: 'center' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: t.fg, fontFamily: t.fontDisplay, letterSpacing: '-0.01em' }}>{title}</h1>
      {subtitle && <p style={{ color: t.muted, margin: 0, fontFamily: t.fontBody, fontSize: 15 }}>{subtitle}</p>}
      {children && <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}>{children}</div>}
    </div>
  );
}

function PrimaryButton({ color, disabled, onClick, children }: { color: string; disabled?: boolean; onClick?: () => void; children: React.ReactNode }) {
  const t = useTheme();
  return (
    <button onClick={onClick} disabled={disabled} type={onClick ? 'button' : 'submit'} style={{
      background: t.buttonStyle === 'outline' ? 'transparent' : color,
      color: t.buttonStyle === 'outline' ? color : t.primaryFg,
      border: t.buttonStyle === 'outline' ? `1.5px solid ${color}` : 'none',
      borderRadius: t.buttonRadius, padding: '14px 16px',
      fontSize: 16, fontWeight: 600, fontFamily: t.fontBody, cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.5 : 1, width: '100%',
    }}>{children}</button>
  );
}

function SecondaryButton({ onClick, disabled, children }: { onClick?: () => void; disabled?: boolean; children: React.ReactNode }) {
  const t = useTheme();
  return (
    <button onClick={onClick} disabled={disabled} type="button" style={{
      background: t.card, color: t.fg, border: `1px solid ${t.border}`, borderRadius: t.buttonRadius, padding: '14px 16px',
      fontSize: 16, fontWeight: 600, fontFamily: t.fontBody, cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.5 : 1, width: '100%',
    }}>{children}</button>
  );
}

function Spinner({ color }: { color: string }) {
  const t = useTheme();
  // A custom loader asset (GIF / animated SVG) overrides the built-in spinner.
  if (t.loader?.imageUrl) {
    return <img src={t.loader.imageUrl} alt="Loading" style={{ width: 48, height: 48, objectFit: 'contain' }} />;
  }
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
