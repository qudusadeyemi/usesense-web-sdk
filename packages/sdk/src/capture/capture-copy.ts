/**
 * `copy.capture`: every string on the capture screens (BRAND-v1 section 5).
 *
 * Every key is optional. A blank or missing value falls back to the SDK's
 * shipped English string, which stays byte-identical to the strings before
 * BRAND-v1. Placeholders: `{app}` is the resolved display name, else the host
 * page's name; `{side}` is the direction as the SDK words it ("to the left",
 * "up"). Unknown placeholders render literally.
 *
 * Keys marked "web addition" are not in the spec's list; they cover strings
 * the Web SDK shows that had no key (reported for iOS and Android parity).
 */

/** Overrides for the capture screens. */
export interface CaptureCopy {
  primer?: {
    selfieTitle?: string; selfieBody?: string; selfieTips?: string[]; start?: string; cancel?: string;
    twoStepsTitle?: string; twoStepsBody?: string; twoStepsTips?: string[];
    /** Web addition: the loading screen before the camera. */
    gettingReady?: string;
    /** Web addition: the camera permission prompt screen. */
    cameraTitle?: string; cameraBody?: string;
  };
  guidance?: {
    ready?: string; centre?: string; closer?: string; back?: string; straight?: string;
    dark?: string; darkHint?: string; bright?: string; brightHint?: string;
    blur?: string; eyes?: string; onePerson?: string; showFace?: string; covered?: string;
    holdStill?: string; shutterHint?: string;
  };
  extraCheck?: {
    sheetTitle?: string; sheetBody?: string; continue?: string;
    /** "Turn your head {side}" (first turn). */
    headTurn?: string;
    followDot?: string; speakDigits?: string;
    /** "Now look straight ahead". */
    lookCentre?: string;
    tryNext?: string; done?: string;
    /** Web addition: later turns, "Now {side}". */
    headTurnNext?: string;
    /** Web addition: the second line under the first turn ("Slowly"). */
    slowly?: string;
    /** Web addition: retry after a missed step ("Let's try that again"). */
    tryAgain?: string;
    /** Web addition: retry hint for a turn ("Turn a little further {side}"). */
    turnFurther?: string;
    /** Web addition: Follow Dot after the first half ("Keep following"). */
    keepFollowing?: string;
    /** Web addition: Follow Dot retry hint. */
    towardDot?: string;
    /** Web addition: the second lines while a challenge is paused (pausedTurn when the step has no direction). */
    pausedTurn?: string; pausedDot?: string; pausedDigits?: string;
    /** Paused during a turn, with the step's direction: "Then keep turning {side}" (Android A03 parity). */
    pausedTurnSide?: string;
    /** Paused during a "look straight ahead" step: "Then look straight ahead" (Android A03 parity). */
    pausedLookCentre?: string;
    /** Web addition: Speak Digits too quiet. */
    cantHear?: string; speakLouder?: string;
    /** Web addition: the on-device check before the upload. */
    oneMoment?: string; keepInOval?: string; screenColour?: string;
  };
  upload?: { title?: string; caption?: string; failedTitle?: string; failedBody?: string; retry?: string };
  result?: {
    approvedTitle?: string; approvedBody?: string; reviewTitle?: string; reviewBody?: string;
    rejectedTitle?: string; rejectedBody?: string; retryTitle?: string; retryBody?: string;
    done?: string; tryAgain?: string; notNow?: string;
    /** Web addition: the tips on the try-again page. */
    retryTips?: string[];
  };
  errors?: {
    cameraDeniedTitle?: string; cameraDeniedBody?: string;
    /** The camera-denied button. Browsers cannot open settings, so on web it reads "Try again". */
    openSettings?: string;
    cameraStoppedTitle?: string; cameraStoppedBody?: string;
    micTitle?: string; micBody?: string; useHeadMovement?: string;
    offlineTitle?: string; offlineBody?: string; expiredTitle?: string; expiredBody?: string; startAgain?: string;
    errorTitle?: string; errorBody?: string;
  };
  leave?: { title?: string; body?: string; leave?: string; keepGoing?: string };
}

