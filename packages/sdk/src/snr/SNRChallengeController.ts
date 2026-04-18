/**
 * SNR (Screen-Nonce Reflection) challenge controller.
 *
 * Drives emission of a per-session color sequence via requestAnimationFrame
 * while the capture pipeline records frames. Produces a render manifest the
 * server uses to align captured frames with emitted states during Signal A
 * scoring.
 *
 * Phase 1 only runs on web; mobile continues to use the legacy
 * FlashReflection challenge until Phase 2 lands full SNR with hardware
 * attestation binding.
 */

/**
 * One state in the HSL emission sequence delivered by the server.
 * Shape mirrors `snr-nonce.tsx:HslState` on the backend.
 */
export interface SNRHslState {
  /** Hue in HSL degrees (0 to 360). */
  h: number;
  /** Saturation in [0, 1]. */
  s: number;
  /** Luminance in [0, 1]. */
  l: number;
  /** How long this state is held on screen, milliseconds. */
  dur_ms: number;
}

/** Opaque challenge envelope delivered by session-create. */
export interface SNRChallengeEnvelope {
  version: 'snr-flash-v1';
  kind: 'snr-flash-v1';
  challenge_id: string;
  states: SNRHslState[];
  accessibility_profile: 'default' | 'reduced-flash';
  issued_at: string;
  expires_at: string;
  hmac: string;
}

/** One entry in the per-frame render manifest uploaded to the server. */
export interface SNRRenderManifestEntry {
  frame_index: number;
  state_index: number;
  /** 'held' = captured mid-state; 'transition' = captured within a transition frame. */
  transition_phase: 'held' | 'transition';
  wallclock_ms: number;
}

/**
 * Callbacks the controller uses to drive the host UI and capture pipeline.
 * All callbacks are synchronous.
 */
export interface SNRChallengeCallbacks {
  /**
   * Apply the emission color (HSL) to the overlay region. Called with
   * `null` to clear the overlay (between states). Expected to render on
   * the next animation frame with no CSS transition.
   */
  setEmissionColor: (state: SNRHslState | null) => void;
  /**
   * Return the current frame index from the capture pipeline. If no frame
   * has yet been captured, return the index the next captured frame will
   * take. The manifest uses this to associate emissions with frames.
   */
  getCurrentFrameIndex: () => number;
}

/** Outcome of a completed challenge run. */
export interface SNRChallengeResult {
  /** The envelope untouched, to be uploaded to the server as `challenge_echo`. */
  consumedChallenge: SNRChallengeEnvelope;
  /** Per-frame render manifest. */
  manifest: SNRRenderManifestEntry[];
  /** Total wallclock duration spent emitting, milliseconds. */
  durationMs: number;
}

/** Reason the challenge was aborted. */
export type SNRAbortReason =
  | 'visibility_lost'
  | 'expired_before_start'
  | 'user_abort'
  | 'challenge_invalid';

const TRANSITION_WINDOW_MS = 16; // ~one 60Hz frame around each state boundary

/**
 * Controller that orchestrates a single SNR challenge run. Safe to be
 * instantiated once per session; do not reuse across sessions.
 */
export class SNRChallengeController {
  private readonly envelope: SNRChallengeEnvelope;
  private readonly callbacks: SNRChallengeCallbacks;
  private manifest: SNRRenderManifestEntry[] = [];
  private running = false;
  private aborted: SNRAbortReason | null = null;
  private rafHandle: number | null = null;
  private visibilityListener: (() => void) | null = null;
  private startWallclock = 0;

  constructor(envelope: SNRChallengeEnvelope, callbacks: SNRChallengeCallbacks) {
    if (!envelope || envelope.version !== 'snr-flash-v1') {
      throw new Error('SNRChallengeController: unsupported challenge version');
    }
    if (!Array.isArray(envelope.states) || envelope.states.length === 0) {
      throw new Error('SNRChallengeController: envelope has no states');
    }
    this.envelope = envelope;
    this.callbacks = callbacks;
  }

