# UseSense Web SDK v1.10.8 -- Backend Integration Guide

**Author:** SDK Team
**Date:** 2026-02-23
**SDK Version:** 1.2.0 (v1.10.8 two-phase capture)
**Backend Endpoint:** `https://api.usesense.ai/functions/v1/make-server-fc4cf30d`
**Status:** BLOCKING -- CORS preflight failure on `X-Nonce` header

---

## 1. Executive Summary

The Web SDK has been upgraded from basic single-phase capture to v1.10.8
two-phase capture (baseline + per-step challenge). This introduced several new
HTTP headers, request body schema changes, and a server-driven capture
configuration model. **The SDK is currently blocked in production** because the
backend's CORS preflight response does not include the new `X-Nonce` header in
`Access-Control-Allow-Headers`.

This document covers every backend-facing change and what the Edge Function
needs to support.

---

## 2. CRITICAL -- CORS Fix Required (P0)

### Problem

```
Access to fetch at '.../v1/sessions/{id}/signals?env=sandbox'
from origin 'https://broom-cot-04638420.figma.site' has been blocked
by CORS policy: Request header field x-nonce is not allowed by
Access-Control-Allow-Headers in preflight response.
```

The SDK now sends `X-Nonce` and `X-Idempotency-Key` custom headers on the
`uploadSignals` and `completeSession` endpoints. The browser's CORS preflight
(`OPTIONS`) request is rejected because these headers are not listed in the
backend's `Access-Control-Allow-Headers` response.

### Required Fix

The Edge Function's CORS handler must return **all** of the following headers
in the `OPTIONS` preflight response (and echo them on actual responses):

```
Access-Control-Allow-Headers:
  Authorization,
  apikey,
  Content-Type,
  X-API-Key,
  X-Session-Token,
  X-Idempotency-Key,
  X-Nonce
```

#### Supabase Edge Function example (Deno/TypeScript):

```typescript
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',  // or specific origins
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': [
    'Authorization',
    'apikey',
    'Content-Type',
    'X-API-Key',
    'X-Session-Token',
    'X-Idempotency-Key',
    'X-Nonce',
  ].join(', '),
  'Access-Control-Max-Age': '86400',
};

// Handle preflight
if (req.method === 'OPTIONS') {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

// Attach CORS headers to all responses
// response.headers.set(...) for each key in CORS_HEADERS
```

**This is the only blocking issue.** Once the CORS headers are updated, the
SDK will be able to complete the full session lifecycle against the live
backend.

---

## 3. New Custom HTTP Headers

The SDK now sends the following custom headers. The backend should accept
(and ideally validate) all of them.

| Header | Sent On | Format | Purpose |
|---|---|---|---|
| `X-API-Key` | `POST /v1/sessions` | `sk_...` or `pk_...` | Organization API key (existing) |
| `X-Session-Token` | `/signals`, `/complete`, `/status` | `string` | Session-scoped auth token (existing) |
| **`X-Nonce`** | `/signals`, `/complete` | `string` (from session response) | Cryptographic session binding -- prevents replay attacks. Only sent if the `createSession` response included a `nonce` field. |
| **`X-Idempotency-Key`** | `/signals`, `/complete` | `{session_id}_{timestamp}_{random}` | Idempotency key for safe retries. Backend should deduplicate requests with the same key within a reasonable window (e.g., 5 min). |

### Header Sending Logic (from `api.ts`)

```typescript
// uploadSignals
headers: {
  ...gatewayHeaders,           // Authorization, apikey
  'X-Session-Token': token,
  'X-Idempotency-Key': `${sessionId}_${Date.now()}_${random9}`,
  ...(this.sessionNonce ? { 'X-Nonce': this.sessionNonce } : {}),
}

// completeSession
headers: {
  ...gatewayHeaders,           // Authorization, apikey
  'X-Session-Token': token,
  'X-Idempotency-Key': `${sessionId}_complete_${Date.now()}`,
  ...(this.sessionNonce ? { 'X-Nonce': this.sessionNonce } : {}),
}
```