const TIPS = ['Good light on your face', 'Take off sunglasses, hats and masks', 'Only you in the picture'];

/** The shipped English strings (the defaults). Do not change: they are byte-identical to 4.13.0. */
export const CAPTURE_COPY_DEFAULTS = {
  primer: {
    selfieTitle: 'Take a quick selfie',
    selfieBody: 'Hold your phone at eye level and look at the screen for a few seconds.',
    selfieTips: TIPS,
    start: 'Start',
    cancel: 'Cancel',
    twoStepsTitle: 'Two quick steps',
    twoStepsBody: 'A selfie scan, then a short movement. About 10 seconds.',
    twoStepsTips: TIPS,
    gettingReady: 'Getting ready...',
    cameraTitle: 'Allow camera access',
    cameraBody: 'We need access to your camera for identity verification',
  },
  guidance: {
    ready: 'Hold still',
    centre: 'Move your face to the centre',
    closer: 'Move a little closer',
    back: 'Move back a little',
    straight: 'Look straight ahead',
    dark: 'Find more light',
    darkHint: 'Face a window or lamp',
    bright: 'Too much light behind you',
    brightHint: 'Turn away from the window',
    blur: 'Hold your phone steady',
    eyes: 'Keep your eyes open',
    onePerson: 'Only you in the picture',
    showFace: 'Show your face in the oval',
    covered: 'Keep your face uncovered',
    holdStill: 'Hold still',
    shutterHint: "Tap the button when you're ready",
  },
  extraCheck: {
    sheetTitle: 'One more quick check',
    sheetBody: 'Slowly turn your head to the left, then to the right.',
    continue: 'Continue',
    headTurn: 'Turn your head {side}',
    followDot: 'Follow the dot with your head',
    speakDigits: 'Say these numbers',
    lookCentre: 'Now look straight ahead',
    tryNext: "Let's try the next one",
    done: 'Done',
    headTurnNext: 'Now {side}',
    slowly: 'Slowly',
    tryAgain: "Let's try that again",
    turnFurther: 'Turn a little further {side}',
    keepFollowing: 'Keep following',
    towardDot: 'Turn your head toward the dot',
    pausedTurn: 'Then keep turning',
    pausedTurnSide: 'Then keep turning {side}',
    pausedLookCentre: 'Then look straight ahead',
    pausedDot: 'The dot will wait for you',
    pausedDigits: 'Then say the numbers',
    cantHear: "We can't hear you",
    speakLouder: 'Speak a little louder',
    oneMoment: 'One more moment',
    keepInOval: 'Keep your face in the oval',
    screenColour: 'The screen will change colour',
  },
  upload: {
    title: "Checking it's you",
    caption: 'Usually under 10 seconds',
    failedTitle: "Couldn't send your scan",
    failedBody: "Check your connection. Your scan is kept, so you won't need to do it again.",
    retry: 'Try again',
  },
  result: {
    approvedTitle: "You're verified",
    approvedBody: 'Thanks. You can carry on in {app}.',
    reviewTitle: "Thanks, we're checking",
    reviewBody: 'This can take a few minutes. {app} will let you know.',
    rejectedTitle: "We couldn't verify you",
    rejectedBody: 'Please contact {app} for help.',
    retryTitle: "We couldn't verify you",
    retryBody: 'This sometimes happens with poor light or movement. You can try once more.',
    done: 'Done',
    tryAgain: 'Try again',
    notNow: 'Not now',
    retryTips: ['Face a window or a lamp', 'Hold your phone at eye level'],
  },
  errors: {
    cameraDeniedTitle: 'Camera access needed',
    cameraDeniedBody: "We use the camera only for this check. Allow camera access for this site in your browser's address bar or site settings, then try again.",
    openSettings: 'Try again',
    cameraStoppedTitle: 'The camera stopped',
    cameraStoppedBody: 'Another app or tab may be using it. Close anything else that uses the camera, then try again.',
    micTitle: 'Microphone needed',
    micBody: "This check needs your microphone. Allow it for this site in your browser's address bar or site settings and try again, or do a head movement instead.",
    useHeadMovement: 'Do a head movement instead',
    offlineTitle: "You're offline",
    offlineBody: 'Check your internet connection, then try again.',
    expiredTitle: 'This check timed out',
    expiredBody: 'For your security, each check is only open for 15 minutes.',
    startAgain: 'Start again',
    errorTitle: 'Something went wrong',
    errorBody: "It's not you. Please try again in a moment.",
  },
  leave: {
    title: 'Leave verification?',
    body: "You're nearly done. If you leave, you'll need to start again.",
    leave: 'Leave',
    keepGoing: 'Keep going',
  },
} as const;

