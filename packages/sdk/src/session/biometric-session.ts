/**
 * runBiometricSession -- straight-line port of VerificationCaptureEngine.
 *
 * v1 scope (tracer bullet):
 *   - challenge_type === 'none'
 *   - no inline step-up
 *   - no upload retries (delegated to api-client)
 *   - MediaPipe optional (falls through if not ready)
 *
 * Out of scope for v1 (will throw `StraightLinePathUnsupported`):
 *   - challenge_type !== 'none'
 *   - inline_step_up.enabled === true (still throws even if we don't trigger)
 *
 * The function owns:
 *   - getUserMedia call and stream lifecycle
 *   - rAF-style timer loops (face-guide, env-checks, baseline)
 *   - frame capture into an internal buffer
 *   - upload + complete sequence
 *   - error mapping to the host via thrown Error
 *
 * The function does NOT own:
 *   - DOM video elements (passed in by the shell)
 *   - the "I'm Ready" button (shell resolves `awaitUserReady`)
 *   - React state (shell translates `onUiEvent`)
 */

import type {
  CapturePhase,
  CaptureResult,
  CaptureSessionData,
  Environment,
  FaceGuideStatus,
  FaceMeshSignals,
  FrameSignal,
  FramesManifestEntry,
  SignalMetadata,
  SuspicionData,
  WebIntegritySignals,
} from '../types';
import { collectWebIntegritySignals } from '../capture/web-integrity';
import {
  evaluateFaceGuide,
  extractFrameSignal,
  initFaceMesh,
  isFaceMeshReady,
} from '../capture/media-pipe';
import {
  captureOneFrame,
  getFrameInterval,
  isFrameBudgetExhausted,
} from '../capture/frame-capture';
import type { CapturedFrame } from '../capture/frame-capture';
import { computeScreenDetectionSignals } from '../capture/screen-detection';
import { SuspicionEngine } from '../capture/suspicion-engine';
import { uploadSignals, completeSession } from '../api-client';
import { getCameraErrorMessage } from '../utils/errors';
import type { OnUiEvent } from './ui-event';
import { realClock, type Clock } from './clock';

const SDK_VERSION = '4.1.0';
const BASELINE_DURATION_MS = 2000;
const FACE_GUIDE_AUTO_ADVANCE_FRAMES = 8;
const FACE_GUIDE_TICK_MS = 250;

export interface RunBiometricSessionParams {
  sessionData: CaptureSessionData;
  environment: Environment;
  apiBaseUrl?: string;
  /** Clear video element used for face-guide evaluation and frame capture. */
  video: HTMLVideoElement;
  /** Blurred video shown behind the oval. May be null. */
  blurredVideo: HTMLVideoElement | null;
  /** Resolves when the user clicks "I'm Ready" or auto-advance fires. */
  awaitUserReady: () => Promise<void>;
  /** Called by the function to fire auto-advance after N ready frames. */
  signalUserReady: () => void;
  /** Single channel for UI updates. */
  onUiEvent: OnUiEvent;
  /** AbortSignal: when aborted, function rejects with `Error('aborted')`. */
  signal?: AbortSignal;
  /**
   * Clock used for all timing (face-guide ticks, baseline duration, frame
   * pacing). Defaults to `realClock`. Tests pass a `FakeClock` to drive
   * time deterministically.
   */
  clock?: Clock;
}

export class StraightLinePathUnsupported extends Error {
  constructor(reason: string) {
    super(`runBiometricSession v1 does not support: ${reason}`);
    this.name = 'StraightLinePathUnsupported';
  }
}

