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

/** Deep-merge a higher-priority copy map over a lower one (SDK > server). */
export function mergeCopy(high: FlowCopy | undefined, low: FlowCopy | undefined): FlowCopy | undefined {
  if (!high) return low;
  if (!low) return high;
  return {
    welcome: { ...low.welcome, ...high.welcome },
    buttons: { ...low.buttons, ...high.buttons },
    loading: { ...low.loading, ...high.loading },
    face: { ...low.face, ...high.face },
    document: { ...low.document, ...high.document },
    form: { ...low.form, ...high.form },
    idNumber: { ...low.idNumber, ...high.idNumber },
    result: { ...low.result, ...high.result },
    errors: { ...low.errors, ...high.errors },
    privacy: { ...low.privacy, ...high.privacy },
    help: { ...low.help, ...high.help },
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
