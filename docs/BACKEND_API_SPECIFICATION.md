# UseSense Backend API Specification

**Version:** 1.0.0  
**Last Updated:** February 19, 2026  
**Author:** UseSense Engineering Team

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Authentication](#authentication)
4. [Core Concepts](#core-concepts)
5. [API Endpoints](#api-endpoints)
6. [Data Models](#data-models)
7. [Signal Processing Pipeline](#signal-processing-pipeline)
8. [Security Requirements](#security-requirements)
9. [Error Handling](#error-handling)
10. [Rate Limiting](#rate-limiting)
11. [Webhooks](#webhooks)
12. [Testing & Sandbox](#testing--sandbox)
13. [Deployment Considerations](#deployment-considerations)

---

## Overview

The UseSense Backend API provides the server-side infrastructure for processing biometric verification sessions initiated by the Web SDK. The backend is responsible for:

- **Session Management**: Creating and tracking verification sessions
- **Signal Processing**: Receiving and storing captured biometric data
- **LiveSense Analysis**: Liveness detection and spoof analysis
- **DeepSense Analysis**: Device trust and fraud detection
- **Identity Matching**: 1:1 authentication and 1:N deduplication
- **Policy Enforcement**: Risk-based decision making
- **Audit & Compliance**: Immutable logs and compliance reporting

### Key Principles

1. **Zero Trust**: Never trust client-side data; validate everything server-side
2. **Privacy First**: Minimize data retention; support GDPR/CCPA compliance
3. **Idempotency**: All mutations support idempotency keys
4. **Separation of Concerns**: SDK collects, backend evaluates
5. **Fast Response**: < 3 seconds for session completion

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Web SDK (Client)                         │
│  Captures: Video frames, Audio, Web integrity, WebAuthn         │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       │ HTTPS/TLS 1.2+
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                      API Gateway / Load Balancer                │
│  - TLS Termination                                              │
│  - Rate Limiting                                                │
│  - Request Validation                                           │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Backend API Service                         │
│                                                                  │
│  ┌──────────────────┐  ┌──────────────────┐                    │
│  │  Session Manager │  │  Upload Handler  │                    │
│  └──────────────────┘  └──────────────────┘                    │
│                                                                  │
│  ┌──────────────────┐  ┌──────────────────┐                    │
│  │  Policy Engine   │  │  Auth Manager    │                    │
│  └──────────────────┘  └──────────────────┘                    │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Processing Pipeline (Async)                   │
│                                                                  │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐ │
│  │   LiveSense      │  │   DeepSense-Web  │  │   Identity   │ │
│  │   Processor      │  │   Analyzer       │  │   Matcher    │ │
│  │                  │  │                  │  │              │ │
│  │  - Liveness      │  │  - Device Trust  │  │  - 1:1 Match │ │
│  │  - Spoof Detect  │  │  - Bot Detection │  │  - 1:N Dedupe│ │
│  │  - Quality Check │  │  - Fingerprint   │  │  - Templates │ │
│  └──────────────────┘  └──────────────────┘  └──────────────┘ │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                         Data Storage                             │
│                                                                  │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐ │
│  │   PostgreSQL     │  │   S3/Blob        │  │   Redis      │ │
│  │   (Metadata)     │  │   (Signals)      │  │   (Cache)    │ │
│  └──────────────────┘  └──────────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## Authentication

### Tenant-Level Authentication

All API requests require authentication using a **Tenant API Key** in the `Authorization` header:

```
Authorization: Bearer sk_live_1234567890abcdefghijklmnopqrstuvwxyz
```

**Tenant Keys:**
- `sk_test_*` - Sandbox environment keys
- `sk_live_*` - Production environment keys

### Session-Level Authentication

After creating a session, the SDK receives a **session token** that authenticates subsequent requests for that specific session:

```
Authorization: Bearer sess_tok_abc123xyz789
```

**Security Requirements:**
- Tenant keys must never be exposed to the client
- Session tokens are single-use and expire after 15 minutes
- Session tokens are scoped to a single session ID
- All requests must use HTTPS (TLS 1.2+)

---

## Core Concepts

### Sessions

A **session** represents a single verification attempt. Sessions are stateful and progress through the following lifecycle:

```
created → capturing → uploaded → evaluating → completed
```

**Session Types:**
1. **Enrollment** (`enrollment`): First-time user registration; creates a biometric template
2. **Authentication** (`authentication`): Returning user verification; matches against existing template

### Policies

The backend returns a **policy** object that tells the SDK what to capture:

```json
{
  "requires_audio": false,
  "requires_stepup": false,
  "challenge_type": "none",
  "phrase": null
}
```

**Policy Logic:**
- Risk-based policies can request additional signals (audio, challenges)
- Challenge types: `none`, `head_turn`, `follow_dot`, `speak_phrase`
- Policies can be pre-configured or dynamically generated based on risk

### Signals

**Signals** are the raw data collected by the SDK:

1. **Video Frames**: 30-50 JPEG images (15 FPS × 2.5s)
2. **Audio**: Optional WebM audio snippet
3. **Metadata**: JSON with timestamps, manifests, web integrity signals
4. **WebAuthn**: Optional platform authenticator binding

### Decisions

The final **decision** is returned after evaluation:

- `APPROVE` - Verification passed, allow action
- `REJECT` - Verification failed, deny access
- `MANUAL_REVIEW` - Inconclusive, queue for human review
- `STEP_UP_REQUIRED` - Trigger additional verification

---

## API Endpoints

### Base URL

```
Production: https://api.usesense.com
Sandbox:    https://api-sandbox.usesense.com
```

### API Version

All endpoints are prefixed with `/v1/`.

---

### 1. Create Session

**Endpoint:** `POST /v1/sessions`

**Description:** Initialize a new verification session (enrollment or authentication).

**Authentication:** Tenant API Key (Bearer token)

**Request Headers:**
```
Content-Type: application/json
Authorization: Bearer sk_live_xxx
X-Request-ID: optional-unique-request-id
```

**Request Body:**

```json
{
  "session_type": "enrollment",
  "identity_id": null,
  "external_user_id": "user_12345",
  "metadata": {
    "user_email": "user@example.com",
    "source": "web_app",
    "ip_address": "203.0.113.42"
  },
  "platform": "web"
}
```

**Request Schema:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `session_type` | string | Yes | `"enrollment"` or `"authentication"` |
| `identity_id` | string | Conditional | Required for authentication; UseSense identity ID |
| `external_user_id` | string | No | Your system's user ID (for tracking) |
| `metadata` | object | No | Custom metadata (max 5KB, non-PII recommended) |
| `platform` | string | Yes | Always `"web"` |

**Response (201 Created):**

```json
{
  "session_id": "sess_abc123xyz789",
  "session_token": "sess_tok_def456uvw012",
  "expires_at": "2026-02-19T15:45:00Z",
  "policy": {
    "requires_audio": false,
    "requires_stepup": false,
    "challenge_type": "none",
    "phrase": null,
    "stepup_sequence": null
  },
  "upload": {
    "max_frames": 50,
    "target_fps": 15,
    "capture_duration_ms": 2500
  },
  "nonce": "nonce_ghi789pqr345"
}
```

**Response Schema:**

| Field | Type | Description |
|-------|------|-------------|
| `session_id` | string | Unique session identifier |
| `session_token` | string | Short-lived token for this session (15min TTL) |
| `expires_at` | string | ISO 8601 timestamp when session expires |
| `policy` | object | Policy object defining what SDK should collect |
| `upload` | object | Upload configuration (frame limits, etc.) |
| `nonce` | string | Optional nonce for cryptographic binding |

**Policy Object:**

| Field | Type | Description |
|-------|------|-------------|
| `requires_audio` | boolean | Whether SDK should capture audio |
| `requires_stepup` | boolean | Whether step-up challenge is required |
| `challenge_type` | string | `"none"`, `"head_turn"`, `"follow_dot"`, `"speak_phrase"` |
| `phrase` | string | Phrase to speak (if `challenge_type` is `"speak_phrase"`) |
| `stepup_sequence` | array | Sequence of challenges (advanced) |

**Error Responses:**

| Status | Error Code | Description |
|--------|------------|-------------|
| 400 | `invalid_request` | Malformed request body |
| 401 | `unauthorized` | Invalid or missing tenant API key |
| 404 | `identity_not_found` | Identity ID not found (authentication only) |
| 429 | `rate_limit_exceeded` | Too many requests |
| 500 | `internal_error` | Server error |

**Example Error Response:**

```json
{
  "error": {
    "code": "identity_not_found",
    "message": "No enrolled identity found for identity_id: ident_xyz789",
    "details": {
      "session_type": "authentication",
      "identity_id": "ident_xyz789"
    }
  }
}
```

---

### 2. Upload Signals

**Endpoint:** `POST /v1/sessions/{session_id}/signals`

**Description:** Upload captured signals (video frames, audio, metadata) to the backend.

**Authentication:** Session Token (Bearer token)

**Request Headers:**
```
Authorization: Bearer sess_tok_xxx
X-Idempotency-Key: sess_abc123_1708356789123_xk9j2l4m
Content-Type: multipart/form-data
```

**Request Body (Multipart Form Data):**

| Part Name | Type | Required | Description |
|-----------|------|----------|-------------|
| `frames[]` | File[] | Yes | Array of JPEG images (30-50 frames) |
| `audio` | File | No | WebM audio file (if policy requires audio) |
| `metadata` | File | Yes | JSON file with metadata payload |

**Form Data Structure:**

```
POST /v1/sessions/sess_abc123/signals
Content-Type: multipart/form-data; boundary=----WebKitFormBoundary

------WebKitFormBoundary
Content-Disposition: form-data; name="frames[]"; filename="frame_0.jpg"
Content-Type: image/jpeg

<binary JPEG data>
------WebKitFormBoundary
Content-Disposition: form-data; name="frames[]"; filename="frame_1.jpg"
Content-Type: image/jpeg

<binary JPEG data>
------WebKitFormBoundary
...
------WebKitFormBoundary
Content-Disposition: form-data; name="audio"; filename="audio.webm"
Content-Type: audio/webm

<binary audio data>
------WebKitFormBoundary
Content-Disposition: form-data; name="metadata"; filename="metadata.json"
Content-Type: application/json

<JSON metadata>
------WebKitFormBoundary--
```

**Metadata JSON Structure:**

```json
{
  "session_id": "sess_abc123xyz789",
  "sdk_version": "1.0.0",
  "platform": "web",
  "capture_config": {
    "captureDurationMs": 2500,
    "targetFps": 15,
    "maxFrames": 50,
    "audioEnabled": "risk_based",
    "stepUpPolicy": "risk_based"
  },
  "timestamps": {
    "session_started_at_ms": 1708356789000,
    "capture_started_at_ms": 1708356791000,
    "capture_ended_at_ms": 1708356793500,
    "upload_started_at_ms": 1708356794000,
    "upload_ended_at_ms": 1708356795500
  },
  "frames_manifest": [
    {
      "frame_index": 0,
      "capture_timestamp_ms": 1708356791000,
      "performance_timestamp_ms": 12345.67,
      "frame_blob_size_bytes": 45821,
      "resolution_w": 640,
      "resolution_h": 480,
      "frame_hash": "sha256:abc123..."
    }
  ],
  "audio_manifest": {
    "audio_mime_type": "audio/webm;codecs=opus",
    "audio_duration_ms": 2500,
    "audio_start_timestamp_ms": 1708356791000,
    "audio_end_timestamp_ms": 1708356793500,
    "audio_blob_size_bytes": 12048
  },
  "stepup_manifest": [
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
    "user_agent": "Mozilla/5.0...",
    "platform": "MacIntel",
    "languages": ["en-US", "en"],
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
      "camera": "granted",
      "microphone": "denied"
    },
    "media_devices": {
      "videoInputs": 2,
      "audioInputs": 1
    },
    "feature_support": {
      "supports_webrtc": true,
      "supports_media_recorder": true,
      "supports_permissions_api": true,
      "supports_webgl": true
    },
    "timing_signals": {
      "navigation_timing": {
        "domContentLoaded": 245,
        "loadComplete": 567
      },
      "event_loop_lag_ms": {
        "avg": 2.3,
        "max": 12.1
      }
    },
    "webgl_fingerprint": "hash:a1b2c3d4"
  },
  "webauthn_data": {
    "credential_id": "cred_xyz123",
    "authenticator_data": "base64_encoded_data",
    "attestation_object_present": true
  }
}
```

**Response (200 OK):**

```json
{
  "received": true,
  "session_id": "sess_abc123xyz789",
  "frames_count": 38,
  "audio_received": true,
  "metadata_received": true,
  "total_size_bytes": 1850432
}
```

**Response Schema:**

| Field | Type | Description |
|-------|------|-------------|
| `received` | boolean | Always `true` if successful |
| `session_id` | string | Session ID confirmation |
| `frames_count` | number | Number of frames received |
| `audio_received` | boolean | Whether audio was received |
| `metadata_received` | boolean | Whether metadata was received |
| `total_size_bytes` | number | Total upload size |

**Idempotency:**

- The `X-Idempotency-Key` header prevents duplicate uploads
- If the same key is sent twice, the second request returns the cached response (200 OK)
- Idempotency keys are stored for 24 hours

**Error Responses:**

| Status | Error Code | Description |
|--------|------------|-------------|
| 400 | `invalid_upload` | Missing frames or malformed data |
| 401 | `unauthorized` | Invalid session token |
| 404 | `session_not_found` | Session ID doesn't exist |
| 413 | `payload_too_large` | Upload exceeds size limit (default 10MB) |
| 422 | `validation_error` | Metadata validation failed |
| 429 | `rate_limit_exceeded` | Too many uploads |
| 500 | `internal_error` | Storage failure |

---

### 3. Complete Session

**Endpoint:** `POST /v1/sessions/{session_id}/complete`

**Description:** Finalize the session and trigger evaluation. Returns the final decision.

**Authentication:** Session Token (Bearer token)

**Request Headers:**
```
Authorization: Bearer sess_tok_xxx
X-Idempotency-Key: sess_abc123_complete_1708356795123
```

**Request Body:** (Empty)

**Response (200 OK):**

```json
{
  "session_id": "sess_abc123xyz789",
  "session_type": "enrollment",
  "identity_id": "ident_new123abc",
  "decision": "APPROVE",
  "channel_trust_score": 87,
  "liveness_score": 94,
  "dedupe_risk_score": 12,
  "reasons": [
    "High liveness score",
    "Strong device trust",
    "No duplicate detected"
  ],
  "rule_applied": "default_enrollment_policy",
  "timestamp": "2026-02-19T15:42:30.123Z",
  "signature": "sha256:xyz789abc123..."
}
```

**Response Schema (Final Decision Object):**

| Field | Type | Description |
|-------|------|-------------|
| `session_id` | string | Session identifier |
| `session_type` | string | `"enrollment"` or `"authentication"` |
| `identity_id` | string | UseSense identity ID (created for enrollment, matched for auth) |
| `decision` | string | `"APPROVE"`, `"REJECT"`, `"MANUAL_REVIEW"`, `"STEP_UP_REQUIRED"` |
| `channel_trust_score` | number | Device/browser trust score (0-100) |
| `liveness_score` | number | Liveness detection score (0-100) |
| `dedupe_risk_score` | number | Duplicate/match quality score (0-100, interpretation varies) |
| `reasons` | string[] | Human-readable reasons for decision |
| `rule_applied` | string | Policy rule that generated this decision |
| `timestamp` | string | ISO 8601 decision timestamp |
| `signature` | string | HMAC signature for verification |

**Score Interpretation:**

| Score | Range | Interpretation |
|-------|-------|----------------|
| `channel_trust_score` | 0-100 | Higher = more trustworthy device/browser |
| `liveness_score` | 0-100 | Higher = more confident user is present (not spoofed) |
| `dedupe_risk_score` | 0-100 | **Enrollment**: Higher = more likely duplicate<br>**Authentication**: Higher = better match quality |

**Decision Logic:**

- `APPROVE`: All scores meet thresholds, proceed with action
- `REJECT`: One or more scores below threshold, deny access
- `MANUAL_REVIEW`: Borderline scores, queue for human review
- `STEP_UP_REQUIRED`: Trigger additional verification (e.g., 2FA)

**Synchronous vs Asynchronous Processing:**

- **Fast Path** (< 3 seconds): If evaluation completes quickly, return decision immediately
- **Slow Path** (> 3 seconds): Return `202 Accepted` and client should poll `/status` endpoint

**Response (202 Accepted) - Async Processing:**

```json
{
  "session_id": "sess_abc123xyz789",
  "status": "evaluating",
  "message": "Session is being evaluated. Poll /status endpoint for result.",
  "retry_after_seconds": 2
}
```

**Error Responses:**

| Status | Error Code | Description |
|--------|------------|-------------|
| 400 | `signals_not_uploaded` | Must upload signals before completing |
| 401 | `unauthorized` | Invalid session token |
| 404 | `session_not_found` | Session ID doesn't exist |
| 409 | `already_completed` | Session already completed (idempotent) |
| 500 | `evaluation_error` | Processing failure |

---

### 4. Get Session Status

**Endpoint:** `GET /v1/sessions/{session_id}/status`

**Description:** Poll the session status (for async processing).

**Authentication:** Session Token (Bearer token)

**Request Headers:**
```
Authorization: Bearer sess_tok_xxx
```

**Response (200 OK) - Still Processing:**

```json
{
  "session_id": "sess_abc123xyz789",
  "status": "evaluating",
  "result": null
}
```

**Response (200 OK) - Completed:**

```json
{
  "session_id": "sess_abc123xyz789",
  "status": "completed",
  "result": {
    "session_id": "sess_abc123xyz789",
    "session_type": "enrollment",
    "identity_id": "ident_new123abc",
    "decision": "APPROVE",
    "channel_trust_score": 87,
    "liveness_score": 94,
    "dedupe_risk_score": 12,
    "reasons": ["High liveness score"],
    "rule_applied": "default_policy",
    "timestamp": "2026-02-19T15:42:30.123Z",
    "signature": "sha256:xyz789..."
  }
}
```

**Status Values:**

| Status | Description |
|--------|-------------|
| `created` | Session created, awaiting capture |
| `capturing` | SDK is capturing signals |
| `uploaded` | Signals uploaded, awaiting evaluation |
| `evaluating` | Backend is processing signals |
| `completed` | Evaluation complete, decision available |

**Polling Guidelines:**

- Poll every 1-2 seconds (SDK default: 1s)
- Maximum 30 attempts (SDK default)
- Use exponential backoff if desired

---

## Data Models

### Database Schema

#### Sessions Table

```sql
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id VARCHAR(64) UNIQUE NOT NULL,
  session_token_hash VARCHAR(128) NOT NULL,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  session_type VARCHAR(20) NOT NULL CHECK (session_type IN ('enrollment', 'authentication')),
  identity_id VARCHAR(64) REFERENCES identities(identity_id),
  external_user_id VARCHAR(255),
  status VARCHAR(20) NOT NULL DEFAULT 'created',
  metadata JSONB,
  policy JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  signals_uploaded_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  INDEX idx_sessions_session_id (session_id),
  INDEX idx_sessions_tenant_id (tenant_id),
  INDEX idx_sessions_identity_id (identity_id),
  INDEX idx_sessions_status (status),
  INDEX idx_sessions_created_at (created_at)
);
```

#### Signals Table

```sql
CREATE TABLE signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id VARCHAR(64) NOT NULL REFERENCES sessions(session_id),
  storage_path VARCHAR(512) NOT NULL,
  frames_count INTEGER NOT NULL,
  has_audio BOOLEAN NOT NULL DEFAULT false,
  total_size_bytes BIGINT NOT NULL,
  metadata JSONB NOT NULL,
  web_integrity JSONB NOT NULL,
  webauthn_data JSONB,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  INDEX idx_signals_session_id (session_id)
);
```

#### Decisions Table

```sql
CREATE TABLE decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id VARCHAR(64) NOT NULL REFERENCES sessions(session_id),
  session_type VARCHAR(20) NOT NULL,
  identity_id VARCHAR(64) REFERENCES identities(identity_id),
  decision VARCHAR(20) NOT NULL CHECK (decision IN ('APPROVE', 'REJECT', 'MANUAL_REVIEW', 'STEP_UP_REQUIRED')),
  channel_trust_score SMALLINT NOT NULL CHECK (channel_trust_score BETWEEN 0 AND 100),
  liveness_score SMALLINT NOT NULL CHECK (liveness_score BETWEEN 0 AND 100),
  dedupe_risk_score SMALLINT NOT NULL CHECK (dedupe_risk_score BETWEEN 0 AND 100),
  reasons TEXT[] NOT NULL,
  rule_applied VARCHAR(128),
  signature VARCHAR(256) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  INDEX idx_decisions_session_id (session_id),
  INDEX idx_decisions_identity_id (identity_id),
  INDEX idx_decisions_decision (decision),
  INDEX idx_decisions_created_at (created_at)
);
```

#### Identities Table

```sql
CREATE TABLE identities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identity_id VARCHAR(64) UNIQUE NOT NULL,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  external_user_id VARCHAR(255),
  enrollment_session_id VARCHAR(64) NOT NULL,
  template_version VARCHAR(20) NOT NULL,
  template_storage_path VARCHAR(512) NOT NULL,
  webauthn_credential_id VARCHAR(256),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  INDEX idx_identities_identity_id (identity_id),
  INDEX idx_identities_tenant_id (tenant_id),
  INDEX idx_identities_external_user_id (external_user_id)
);
```

#### Audit Logs Table

```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  event_type VARCHAR(64) NOT NULL,
  session_id VARCHAR(64),
  identity_id VARCHAR(64),
  actor VARCHAR(255),
  ip_address INET,
  user_agent TEXT,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  INDEX idx_audit_logs_tenant_id (tenant_id),
  INDEX idx_audit_logs_session_id (session_id),
  INDEX idx_audit_logs_event_type (event_type),
  INDEX idx_audit_logs_created_at (created_at)
);
```

---

## Signal Processing Pipeline

### Processing Flow

```
1. Receive Upload (POST /signals)
   ↓
2. Validate & Store Signals in S3/Blob Storage
   ↓
3. Extract Frames & Audio
   ↓
4. Run Parallel Analysis:
   ├─ LiveSense: Liveness + Spoof Detection
   ├─ DeepSense-Web: Device Trust + Bot Detection
   └─ Identity: Template Creation or Matching
   ↓
5. Policy Engine: Evaluate Scores Against Rules
   ↓
6. Generate Decision + Signature
   ↓
7. Store Decision in Database
   ↓
8. Return to Client (POST /complete)
```

### LiveSense Processing

**Input:**
- Video frames (JPEG images)
- Optional audio snippet
- Challenge responses (if applicable)

**Outputs:**
- `liveness_score` (0-100)
- Spoof detection flags
- Quality metrics

**Checks:**
- Face detection in each frame
- Head pose variations
- Micro-expressions
- Eye blink detection
- Challenge response validation (head turn, dot tracking)
- Audio-visual sync (if audio present)
- Deepfake/manipulation detection

### DeepSense-Web Processing

**Input:**
- Web integrity signals (browser fingerprint)
- Device characteristics
- Timing signals

**Outputs:**
- `channel_trust_score` (0-100)
- Bot/automation likelihood
- Device risk flags

**Checks:**
- WebDriver detection
- Headless browser detection
- Event loop timing anomalies
- Hardware consistency checks
- TLS fingerprinting
- IP reputation
- Browser fingerprint uniqueness

### Identity Processing

**Enrollment:**
1. Extract face embeddings from video frames
2. Generate biometric template (vector representation)
3. Run deduplication check (1:N search against existing identities)
4. Store template if no duplicate found
5. Assign `identity_id`

**Authentication:**
1. Extract face embeddings from video frames
2. Load template for provided `identity_id`
3. Compute similarity score (1:1 match)
4. Return match quality as `dedupe_risk_score`

**Template Format:**
- 512-dimensional face embedding vector
- Stored encrypted in S3/Blob storage
- Never returned to client

---

## Security Requirements

### TLS/HTTPS

- **Mandatory TLS 1.2+** for all production traffic
- Use strong cipher suites (no RC4, no MD5)
- HSTS headers recommended

### Authentication

- **Tenant API keys** must be rotated every 90 days
- **Session tokens** expire after 15 minutes
- Tokens are single-use for write operations

### Data Storage

- **Encryption at rest**: AES-256 for S3/Blob storage
- **Encryption in transit**: TLS 1.2+
- **Database encryption**: Transparent Data Encryption (TDE)

### Idempotency

- All mutation endpoints (`POST`, `PUT`, `DELETE`) support idempotency keys
- Idempotency keys stored for 24 hours
- Duplicate requests return cached response (no side effects)

### Rate Limiting

Per tenant, per endpoint:

| Endpoint | Limit | Window |
|----------|-------|--------|
| `POST /sessions` | 100 requests | 1 minute |
| `POST /signals` | 50 requests | 1 minute |
| `POST /complete` | 50 requests | 1 minute |
| `GET /status` | 200 requests | 1 minute |

Return `429 Too Many Requests` with `Retry-After` header.

### Input Validation

- **Session creation**: Validate `session_type`, `platform`, metadata size
- **Signal upload**: Validate frame count (30-50), file types (JPEG, WebM), total size (< 10MB)
- **Metadata validation**: JSON schema validation, required fields

### Signature Verification

All decisions include a **signature** that clients can verify:

```
signature = HMAC-SHA256(
  key: tenant_secret,
  data: session_id + decision + timestamp
)
```

This prevents tampering with decision objects.

---

## Error Handling

### Standard Error Response

```json
{
  "error": {
    "code": "invalid_request",
    "message": "Session type must be 'enrollment' or 'authentication'",
    "details": {
      "field": "session_type",
      "provided": "enrolment"
    },
    "request_id": "req_abc123xyz789"
  }
}
```

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `invalid_request` | 400 | Malformed request |
| `unauthorized` | 401 | Invalid or missing auth token |
| `forbidden` | 403 | Insufficient permissions |
| `not_found` | 404 | Resource not found |
| `conflict` | 409 | Resource already exists |
| `validation_error` | 422 | Input validation failed |
| `rate_limit_exceeded` | 429 | Too many requests |
| `internal_error` | 500 | Server-side error |
| `service_unavailable` | 503 | Temporary outage |

### Error Handling Best Practices

1. **Log all errors** with `request_id` for debugging
2. **Never expose sensitive data** in error messages
3. **Use appropriate HTTP status codes**
4. **Provide actionable error messages** for developers
5. **Include retry guidance** for transient errors

---

## Rate Limiting

### Implementation

```http
HTTP/1.1 429 Too Many Requests
Content-Type: application/json
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1708357200
Retry-After: 60

{
  "error": {
    "code": "rate_limit_exceeded",
    "message": "Too many requests. Please retry after 60 seconds.",
    "request_id": "req_xyz789"
  }
}
```

### Headers

| Header | Description |
|--------|-------------|
| `X-RateLimit-Limit` | Maximum requests allowed in window |
| `X-RateLimit-Remaining` | Requests remaining in current window |
| `X-RateLimit-Reset` | Unix timestamp when limit resets |
| `Retry-After` | Seconds until client should retry |

### Algorithm

Use **sliding window** or **token bucket** algorithm:

- Track requests per tenant per endpoint
- Use Redis for distributed rate limiting
- Reset counters on window expiration

---

## Webhooks

### Overview

UseSense can send **webhooks** to notify your backend of important events.

### Event Types

| Event | Description |
|-------|-------------|
| `session.completed` | Session evaluation finished |
| `session.failed` | Session evaluation failed |
| `identity.enrolled` | New identity created |
| `decision.manual_review` | Decision requires manual review |

### Webhook Payload

```json
{
  "event_type": "session.completed",
  "event_id": "evt_abc123xyz789",
  "timestamp": "2026-02-19T15:42:30.123Z",
  "data": {
    "session_id": "sess_abc123xyz789",
    "session_type": "enrollment",
    "decision": {
      "session_id": "sess_abc123xyz789",
      "decision": "APPROVE",
      "channel_trust_score": 87,
      "liveness_score": 94,
      "dedupe_risk_score": 12,
      "identity_id": "ident_new123abc",
      "timestamp": "2026-02-19T15:42:30.123Z"
    }
  },
  "signature": "sha256:hmac_signature_here"
}
```

### Webhook Signature Verification

```python
import hmac
import hashlib

def verify_webhook(payload, signature, webhook_secret):
    expected = hmac.new(
        webhook_secret.encode(),
        payload.encode(),
        hashlib.sha256
    ).hexdigest()
    
    return hmac.compare_digest(f"sha256:{expected}", signature)
```

### Configuration

Webhooks are configured per tenant via dashboard or API.

---

## Testing & Sandbox

### Sandbox Environment

- **Base URL**: `https://api-sandbox.usesense.com`
- **Tenant Keys**: Start with `sk_test_`
- **No charges**: Free for testing
- **Data retention**: 7 days

### Test Identities

Sandbox provides test identities for authentication testing:

| Identity ID | Description |
|-------------|-------------|
| `ident_test_approve` | Always returns `APPROVE` |
| `ident_test_reject` | Always returns `REJECT` |
| `ident_test_review` | Always returns `MANUAL_REVIEW` |

### Mock Policies

Test different policy scenarios:

```json
{
  "session_type": "enrollment",
  "metadata": {
    "test_policy": "always_audio"
  }
}
```

Policy options:
- `always_audio`: Force audio capture
- `always_stepup`: Force step-up challenge
- `force_approve`: Always approve (testing only)
- `force_reject`: Always reject (testing only)

---

## Deployment Considerations

### Infrastructure

**Minimum Production Setup:**
- **API Service**: 3+ instances (load balanced)
- **Database**: PostgreSQL 14+ (replicated)
- **Storage**: S3-compatible blob storage
- **Cache**: Redis cluster
- **Processing Queue**: RabbitMQ or AWS SQS

**Recommended Stack:**
- **Container Orchestration**: Kubernetes or ECS
- **API Framework**: Node.js (Express/Fastify), Python (FastAPI), or Go
- **ML Inference**: TensorFlow Serving, ONNX Runtime, or custom
- **Monitoring**: Prometheus + Grafana
- **Logging**: ELK Stack or Datadog

### Performance Targets

| Metric | Target |
|--------|--------|
| **Session Creation** | < 200ms p99 |
| **Signal Upload** | < 2s for 5MB payload |
| **Session Completion** | < 3s p95 (sync), < 10s p99 (async) |
| **Status Polling** | < 100ms p99 |

### Scaling

**Horizontal Scaling:**
- API service scales based on CPU/memory
- Processing workers scale based on queue depth
- Database read replicas for heavy read loads

**Vertical Scaling:**
- ML inference may require GPU instances
- Database may need high-memory instances for large datasets

### Monitoring & Alerting

**Key Metrics:**
- Request rate, error rate, latency (p50, p95, p99)
- Session completion rate
- Queue depth and processing time
- Database connection pool utilization
- Storage usage and costs

**Critical Alerts:**
- Error rate > 1% for 5 minutes
- p99 latency > 10s for session completion
- Queue depth > 1000 for 10 minutes
- Database replica lag > 5 seconds

### Data Retention

**Compliance Requirements:**
- **Signals (frames/audio)**: Delete after 30 days (configurable)
- **Templates**: Retain until identity deletion request
- **Decisions**: Retain for 7 years (audit compliance)
- **Audit logs**: Retain for 7 years

**GDPR/CCPA Compliance:**
- Support identity deletion (`DELETE /identities/{id}`)
- Export user data (`GET /identities/{id}/export`)
- Anonymize audit logs on deletion

### Security Hardening

- **WAF**: Deploy Web Application Firewall (AWS WAF, Cloudflare)
- **DDoS Protection**: Rate limiting + CDN
- **Secrets Management**: Use AWS Secrets Manager or HashiCorp Vault
- **Audit Logging**: Log all API requests with IP, user agent, tenant
- **Penetration Testing**: Annual security audits

---

## Appendix A: API Request Examples

### Example 1: Complete Enrollment Flow

**Step 1: Create Session**

```bash
curl -X POST https://api.usesense.com/v1/sessions \
  -H "Authorization: Bearer sk_live_abc123" \
  -H "Content-Type: application/json" \
  -d '{
    "session_type": "enrollment",
    "external_user_id": "user_12345",
    "platform": "web"
  }'
```

**Response:**

```json
{
  "session_id": "sess_xyz789",
  "session_token": "sess_tok_abc123",
  "expires_at": "2026-02-19T16:00:00Z",
  "policy": {
    "requires_audio": false,
    "requires_stepup": false,
    "challenge_type": "none"
  }
}
```

**Step 2: Upload Signals**

```bash
curl -X POST https://api.usesense.com/v1/sessions/sess_xyz789/signals \
  -H "Authorization: Bearer sess_tok_abc123" \
  -H "X-Idempotency-Key: sess_xyz789_upload_1708356789" \
  -F "frames[]=@frame_0.jpg" \
  -F "frames[]=@frame_1.jpg" \
  ... \
  -F "metadata=@metadata.json"
```

**Step 3: Complete Session**

```bash
curl -X POST https://api.usesense.com/v1/sessions/sess_xyz789/complete \
  -H "Authorization: Bearer sess_tok_abc123" \
  -H "X-Idempotency-Key: sess_xyz789_complete"
```

**Response:**

```json
{
  "session_id": "sess_xyz789",
  "session_type": "enrollment",
  "identity_id": "ident_new456",
  "decision": "APPROVE",
  "channel_trust_score": 87,
  "liveness_score": 94,
  "dedupe_risk_score": 8,
  "reasons": ["High liveness score", "No duplicate found"],
  "timestamp": "2026-02-19T15:42:30Z",
  "signature": "sha256:signature_here"
}
```

---

## Appendix B: TypeScript Client Implementation

```typescript
import axios, { AxiosInstance } from 'axios';

interface UseSenseConfig {
  apiBaseUrl: string;
  tenantKey: string;
}

interface CreateSessionRequest {
  session_type: 'enrollment' | 'authentication';
  identity_id?: string;
  external_user_id?: string;
  metadata?: Record<string, any>;
  platform: 'web';
}

interface CreateSessionResponse {
  session_id: string;
  session_token: string;
  expires_at: string;
  policy: any;
}

interface FinalDecisionObject {
  session_id: string;
  session_type: string;
  identity_id?: string;
  decision: 'APPROVE' | 'REJECT' | 'MANUAL_REVIEW' | 'STEP_UP_REQUIRED';
  channel_trust_score: number;
  liveness_score: number;
  dedupe_risk_score: number;
  reasons: string[];
  timestamp: string;
  signature: string;
}

class UseSenseBackendClient {
  private client: AxiosInstance;
  
  constructor(config: UseSenseConfig) {
    this.client = axios.create({
      baseURL: config.apiBaseUrl,
      headers: {
        'Authorization': `Bearer ${config.tenantKey}`
      }
    });
  }
  
  async createSession(request: CreateSessionRequest): Promise<CreateSessionResponse> {
    const response = await this.client.post('/v1/sessions', request);
    return response.data;
  }
  
  async uploadSignals(
    sessionId: string,
    sessionToken: string,
    formData: FormData
  ): Promise<void> {
    const idempotencyKey = `${sessionId}_upload_${Date.now()}`;
    
    await this.client.post(`/v1/sessions/${sessionId}/signals`, formData, {
      headers: {
        'Authorization': `Bearer ${sessionToken}`,
        'X-Idempotency-Key': idempotencyKey
      }
    });
  }
  
  async completeSession(
    sessionId: string,
    sessionToken: string
  ): Promise<FinalDecisionObject> {
    const idempotencyKey = `${sessionId}_complete_${Date.now()}`;
    
    const response = await this.client.post(
      `/v1/sessions/${sessionId}/complete`,
      {},
      {
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
          'X-Idempotency-Key': idempotencyKey
        }
      }
    );
    
    return response.data;
  }
}
```

---

## Appendix C: Policy Configuration Examples

### Example 1: Low-Risk Enrollment

```json
{
  "policy_name": "low_risk_enrollment",
  "rules": [
    {
      "condition": "session_type == 'enrollment'",
      "requirements": {
        "requires_audio": false,
        "requires_stepup": false,
        "challenge_type": "none"
      },
      "thresholds": {
        "liveness_score": 70,
        "channel_trust_score": 60
      }
    }
  ]
}
```

### Example 2: High-Risk Authentication

```json
{
  "policy_name": "high_risk_authentication",
  "rules": [
    {
      "condition": "session_type == 'authentication' AND ip_country != user_country",
      "requirements": {
        "requires_audio": true,
        "requires_stepup": true,
        "challenge_type": "speak_phrase"
      },
      "thresholds": {
        "liveness_score": 90,
        "channel_trust_score": 80,
        "dedupe_risk_score": 85
      }
    }
  ]
}
```

---

## Support

For questions or issues:

- **Email**: backend-support@usesense.com
- **Documentation**: https://docs.usesense.com/backend
- **API Status**: https://status.usesense.com

---

**Document Version:** 1.0.0  
**Last Updated:** February 19, 2026  
**Next Review:** May 19, 2026