/**
 * Defaults that today read differently in a situation the key does not name.
 * Used only when the key has no override.
 */
const SITUATIONAL_DEFAULTS = {
  /** No display name: the shipped strings without `{app}`. */
  noApp: {
    approvedBody: 'Thanks. You can carry on now.',
    reviewBody: "This can take a few minutes. You'll be told the result.",
    rejectedBody: 'Please contact the service you are verifying with for help.',
  },
  twoStepsBodyDigits: 'A selfie scan, then say a few numbers out loud. About 10 seconds.',
  sheetBody: {
    follow_dot: 'Keep your face in the oval and follow the dot with your head.',
    speak_phrase: "Say the numbers you see out loud. We'll need your microphone.",
  },
  /** Up and down are worded "Look up" / "Now look up". */
  headTurnVertical: 'Look {side}',
  headTurnNextVertical: 'Now look {side}',
  turnFurtherVertical: 'Look a little further {side}',
  turnFurtherCentre: 'Look straight at the screen',
  /** Up and down are worded "Then keep tilting your head up" (as Android). */
  pausedTurnVertical: 'Then keep tilting your head {side}',
} as const;

type Group = keyof typeof CAPTURE_COPY_DEFAULTS;
type StringKey<G extends Group> = { [K in keyof (typeof CAPTURE_COPY_DEFAULTS)[G]]: (typeof CAPTURE_COPY_DEFAULTS)[G][K] extends string ? K : never }[keyof (typeof CAPTURE_COPY_DEFAULTS)[G]];
type ListKey<G extends Group> = { [K in keyof (typeof CAPTURE_COPY_DEFAULTS)[G]]: (typeof CAPTURE_COPY_DEFAULTS)[G][K] extends readonly string[] ? K : never }[keyof (typeof CAPTURE_COPY_DEFAULTS)[G]];

/** Replace `{app}` and `{side}`; anything else in braces stays as written. */
export function fillPlaceholders(s: string, vars: { app?: string | null; side?: string | null }): string {
  return s.replace(/\{(app|side)\}/g, (m, k: 'app' | 'side') => {
    const v = vars[k];
    return v != null ? v : m;
  });
}

const blank = (v: unknown): boolean => v == null || (typeof v === 'string' && v.trim().length === 0);

/** How the SDK words each direction today. */
export const SIDE_WORDS: Record<'left' | 'right' | 'up' | 'down', string> = {
  left: 'to the left', right: 'to the right', up: 'up', down: 'down',
};

/** The host page's name for `{app}` when there is no display name. */
function hostAppName(): string | null {
  if (typeof document === 'undefined') return null;
  const t = document.title?.trim();
  if (t) return t;
  const h = typeof location !== 'undefined' ? location.hostname : '';
  return h || null;
}

/**
 * Resolved capture strings: overrides over the shipped defaults, with the
 * placeholders filled. One per session or Flow run.
 */
export class CaptureStrings {
  /** The display name `{app}` reads (null when the integrator set none). */
  readonly app: string | null;
  private readonly appForOverrides: string | null;

  constructor(private readonly copy: CaptureCopy | null | undefined = undefined, app?: string | null, hostName: string | null = hostAppName()) {
    this.app = app && app.trim() ? app.trim() : null;
    this.appForOverrides = this.app ?? hostName;
  }