### Backend Nonce Validation (Recommended)

If the backend returns a `nonce` in `createSession`, it should:

1. Store the nonce associated with the session ID.
2. On `/signals` and `/complete`, validate that `X-Nonce` matches the stored
   nonce for the given session.
3. Reject requests with mismatched or missing nonces (when nonce was issued)
   with `401 { "error": { "code": "nonce_mismatch", "message": "..." } }`.

If nonce validation is **not yet implemented**, the backend should simply
**ignore** the `X-Nonce` header (but still allow it through CORS). The SDK
sends it conditionally -- only when a nonce was received in the session
response.

---

## 4. `POST /v1/sessions` -- Response Schema

### 4.1 Required Response Fields

The SDK expects the `createSession` response to have this shape:

```jsonc
{
  "session_id": "sess_...",
  "session_token": "sess_tok_...",
  "expires_at": "2026-02-23T12:00:00.000Z",
  "nonce": "nonce_abc123...",       // NEW -- cryptographic nonce for session binding
  "policy": {                       // NEW -- server-driven policy
    "requires_audio": false,
    "requires_stepup": true,        // triggers two-phase capture in SDK
    "challenge_type": "head_turn",  // "none" | "head_turn" | "follow_dot" | "speak_phrase"
    "challenge": { ... },           // challenge spec (see 4.2)
    "audio_challenge": null,        // speak_phrase spec or null
    "policy_source": "default"
  },
  "upload": {                       // NEW -- server-driven capture config
    "max_frames": 90,               // hard cap on total frames SDK will capture
    "target_fps": 10,               // recommended capture FPS
    "capture_duration_ms": 6000     // total capture window (baseline + challenge)
  }
}
```

### 4.2 Challenge Spec Schemas

The SDK parses the `policy.challenge` field into one of these typed objects.

#### `head_turn`

```jsonc
{
  "type": "head_turn",
  "seed": "seed_a1b2c3d4e5f6",     // server-generated seed for replay detection
  "sequence": [
    { "direction": "left",   "duration_ms": 2000, "index": 0 },
    { "direction": "right",  "duration_ms": 2000, "index": 1 },
    { "direction": "center", "duration_ms": 1500, "index": 2 }
  ],
  "total_duration_ms": 5500,
  "frames_per_step": 3,             // NEW -- minimum frames the SDK tags per step
  "capture_fps_hint": 10            // NEW -- recommended FPS during challenge
}
```

**Direction enum:** `"left"` | `"right"` | `"up"` | `"down"` | `"center"`

#### `follow_dot`

```jsonc
{
  "type": "follow_dot",
  "seed": "seed_x9y8z7w6",
  "generated_at": "2026-02-23T10:30:00.000Z",
  "waypoints": [
    { "x": 0.2, "y": 0.3, "duration_ms": 800, "index": 0 },
    { "x": 0.8, "y": 0.7, "duration_ms": 800, "index": 1 },
    { "x": 0.5, "y": 0.2, "duration_ms": 800, "index": 2 }
  ],
  "dot_size_px": 24,
  "total_duration_ms": 2400,
  "frames_per_step": 3,             // NEW
  "capture_fps_hint": 10            // NEW
}
```

**Waypoint coordinates:** `x` and `y` are normalized 0.0-1.0 (fraction of viewport).

#### `speak_phrase` (via `policy.audio_challenge`)

```jsonc
{
  "type": "speak_phrase",
  "seed": "seed_p1q2r3",
  "phrase": "The sun rises in the east",
  "phrase_language": "en",
  "total_duration_ms": 5000
}
```

### 4.3 `upload.max_frames` Computation Guidance

The SDK uses `upload.max_frames` as the absolute hard cap on captured frames
across both baseline and challenge phases. The backend should compute this
based on the challenge duration:

