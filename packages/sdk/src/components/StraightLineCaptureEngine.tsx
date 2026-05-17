/**
 * StraightLineCaptureEngine -- thin React shell around runBiometricSession.
 *
 * Casey-style sibling to VerificationCaptureEngine: instead of bolting a flag
 * into the 1.3k-line god component, this is a 120-line adapter you can read
 * top to bottom. The old engine stays unchanged. Delete this file or that
 * file when one wins.
 *
 * v1 scope mirrors runBiometricSession: challenge_type='none', no step-up.
 * No result screen, no intro screen, no styled chrome. Mounts the video,
 * shows the current phase + "I'm Ready" button, and calls onComplete with
 * the decision. Hosts wrap their own UI around it.
 */

import React, { useEffect, useRef, useState } from 'react';
import type { CaptureResult, VerificationCaptureEngineProps } from '../types';
import { runBiometricSession, StraightLinePathUnsupported } from '../session/biometric-session';
import type { UiEvent } from '../session/ui-event';
import {
  initialSnapshot,
  reduce,
  showReadyButton,
  showProgress,
  showFaceGuideMessage,
  type SessionSnapshot,
} from '../session/snapshot';

export type StraightLineCaptureEngineProps = Pick<
  VerificationCaptureEngineProps,
  'sessionData' | 'environment' | 'apiBaseUrl' | 'primaryColor' | 'onComplete' | 'onError' | 'onCancel' | 'onPhaseChange'
>;

const DEFAULT_PRIMARY = '#4F7CFF';

export const StraightLineCaptureEngine: React.FC<StraightLineCaptureEngineProps> = ({
  sessionData,
  environment = 'sandbox',
  apiBaseUrl,
  primaryColor = DEFAULT_PRIMARY,
  onComplete,
  onError,
  onCancel,
  onPhaseChange,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const blurredRef = useRef<HTMLVideoElement>(null);

  // Deferred resolved by either the "I'm Ready" button OR auto-advance from
  // inside runBiometricSession. Held in a ref so the callback identities are
  // stable across re-renders.
  const readyDeferredRef = useRef<{ promise: Promise<void>; resolve: () => void } | null>(null);
  if (!readyDeferredRef.current) {
    let resolve!: () => void;
    const promise = new Promise<void>((r) => { resolve = r; });
    readyDeferredRef.current = { promise, resolve };
  }

  const [snap, setSnap] = useState<SessionSnapshot>(initialSnapshot);

  // onPhaseChange is fired from an effect, NOT from inside the setSnap updater.
  // Updater functions must be pure; calling a parent prop callback from inside
  // one would (a) violate that purity and (b) trigger React's
  // "Cannot update a component while rendering a different component" warning
  // when the parent's handler calls setState.
  const lastPhaseRef = useRef(snap.phase);
  useEffect(() => {
    if (snap.phase !== lastPhaseRef.current) {
      lastPhaseRef.current = snap.phase;
      onPhaseChange?.(snap.phase, snap.phaseLabel);
    }
  }, [snap.phase, snap.phaseLabel, onPhaseChange]);

  useEffect(() => {
    const ac = new AbortController();
    let cancelled = false;

    const handleEvent = (e: UiEvent) => {
      if (cancelled) return;
      setSnap((prev) => reduce(prev, e));
    };

    const start = async () => {
      // Wait one tick so refs are wired.
      await new Promise<void>((r) => setTimeout(r, 0));
      if (!videoRef.current) return;
      try {
        const result: CaptureResult = await runBiometricSession({
          sessionData,
          environment,
          apiBaseUrl,
          video: videoRef.current,
          blurredVideo: blurredRef.current,
          onUiEvent: handleEvent,
          awaitUserReady: () => readyDeferredRef.current!.promise,
          signalUserReady: () => readyDeferredRef.current!.resolve(),
          signal: ac.signal,
        });
        if (!cancelled) onComplete(result);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (cancelled || message === 'aborted') return;
        if (err instanceof StraightLinePathUnsupported) {
          onError(`SDK build error: ${err.message}`);
        } else {
          onError(message || 'Verification failed');
        }
      }
    };

    void start();
    return () => {
      cancelled = true;
      ac.abort();
    };
    // Intentionally re-runs only when the session id changes; the callback
    // props are captured by closure and not in deps by design.
  }, [sessionData.session_id]);

  const onReadyClick = () => {
    readyDeferredRef.current?.resolve();
  };

  return (
    <div style={styles.root}>
      <div style={styles.stage}>
        <video ref={blurredRef} style={styles.blurred} playsInline muted />
        <video ref={videoRef} style={styles.video} playsInline muted />
        <div style={styles.oval(primaryColor)} />
      </div>

      <div style={styles.hud}>
        <div style={{ fontSize: 14, color: '#6B6760' }}>Phase: {snap.phase}</div>
        <div style={{ fontSize: 18, fontWeight: 600, color: '#1C1A17' }}>{snap.phaseLabel}</div>
        {showProgress(snap) && (
          <div style={styles.progressBar}>
            <div style={{ ...styles.progressFill, width: `${snap.progress}%`, background: primaryColor }} />
          </div>
        )}
        {snap.framesCount > 0 && (
          <div style={{ fontSize: 12, color: '#6B6760' }}>Frames: {snap.framesCount}</div>
        )}
        {showFaceGuideMessage(snap) && snap.faceGuide && (
          <div style={{ fontSize: 13, color: snap.faceGuide.ready ? '#15803D' : '#B25500' }}>
            {snap.faceGuide.message}
          </div>
        )}
        {showReadyButton(snap) && (
          <button type="button" style={styles.primaryBtn(primaryColor)} onClick={onReadyClick}>
            I'm Ready
          </button>
        )}
        {snap.cameraError && (
          <div style={{ color: '#B73520', fontSize: 14 }}>Camera: {snap.cameraError}</div>
        )}
        {onCancel && (
          <button type="button" style={styles.cancelBtn} onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </div>
  );
};

// ── Inline styles. No theme system; this is the bare straight-line shell. ──

const styles = {
  root: { display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 16, padding: 24 },
  stage: { position: 'relative' as const, width: 480, height: 360, borderRadius: 12, overflow: 'hidden', background: '#000' },
  video: { width: '100%', height: '100%', objectFit: 'cover' as const, transform: 'scaleX(-1)' },
  blurred: { position: 'absolute' as const, inset: 0, width: '100%', height: '100%', objectFit: 'cover' as const, filter: 'blur(20px)', transform: 'scaleX(-1)' },
  oval: (color: string) => ({
    position: 'absolute' as const,
    top: '50%', left: '50%',
    transform: 'translate(-50%, -50%)',
    width: 220, height: 290,
    borderRadius: '50%',
    border: `3px solid ${color}`,
    pointerEvents: 'none' as const,
  }),
  hud: { display: 'flex', flexDirection: 'column' as const, gap: 8, alignItems: 'center', minWidth: 320 },
  progressBar: { width: 320, height: 6, background: '#E8E5DE', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', transition: 'width 100ms linear' },
  primaryBtn: (color: string): React.CSSProperties => ({
    height: 44, padding: '0 24px', border: 'none', borderRadius: 10,
    fontSize: 14, fontWeight: 600, cursor: 'pointer', background: color, color: '#fff',
  }),
  cancelBtn: {
    height: 36, padding: '0 16px', border: '1px solid #E8E5DE', borderRadius: 8,
    fontSize: 13, background: '#fff', color: '#1C1A17', cursor: 'pointer', marginTop: 8,
  } as React.CSSProperties,
};