  /** The override for a key, if set and not blank. */
  private override<G extends Group>(group: G, key: string): unknown {
    const g = (this.copy as Record<string, Record<string, unknown> | undefined> | undefined)?.[group];
    const v = g?.[key];
    return blank(v) ? undefined : v;
  }

  /** Whether a key has a (non-blank) override. */
  has<G extends Group>(group: G, key: StringKey<G> | ListKey<G>): boolean {
    return this.override(group, key as string) !== undefined;
  }

  /** A string: the override if set, else the shipped default; placeholders filled. */
  t<G extends Group>(group: G, key: StringKey<G>, vars: { side?: string | null } = {}): string {
    const o = this.override(group, key as string);
    if (typeof o === 'string') return fillPlaceholders(o, { app: this.appForOverrides, side: vars.side });
    if (group === 'result' && this.app === null) {
      const na = (SITUATIONAL_DEFAULTS.noApp as Record<string, string>)[key as string];
      if (na) return na;
    }
    const d = (CAPTURE_COPY_DEFAULTS[group] as Record<string, unknown>)[key as string] as string;
    return fillPlaceholders(d, { app: this.app, side: vars.side });
  }

  /** A list (tips): the override if it is a non-empty array of strings, else the default. */
  list<G extends Group>(group: G, key: ListKey<G>): string[] {
    const o = this.override(group, key as string);
    if (Array.isArray(o)) {
      const items = o.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
        .map((x) => fillPlaceholders(x, { app: this.appForOverrides }));
      if (items.length > 0) return items;
    }
    return [...((CAPTURE_COPY_DEFAULTS[group] as Record<string, unknown>)[key as string] as readonly string[])];
  }

  // ── Situational strings ────────────────────────────────────────────────

  /** The primer: one step, or two when the policy already has a challenge. */
  primer(challenge: string | undefined): { title: string; body: string; tips: string[]; start: string; two: boolean } {
    const two = challenge === 'head_turn' || challenge === 'follow_dot' || challenge === 'speak_phrase';
    if (!two) return { title: this.t('primer', 'selfieTitle'), body: this.t('primer', 'selfieBody'), tips: this.list('primer', 'selfieTips'), start: this.t('primer', 'start'), two };
    const body = challenge === 'speak_phrase' && !this.has('primer', 'twoStepsBody')
      ? SITUATIONAL_DEFAULTS.twoStepsBodyDigits : this.t('primer', 'twoStepsBody');
    return { title: this.t('primer', 'twoStepsTitle'), body, tips: this.list('primer', 'twoStepsTips'), start: this.t('primer', 'start'), two };
  }

  /** The "One more quick check" sheet sentence. */
  sheetBody(type: 'head_turn' | 'follow_dot' | 'speak_phrase', directions?: string[]): string {
    if (this.has('extraCheck', 'sheetBody')) {
      const first = (directions ?? []).find((d) => d !== 'center') as keyof typeof SIDE_WORDS | undefined;
      return this.t('extraCheck', 'sheetBody', { side: first ? SIDE_WORDS[first] : null });
    }
    if (type !== 'head_turn') return SITUATIONAL_DEFAULTS.sheetBody[type];
    const dirs = (directions ?? []).filter((d): d is keyof typeof SIDE_WORDS => d in SIDE_WORDS);
    if (dirs.length === 0) return CAPTURE_COPY_DEFAULTS.extraCheck.sheetBody;
    // The first two sides the server asked for (as iOS).
    return `Slowly turn your head ${dirs.slice(0, 2).map((d) => SIDE_WORDS[d]).join(', then ')}.`;
  }

  /** A Head Turn step's title: the first turn in full, later ones "Now ...". */
  headTurn(direction: string, firstTurn: boolean): { text: string; sub?: string } {
    if (direction !== 'left' && direction !== 'right' && direction !== 'up' && direction !== 'down') {
      return { text: this.t('extraCheck', 'lookCentre') };
    }
    const side = SIDE_WORDS[direction];
    const vertical = direction === 'up' || direction === 'down';
    if (firstTurn) {
      const text = vertical && !this.has('extraCheck', 'headTurn')
        ? fillPlaceholders(SITUATIONAL_DEFAULTS.headTurnVertical, { side })
        : this.t('extraCheck', 'headTurn', { side });
      return { text, sub: this.t('extraCheck', 'slowly') };
    }
    const text = vertical && !this.has('extraCheck', 'headTurnNext')
      ? fillPlaceholders(SITUATIONAL_DEFAULTS.headTurnNextVertical, { side })
      : this.t('extraCheck', 'headTurnNext', { side });
    return { text };
  }