```
baseline_ms     = 2000  (fixed SDK constant)
total_ms        = baseline_ms + challenge.total_duration_ms
target_fps      = challenge.capture_fps_hint || 10
max_frames      = max(50, ceil(total_ms / 1000 * target_fps) + 15)
```

The SDK allocates 30% of `max_frames` to the baseline phase and the remaining
70% to the challenge phase. The 15-frame buffer accounts for timing jitter and
the minimum-frames-per-step guarantees.

---

## 5. `POST /v1/sessions/{id}/signals` -- Request Schema

### 5.1 Multipart Form Data

The SDK sends a `multipart/form-data` body (no explicit `Content-Type` header
-- the browser sets the boundary automatically).

| Part Name | Type | Description |
|---|---|---|
| `frames[]` | `image/jpeg` | One file per captured frame, named `frame_0.jpg`, `frame_1.jpg`, ... JPEG quality 0.85. **Frames are raw/non-mirrored** -- no CSS `scaleX(-1)` is applied to the canvas capture. |
| `metadata` | `application/json` | Single file named `metadata.json` containing the `MetadataPayload` (see 5.2). |
| `audio` | `audio/webm` | Optional. Present only for `speak_phrase` challenges. Named `audio.webm`. |

### 5.2 `metadata.json` Schema (MetadataPayload)

```jsonc
{
  "web_integrity": {
    "webdriver": false,
    "permissions_state": { "camera": "granted", "microphone": "prompt" },
    "webgl_renderer": "ANGLE (Apple, ..., OpenGL 4.1)",
    "webgl_vendor": "Google Inc. (Apple)",
    "canvas_hash": -1234567890,
    "screen_resolution": "1920x1080",
    "hardware_concurrency": 8,
    "device_memory": 8,
    "color_depth": 24,
    "cookie_enabled": true,
    "has_focus": true,
    "visibility_state": "visible",
    "timezone": "America/New_York",
    "languages": ["en-US", "en"],
    "do_not_track": null,
    "viewport_size": "1440x900",
    "battery": { "charging": true, "level": 0.85 },
    "connection": { "effectiveType": "4g", "downlink": 10, "rtt": 50 },
    "feature_support": {
      "supports_webgl": true,
      "supports_web_audio": true,
      "supports_webrtc": true,
      "supports_media_recorder": true,
      "supports_wasm": true,
      "supports_service_worker": true
    }
  },

  "challenge_response": {
    // === head_turn example ===
    "type": "head_turn",
    "seed": "seed_a1b2c3d4e5f6",          // must match the issued seed
    "completed": true,
    "step_frames": {                        // NEW -- per-step frame index map
      "0": [20, 21, 22, 23, 24, 25, 26],   // frames captured during step 0 (left)
      "1": [27, 28, 29, 30, 31, 32, 33],   // frames captured during step 1 (right)
      "2": [34, 35, 36, 37, 38, 39]         // frames captured during step 2 (center)
    },
    "frame_timestamps": [0, 101, 203, ...], // NEW -- ms offset from capture start for every frame
    "started_at": "2026-02-23T10:30:05Z",   // NEW -- ISO timestamp when challenge phase began
    "completed_at": "2026-02-23T10:30:11Z"  // NEW -- ISO timestamp when challenge phase ended

    // === follow_dot variant ===
    // Same structure but with "waypoint_frames" instead of "step_frames":
    // "waypoint_frames": { "0": [...], "1": [...], ... }

    // === speak_phrase variant ===
    // "type": "speak_phrase",
    // "seed": "...",
    // "completed": true,
    // "started_at": "...",
    // "completed_at": "..."
    // (no step_frames/waypoint_frames/frame_timestamps)
  },

  "webauthn_data": null
  // or: { "credential_id": "base64url...", "authenticator_data": "base64url...", "attestation_object_present": true }
}
```

### 5.3 Frame Indexing Convention