  /**
   * Run the challenge to completion.
   *
   * @returns the result on natural completion.
   * @throws with `message.startsWith('snr_aborted:')` when aborted.
   */
  async run(): Promise<SNRChallengeResult> {
    if (this.running) {
      throw new Error('SNRChallengeController: already running');
    }
    const now = Date.now();
    if (new Date(this.envelope.expires_at).getTime() <= now) {
      throw new Error('snr_aborted:expired_before_start');
    }
    this.running = true;
    this.manifest = [];
    this.aborted = null;
    this.startWallclock = nowMs();

    this.attachVisibilityHandler();

    try {
      await this.runStates();
    } finally {
      this.callbacks.setEmissionColor(null);
      this.detachVisibilityHandler();
      this.running = false;
    }

    if (this.aborted) {
      throw new Error(`snr_aborted:${this.aborted}`);
    }

    return {
      consumedChallenge: this.envelope,
      manifest: this.manifest,
      durationMs: nowMs() - this.startWallclock,
    };
  }

  /** Request that an in-progress run stop at the next frame boundary. */
  abort(reason: SNRAbortReason = 'user_abort'): void {
    this.aborted = reason;
    if (this.rafHandle !== null && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(this.rafHandle);
      this.rafHandle = null;
    }
  }

  // ---------- Internals ----------

  private async runStates(): Promise<void> {
    for (let stateIndex = 0; stateIndex < this.envelope.states.length; stateIndex++) {
      if (this.aborted) return;
      const state = this.envelope.states[stateIndex];
      this.callbacks.setEmissionColor(state);

      // Wait until the next animation frame to record the transition boundary
      await this.awaitRaf();
      if (this.aborted) return;

      const stateStart = nowMs();
      this.recordManifestEntry(stateIndex, 'transition', stateStart);

      // Hold the state for its full dur_ms, recording 'held' samples on
      // subsequent frames. We stop recording 'held' for the very last
      // TRANSITION_WINDOW_MS which is tagged 'transition' so the server can
      // drop those from Signal A.
      const holdUntil = stateStart + state.dur_ms;
      const transitionStart = holdUntil - TRANSITION_WINDOW_MS;

      while (nowMs() < holdUntil) {
        await this.awaitRaf();
        if (this.aborted) return;
        const t = nowMs();
        this.recordManifestEntry(
          stateIndex,
          t >= transitionStart ? 'transition' : 'held',
          t,
        );
      }
    }
  }

  private recordManifestEntry(
    stateIndex: number,
    phase: 'held' | 'transition',
    wallclockMs: number,
  ): void {
    const frameIndex = this.callbacks.getCurrentFrameIndex();
    // If no frame has been captured yet since the last recorded entry, skip
    // recording duplicates. The capture pipeline may run at a lower rate
    // than rAF.
    const last = this.manifest[this.manifest.length - 1];
    if (last && last.frame_index === frameIndex) return;
    this.manifest.push({
      frame_index: frameIndex,
      state_index: stateIndex,
      transition_phase: phase,
      wallclock_ms: wallclockMs,
    });
  }

  private awaitRaf(): Promise<void> {
    return new Promise((resolve) => {
      if (typeof requestAnimationFrame === 'function') {
        this.rafHandle = requestAnimationFrame(() => {
          this.rafHandle = null;
          resolve();
        });
      } else {
        // Fallback for non-browser test environments: yield to the event loop.
        setTimeout(() => resolve(), 16);
      }
    });
  }

  private attachVisibilityHandler(): void {
    if (typeof document === 'undefined') return;
    this.visibilityListener = () => {
      if (document.visibilityState === 'hidden') {
        this.abort('visibility_lost');
      }
    };
    document.addEventListener('visibilitychange', this.visibilityListener);
  }

  private detachVisibilityHandler(): void {
    if (typeof document === 'undefined' || !this.visibilityListener) return;
    document.removeEventListener('visibilitychange', this.visibilityListener);
    this.visibilityListener = null;
  }
}

function nowMs(): number {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
}