  /** The retry hint after a missed turn. */
  turnFurther(direction: string): string {
    if (direction !== 'left' && direction !== 'right' && direction !== 'up' && direction !== 'down') {
      return SITUATIONAL_DEFAULTS.turnFurtherCentre;
    }
    const side = SIDE_WORDS[direction];
    if ((direction === 'up' || direction === 'down') && !this.has('extraCheck', 'turnFurther')) {
      return fillPlaceholders(SITUATIONAL_DEFAULTS.turnFurtherVertical, { side });
    }
    return this.t('extraCheck', 'turnFurther', { side });
  }

  /** The second line while a turn is paused, for the step's direction. */
  pausedTurn(direction: string | null | undefined): string {
    if (direction === 'center') return this.t('extraCheck', 'pausedLookCentre');
    if (direction !== 'left' && direction !== 'right' && direction !== 'up' && direction !== 'down') return this.t('extraCheck', 'pausedTurn');
    const side = SIDE_WORDS[direction];
    if ((direction === 'up' || direction === 'down') && !this.has('extraCheck', 'pausedTurnSide')) {
      return fillPlaceholders(SITUATIONAL_DEFAULTS.pausedTurnVertical, { side });
    }
    return this.t('extraCheck', 'pausedTurnSide', { side });
  }

  /** The gate hint for a check id (quality-gate GateCheckId / hint id). */
  gateHint(id: string): { text: string; sub?: string } | null {
    switch (id) {
      case 'face': return { text: this.t('guidance', 'showFace') };
      case 'one_person': return { text: this.t('guidance', 'onePerson') };
      case 'covered': return { text: this.t('guidance', 'covered') };
      case 'in_frame': return { text: this.t('guidance', 'centre') };
      case 'too_far': return { text: this.t('guidance', 'closer') };
      case 'too_close': return { text: this.t('guidance', 'back') };
      case 'pose': return { text: this.t('guidance', 'straight') };
      case 'too_dark': return { text: this.t('guidance', 'dark'), sub: this.t('guidance', 'darkHint') };
      case 'too_bright': return { text: this.t('guidance', 'bright'), sub: this.t('guidance', 'brightHint') };
      case 'sharpness': return { text: this.t('guidance', 'blur') };
      case 'eyes': return { text: this.t('guidance', 'eyes') };
      case 'stillness': return { text: this.t('guidance', 'holdStill') };
      default: return null;
    }
  }
}

/** The default strings (no overrides, no display name). */
export const DEFAULT_CAPTURE_STRINGS = new CaptureStrings(undefined, null, null);

/**
 * Merge a higher-priority `copy.capture` over a lower one, key by key. A
 * blank (or empty list) high value is unset, so the lower layer shows through.
 */
export function mergeCaptureCopy(high: CaptureCopy | null | undefined, low: CaptureCopy | null | undefined): CaptureCopy | undefined {
  if (!high) return low ?? undefined;
  if (!low) return high;
  const out: Record<string, Record<string, unknown>> = {};
  const groups = new Set([...Object.keys(low), ...Object.keys(high)]);
  for (const g of groups) {
    const lo = ((low as Record<string, unknown>)[g] ?? {}) as Record<string, unknown>;
    const hi = ((high as Record<string, unknown>)[g] ?? {}) as Record<string, unknown>;
    const merged: Record<string, unknown> = { ...lo };
    for (const [k, v] of Object.entries(hi)) {
      if (blank(v) || (Array.isArray(v) && v.every(blank))) continue;
      merged[k] = v;
    }
    out[g] = merged;
  }
  return out as CaptureCopy;
}
