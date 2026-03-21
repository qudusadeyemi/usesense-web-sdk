# UseSense Web SDK - Frontend Technical Specification

**Covers server versions:** v1.17.5 through v1.17.7
**Date:** March 7, 2026
**Classification:** Internal Engineering
**Author:** UseSense Platform Team
**Target Audience:** Frontend engineer(s) maintaining the Web SDK capture UI
**Predecessor document:** `v1.17.4-technical-changelog.md`
**Status:** All changes are deployed to the server. **None have been end-to-end tested yet.**

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Session Capture Phase Lifecycle](#2-session-capture-phase-lifecycle)
3. [Change 1 - Face Guide Oval Overlay](#3-change-1---face-guide-oval-overlay)
4. [Change 2 - 3-2-1 Countdown Before Challenge](#4-change-2---3-2-1-countdown-before-challenge)
5. [Change 3 - Unified Indigo Theme](#5-change-3---unified-indigo-theme)
6. [Change 4 - Nonce Dual-Delivery Fix](#6-change-4---nonce-dual-delivery-fix)
7. [Change 5 - Hard 30-Frame Cap with Adaptive FPS](#7-change-5---hard-30-frame-cap-with-adaptive-fps)
8. [Change 6 - frames_per_step Lowered 3 to 2](#8-change-6---frames_per_step-lowered-3-to-2)
9. [Change 7 - SDK Tester Uses Server Adaptive target_fps](#9-change-7---sdk-tester-uses-server-adaptive-target_fps)
10. [API Response Schema Changes](#10-api-response-schema-changes)
11. [Frame Budget Enforcement](#11-frame-budget-enforcement)
12. [Complete Session Lifecycle Timing Example](#12-complete-session-lifecycle-timing-example)
13. [Testing Checklist](#13-testing-checklist)
14. [Version History](#14-version-history)

---

## 1. Executive Summary

These changes span three deployment versions and address two categories of improvement:

**UX Improvements (v1.17.5):**
- Added a face-positioning guide (oval overlay) so users can center their face before capture begins
- Added a 3-2-1 animated countdown between baseline capture and challenge phase
- Unified the entire capture/challenge overlay to an indigo color scheme (replacing the previous red dots, emerald badges, etc.)
- Fixed nonce replay-prevention failures caused by API gateways stripping custom headers, by sending nonce via both `X-Nonce` header AND `?nonce=` query parameter

**Performance / Network Optimization (v1.17.6-v1.17.7):**
- Enforced a hard maximum of 30 frames per session (down from the previous ~50-100 range)
- Server now computes an adaptive `target_fps` so frames distribute evenly across the full capture window (baseline + countdown + challenge)
- `frames_per_step` (minimum frames the SDK should tag per challenge step) lowered from 3 to 2, matching the reduced frame budget
- SDK tester updated to prefer the server's `upload.target_fps` over the challenge's nominal `capture_fps_hint`

### Impact Summary

| Area | What Changed | Breaking? |
|------|-------------|-----------|
| Phase lifecycle | 2 new phases added (`face-guide`, `countdown`) | No - additive |
| Color theme | All overlay elements now indigo-600 family | No - visual only |
| Nonce delivery | Must send nonce in BOTH header AND query param | **Yes** - if only header was sent, gateway stripping would cause 401 |
| Max frames | Hard cap at 30 (was ~50-100 depending on session) | **Behavioral** - SDK must respect `upload.max_frames` |
| FPS | Server returns `upload.target_fps` (often 2-5 fps) | **Behavioral** - SDK should use this instead of `capture_fps_hint` |
| Frames per step | 2 instead of 3 | No - reduces minimum, still validates |

---

## 2. Session Capture Phase Lifecycle

### Previous (v1.17.4)

```
idle -> instructions -> baseline -> challenge -> done
```

### Current (v1.17.5+)

```
idle -> instructions -> face-guide -> baseline -> countdown -> challenge -> done
         (if challenge)   (if challenge)           (if challenge)
```

### Full state machine

```
                    +-- no challenge ---> baseline ---> done
                    |
idle ---> [hasChallenge?]
                    |
                    +-- has challenge --> instructions
                                              |
                                         [user clicks "Got it"]
                                              |
                                         face-guide
                                              |
                                         [user clicks "My face is ready"]
                                              |
                                         baseline (2s, capturing frames)
                                              |
                                         countdown (3s: 3, 2, 1 - still capturing)
                                              |
                                         challenge (variable duration, capturing)
                                              |
                                         done (camera stops)
```

### State type definition

```tsx
type ChallengePhase =
  | 'idle'
  | 'instructions'
  | 'face-guide'
  | 'baseline'
  | 'countdown'
  | 'challenge'
  | 'done';
```

### New refs required

```tsx
// Existing from v1.17.4
const instructionsDismissRef = useRef<(() => void) | null>(null);

// NEW in v1.17.5
const faceGuideReadyRef = useRef<(() => void) | null>(null);
```

### New state for countdown

```tsx
const [countdownNumber, setCountdownNumber] = useState<number | null>(null);
```

---

## 3. Change 1 - Face Guide Oval Overlay

### Purpose

Before frame capture begins, users need to position their face within the camera frame. The face guide shows a dashed oval overlay with a semi-transparent background, giving users a clear target area. This improves face detection success rates, especially on first-time users.

### When it appears

- Only when the session has a step-up challenge (`hasChallenge === true`)
- After the user dismisses the instructions screen
- Before baseline capture starts
- **No frames are captured during this phase**

### Implementation

The face guide blocks on a Promise that resolves when the user clicks "My face is ready":

```tsx
// Phase 0b: Face Guide
if (hasChallenge) {
  setChallengePhase('face-guide');
  setChallengeStepLabel('Position your face in the oval');
  setChallengeStepDirection('');
  setDotPosition(null);

  // BLOCKS until user clicks "My face is ready"
  await new Promise<void>(resolve => {
    faceGuideReadyRef.current = resolve;
  });
}
```

### Overlay rendering

The overlay uses a radial gradient to create a transparent elliptical cutout:

```tsx
{challengePhase === 'face-guide' && (
  <div className="absolute inset-0 z-10 flex flex-col items-center justify-center">
    {/* Semi-transparent surround with oval cutout */}
    <div
      className="absolute inset-0"
      style={{
        background: 'radial-gradient(ellipse 38% 50% at 50% 46%, transparent 98%, rgba(0,0,0,0.6) 100%)',
      }}
    />
    {/* Animated dashed oval border */}
    <div
      className="absolute border-[3px] border-dashed border-white/80 rounded-[50%]"
      style={{
        width: '38%',
        height: '62%',
        top: '15%',
        left: '31%',
        animation: 'pulse 2s ease-in-out infinite',
        boxShadow: '0 0 0 4px rgba(255,255,255,0.15), inset 0 0 30px rgba(255,255,255,0.05)',
      }}
    />
    {/* Top label */}
    <div className="absolute top-[4%] left-0 right-0 text-center">
      <div className="inline-block px-4 py-1.5 bg-black/60 rounded-full">
        <span className="text-white text-sm font-medium">Position your face in the oval</span>
      </div>
    </div>
    {/* Ready button */}
    <div className="absolute bottom-[6%] left-0 right-0 text-center">
      <button
        className="pointer-events-auto px-8 py-3 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-base font-bold rounded-2xl shadow-xl transition-all focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2"
        onClick={() => {
          if (faceGuideReadyRef.current) {
            faceGuideReadyRef.current();
            faceGuideReadyRef.current = null;
          }
        }}
      >
        My face is ready
      </button>
    </div>
  </div>
)}
```

### Oval geometry

| Property | Value | Notes |
|----------|-------|-------|
| Gradient center | `50% 46%` | Slightly above center to match typical face position |
| Ellipse radii | `38% 50%` | Width 38%, height 50% of the video element |
| Border position | `width: 38%, height: 62%, top: 15%, left: 31%` | Manually positioned to align with the gradient cutout |
| Border style | 3px dashed, white/80 | Pulsing animation for visibility |

### Important notes for SDK integrators

- The face guide does NOT capture any frames. Frame indices start at 0 from the baseline phase.
- There is no timeout. If the user never clicks, the session expires per server TTL (15 minutes).
- The button uses `pointer-events-auto` because the parent overlay container has `pointer-events-none`.

---

## 4. Change 2 - 3-2-1 Countdown Before Challenge

### Purpose

After baseline capture completes but before the challenge begins, a 3-2-1 countdown prepares the user. This prevents jarring transitions and gives users time to focus.

### When it appears

- Only when the session has a step-up challenge
- After baseline capture (2 seconds)
- Before the challenge phase
- **Frames ARE captured during countdown** (they count as additional baseline frames)

### Implementation

```tsx
// Phase 1b: Countdown 3-2-1 before challenge
if (hasChallenge) {
  setChallengePhase('countdown');
  setChallengeStepLabel('');
  setChallengeStepDirection('');
  console.log('Countdown before challenge...');
  for (let n = 3; n >= 1; n--) {
    setCountdownNumber(n);
    // Continue capturing baseline frames during countdown
    await captureForDuration(1000);
  }
  setCountdownNumber(null);
}
```

### Key behavior

- Each number displays for exactly 1 second (1000ms)
- Frame capture CONTINUES during countdown at the session's adaptive FPS
- Countdown frames are considered baseline frames (not tagged to any challenge step)
- Total countdown duration: 3 seconds (3000ms)

### Overlay rendering

```tsx
{challengePhase === 'countdown' && countdownNumber !== null && (
  <div className="absolute inset-0 z-10 flex items-center justify-center">
    <div className="absolute inset-0 bg-black/40" />
    <div className="relative flex flex-col items-center gap-3">
      <div
        key={countdownNumber}  // key forces re-mount for animation restart
        className="w-28 h-28 rounded-full bg-white/95 flex items-center justify-center shadow-2xl"
        style={{
          animation: 'countdown-pop 0.9s ease-out forwards',
        }}
      >
        <span className="text-6xl font-black text-indigo-600">{countdownNumber}</span>
      </div>
      <div className="px-4 py-1.5 bg-black/60 rounded-full">
        <span className="text-white text-sm font-semibold">Get ready...</span>
      </div>
    </div>
  </div>
)}
```

### Required keyframe animation

```css
@keyframes countdown-pop {
  0% { transform: scale(0.3); opacity: 0; }
  40% { transform: scale(1.15); opacity: 1; }
  100% { transform: scale(1); opacity: 1; }
}
```

### Timing impact on frame budget

The countdown adds 3 seconds of frame capture. With the adaptive FPS system, this is already accounted for in the server's `target_fps` computation:

```
totalCaptureMs = BASELINE_MS(2000) + COUNTDOWN_MS(3000) + challengeDurationMs
targetFps = max(2, min(nominalFps, floor(30 / (totalCaptureMs / 1000))))
```

---

## 5. Change 3 - Unified Indigo Theme

### Purpose

All capture/challenge overlay elements now use a consistent indigo color palette. Previously, the design mixed red (follow-dot), emerald/green (badges), and other colors, creating visual inconsistency.

### Color mapping

| Element | Before | After |
|---------|--------|-------|
| Instructions icon background | varied | `bg-indigo-100` |
| Instructions icon | varied | `text-indigo-600` |
| Instructions button | varied | `bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800` |
| Face guide button | N/A (new) | `bg-indigo-600` family |
| Countdown number | N/A (new) | `text-indigo-600` |
| Phase badge (baseline) | `bg-emerald-500/90` | `bg-indigo-500/90 text-white` |
| Phase badge (challenge) | `bg-amber-600/90` | `bg-indigo-600/90 text-white` |
| Step label (baseline) | `bg-emerald-600/85` | `bg-indigo-600/85 text-white` |
| Step label (challenge) | `bg-slate-800/85` | `bg-indigo-600/90 text-white` |
| Follow-dot dot | `bg-red-500` + red glow | `bg-indigo-500` + indigo glow |
| Direction arrow circle | `bg-white` with colored arrows | Indigo gradient background, white arrows |
| Challenge info card | default | `border-indigo-200 bg-indigo-50` |

### Follow-dot element (current)

```tsx
<div
  className="absolute w-6 h-6 bg-indigo-500 rounded-full border-2 border-white shadow-xl"
  style={{
    left: `${dotPosition.x * 100}%`,
    top: `${dotPosition.y * 100}%`,
    transform: 'translate(-50%, -50%)',
    transition: 'left 400ms cubic-bezier(0.4, 0, 0.2, 1), top 400ms cubic-bezier(0.4, 0, 0.2, 1)',
    boxShadow: '0 0 12px 4px rgba(99, 102, 241, 0.5)',  // indigo glow
  }}
/>
```

### Direction arrow circle (head_turn challenge)

```tsx
<div
  key={challengeStepDirection}
  className="flex items-center justify-center w-24 h-24 rounded-full shadow-2xl"
  style={{
    background: challengeStepDirection === 'center'
      ? 'linear-gradient(135deg, #6366f1, #8b5cf6)'    // indigo-500 -> violet-500
      : 'linear-gradient(135deg, #4f46e5, #6366f1)',    // indigo-600 -> indigo-500
    animation: 'direction-enter 0.35s ease-out forwards',
    boxShadow: '0 0 30px rgba(99, 102, 241, 0.5), 0 8px 25px rgba(0,0,0,0.3)',
  }}
>
  {/* White arrows/crosshair inside, w-14 h-14, strokeWidth={3} (or 2.5 for crosshair) */}
</div>
```

### Required keyframe

```css
@keyframes direction-enter {
  0% { transform: scale(0.5); opacity: 0; }
  60% { transform: scale(1.1); }
  100% { transform: scale(1); opacity: 1; }
}
```

### Baseline phase: subtle oval reminder

During the baseline phase, a subtle non-dashed oval appears as a lighter version of the face guide:

```tsx
{challengePhase === 'baseline' && (
  <div className="flex flex-col items-center gap-2 mb-8">
    <div
      className="absolute border-2 border-white/30 rounded-[50%] pointer-events-none"
      style={{ width: '38%', height: '62%', top: '15%', left: '31%' }}
    />
    <div className="px-6 py-3 rounded-xl text-lg font-bold shadow-lg bg-indigo-600/85 text-white">
      {challengeStepLabel}
    </div>
  </div>
)}
```

---

## 6. Change 4 - Nonce Dual-Delivery Fix

### Problem

Some API gateways, reverse proxies, and CDN edge nodes strip non-standard HTTP headers. The `X-Nonce` header was being stripped in certain deployments, causing all signal uploads and session completions to fail with `401 nonce_mismatch`.

### Solution

The SDK now sends the nonce via **both** delivery mechanisms:

1. `X-Nonce` header (primary)
2. `?nonce=` query parameter (fallback)

The server accepts from **either source** (header takes priority):

```ts
// Server-side (usesense-api-endpoints.tsx, both /signals and /complete endpoints)
const requestNonce = c.req.header('x-nonce') || c.req.query('nonce');
```

### SDK implementation

**Signal upload:**

```tsx
// Build URL with nonce query param
const nonceParam = sessionData.nonce
  ? `&nonce=${encodeURIComponent(sessionData.nonce)}`
  : '';
const url = `${baseUrl}/v1/sessions/${sessionData.session_id}/signals?env=${environment}${nonceParam}`;

// Also send in header
const headers = {
  'Authorization': `Bearer ${publicAnonKey}`,
  'X-Session-Token': sessionData.session_token,
  'X-Idempotency-Key': `${sessionData.session_id}_${Date.now()}`,
  ...(sessionData.nonce ? { 'X-Nonce': sessionData.nonce } : {}),
  'apikey': publicAnonKey,
};
```

**Session completion:**

```tsx
// Same dual-delivery pattern
const completeNonceParam = sessionData.nonce
  ? `&nonce=${encodeURIComponent(sessionData.nonce)}`
  : '';
const url = `${baseUrl}/v1/sessions/${sessionData.session_id}/complete?env=${environment}${completeNonceParam}`;

const headers = {
  'Authorization': `Bearer ${publicAnonKey}`,
  'X-Session-Token': sessionData.session_token,
  'X-Idempotency-Key': `${sessionData.session_id}_complete_${Date.now()}`,
  ...(sessionData.nonce ? { 'X-Nonce': sessionData.nonce } : {}),
  'apikey': publicAnonKey,
};
```

### Server-side diagnostic logging

When a nonce is required but not provided, the server now logs all relevant headers to assist debugging:

```ts
if (!requestNonce) {
  console.error('Nonce required but not provided. Session nonce:', session.nonce);
  console.error('All headers:', [...new Set([
    'x-nonce', 'X-Nonce', 'x-session-token', 'authorization', 'content-type', 'apikey'
  ].map(h => `${h}=${c.req.header(h) || '(missing)'}`))]);
}
```

### Endpoints affected

| Endpoint | Nonce Required | Delivery |
|----------|---------------|----------|
| `POST /v1/sessions` (create) | No (nonce is generated here) | N/A |
| `POST /v1/sessions/:id/signals` (upload) | Yes | Header + query param |
| `POST /v1/sessions/:id/complete` (complete) | Yes | Header + query param |
| `GET /v1/sessions/:id/status` (status) | No | N/A |

### Important: nonce is always present

The nonce is returned in the `POST /v1/sessions` response body:

```json
{
  "session_id": "sess_...",
  "session_token": "sess_tok_...",
  "nonce": "nonce_abc123def456",
  ...
}
```

The SDK MUST store this value and echo it on all subsequent requests for that session.

---

## 7. Change 5 - Hard 30-Frame Cap with Adaptive FPS

### Problem

Previous sessions could generate 50-100+ frames depending on challenge duration and FPS. This caused:

1. **Large uploads** (5-10 MB) on poor/metered mobile networks
2. **No analytical benefit** - the LiveSense engine only analyzes `MAX_SAMPLE_FRAMES = 8` evenly-spaced frames via the biometric engine (Rekognition DetectFaces)
3. **Wasted S3 storage** - 80%+ of uploaded frames were never analyzed

### Solution: Adaptive FPS

The server now computes the total capture window and calculates a `target_fps` such that `fps x duration <= 30 frames`:

```ts
// Server-side computation (usesense-api-endpoints.tsx, createSession)
const HARD_MAX_FRAMES = 30;
const BASELINE_MS = 2000;
const hasChallenge = !!(policy.challenge?.type && policy.challenge.type !== 'none');
const COUNTDOWN_MS = hasChallenge ? 3000 : 0;
const challengeDurationMs = policy.challenge?.total_duration_ms || 0;
const audioDurationMs = policy.audio_challenge?.total_duration_ms || 0;
const totalCaptureMs = BASELINE_MS + COUNTDOWN_MS + Math.max(challengeDurationMs, audioDurationMs);

const nominalFps = policy.challenge?.capture_fps_hint || 10;

// Core formula: lower FPS so 30 frames cover the full session
const targetFps = Math.max(2, Math.min(nominalFps, Math.floor(HARD_MAX_FRAMES / (totalCaptureMs / 1000))));
```

### Formula breakdown

```
targetFps = max(2, min(nominalFps, floor(30 / totalSeconds)))
```

- **Floor of 2 FPS**: Ensures minimum quality even for very long sessions
- **Capped at nominalFps**: Never exceeds the challenge's intended capture rate (typically 10 fps)
- **30 frames**: Hard maximum, providing identical analytical coverage while cutting upload size by ~60%

### Example calculations

| Session Type | Baseline | Countdown | Challenge | Total | Nominal | Computed FPS | Frames |
|-------------|----------|-----------|-----------|-------|---------|-------------|--------|
| Enrollment (no challenge) | 2s | 0s | 0s | 2s | 10 | 10 | ~20 |
| Auth + follow_dot (5wp x 1.5s) | 2s | 3s | 7.5s | 12.5s | 10 | 2 | ~25 |
| Auth + head_turn (3 steps) | 2s | 3s | 5.5s | 10.5s | 10 | 2 | ~21 |
| Auth + head_turn (4 steps) | 2s | 3s | 7.5s | 12.5s | 10 | 2 | ~25 |
| Auth + follow_dot (4wp x 1.5s) | 2s | 3s | 6s | 11s | 10 | 2 | ~22 |

### API response: `upload` object

The session creation response now includes:

```json
{
  "session_id": "sess_...",
  "session_token": "sess_tok_...",
  "policy": { ... },
  "upload": {
    "max_frames": 30,
    "target_fps": 2,
    "capture_duration_ms": 8000
  },
  "nonce": "nonce_..."
}
```

| Field | Type | Description |
|-------|------|-------------|
| `upload.max_frames` | `number` | Hard maximum frames the server will accept. Always 30. |
| `upload.target_fps` | `number` | Adaptive FPS the SDK should use for frame capture. Range: 2-10. |
| `upload.capture_duration_ms` | `number` | Minimum capture duration. Computed as `max(2500, challengeDuration + 500, audioDuration + 500)`. |

### SDK must honor these values

```tsx
// CORRECT: Use server's adaptive target_fps
const fps = sessionData?.upload?.target_fps || 10;
const maxFrames = sessionData?.upload?.max_frames || 30;

// WRONG: Using challenge's capture_fps_hint (ignores frame budget)
// const fps = challengeSpec.capture_fps_hint; // DO NOT USE THIS
```

The `capture_fps_hint` in the challenge spec is the NOMINAL fps the challenge was designed for. It does NOT account for the frame budget. The server's `upload.target_fps` is the authoritative value.

---

## 8. Change 6 - frames_per_step Lowered 3 to 2

### What changed

In `challenge-engine.tsx`, both `follow_dot` and `head_turn` challenge generators now set `frames_per_step: 2` (was 3).

```ts
// follow_dot
return {
  type: 'follow_dot',
  // ...
  frames_per_step: 2,  // was 3
  capture_fps_hint: 10,
};

// head_turn
return {
  type: 'head_turn',
  // ...
  frames_per_step: 2,  // was 3
  capture_fps_hint: 10,
};
```

### Why

With the hard 30-frame cap and adaptive FPS (often 2 fps for longer sessions), requiring 3 frames per step was unrealistic. At 2 fps with 1.5-2s per step, only 3-4 frames are captured per step. Requiring a minimum of 3 left no margin.

2 frames per step is sufficient for the backend's pose averaging algorithm:
- The challenge-aware frame sampler (`chooseChallengeAwareFrameIndices`) uses a nearest-frame fallback with +/-3 frame tolerance
- Pose averaging with 2 frames provides adequate accuracy for direction detection

### SDK impact

The SDK uses `frames_per_step` as the minimum threshold for per-step frame capture. The remediation loop that captures extra frames when a step has too few now triggers less often:

```tsx
const minRequired = challengeSpec.frames_per_step || 2;
if (framesThisStep < minRequired) {
  // Capture extra frames...
}
```

With 2 fps and 2-second steps, each step naturally captures ~4 frames, comfortably exceeding the minimum of 2.

---

## 9. Change 7 - SDK Tester Uses Server Adaptive target_fps

### What changed

The SDK tester's `captureFrames` function was updated to prioritize the server's `upload.target_fps` over the challenge's `capture_fps_hint`.

### Before (v1.17.5)

```tsx
const fps = hasChallenge ? challengeSpec.capture_fps_hint : 10;
const maxFrames = sessionData?.upload?.max_frames || 50;
```

### After (v1.17.6+)

```tsx
// Server's target_fps is adaptive (lowered to fit 30 frames across
// the full session). It MUST take priority over capture_fps_hint.
const fps = sessionData?.upload?.target_fps
  || (hasChallenge ? challengeSpec.capture_fps_hint : null)
  || 10;
const intervalMs = Math.floor(1000 / fps);
const maxFrames = sessionData?.upload?.max_frames || 30;
```

### Priority chain

```
1. sessionData.upload.target_fps   (authoritative - from server)
2. challengeSpec.capture_fps_hint  (fallback - nominal rate)
3. 10                              (default - no session data)
```

### Default max_frames also updated

The fallback for `max_frames` changed from `50` to `30` to match the server's hard cap.

---

## 10. API Response Schema Changes

### POST /v1/sessions (Create Session) - Response

New `upload` object added to response (v1.17.6+):

```typescript
interface CreateSessionResponse {
  session_id: string;
  session_token: string;
  expires_at: string;         // ISO 8601
  policy: {
    requires_audio: boolean;
    requires_stepup: boolean;
    challenge_type: 'none' | 'follow_dot' | 'head_turn' | 'speak_phrase';
    challenge: ChallengeSpec | null;
    audio_challenge: ChallengeSpec | null;
    policy_source: string;
  };
  // NEW in v1.17.6
  upload: {
    max_frames: number;         // Always 30
    target_fps: number;         // Adaptive: 2-10
    capture_duration_ms: number;  // Minimum capture window
  };
  nonce: string;
}
```

### ChallengeSpec (unchanged structure, changed values)

```typescript
interface ChallengeSpec {
  type: 'follow_dot' | 'head_turn' | 'speak_phrase';
  seed: string;
  generated_at: string;

  // follow_dot
  waypoints?: DotWaypoint[];
  dot_size_px?: number;

  // head_turn
  sequence?: HeadTurnStep[];

  // speak_phrase
  phrase?: string;
  phrase_language?: string;

  // shared
  total_duration_ms: number;

  // Changed values in v1.17.6:
  frames_per_step?: number;     // Now 2 (was 3)
  capture_fps_hint?: number;    // Still 10 (nominal - DO NOT use directly)
}
```

---

## 11. Frame Budget Enforcement

### Server-side enforcement

The signal upload endpoint enforces a hard frame cap with 20% slack for timing jitter:

```ts
// Server-side (uploadSignals)
const HARD_MAX_FRAMES = 30;
const sessMaxFrames = HARD_MAX_FRAMES;
const hardCap = Math.ceil(sessMaxFrames * 1.2);  // = 36

if (frames.length > hardCap) {
  return c.json({
    error: {
      code: 'invalid_upload',
      message: `Frame count ${frames.length} exceeds the allowed budget of ${hardCap} frames`,
      details: { received: frames.length, max_frames: sessMaxFrames, hard_cap: hardCap }
    }
  }, 400);
}
```

### What this means for the SDK

| Limit | Value | Notes |
|-------|-------|-------|
| `max_frames` | 30 | The intended maximum |
| Hard cap (server rejection) | 36 | 30 * 1.2, ceiling'd. Upload is rejected if frames > 36. |

The SDK's `captureForDuration` loop should stop capturing when `globalFrameIndex >= maxFrames`:

```tsx
while (Date.now() - phaseStart < durationMs && globalFrameIndex < maxFrames) {
  const idx = await captureOneFrame();
  // ...
}
```

This naturally limits frames to `max_frames` (30). The 20% server-side slack exists only to tolerate minor timing jitter, not to allow intentional over-capture.

---

## 12. Complete Session Lifecycle Timing Example

**Scenario:** Authentication session with `follow_dot` challenge, 5 waypoints at 1500ms each.

### Server computation

```
BASELINE_MS        = 2000
COUNTDOWN_MS       = 3000
challengeDurationMs = 5 * 1500 = 7500
totalCaptureMs     = 2000 + 3000 + 7500 = 12500
nominalFps         = 10
targetFps          = max(2, min(10, floor(30 / 12.5))) = max(2, min(10, 2)) = 2
```

### Session response

```json
{
  "upload": {
    "max_frames": 30,
    "target_fps": 2,
    "capture_duration_ms": 8000
  }
}
```

### Capture timeline

```
Time    Phase              Action                   Frames Captured (at 2 fps)
──────  ─────────────────  ───────────────────────  ──────────────────────────
0s      instructions       "Got it" modal           0
?s      face-guide         Position face, "Ready"   0
0.0s    baseline           "Hold still"             
0.5s    baseline           frame 0                  1
1.0s    baseline           frame 1                  2
1.5s    baseline           frame 2                  3
2.0s    baseline           frame 3                  4
2.0s    countdown          "3" (still capturing)    
2.5s    countdown          frame 4                  5
3.0s    countdown          frame 5, "2"             6
3.5s    countdown          frame 6                  7
4.0s    countdown          frame 7, "1"             8
4.5s    countdown          frame 8                  9
5.0s    challenge          wp0 (center-ish)         
5.0s    challenge          frame 9                  10
5.5s    challenge          frame 10                 11
6.0s    challenge          frame 11                 12
6.5s    challenge          wp1 (new position)       
6.5s    challenge          frame 12                 13
7.0s    challenge          frame 13                 14
7.5s    challenge          frame 14                 15
8.0s    challenge          wp2                      
8.0s    challenge          frame 15                 16
8.5s    challenge          frame 16                 17
9.0s    challenge          frame 17                 18
9.5s    challenge          wp3                      
9.5s    challenge          frame 18                 19
10.0s   challenge          frame 19                 20
10.5s   challenge          frame 20                 21
11.0s   challenge          wp4                      
11.0s   challenge          frame 21                 22
11.5s   challenge          frame 22                 23
12.0s   challenge          frame 23                 24
12.5s   done               Camera stops             ~24 frames total
```

Result: 24 frames, well within the 30-frame budget. Each waypoint gets ~3 frames, exceeding the `frames_per_step: 2` minimum.

---

## 13. Testing Checklist

All items below need end-to-end verification. None have been tested since these changes were deployed.

### UX Changes (v1.17.5)

- [ ] **Face guide renders correctly** - Oval overlay appears over video feed with dashed border and semi-transparent background
- [ ] **Face guide dismisses on click** - "My face is ready" button resolves the promise and advances to baseline
- [ ] **Face guide only shows for challenge sessions** - Enrollment without challenge should skip face-guide phase
- [ ] **Countdown renders 3, 2, 1** - Each number appears with pop animation for 1 second
- [ ] **Countdown captures frames** - Verify frames are being captured during countdown (check frame count)
- [ ] **Countdown transitions to challenge** - Challenge phase starts immediately after countdown ends
- [ ] **Indigo theme applied everywhere** - All overlay elements use indigo-600 family, no red/emerald remnants
- [ ] **Follow-dot uses indigo dot** - Dot is `bg-indigo-500` with indigo glow shadow
- [ ] **Direction arrows use indigo gradient** - Head-turn arrows render on indigo gradient circles

### Nonce Fix (v1.17.5)

- [ ] **Nonce sent in both header and query param** - Inspect network tab for both `X-Nonce` header and `?nonce=` in URL
- [ ] **Signal upload succeeds** - No 401 nonce_mismatch errors
- [ ] **Session completion succeeds** - No 401 nonce_mismatch errors
- [ ] **Nonce missing from response** - Verify graceful handling if server returns no nonce (edge case)

### Frame Budget (v1.17.6)

- [ ] **Max 30 frames captured** - For all session types, frame count should not exceed 30
- [ ] **Adaptive FPS applied** - For challenge sessions (12+ seconds total), FPS should be 2-3
- [ ] **No-challenge session FPS** - Short enrollment sessions should use higher FPS (up to 10)
- [ ] **Upload succeeds** - Server accepts the reduced frame count without errors
- [ ] **Upload rejected at 37+ frames** - If somehow 37+ frames are sent, server returns 400
- [ ] **Frames per step >= 2** - Each challenge step should have at least 2 tagged frames
- [ ] **Extra-frame remediation works** - If a step has < 2 frames, the SDK captures more

### End-to-End Flows

- [ ] **Enrollment (no challenge)** - Create -> capture -> upload -> complete -> APPROVE
- [ ] **Enrollment (follow_dot)** - Full challenge flow with 30-frame cap
- [ ] **Enrollment (head_turn)** - Full challenge flow with 30-frame cap
- [ ] **Authentication** - Using identity from successful enrollment
- [ ] **Network performance** - Upload size should be ~1-2 MB (vs 5-10 MB before)

---

## 14. Version History

| Version | Date | Key Changes |
|---------|------|-------------|
| v1.17.4 | 2026-03-01 | Follow-dot dwell 800->1500ms, pre-challenge instructions, ethnicity toggle |
| v1.17.5 | 2026-03-06 | Face guide oval, 3-2-1 countdown, indigo theme unification, nonce dual-delivery |
| v1.17.6 | 2026-03-07 | Hard 30-frame cap, adaptive FPS, frames_per_step 3->2, SDK uses target_fps |
| v1.17.7 | 2026-03-07 | Version bump only (deploy verification) |

---

## Appendix A: Files Modified

### Backend

| File | Changes |
|------|---------|
| `/supabase/functions/server/usesense-api-endpoints.tsx` | Adaptive FPS computation in `createSession`, simplified frame budget enforcement in `uploadSignals`, nonce dual-delivery (header + query param) with diagnostic logging |
| `/supabase/functions/server/challenge-engine.tsx` | `frames_per_step: 2` for both `follow_dot` and `head_turn` generators |
| `/supabase/functions/server/index.tsx` | Version bumps (startup log + health endpoint) |

### Frontend

| File | Changes |
|------|---------|
| `/src/app/pages/sdk-api-tester-page.tsx` | Face guide phase, countdown phase, `faceGuideReadyRef`, `countdownNumber` state, indigo theme throughout overlay, nonce in query params for upload + complete, `upload.target_fps` priority over `capture_fps_hint`, default max_frames fallback 50->30 |

### No changes

- No new API routes
- No new dependencies
- No schema changes (KV store structure unchanged)
- No new files created

---

## Appendix B: Constants Reference

### Server-side (usesense-api-endpoints.tsx)

| Constant | Value | Notes |
|----------|-------|-------|
| `HARD_MAX_FRAMES` | `30` | Maximum frames per session |
| `BASELINE_MS` | `2000` | Baseline capture duration |
| `COUNTDOWN_MS` | `3000` | 3-2-1 countdown (only if challenge present) |
| Hard cap (upload rejection) | `ceil(30 * 1.2) = 36` | 20% slack for timing jitter |

### Server-side (challenge-engine.tsx)

| Constant | Value | Notes |
|----------|-------|-------|
| `FOLLOW_DOT_DWELL_MS` | `1500` | Per-waypoint dwell time |
| `FOLLOW_DOT_WAYPOINTS_MIN` | `4` | Minimum waypoints |
| `FOLLOW_DOT_WAYPOINTS_MAX` | `6` | Maximum waypoints |
| `FOLLOW_DOT_DOT_SIZE` | `20` | Dot diameter in pixels |
| `HEAD_TURN_DWELL_MS` | `2000` | Per-step hold time |
| `HEAD_TURN_CENTER_DWELL_MS` | `1500` | Center return hold time |
| `HEAD_TURN_STEPS_MIN` | `3` | Minimum head-turn steps |
| `HEAD_TURN_STEPS_MAX` | `4` | Maximum head-turn steps |
| `frames_per_step` (both types) | `2` | Minimum frames SDK should tag per step |
| `capture_fps_hint` (both types) | `10` | Nominal FPS (DO NOT use directly) |

### Server-side (livesense-engine.tsx)

| Constant | Value | Notes |
|----------|-------|-------|
| `MAX_SAMPLE_FRAMES` | `8` | Frames actually analyzed by biometric engine |
| `MAX_CHALLENGE_EXTRA` | `8` | Additional frames sampled for challenge coverage |

### SDK-side (sdk-api-tester-page.tsx)

| Constant | Value | Notes |
|----------|-------|-------|
| `BASELINE_DURATION_MS` | `2000` | Baseline capture window |
| Default FPS fallback | `10` | When no server value available |
| Default max_frames fallback | `30` | When no server value available |
