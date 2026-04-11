# SDK-Backend Integration Reference

**Understanding the UseSense Web SDK from a Backend Perspective**

---

## Table of Contents

1. [SDK Overview](#sdk-overview)
2. [Request-Response Flow](#request-response-flow)
3. [Data Structures](#data-structures)
4. [Web Integrity Signals Deep Dive](#web-integrity-signals-deep-dive)
5. [Policy-Driven Behavior](#policy-driven-behavior)
6. [Error Scenarios](#error-scenarios)
7. [Testing Strategies](#testing-strategies)

---

## SDK Overview

The UseSense Web SDK is a React-based client library that:

1. **Captures biometric signals** (video frames, optional audio)
2. **Collects device fingerprints** (web integrity signals)
3. **Transmits raw data** to your backend (no client-side evaluation)
4. **Displays UI screens** for a seamless user experience

### Key Characteristics

- **Stateless**: SDK doesn't persist data between sessions
- **Event-driven**: Emits events for monitoring and analytics
- **Policy-responsive**: Adapts capture behavior based on backend policy
- **Error-resilient**: Handles permission denials, network failures gracefully

---

## Request-Response Flow

### Complete Enrollment Flow

```
┌─────────────┐                                      ┌─────────────┐
│   Web SDK   │                                      │   Backend   │
└──────┬──────┘                                      └──────┬──────┘
       │                                                    │
       │ 1. User clicks "Start Enrollment"                 │
       │                                                    │
       │ 2. POST /v1/sessions                              │
       │    {                                               │
       │      "session_type": "enrollment",                │
       │      "external_user_id": "user_12345",            │
       │      "platform": "web"                             │
       │    }                                               │
       ├───────────────────────────────────────────────────>│
       │                                                    │
       │                                      3. Create session
       │                                         Store in DB
       │                                         Generate token
       │                                         Determine policy
       │                                                    │
       │ 4. 201 Created                                    │
       │    {                                               │
       │      "session_id": "sess_abc123",                 │
       │      "session_token": "sess_tok_xyz",             │
       │      "policy": {                                   │
       │        "requires_audio": false,                   │
       │        "requires_stepup": false,                  │
       │        "challenge_type": "none"                   │
       │      }                                             │
       │    }                                               │
       │<───────────────────────────────────────────────────┤
       │                                                    │
       │ 5. SDK requests camera permission                 │
       │    (browser native prompt)                        │
       │                                                    │
       │ 6. SDK captures video frames                      │
       │    (15 FPS × 2.5s = ~38 frames)                   │
       │                                                    │
       │ 7. SDK collects web integrity signals             │
       │    (browser fingerprint)                          │
       │                                                    │
       │ 8. POST /v1/sessions/sess_abc123/signals          │
       │    Content-Type: multipart/form-data              │
       │    [frames[], metadata.json, audio?]              │
       ├───────────────────────────────────────────────────>│
       │                                                    │
       │                                      9. Validate upload
       │                                         Store in S3
       │                                         Update DB status
       │                                                    │
       │ 10. 200 OK                                        │
       │     { "received": true }                          │
       │<───────────────────────────────────────────────────┤
       │                                                    │
       │ 11. POST /v1/sessions/sess_abc123/complete        │
       ├───────────────────────────────────────────────────>│
       │                                                    │
       │                                     12. Process signals
       │                                         Run LiveSense
       │                                         Run DeepSense
       │                                         Create template
       │                                         Generate decision
       │                                                    │
       │ 13. 200 OK (or 202 Accepted if async)            │
       │     {                                              │
       │       "decision": "APPROVE",                      │
       │       "identity_id": "ident_new789",              │
       │       "liveness_score": 94,                       │
       │       "channel_trust_score": 87                   │
       │     }                                              │
       │<───────────────────────────────────────────────────┤
       │                                                    │
       │ 14. SDK displays success screen                   │
       │                                                    │
```

### Key Timing Expectations

| Phase | Expected Duration | SDK Behavior |
|-------|-------------------|--------------|
| Session creation | < 500ms | Shows loading spinner |
| Camera permission | User-dependent | Shows permission screen |
| Video capture | 2.5 seconds | Shows face oval overlay |
| Signal upload | 1-3 seconds | Shows upload progress |
| Evaluation | < 3 seconds | Shows "processing" animation |
| **Total** | **< 10 seconds** | End-to-end user experience |

---

## Data Structures

### Metadata Payload Structure

The SDK sends a comprehensive metadata JSON file. Here's what each field means:

```json
{
  "session_id": "sess_abc123xyz789",
  "sdk_version": "1.0.0",
  "platform": "web",
  
  "capture_config": {
    "captureDurationMs": 2500,      // How long video was captured
    "targetFps": 15,                  // Target frames per second
    "maxFrames": 50,                  // Maximum frames to capture
    "audioEnabled": "risk_based",     // Audio capture mode
    "stepUpPolicy": "risk_based"      // Challenge policy
  },
  
  "timestamps": {
    "session_started_at_ms": 1708356789000,   // When SDK initialized
    "capture_started_at_ms": 1708356791000,   // When camera started
    "capture_ended_at_ms": 1708356793500,     // When camera stopped
    "upload_started_at_ms": 1708356794000,    // When upload began
    "upload_ended_at_ms": 1708356795500       // When upload finished
  },
  
  "frames_manifest": [
    {
      "frame_index": 0,                      // Frame number (0-based)
      "capture_timestamp_ms": 1708356791000, // Unix epoch ms
      "performance_timestamp_ms": 12345.67,  // performance.now()
      "frame_blob_size_bytes": 45821,        // Size of JPEG
      "resolution_w": 640,                    // Frame width
      "resolution_h": 480,                    // Frame height
      "frame_hash": "sha256:abc..."          // Optional hash
    },
    // ... more frames
  ],
  
  "audio_manifest": {                        // Only if audio captured
    "audio_mime_type": "audio/webm;codecs=opus",
    "audio_duration_ms": 2500,
    "audio_start_timestamp_ms": 1708356791000,
    "audio_end_timestamp_ms": 1708356793500,
    "audio_blob_size_bytes": 12048
  },
  
  "stepup_manifest": [                       // Only if challenges performed
    {
      "type": "follow_dot",
      "started_at_ms": 1708356791000,
      "completed_at_ms": 1708356793500,
      "dot_positions": [
        { "x": 320, "y": 240, "timestamp_ms": 1708356791000 },
        { "x": 450, "y": 150, "timestamp_ms": 1708356792000 }
      ]
    }
  ],
  
  "web_integrity": {
    // See "Web Integrity Signals Deep Dive" section
  },
  
  "webauthn_data": {                        // Only if WebAuthn used
    "credential_id": "cred_xyz123",
    "authenticator_data": "base64...",
    "attestation_object_present": true
  }
}
```

### Frame Format

**File Format:** JPEG  
**Naming:** `frame_0.jpg`, `frame_1.jpg`, etc.  
**Resolution:** Typically 640×480 or 1280×720 (depends on camera)  
**Size:** 30-80 KB per frame  
**Total Frames:** 30-50 frames  

**Frame Extraction Process:**
1. SDK captures video stream from getUserMedia
2. Every ~66ms (15 FPS), draws frame to canvas
3. Converts canvas to JPEG blob via `toBlob('image/jpeg', 0.85)`
4. Stores in memory array

**Important:** Frames are captured from the **front-facing camera** in landscape or portrait orientation.

### Audio Format

**File Format:** WebM (Opus codec)  
**Naming:** `audio.webm`  
**Duration:** Matches video capture (2.5 seconds default)  
**Sample Rate:** 48 kHz  
**Size:** 8-15 KB  

**Audio is Optional:**
- Only captured if `policy.requires_audio === true`
- Used for voice liveness checks
- Not transcribed by SDK (backend responsibility)

---

## Web Integrity Signals Deep Dive

The SDK collects comprehensive device and browser fingerprints. Here's what each signal means and how to use it:

### User Agent & Platform

```json
{
  "user_agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
  "platform": "MacIntel"
}
```

**Use Cases:**
- Detect inconsistencies (e.g., iPhone user agent but Windows platform)
- Track device changes for same user
- Identify automation tools (headless Chrome has telltale signatures)

### Languages & Timezone

```json
{
  "languages": ["en-US", "en", "es"],
  "timezone": "America/Los_Angeles"
}
```

**Use Cases:**
- Geo-location verification (timezone should match IP)
- Detect VPN/proxy usage (inconsistent timezone/IP)
- Language preference tracking

### Hardware Concurrency & Memory

```json
{
  "hardware_concurrency": 8,
  "device_memory_gb": 16
}
```

**Use Cases:**
- Device consistency checks (same user, different hardware = suspicious)
- Bot detection (bots often run on low-spec VMs)
- Device fingerprinting (combine with other signals)

**Note:** `device_memory_gb` may be `undefined` (not all browsers support it).

### WebDriver Detection

```json
{
  "webdriver": false
}
```

**Use Cases:**
- **Primary bot detection signal**
- `true` = Selenium/Puppeteer automation detected
- `false` = Normal browser (but could still be headless Chrome)

**Important:** This is not foolproof. Sophisticated bots can spoof this.

### Cookie & DNT

```json
{
  "cookie_enabled": true,
  "do_not_track": null
}
```

**Use Cases:**
- `cookie_enabled: false` = Privacy-focused user or automation
- `do_not_track` is mostly deprecated but can indicate privacy preferences

### Screen Properties

```json
{
  "screen": {
    "width": 1920,
    "height": 1080,
    "colorDepth": 24,
    "pixelRatio": 2.0
  }
}
```

**Use Cases:**
- Detect virtual displays (common in bots)
- Device consistency checks
- High pixel ratio = Retina/HiDPI display (premium devices)

### Visibility & Focus

```json
{
  "visibility_state": "visible",
  "has_focus": true
}
```

**Use Cases:**
- User engagement signals
- Background tab detection (suspicious if user isn't focused)

### Permissions State

```json
{
  "permissions_state": {
    "camera": "granted",
    "microphone": "denied"
  }
}
```

**Use Cases:**
- Verify camera permission was actually granted
- Track permission changes across sessions

**Note:** Some browsers don't support Permissions API; fields may be `undefined`.

### Media Devices

```json
{
  "media_devices": {
    "videoInputs": 2,
    "audioInputs": 1
  }
}
```

**Use Cases:**
- Device consistency (same user should have same device count)
- Virtual camera detection (bots often have 0 or unusual counts)
- Multiple cameras = likely real device (phones, laptops with external webcam)

**Important:** SDK only counts devices, not labels (privacy).

### Feature Support

```json
{
  "feature_support": {
    "supports_webrtc": true,
    "supports_media_recorder": true,
    "supports_permissions_api": true,
    "supports_webgl": true
  }
}
```

**Use Cases:**
- Browser capability detection
- Missing features = old browser or bot
- All `true` = modern browser

### Timing Signals

```json
{
  "timing_signals": {
    "navigation_timing": {
      "domContentLoaded": 245,
      "loadComplete": 567
    },
    "event_loop_lag_ms": {
      "avg": 2.3,
      "max": 12.1
    }
  }
}
```

**Use Cases:**
- **Event loop lag detection** (bots often have high lag)
- Performance profiling
- Real user vs. bot (bots have CPU-intensive background tasks)

**Event Loop Lag Calculation:**
```javascript
// SDK measures how long setTimeout(0) actually takes
const expectedDelay = 0;
const actualDelay = performance.now() - scheduledTime;
const lag = actualDelay - expectedDelay;
```

**Typical Values:**
- Real users: 1-5ms average, 10-30ms max
- Bots: 10-50ms average, 100-500ms max

### WebGL Fingerprint

```json
{
  "webgl_fingerprint": "hash:a1b2c3d4e5f6"
}
```

**How It's Generated:**
1. Create WebGL context
2. Render a simple scene
3. Read pixel data
4. Hash the rendered output
5. Also include renderer/vendor strings

**Use Cases:**
- Device-specific fingerprint (GPU-dependent)
- Track same device across sessions
- Detect VM/emulators (generic GPU signatures)

**Privacy Note:** This is privacy-preserving (hash only, not raw GPU info).

---

## Policy-Driven Behavior

The SDK adapts its behavior based on the `policy` object returned from `POST /v1/sessions`.

### Policy Examples

#### Example 1: Basic Enrollment (No Extra Signals)

**Backend Response:**
```json
{
  "policy": {
    "requires_audio": false,
    "requires_stepup": false,
    "challenge_type": "none"
  }
}
```

**SDK Behavior:**
- Capture 2.5s video (15 FPS)
- Skip audio recording
- Skip challenges
- Upload and complete

#### Example 2: High-Risk Authentication (Audio + Challenge)

**Backend Response:**
```json
{
  "policy": {
    "requires_audio": true,
    "requires_stepup": true,
    "challenge_type": "head_turn",
    "phrase": null
  }
}
```

**SDK Behavior:**
1. Capture 2.5s video
2. **Record audio** simultaneously
3. **Show challenge screen** with "Turn your head left" instruction
4. Wait for user to turn head
5. Upload video + audio + challenge manifest
6. Complete

#### Example 3: Speak Phrase Challenge

**Backend Response:**
```json
{
  "policy": {
    "requires_audio": true,
    "requires_stepup": true,
    "challenge_type": "speak_phrase",
    "phrase": "The quick brown fox jumps"
  }
}
```

**SDK Behavior:**
1. Capture video
2. Record audio
3. **Show challenge screen** with phrase: "Say: The quick brown fox jumps"
4. User speaks phrase
5. Upload video + audio with phrase in metadata

**Backend Responsibility:**
- Verify phrase was spoken (speech-to-text)
- Check audio-visual sync (lip movements match audio)

### Challenge Types

| Type | SDK Behavior | Backend Verification |
|------|--------------|---------------------|
| `none` | No challenge | N/A |
| `head_turn` | Shows arrow, waits for head movement | Verify head pose changed in frames |
| `follow_dot` | Shows moving dot, user follows with eyes | Verify gaze tracking, dot positions logged |
| `speak_phrase` | Shows phrase, records audio | Speech-to-text verification, lip sync |

### Step-Up Sequence (Advanced)

For complex flows, backend can return a sequence:

```json
{
  "policy": {
    "requires_stepup": true,
    "stepup_sequence": [
      { "type": "head_turn", "direction": "left" },
      { "type": "head_turn", "direction": "right" },
      { "type": "follow_dot" }
    ]
  }
}
```

SDK will perform challenges in order and log all responses in `stepup_manifest`.

---

## Error Scenarios

### Client-Side Errors

These errors are handled by the SDK and **not** sent to backend:

| Error Code | Scenario | SDK Behavior |
|------------|----------|--------------|
| `CAMERA_PERMISSION_DENIED` | User denies camera | Shows error screen with instructions |
| `MIC_PERMISSION_DENIED` | User denies mic (when required) | Shows error screen |
| `USER_CANCELLED` | User closes verification | Calls `onError` callback |
| `TIMEOUT` | Capture takes > 30 seconds | Shows error screen, allows retry |

**Backend Impact:** Session will remain in `created` state; no signals uploaded.

### Network Errors

| Scenario | SDK Behavior | Backend Expectation |
|----------|--------------|---------------------|
| Session creation fails | Shows error, retries once | Return 500/503 with retry guidance |
| Upload fails (network) | Retries upload 2 times | Idempotent upload (use `X-Idempotency-Key`) |
| Complete fails | Shows error, allows manual retry | Return 500 or 202 Accepted |

**Best Practice:** Implement idempotency keys to handle retry scenarios.

### Backend Errors

Errors your backend should return:

| HTTP Status | Error Code | When to Return |
|-------------|------------|----------------|
| 400 | `invalid_request` | Malformed request body |
| 401 | `unauthorized` | Invalid API key or session token |
| 404 | `identity_not_found` | Authentication with non-existent identity |
| 404 | `session_not_found` | Session ID doesn't exist |
| 413 | `payload_too_large` | Upload exceeds size limit |
| 422 | `validation_error` | Metadata validation failed |
| 429 | `rate_limit_exceeded` | Too many requests from tenant |
| 500 | `internal_error` | Database/storage failure |
| 503 | `service_unavailable` | Temporary outage |

**Error Response Format:**

```json
{
  "error": {
    "code": "identity_not_found",
    "message": "No enrolled identity found for identity_id: ident_xyz789",
    "details": {
      "identity_id": "ident_xyz789"
    },
    "request_id": "req_abc123"
  }
}
```

**SDK Behavior:**
- 400-499 errors: Show user-friendly error message
- 500-599 errors: Show "Service unavailable, please retry"

---

## Testing Strategies

### Unit Testing Backend Endpoints

**Test Session Creation:**

```javascript
describe('POST /v1/sessions', () => {
  it('should create enrollment session', async () => {
    const response = await request(app)
      .post('/v1/sessions')
      .set('Authorization', 'Bearer sk_test_abc123')
      .send({
        session_type: 'enrollment',
        external_user_id: 'test_user_1',
        platform: 'web'
      });
    
    expect(response.status).toBe(201);
    expect(response.body.session_id).toMatch(/^sess_/);
    expect(response.body.policy).toBeDefined();
  });
  
  it('should reject authentication without identity_id', async () => {
    const response = await request(app)
      .post('/v1/sessions')
      .set('Authorization', 'Bearer sk_test_abc123')
      .send({
        session_type: 'authentication',
        platform: 'web'
      });
    
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('invalid_request');
  });
});
```

**Test Signal Upload:**

```javascript
describe('POST /v1/sessions/:id/signals', () => {
  it('should accept multipart upload', async () => {
    const sessionId = 'sess_test123';
    const sessionToken = 'sess_tok_test456';
    
    const response = await request(app)
      .post(`/v1/sessions/${sessionId}/signals`)
      .set('Authorization', `Bearer ${sessionToken}`)
      .attach('frames[]', 'test/fixtures/frame_0.jpg')
      .attach('frames[]', 'test/fixtures/frame_1.jpg')
      .attach('metadata', Buffer.from(JSON.stringify(mockMetadata)), 'metadata.json');
    
    expect(response.status).toBe(200);
    expect(response.body.received).toBe(true);
  });
});
```

### Integration Testing with SDK

**Option 1: Mock Backend**

Create a mock server that matches API spec:

```javascript
// mock-server.js
const express = require('express');
const app = express();

app.post('/v1/sessions', (req, res) => {
  res.status(201).json({
    session_id: 'mock_session_123',
    session_token: 'mock_token_456',
    expires_at: new Date(Date.now() + 15 * 60000).toISOString(),
    policy: { requires_audio: false, requires_stepup: false }
  });
});

app.post('/v1/sessions/:id/signals', (req, res) => {
  res.json({ received: true });
});

app.post('/v1/sessions/:id/complete', (req, res) => {
  res.json({
    session_id: req.params.id,
    decision: 'APPROVE',
    liveness_score: 95,
    channel_trust_score: 88,
    // ...
  });
});

app.listen(3001);
```

Point SDK to mock:

```typescript
const client = createUseSenseClient({
  apiBaseUrl: 'http://localhost:3001',
  tenantKey: 'mock_key',
  environment: 'sandbox'
});
```

**Option 2: Record/Replay**

1. Perform real capture with SDK
2. Save request data (frames, metadata)
3. Replay in tests against your backend

```bash
# Save frames from real capture
curl -X POST http://localhost:3001/v1/sessions/test/signals \
  -F "frames[]=@captured_frame_0.jpg" \
  -F "metadata=@captured_metadata.json"
```

### End-to-End Testing

Use Playwright or Cypress to test complete flow:

```javascript
// e2e/enrollment.spec.js
import { test, expect } from '@playwright/test';

test('complete enrollment flow', async ({ page, context }) => {
  // Grant camera permission
  await context.grantPermissions(['camera']);
  
  // Navigate to app
  await page.goto('http://localhost:3000');
  
  // Start enrollment
  await page.click('button:has-text("Start Enrollment")');
  
  // Wait for camera to initialize
  await page.waitForSelector('video[autoplay]');
  
  // Wait for capture to complete
  await page.waitForSelector('text=Verification Complete', { timeout: 15000 });
  
  // Check decision
  const decision = await page.textContent('[data-testid="decision"]');
  expect(decision).toBe('APPROVE');
});
```

### Load Testing

Test backend performance under load:

```javascript
// load-test.js (using k6)
import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
  vus: 100, // 100 virtual users
  duration: '5m',
};

export default function () {
  // 1. Create session
  let createRes = http.post('https://api.usesense.ai/v1/sessions', JSON.stringify({
    session_type: 'enrollment',
    platform: 'web'
  }), {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer sk_test_xxx'
    }
  });
  
  check(createRes, {
    'session created': (r) => r.status === 201
  });
  
  let session = createRes.json();
  
  // 2. Upload signals (mock)
  let uploadRes = http.post(`https://api.usesense.ai/v1/sessions/${session.session_id}/signals`,
    mockMultipartData,
    {
      headers: {
        'Authorization': `Bearer ${session.session_token}`
      }
    }
  );
  
  check(uploadRes, {
    'signals uploaded': (r) => r.status === 200
  });
  
  // 3. Complete session
  let completeRes = http.post(`https://api.usesense.ai/v1/sessions/${session.session_id}/complete`,
    null,
    {
      headers: {
        'Authorization': `Bearer ${session.session_token}`
      }
    }
  );
  
  check(completeRes, {
    'session completed': (r) => r.status === 200,
    'decision returned': (r) => r.json('decision') !== undefined
  });
  
  sleep(1);
}
```

Run load test:

```bash
k6 run load-test.js
```

**Target Metrics:**
- **Throughput:** 100+ sessions/second
- **P95 Latency:** < 5 seconds (end-to-end)
- **Error Rate:** < 0.1%

---

## Appendix: Sample Metadata Files

### Minimal Metadata (No Audio, No Challenges)

```json
{
  "session_id": "sess_abc123",
  "sdk_version": "1.0.0",
  "platform": "web",
  "capture_config": {
    "captureDurationMs": 2500,
    "targetFps": 15,
    "maxFrames": 50,
    "audioEnabled": "never",
    "stepUpPolicy": "never"
  },
  "timestamps": {
    "session_started_at_ms": 1708356789000,
    "capture_started_at_ms": 1708356791000,
    "capture_ended_at_ms": 1708356793500,
    "upload_started_at_ms": 1708356794000,
    "upload_ended_at_ms": 1708356795000
  },
  "frames_manifest": [
    {
      "frame_index": 0,
      "capture_timestamp_ms": 1708356791000,
      "frame_blob_size_bytes": 48230,
      "resolution_w": 640,
      "resolution_h": 480
    }
  ],
  "web_integrity": {
    "user_agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    "platform": "MacIntel",
    "languages": ["en-US"],
    "hardware_concurrency": 8,
    "device_memory_gb": 16,
    "webdriver": false,
    "cookie_enabled": true,
    "do_not_track": null,
    "timezone": "America/Los_Angeles",
    "screen": {
      "width": 1920,
      "height": 1080,
      "colorDepth": 24,
      "pixelRatio": 2.0
    },
    "visibility_state": "visible",
    "has_focus": true,
    "permissions_state": {
      "camera": "granted"
    },
    "media_devices": {
      "videoInputs": 1,
      "audioInputs": 1
    },
    "feature_support": {
      "supports_webrtc": true,
      "supports_media_recorder": true,
      "supports_permissions_api": true,
      "supports_webgl": true
    },
    "timing_signals": {
      "event_loop_lag_ms": {
        "avg": 2.1,
        "max": 8.3
      }
    },
    "webgl_fingerprint": "hash:1a2b3c4d"
  }
}
```

### Full Metadata (Audio + Challenge)

```json
{
  "session_id": "sess_xyz789",
  "sdk_version": "1.0.0",
  "platform": "web",
  "capture_config": {
    "captureDurationMs": 2500,
    "targetFps": 15,
    "maxFrames": 50,
    "audioEnabled": "always",
    "stepUpPolicy": "always"
  },
  "timestamps": {
    "session_started_at_ms": 1708356789000,
    "capture_started_at_ms": 1708356791000,
    "capture_ended_at_ms": 1708356793500,
    "upload_started_at_ms": 1708356794000,
    "upload_ended_at_ms": 1708356796500
  },
  "frames_manifest": [
    {
      "frame_index": 0,
      "capture_timestamp_ms": 1708356791000,
      "performance_timestamp_ms": 12345.67,
      "frame_blob_size_bytes": 48230,
      "resolution_w": 1280,
      "resolution_h": 720,
      "frame_hash": "sha256:abc123def456"
    }
  ],
  "audio_manifest": {
    "audio_mime_type": "audio/webm;codecs=opus",
    "audio_duration_ms": 2500,
    "audio_start_timestamp_ms": 1708356791000,
    "audio_end_timestamp_ms": 1708356793500,
    "audio_blob_size_bytes": 11524
  },
  "stepup_manifest": [
    {
      "type": "head_turn",
      "started_at_ms": 1708356791500,
      "completed_at_ms": 1708356792500,
      "head_turn_direction": "left"
    },
    {
      "type": "follow_dot",
      "started_at_ms": 1708356792500,
      "completed_at_ms": 1708356793500,
      "dot_positions": [
        { "x": 320, "y": 240, "timestamp_ms": 1708356792500 },
        { "x": 640, "y": 480, "timestamp_ms": 1708356793000 }
      ]
    }
  ],
  "web_integrity": {
    "user_agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X)",
    "platform": "iPhone",
    "languages": ["en-US", "en"],
    "hardware_concurrency": 6,
    "device_memory_gb": 4,
    "webdriver": false,
    "cookie_enabled": true,
    "do_not_track": null,
    "timezone": "America/New_York",
    "screen": {
      "width": 390,
      "height": 844,
      "colorDepth": 24,
      "pixelRatio": 3.0
    },
    "visibility_state": "visible",
    "has_focus": true,
    "permissions_state": {
      "camera": "granted",
      "microphone": "granted"
    },
    "media_devices": {
      "videoInputs": 2,
      "audioInputs": 1
    },
    "feature_support": {
      "supports_webrtc": true,
      "supports_media_recorder": true,
      "supports_permissions_api": false,
      "supports_webgl": true
    },
    "timing_signals": {
      "navigation_timing": {
        "domContentLoaded": 245,
        "loadComplete": 567
      },
      "event_loop_lag_ms": {
        "avg": 3.2,
        "max": 15.7
      }
    },
    "webgl_fingerprint": "hash:9z8y7x6w"
  },
  "webauthn_data": {
    "credential_id": "cred_platform_abc123",
    "authenticator_data": "base64_encoded_string_here",
    "attestation_object_present": true
  }
}
```

---

## Summary for Backend Developers

**What You Need to Build:**

1. **Session Management**
   - Create sessions with policies
   - Validate session tokens
   - Track session state

2. **Signal Storage**
   - Accept multipart uploads (30-50 JPEGs + JSON)
   - Store in S3/blob storage
   - Parse and validate metadata

3. **Processing Pipeline**
   - Extract features from frames
   - Run liveness detection
   - Run device trust analysis
   - Generate decisions

4. **API Responses**
   - Return policies that drive SDK behavior
   - Return decisions with scores
   - Handle errors gracefully

**Key Takeaways:**

- SDK sends **raw signals**, backend evaluates
- Metadata contains **comprehensive device fingerprint**
- Policies allow **dynamic capture behavior**
- Idempotency prevents duplicate processing
- Target **< 3 seconds** for evaluation

---

## Support

For integration questions:

- **Email:** support@usesense.ai  
- **Docs:** https://watchtower.usesense.ai/developer-docs/backend  
- **GitHub:** https://github.com/qudusadeyemi/usesense-web-sdk

---

**Happy Integrating! 🔧**