export async function runBiometricSession(
  params: RunBiometricSessionParams
): Promise<CaptureResult> {
  const { sessionData, environment, apiBaseUrl, video, blurredVideo, awaitUserReady,
    signalUserReady, onUiEvent, signal, clock = realClock } = params;

  // ── v1 scope guards ─────────────────────────────────────────────────
  if (sessionData.policy.challenge_type !== 'none') {
    throw new StraightLinePathUnsupported(
      `challenge_type=${sessionData.policy.challenge_type} (only 'none' in v1)`
    );
  }
  if (sessionData.policy.inline_step_up?.enabled) {
    throw new StraightLinePathUnsupported('inline_step_up.enabled=true');
  }

  const aborted = () => signal?.aborted === true;
  const throwIfAborted = () => { if (aborted()) throw new Error('aborted'); };

  const phase = (p: CapturePhase, label: string) =>
    onUiEvent({ type: 'phase', phase: p, label });

  // Internal state -- mirrors the refs in the React engine.
  const frames: CapturedFrame[] = [];
  const meshSignals: FrameSignal[] = [];
  const frameLuminances: number[] = [];
  const sessionStartedAtMs = Date.now();
  let captureStartTime = 0;
  let captureStartedAtMs = 0;
  let stream: MediaStream | null = null;

  // ── Phase: initializing ─────────────────────────────────────────────
  phase('initializing', 'Getting ready...');
  let channelIntegrity: WebIntegritySignals;
  try {
    const [signals] = await Promise.all([
      collectWebIntegritySignals().catch(() => ({} as WebIntegritySignals)),
      initFaceMesh().catch(() => {}),
    ]);
    channelIntegrity = signals;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Initialization failed';
    throw new Error(message);
  }
  throwIfAborted();

  const stepUpThreshold = sessionData.policy.inline_step_up?.suspicion_threshold ?? 55;
  const suspicion = new SuspicionEngine(stepUpThreshold);

  // ── Phase: camera-request ───────────────────────────────────────────
  phase('camera-request', 'Requesting camera access...');
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        facingMode: 'user',
        frameRate: { ideal: 30 },
      },
      audio: false, // v1: challenge_type is always 'none', never speak_phrase
    });
    video.srcObject = stream;
    await video.play();
    if (blurredVideo) {
      blurredVideo.srcObject = stream;
      await blurredVideo.play();
    }
    if (channelIntegrity.permissions_state) {
      channelIntegrity.permissions_state.camera = 'granted';
    }
  } catch (err) {
    onUiEvent({ type: 'cameraError', message: getCameraErrorMessage(err) });
    phase('camera-error', 'Camera error');
    if (stream) stream.getTracks().forEach(t => t.stop());
    throw err;
  }
  throwIfAborted();

  // ── Phase: face-guide ───────────────────────────────────────────────
  // Every FACE_GUIDE_TICK_MS, evaluate the face guide. After
  // FACE_GUIDE_AUTO_ADVANCE_FRAMES consecutive ready ticks, fire
  // signalUserReady() (auto-advance). Concurrently, the shell awaits the
  // user clicking "I'm Ready". Either resolves `awaitUserReady`.
  //
  // One clock model: clock.sleep gates the loop, awaitUserReady ends it.
  phase('face-guide', 'Position your face in the oval');
  let consecutiveReady = 0;
  let guideStop = false;
  const guideLoop = (async () => {
    while (!guideStop && !aborted()) {
      if (video.readyState >= 2) {
        const status: FaceGuideStatus = isFaceMeshReady()
          ? evaluateFaceGuide(video)
          : {
              faceDetected: true,
              faceCentered: true,
              faceDistance: 'good',
              faceVisible: true,
              message: 'Position your face in the oval',
              ready: false,
            };
        onUiEvent({ type: 'faceGuide', status });
        if (status.ready) {
          consecutiveReady++;
          if (consecutiveReady >= FACE_GUIDE_AUTO_ADVANCE_FRAMES) {
            signalUserReady();
          }
        } else {
          consecutiveReady = 0;
        }
      }
      await clock.sleep(FACE_GUIDE_TICK_MS);
    }
  })();

  try {
    await awaitUserReady();
  } finally {
    guideStop = true;
  }
  await guideLoop.catch(() => {}); // drain
  throwIfAborted();

  // ── Phase: baseline ─────────────────────────────────────────────────
  phase('baseline', 'Keep your face still...');
  onUiEvent({ type: 'progress', value: 0 });
  captureStartTime = clock.now();
  captureStartedAtMs = Date.now();

  const fps = sessionData.upload.target_fps || 4;
  const frameIntervalMs = getFrameInterval(fps);
  const baselineStart = clock.now();

  while (clock.now() - baselineStart < BASELINE_DURATION_MS && !aborted()) {
    if (isFrameBudgetExhausted(frames.length)) break;
    if (video.readyState >= 2) {
      const frame = await captureOneFrame(video, frames.length, captureStartTime);
      if (frame) {
        frames.push(frame);
        onUiEvent({ type: 'framesCollected', count: frames.length });
        if (isFaceMeshReady()) {
          const sig = extractFrameSignal(video, frame.index, 'baseline');
          if (sig) meshSignals.push(sig);
        }
        suspicion.push(
          meshSignals[meshSignals.length - 1]?.headPose ?? { yaw: 0, pitch: 0, roll: 0 },
          frame.luminance,
          50, // sharpness placeholder; full port wires computeFrameSharpness
        );
        frameLuminances.push(frame.luminance);
      }
    }
    const elapsed = clock.now() - baselineStart;
    onUiEvent({ type: 'progress', value: Math.min((elapsed / BASELINE_DURATION_MS) * 100, 100) });
    await clock.sleep(frameIntervalMs);
  }
  throwIfAborted();

  // ── Phase: uploading ────────────────────────────────────────────────
  phase('uploading', 'Uploading verification data...');

  const frameTimestamps = frames.map(f => f.timestamp);
  channelIntegrity.frame_timestamps = frameTimestamps;
  channelIntegrity.avg_frame_interval_ms = frameTimestamps.length >= 2
    ? Math.round(
        (frameTimestamps[frameTimestamps.length - 1] - frameTimestamps[0]) /
        (frameTimestamps.length - 1)
      )
    : 0;
  channelIntegrity.camera_permission_granted = !!stream;
  channelIntegrity.camera_resolution = `${video.videoWidth}x${video.videoHeight}`;
  if (channelIntegrity.permissions_state) {
    channelIntegrity.permissions_state.camera = 'granted';
  }
  channelIntegrity.screen_detection = computeScreenDetectionSignals(frameLuminances, null);

  const framesManifest: FramesManifestEntry[] = frames.map(f => ({
    frame_index: f.index,
    capture_timestamp_ms: f.timestamp,
    resolution_w: f.resolution.w,
    resolution_h: f.resolution.h,
  }));

  const faceMeshSignals: FaceMeshSignals | null = meshSignals.length > 0
    ? {
        model: 'mediapipe_face_landmarker_v2',
        frame_count: meshSignals.length,
        frames: meshSignals.map(s => ({
          frame_index: s.frameIndex,
          timestamp_ms: s.timestamp,
          headPose: s.headPose,
          leftEAR: s.leftEAR,
          rightEAR: s.rightEAR,
          bbox: s.bbox,
        })),
      }
    : null;

  const suspicionData: SuspicionData = suspicion.getSnapshot() ?? {
    final_score: 0,
    triggered: false,
    snapshot: { score: 0, signals: [], framesAnalyzed: 0, reliable: false, timestamp: Date.now() },
  };

  const metadata: SignalMetadata = {
    session_id: sessionData.session_id,
    sdk_version: SDK_VERSION,
    platform: 'web',
    source: 'sdk',
    capture_config: {
      captureDurationMs: sessionData.upload.capture_duration_ms,
      targetFps: sessionData.upload.target_fps,
      maxFrames: sessionData.upload.max_frames,
    },
    timestamps: {
      session_started_at_ms: sessionStartedAtMs,
      capture_started_at_ms: captureStartedAtMs,
      capture_ended_at_ms: Date.now(),
    },
    frames_manifest: framesManifest,
    frame_hashes: frames.map(f => f.hash),
    channel_integrity: channelIntegrity,
    challenge_response: { type: 'none', completed: true },
    face_mesh_signals: faceMeshSignals,
    verification_package: null, // v1: skip mesh package (full port adds this)
    suspicion: suspicionData,
    inline_step_up: null,
  };

  await uploadSignals({
    apiBaseUrl,
    environment,
    sessionId: sessionData.session_id,
    sessionToken: sessionData.session_token,
    nonce: sessionData.nonce,
    frames: frames.map(f => f.bytes),
    metadata,
    audioBlob: null,
  });
  throwIfAborted();

  // ── Phase: completing ───────────────────────────────────────────────
  phase('completing', 'Verifying...');
  const decision = await completeSession({
    apiBaseUrl,
    environment,
    sessionId: sessionData.session_id,
    sessionToken: sessionData.session_token,
    nonce: sessionData.nonce,
  });

  // Stop camera before yielding decision to host.
  if (stream) {
    stream.getTracks().forEach(t => t.stop());
    stream = null;
  }

  phase('done', 'Complete');
  return decision;
}
