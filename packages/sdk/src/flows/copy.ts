// FlowCopy — the white-label copy/messaging override contract (Phase 2).
//
// Every subject-facing string in the runner can be overridden. Like
// FlowAppearance it is supplied two ways and merged SDK-init > server(branding)
// > built-in default: developers pass `copy` at SDK init, operators configure it
// in the dashboard (delivered in branding.copy, layered org -> flow server-side).
// Everything is optional; an omitted key keeps the built-in hosted-page copy.

export interface FlowCopy {
  /** Optional welcome/intro shown before the first step (when set). */
  welcome?: { title?: string; body?: string };

  /** Shared button labels. */
  buttons?: {
    continue?: string;
    cancel?: string;
    tryAgain?: string;
    retake?: string;
    useThisPhoto?: string;
    uploadInstead?: string;
    scan?: string;
    upload?: string;
    submitting?: string;
  };

  /** Titles shown under the loader for each transient state. */
  loading?: { default?: string; verifying?: string; submittingDocument?: string; checkingQuality?: string };

  /** Face capture primer. */
  face?: { title?: string; body?: string; start?: string };

  /** Document capture surfaces. */
  document?: {
    selectTitle?: string; selectBody?: string;
    primerTitle?: string; primerBody?: string;
    uploadTitle?: string; uploadBody?: string;
    scanTitle?: string; scanBody?: string;
    confirmTitle?: string; confirmBody?: string;
  };

  /** Form + ID-number surfaces. */
  form?: { title?: string };
  idNumber?: { title?: string; body?: string };

  /** Terminal result screens. */
  result?: {
    successTitle?: string; successBody?: string;
    reviewTitle?: string; reviewBody?: string;
    notVerifiedTitle?: string; notVerifiedBody?: string;
    cancelledTitle?: string;
  };

  /** Error copy (provider failure vs unreadable capture vs generic). */
  errors?: { generic?: string; providerUnavailable?: string; documentUnreadable?: string };

  /** Privacy / consent disclosures shown to the subject. */
  privacy?: { disclosure?: string; consentTitle?: string; consentBody?: string };

  /** Free-form help text / tooltips keyed by an SDK-defined slot id. */
  help?: Record<string, string>;
}

/**
 * Merge a higher-priority copy group over a lower one, treating a BLANK high
 * value as unset — so a cleared/empty override lets the lower (server) value
 * show through instead of clobbering it (which `txt()` would then read as the
 * built-in default, dropping the server's copy).
 */
function mergeGroup<T extends Record<string, string | undefined>>(
  high: T | undefined,
  low: T | undefined,
): T {
  const out: Record<string, string | undefined> = { ...low };
  for (const [k, v] of Object.entries(high ?? {})) {
    if (v == null || (typeof v === 'string' && v.trim().length === 0)) continue;
    out[k] = v;
  }
  return out as T;
}

/** Deep-merge a higher-priority copy map over a lower one (SDK > server). */
export function mergeCopy(high: FlowCopy | undefined, low: FlowCopy | undefined): FlowCopy | undefined {
  if (!high) return low;
  if (!low) return high;
  return {
    welcome: mergeGroup(high.welcome, low.welcome),
    buttons: mergeGroup(high.buttons, low.buttons),
    loading: mergeGroup(high.loading, low.loading),
    face: mergeGroup(high.face, low.face),
    document: mergeGroup(high.document, low.document),
    form: mergeGroup(high.form, low.form),
    idNumber: mergeGroup(high.idNumber, low.idNumber),
    result: mergeGroup(high.result, low.result),
    errors: mergeGroup(high.errors, low.errors),
    privacy: mergeGroup(high.privacy, low.privacy),
    help: mergeGroup(high.help, low.help),
  };
}

/**
 * Read an override or fall back to the built-in default. Components call e.g.
 * `txt(copy?.face?.title, 'Take a selfie')`. Treats empty/blank overrides as
 * unset so a cleared dashboard field never blanks the UI.
 */
export function txt(override: string | undefined, fallback: string): string {
  return override != null && override.trim().length > 0 ? override : fallback;
}