Frame indices in `step_frames` / `waypoint_frames` are **global** indices into
the `frames[]` array (0-based). The first ~30% of frames are the baseline
phase (user looking straight ahead, no challenge). The remaining frames are the
challenge phase, tagged by step/waypoint.

Example with 40 frames total:
- Frames 0-11: baseline (no step assignment)
- Frames 12-22: step 0 (left)
- Frames 23-33: step 1 (right)
- Frames 34-39: step 2 (center)

The `frame_timestamps` array has one entry per frame (same length as
`frames[]`), giving the millisecond offset from the start of capture for each
frame.

### 5.4 Expected Response

```jsonc
{
  "received": true,
  "session_id": "sess_...",
  "frames_count": 40,
  "audio_received": false,
  "metadata_received": true,
  "total_size_bytes": 1234567
}
```

---

## 6. `POST /v1/sessions/{id}/complete` -- No Body Changes

The SDK sends an empty body with auth headers. No changes to the request
schema. The `X-Nonce` and `X-Idempotency-Key` headers are the only additions.

### Expected Response (FinalDecisionObject)

The full decision object is returned to the SDK but **redacted before
exposure** to the host application. The SDK strips all scoring fields and
only exposes:

```jsonc
// RedactedDecisionObject (what the host app sees)
{
  "session_id": "sess_...",
  "session_type": "enrollment",
  "identity_id": "ident_...",
  "decision": "APPROVE",   // "APPROVE" | "REJECT" | "MANUAL_REVIEW"
  "timestamp": "2026-02-23T10:30:15.000Z"
}
```

The full object (scores, pillars, reasons, debug info) is consumed internally
by the SDK for rendering the result screens but is **never** passed to
`onComplete` callbacks. This is a security invariant.

---

## 7. `GET /v1/sessions/{id}/status` -- No Changes

Used by `pollUntilComplete()` fallback. No new headers or schema changes.

---

## 8. Error Response Contract

The SDK maps backend error responses to typed `UseSenseError` codes. The
backend should return errors in this format:

```jsonc
{
  "error": {
    "code": "session_expired",        // machine-readable code
    "message": "Session has expired"  // human-readable message
  }
}
```

**Recognized error codes:**

| HTTP Status | `error.code` | SDK Error Code |
|---|---|---|
| 400 | `invalid_request`, `invalid_upload`, `signals_not_uploaded` | `INVALID_REQUEST` |
| 401 | `session_expired` | `SESSION_EXPIRED` |
| 401 | `invalid_token` | `INVALID_TOKEN` |
| 401 | `session_not_found` | `SESSION_NOT_FOUND` |
| 401 | `nonce_mismatch` (new) | `UNAUTHORIZED` |
| 404 | `identity_not_found` | `IDENTITY_NOT_FOUND` |
| 429 | (any) | `QUOTA_EXCEEDED` |
| 500 | `internal_error`, `evaluation_error` | `SERVER_ERROR` |

---

## 9. Two-Phase Capture Flow Diagram

```
SDK                                         Backend
 |                                            |
 |  POST /v1/sessions                         |
 |  X-API-Key: sk_...                         |
 |  ----------------------------------------> |
 |                                            |
 |  { session_id, session_token, nonce,       |
 |    policy: { challenge: head_turn_spec },  |
 |    upload: { max_frames: 90 } }            |
 |  <---------------------------------------- |
 |                                            |
 |  [SDK: 2s baseline capture]                |
 |  [SDK: per-step challenge capture]         |
 |  [SDK: frame budget enforcement]           |
 |  [SDK: real-time quality analysis]         |
 |                                            |
 |  POST /v1/sessions/{id}/signals            |
 |  X-Session-Token: ...                      |
 |  X-Nonce: nonce_abc123                     |
 |  X-Idempotency-Key: sess_..._1708..._x9y  |
 |  Body: multipart (frames[] + metadata)     |
 |  ----------------------------------------> |
 |                                            |
 |  { received: true, frames_count: 40 }      |
 |  <---------------------------------------- |
 |                                            |
 |  POST /v1/sessions/{id}/complete           |
 |  X-Session-Token: ...                      |
 |  X-Nonce: nonce_abc123                     |
 |  X-Idempotency-Key: sess_..._complete_17.. |
 |  ----------------------------------------> |
 |                                            |
 |  { decision: "APPROVE", ... full object }  |
 |  <---------------------------------------- |
 |                                            |
 |  [SDK: redactDecision() -> host app]       |
```

---

## 10. Implementation Checklist

### P0 -- Blocking (must fix before any live testing)

- [ ] **CORS: Add `X-Nonce` to `Access-Control-Allow-Headers`**
- [ ] **CORS: Add `X-Idempotency-Key` to `Access-Control-Allow-Headers`**
- [ ] Ensure `OPTIONS` preflight returns `204` with full CORS headers

### P1 -- Required for v1.10.8 Feature Completeness

- [ ] `createSession` response includes `nonce` field
- [ ] `createSession` response includes `policy` object with challenge spec
- [ ] `createSession` response includes `upload` config with `max_frames`,
      `target_fps`, `capture_duration_ms`
- [ ] `uploadSignals` parses `metadata.json` with new `challenge_response`
      fields (`step_frames`/`waypoint_frames`, `frame_timestamps`,
      `started_at`, `completed_at`)
- [ ] Backend challenge validation uses `step_frames` mapping to correlate
      frames with expected head poses

### P2 -- Recommended

- [ ] Validate `X-Nonce` header matches session's issued nonce
- [ ] Implement `X-Idempotency-Key` deduplication (5-min window)
- [ ] Validate `challenge_response.seed` matches the issued challenge seed
- [ ] Log `frame_timestamps` for timing analysis and anti-replay
- [ ] Validate frame count is within `upload.max_frames` budget

### P3 -- Nice to Have

- [ ] Return `nonce_mismatch` error code for nonce validation failures
- [ ] Support `timezone_offset_mismatch` flag in web integrity signals
- [ ] Use `frame_timestamps` for inter-frame timing anomaly detection

---

## 11. Testing Guidance

### Mock Mode

The SDK enters mock mode when the API key contains `demo`, `mock`, or equals
`sk_demo_temp_key`. In mock mode, all API calls are simulated client-side and
no requests hit the backend. Use a real API key to test against the live
backend.

### Sandbox vs Production

The SDK appends `?env=sandbox` or `?env=production` to all API URLs. The
environment is derived from the API key prefix (`pk_` = production, anything
else = sandbox) unless explicitly overridden.

### Quick Smoke Test

After the CORS fix, verify the full flow with:

1. `POST /v1/sessions?env=sandbox` -- should return 200 with session + policy
2. `POST /v1/sessions/{id}/signals?env=sandbox` -- should return 200 with
   `received: true`
3. `POST /v1/sessions/{id}/complete?env=sandbox` -- should return 200 with
   decision object

Monitor for any `4xx` responses and check that `X-Nonce` / `X-Idempotency-Key`
headers are accepted without CORS errors.

---

## 12. SDK File Reference

For backend engineers reviewing the SDK source:

| File | Purpose |
|---|---|
| `api.ts` | HTTP client -- all backend calls, header construction, nonce binding |
| `types.ts` | Full TypeScript type definitions for all request/response schemas |
| `utils/redact.ts` | Decision redaction logic (security boundary) |
| `utils/errors.ts` | Error code mapping from server responses |
| `components/screens/ChallengeScreen.tsx` | Two-phase capture loop (baseline + challenge, frame budget) |
| `components/UseSenseVerification.tsx` | Orchestrator -- session lifecycle, metadata assembly |
| `capture/image-quality.ts` | Client-side quality analysis (blur, lighting) -- no backend impact |
| `integrity/web-signals.ts` | Web integrity signal collection (feeds `metadata.web_integrity`) |

---

*End of document. Questions? Reach out to the SDK team.*
