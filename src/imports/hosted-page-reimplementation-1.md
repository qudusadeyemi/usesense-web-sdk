# UseSense Web SDK: Hosted Page Re-Implementation Using VerificationCaptureEngine

**Author:** Engineering Team
**Date:** March 12, 2026
**Version:** 1.17.57+
**Target:** Demo Web SDK hosted enrollment/verification pages

---

## 1. Executive Summary

The dashboard's **Hosted Enrollment Page** (`/enroll/:sessionId`) and **Hosted Verification Page** (`/verify/:sessionId`) are thin wrappers around a shared component called `VerificationCaptureEngine`. This engine runs the full biometric capture pipeline:

```
Camera init -> Web integrity signals -> Baseline phase
  -> Countdown 3-2-1 -> Challenge phase -> Upload signals
  -> Complete session -> Return verdict
```

The demo Web SDK should re-implement this same pattern: a page wrapper that handles session lifecycle (loading data, branding, result display), and delegates the entire capture flow to the engine.

---

## 2. Architecture Overview

```
                         [Hosted Page URL]
                                |
                    +-----------v-----------+
                    |   Page Wrapper (thin)  |
                    |  - Loads session data  |
                    |  - Shows branding      |
                    |  - Renders intro/result|
                    +-----------+-----------+
                                |
            User clicks "Get Started" / "Verify"
                                |
               POST /:id/init-session  (creates real UseSense session)
                                |
                    +-----------v-----------+
                    | VerificationCapture   |
                    | Engine                |
                    |                       |
                    | Camera -> Baseline -> |
                    | Countdown -> Challenge|
                    | -> Upload -> Complete  |
                    +-----------+-----------+
                                |
                        onComplete / onError
                                |
               POST /:id/complete  (reads real session verdict)
                                |
                    +-----------v-----------+
                    |   Result Screen       |
                    |  Success / Failed /   |
                    |  Pending Review        |
                    +-----------------------+
```

### Key Design Principles

1. **The page wrapper never touches the camera or does any capture logic.** All of that is inside `VerificationCaptureEngine`.
2. **The page wrapper owns the lifecycle:** loading session data from the API, initializing the session, showing the branded introduction screen, and displaying the result.
3. **Branding is dynamic:** org name, logo, primary colour, and redirect URL are loaded from the session data (set by the operator in Settings > Branding).

---

## 3. Backend API Endpoints

All endpoints are unauthenticated (public links sent to end users). They use the Supabase anon key as a Bearer token.

### 3.1 Enrollment Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/remote-enrollment/:id/data` | Load enrollment session metadata + branding |
| `POST` | `/remote-enrollment/:id/opened` | Mark link as opened (audit trail) |
| `POST` | `/remote-enrollment/:id/init-session` | Create a real `usesense_session` and return session credentials |
| `POST` | `/remote-enrollment/:id/complete` | Read real session verdict, create identity if approved |
| `GET` | `/remote-enrollment/:id/status` | Poll status (for operator-side polling) |

### 3.2 Verification Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/remote-session/:id/data` | Load verification session metadata + branding |
| `POST` | `/remote-session/:id/opened` | Mark link as opened |
| `POST` | `/remote-session/:id/init-session` | Create a real `usesense_session` (type=authentication) |
| `POST` | `/remote-session/:id/complete` | Read real session verdict, update remote session status |
| `POST` | `/remote-session/:id/dispute` | Customer disputes the request (freezes session) |
| `GET` | `/remote-session/:id/status` | Poll status (for operator-side polling) |

### 3.3 Session Capture Endpoints (Used by the Engine)

These are the standard UseSense API endpoints called internally by `VerificationCaptureEngine`:

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `POST` | `/v1/sessions/:session_id/signals` | `X-Session-Token` + `X-Nonce` | Upload captured frames + metadata |
| `POST` | `/v1/sessions/:session_id/complete` | `X-Session-Token` + `X-Nonce` | Trigger three-pillar verdict |

---

## 4. Data Types

### 4.1 CaptureSessionData (Input to Engine)

This is what `init-session` returns and what you pass to the engine:

```typescript
interface CaptureSessionData {
  session_id: string;      // e.g. "sess_abc123"
  session_token: string;   // JWT-like token for signal upload auth
  nonce: string;           // One-time nonce for replay protection
  policy: {
    challenge_type: string;  // 'passive' | 'head_turn' | 'follow_dot' | 'speak_phrase'
    policy_source: string;   // 'org_policy' | 'default'
    challenge?: {
      type: string;         // 'head_turn' | 'follow_dot' | 'none'
      seed: string;
      total_duration_ms: number;
      frames_per_step?: number;
      capture_fps_hint?: number;
      // For head_turn:
      sequence?: Array<{
        index: number;
        direction: 'left' | 'right' | 'up' | 'down' | 'center';
        duration_ms: number;
      }>;
      // For follow_dot:
      waypoints?: Array<{
        index: number;
        x: number;  // 0.0 to 1.0 (viewport-relative)
        y: number;
        duration_ms: number;
      }>;
    };
    audio_challenge?: {
      type: 'speak_phrase';
      phrase: string;
      seed: string;
      total_duration_ms: number;
    };
    requires_stepup?: boolean;
  };
  upload: {
    max_frames: number;       // Hard cap (30)
    target_fps: number;       // Computed from policy (2-10)
    capture_duration_ms: number; // Total capture window
  };
}
```

### 4.2 CaptureResult (Output from Engine)

```typescript
interface CaptureResult {
  decision: 'APPROVE' | 'REJECT' | 'MANUAL_REVIEW';
  identity_id?: string;
  channel_trust_score?: number;   // 0-100 (DeepSense)
  liveness_score?: number;        // 0-100 (LiveSense)
  dedupe_risk_score?: number;     // 0-100 (MatchSense risk, lower = better)
  reasons?: string[];
  debug?: any;
}
```

### 4.3 CapturePhase (Lifecycle States)

```typescript
type CapturePhase =
  | 'initializing'     // Engine mounting
  | 'camera-request'   // Calling getUserMedia
  | 'camera-error'     // Camera denied/not found (shows retry UI)
  | 'instructions'     // Pre-challenge instructions (if challenge)
  | 'face-guide'       // Oval overlay, "Position your face"
  | 'baseline'         // 2s neutral capture, "Hold still"
  | 'countdown'        // 3-2-1 before challenge
  | 'challenge'        // Head turn arrows / follow dot / speak phrase
  | 'uploading'        // Multipart POST of frames + metadata
  | 'completing'       // POST /complete for verdict
  | 'done';            // onComplete fired
```

### 4.4 Enrollment Session Data (from GET /remote-enrollment/:id/data)

```typescript
interface EnrollmentData {
  id: string;
  full_name: string;
  external_reference: string;
  environment: 'sandbox' | 'production';
  status: string;  // 'pending' | 'link_opened' | 'capture_in_progress' | 'completed' | 'expired'
  enrollment_url: string;
  expires_at: string;
  created_at: string;
  metadata?: Record<string, any>;
  org_branding?: {
    display_name: string;    // "Providus Bank"
    logo_url?: string;       // "https://..."
    primary_color?: string;  // "#F5A623"
    redirect_url?: string;   // Where to redirect after close
  };
}
```

### 4.5 Verification Session Data (from GET /remote-session/:id/data)

```typescript
interface VerificationSessionData {
  id: string;
  identity_id: string;
  identity_name: string;
  environment: 'sandbox' | 'production';
  purpose: 'authentication' | 'action_authorization';
  status: string;
  verification_url: string;
  expires_at: string;
  created_at: string;
  action_context?: {
    action_type: string;          // e.g. "wire_transfer"
    params: Record<string, any>;  // e.g. { amount: 500000, currency: "NGN" }
    display_text: string;         // "Transfer NGN 500,000 to Acct 0123456789"
    risk_tier: 'critical' | 'high' | 'medium' | 'low';
  };
  org_branding?: {
    display_name: string;
    logo_url?: string;
    primary_color?: string;
    redirect_url?: string;
  };
}
```

---

## 5. VerificationCaptureEngine Props

```typescript
interface VerificationCaptureEngineProps {
  sessionData: CaptureSessionData;            // Required: session credentials from init-session
  environment: 'sandbox' | 'production';       // Required: determines API routing
  primaryColor?: string;                       // Optional: hex colour for buttons/progress (default: '#4f46e5')
  onComplete: (result: CaptureResult) => void; // Required: called when verdict is received
  onError: (error: string) => void;            // Required: called on upload/completion failure
  onPhaseChange?: (phase: CapturePhase, label: string) => void; // Optional: lifecycle tracking
}
```

---

## 6. Full Page Implementation: Hosted Enrollment Page

This is the complete implementation. The page manages 5 steps: `loading` -> `introduction` -> `capture` -> `finalizing` -> `result`.

```tsx
/**
 * Hosted Enrollment Page
 *
 * Route: /enroll/:sessionId
 *
 * Flow:
 *   1. GET  /remote-enrollment/:id/data        -> load enrollment record
 *   2. POST /remote-enrollment/:id/opened       -> mark link opened
 *   3. User reviews introduction screen
 *   4. POST /remote-enrollment/:id/init-session -> create real usesense_session
 *   5. VerificationCaptureEngine runs full pipeline
 *   6. POST /remote-enrollment/:id/complete     -> read verdict, create identity
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router';
import { CheckCircle2, XCircle, Camera, AlertTriangle, Shield } from 'lucide-react';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';
import {
  VerificationCaptureEngine,
  type CaptureSessionData,
  type CaptureResult,
  type CapturePhase,
} from '../components/verification-capture-engine';

// ---- Types ----

interface EnrollmentData {
  id: string;
  full_name: string;
  external_reference: string;
  environment: 'sandbox' | 'production';
  status: string;
  enrollment_url: string;
  expires_at: string;
  created_at: string;
  metadata?: Record<string, any>;
  org_branding?: {
    display_name: string;
    logo_url?: string;
    primary_color?: string;
    redirect_url?: string;
  };
}

type PageStep = 'loading' | 'error' | 'introduction' | 'capture' | 'finalizing' | 'result';
type EnrollmentResult = 'success' | 'failed' | 'review' | null;

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-fc4cf30d`;

const HEADERS = {
  Authorization: `Bearer ${publicAnonKey}`,
  apikey: publicAnonKey,
};

// ---- API Helper ----

async function apiPost(url: string, body?: Record<string, unknown>) {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { ...HEADERS, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json();
    if (!res.ok) console.error(`[HostedEnrollment] POST ${url} failed:`, data);
    return { ok: res.ok, data };
  } catch (err) {
    console.error(`[HostedEnrollment] POST ${url} network error:`, err);
    return { ok: false, data: null };
  }
}

// ---- Component ----

export function HostedEnrollmentPage() {
  const { sessionId } = useParams<{ sessionId: string }>();

  const [step, setStep] = useState<PageStep>('loading');
  const [error, setError] = useState<string | null>(null);
  const [enrollmentData, setEnrollmentData] = useState<EnrollmentData | null>(null);
  const [captureSessionData, setCaptureSessionData] = useState<CaptureSessionData | null>(null);
  const [result, setResult] = useState<EnrollmentResult>(null);
  const [resultMessage, setResultMessage] = useState('');
  const [capturePhaseLabel, setCapturePhaseLabel] = useState('');

  // ---- Step 1: Load enrollment data ----

  const fetchEnrollmentData = useCallback(async () => {
    if (!sessionId) { setError('Invalid enrollment link'); setStep('error'); return; }

    try {
      const res = await fetch(`${API_BASE}/remote-enrollment/${sessionId}/data`, {
        headers: HEADERS,
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed to load enrollment session');
      }
      const d = await res.json();
      setEnrollmentData(d.session);

      // Notify backend: link opened (for audit trail)
      await apiPost(`${API_BASE}/remote-enrollment/${sessionId}/opened`);
      console.log('[HostedEnrollment] Session loaded, link_opened notified');
      setStep('introduction');
    } catch (err: any) {
      console.error('[HostedEnrollment] Fetch error:', err);
      setError(err.message || 'Failed to load enrollment session');
      setStep('error');
    }
  }, [sessionId]);

  useEffect(() => { fetchEnrollmentData(); }, [fetchEnrollmentData]);

  // ---- Step 2: Start capture (init-session -> launch engine) ----

  const handleGetStarted = async () => {
    if (!sessionId) return;

    setStep('loading'); // brief loading while we create session
    try {
      const { ok, data } = await apiPost(
        `${API_BASE}/remote-enrollment/${sessionId}/init-session`
      );
      if (!ok || !data?.session_id) {
        throw new Error(data?.error || 'Failed to initialize session');
      }

      console.log('[HostedEnrollment] Session initialized:', data.session_id);
      console.log('[HostedEnrollment] Policy:', data.policy?.challenge_type,
        '| source:', data.policy?.policy_source);

      // Pass session credentials to the engine
      setCaptureSessionData({
        session_id: data.session_id,
        session_token: data.session_token,
        nonce: data.nonce,
        policy: data.policy,
        upload: data.upload,
      });
      setStep('capture');
    } catch (err: any) {
      console.error('[HostedEnrollment] init-session error:', err);
      setError(err.message);
      setStep('error');
    }
  };

  // ---- Step 3: Engine callbacks ----

  const handleCaptureComplete = async (captureResult: CaptureResult) => {
    setStep('finalizing');
    console.log('[HostedEnrollment] Capture complete, decision:', captureResult.decision);

    try {
      // Call the enrollment complete endpoint to create identity + link records
      const { ok, data } = await apiPost(
        `${API_BASE}/remote-enrollment/${sessionId}/complete`
      );

      if (ok && data?.success) {
        setResult('success');
        setResultMessage('Your identity has been enrolled successfully.');
      } else if (data?.status === 'rejected') {
        setResult('failed');
        setResultMessage('Enrollment did not pass the required checks. Please try again.');
      } else if (data?.needs_review) {
        setResult('review');
        setResultMessage('Your enrollment is pending review. You will be notified once approved.');
      } else {
        // Fallback: use the capture result directly
        if (captureResult.decision === 'APPROVE') {
          setResult('success');
          setResultMessage('Enrollment completed successfully.');
        } else {
          setResult('failed');
          setResultMessage('Verification did not pass. Please try again or contact support.');
        }
      }
    } catch (err: any) {
      console.error('[HostedEnrollment] Complete error:', err);
      // Still show a result screen rather than leaving the user stuck
      if (captureResult.decision === 'APPROVE') {
        setResult('success');
        setResultMessage('Enrollment completed successfully.');
      } else {
        setResult('failed');
        setResultMessage('Something went wrong finalizing your enrollment. Please try again.');
      }
    }
    setStep('result');
  };

  const handleCaptureError = (errMsg: string) => {
    console.error('[HostedEnrollment] Capture error:', errMsg);
    setResult('failed');
    setResultMessage('Something went wrong during the verification process. Please try again.');
    setStep('result');
  };

  const handlePhaseChange = (_phase: CapturePhase, label: string) => {
    setCapturePhaseLabel(label);
  };

  // ---- Branding ----

  const orgName = enrollmentData?.org_branding?.display_name || 'UseSense';
  const primaryColor = enrollmentData?.org_branding?.primary_color || '#4f46e5';
  const redirectUrl = enrollmentData?.org_branding?.redirect_url || null;

  const handleClose = () => {
    if (redirectUrl) {
      window.location.href = redirectUrl;
    } else {
      window.close();
    }
  };

  // ---- Shared UI Fragments ----

  const Header = () => (
    <div className="bg-white border-b border-slate-200 px-6 py-4">
      {enrollmentData?.org_branding?.logo_url ? (
        <img
          src={enrollmentData.org_branding.logo_url}
          alt={orgName}
          className="h-8 mx-auto object-contain"
        />
      ) : (
        <div className="text-center">
          <h1 className="text-xl font-semibold" style={{ color: primaryColor }}>
            {orgName}
          </h1>
        </div>
      )}
    </div>
  );

  const Footer = () => (
    <div className="px-6 py-4 text-center text-xs text-slate-500 border-t border-slate-100">
      <a
        href="https://usesense.ai"
        target="_blank"
        rel="noopener noreferrer"
        className="hover:text-slate-700 transition-colors"
      >
        Powered by UseSense
      </a>
    </div>
  );

  // ============================================================
  // RENDER: Loading
  // ============================================================

  if (step === 'loading') {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-6">
        <div className="text-center">
          <div
            className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"
          />
          <p className="text-slate-600">Loading enrollment session...</p>
        </div>
      </div>
    );
  }

  // ============================================================
  // RENDER: Error
  // ============================================================

  if (step === 'error') {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center">
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 mb-6">
            <XCircle className="h-12 w-12 text-red-600 mx-auto mb-3" />
            <h2 className="text-xl font-semibold text-red-900 mb-2">Session Not Available</h2>
            <p className="text-red-700">
              {error || 'This enrollment link is invalid or has expired.'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================
  // RENDER: Introduction (matches the screenshot from the spec)
  // ============================================================

  if (step === 'introduction') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-lg w-full space-y-6">
            {/* Title & Description */}
            <div className="text-center space-y-4">
              <h2 className="text-2xl font-semibold text-slate-900">
                {orgName} would like to verify your identity.
              </h2>
              <p className="text-slate-600 text-lg leading-relaxed">
                This is a one-time setup to enable secure remote verification for
                your account. You will need to allow camera access and follow
                on-screen instructions.
              </p>
            </div>

            {/* Camera Icon */}
            <div className="flex justify-center py-8">
              <div
                className="inline-flex items-center justify-center w-24 h-24 rounded-full"
                style={{ backgroundColor: `${primaryColor}20` }}
              >
                <Camera className="h-12 w-12" style={{ color: primaryColor }} />
              </div>
            </div>

            {/* What to Expect */}
            <div className="bg-slate-50 rounded-lg p-4 space-y-2">
              <p className="text-sm font-medium text-slate-800">What to expect:</p>
              <ul className="text-sm text-slate-600 space-y-1">
                <li className="flex items-start gap-2">
                  <span className="text-slate-400 mt-0.5">1.</span>
                  You'll be asked to allow camera access
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-slate-400 mt-0.5">2.</span>
                  Follow on-screen instructions (you may be asked to turn your
                  head or follow a dot)
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-slate-400 mt-0.5">3.</span>
                  Your identity will be securely verified and enrolled
                </li>
              </ul>
            </div>

            {/* Security Badge */}
            <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
              <Shield className="w-3.5 h-3.5" />
              <span>End-to-end encrypted &middot; Three-pillar verification</span>
            </div>

            {/* CTA Button */}
            <div className="pt-4">
              <button
                onClick={handleGetStarted}
                className="w-full py-4 rounded-xl font-semibold text-white shadow-md
                           hover:shadow-lg transition-all"
                style={{ backgroundColor: primaryColor }}
              >
                Get Started
              </button>
            </div>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  // ============================================================
  // RENDER: Capture (the Engine takes over the entire viewport)
  // ============================================================

  if (step === 'capture' && captureSessionData) {
    return (
      <div className="min-h-screen bg-black flex flex-col">
        <VerificationCaptureEngine
          sessionData={captureSessionData}
          environment={enrollmentData?.environment || 'sandbox'}
          primaryColor={primaryColor}
          onComplete={handleCaptureComplete}
          onError={handleCaptureError}
          onPhaseChange={handlePhaseChange}
        />
        <div className="px-6 py-3 text-center text-xs text-white/50 bg-black">
          <a
            href="https://usesense.ai"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-white/70 transition-colors"
          >
            Powered by UseSense
          </a>
        </div>
      </div>
    );
  }

  // ============================================================
  // RENDER: Finalizing (spinner while /complete is called)
  // ============================================================

  if (step === 'finalizing') {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-md w-full text-center space-y-6">
            <div
              className="animate-spin rounded-full h-16 w-16 border-4 border-slate-200 mx-auto"
              style={{ borderTopColor: primaryColor }}
            />
            <h2 className="text-xl font-semibold text-slate-900">
              Finalizing Enrollment
            </h2>
            <p className="text-slate-600">
              Please wait while we complete your enrollment...
            </p>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  // ============================================================
  // RENDER: Result (success / failed / review)
  // ============================================================

  if (step === 'result' && result) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-md w-full text-center space-y-6">
            {result === 'success' ? (
              <>
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100">
                  <CheckCircle2 className="h-12 w-12 text-green-600" />
                </div>
                <h2 className="text-2xl font-semibold text-slate-900">
                  Enrollment Successful
                </h2>
                <p className="text-slate-700 text-lg leading-relaxed">
                  Your identity has been registered. Future verifications will be
                  quicker and easier. You may now close this page.
                </p>
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <p className="text-sm text-green-700">{resultMessage}</p>
                </div>
              </>
            ) : result === 'review' ? (
              <>
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-amber-100">
                  <AlertTriangle className="h-12 w-12 text-amber-600" />
                </div>
                <h2 className="text-2xl font-semibold text-slate-900">
                  Pending Review
                </h2>
                <p className="text-slate-700">{resultMessage}</p>
              </>
            ) : (
              <>
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-red-100">
                  <XCircle className="h-12 w-12 text-red-600" />
                </div>
                <h2 className="text-2xl font-semibold text-slate-900">
                  Enrollment Failed
                </h2>
                <p className="text-slate-700">
                  {resultMessage ||
                    `We could not complete your enrollment. Please contact ${orgName} for assistance.`}
                </p>
              </>
            )}

            <button
              onClick={handleClose}
              className="w-full py-3 rounded-xl font-medium bg-slate-100 text-slate-900
                         hover:bg-slate-200 transition-all"
            >
              {redirectUrl ? 'Continue' : 'Close'}
            </button>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return null;
}
```

---

## 7. Full Page Implementation: Hosted Verification Page

The verification page adds two features the enrollment page doesn't have:

1. **Action authorization flow** — if `action_context` is present, shows a review screen with the action details and a "This Is Not My Request" dispute button.
2. **Dispute endpoint** — `POST /:id/dispute` freezes the session.

```tsx
/**
 * Hosted Verification Page
 *
 * Route: /verify/:sessionId
 *
 * Flow:
 *   1. GET  /remote-session/:id/data           -> load session record
 *   2. POST /remote-session/:id/opened          -> mark link opened
 *   3. User reviews action context (if present)
 *   4. POST /remote-session/:id/init-session    -> create real usesense_session
 *   5. VerificationCaptureEngine runs full pipeline
 *   6. POST /remote-session/:id/complete        -> read verdict, update status
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router';
import { CheckCircle2, XCircle, AlertCircle, Shield } from 'lucide-react';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';
import {
  VerificationCaptureEngine,
  type CaptureSessionData,
  type CaptureResult,
  type CapturePhase,
} from '../components/verification-capture-engine';

// ---- Types ----

interface SessionData {
  id: string;
  identity_id: string;
  identity_name: string;
  environment: 'sandbox' | 'production';
  purpose: 'authentication' | 'action_authorization';
  status: string;
  verification_url: string;
  expires_at: string;
  created_at: string;
  action_context?: {
    action_type: string;
    params: Record<string, any>;
    display_text: string;
    risk_tier: 'critical' | 'high' | 'medium' | 'low';
  };
  org_branding?: {
    display_name: string;
    logo_url?: string;
    primary_color?: string;
    redirect_url?: string;
  };
}

type PageStep =
  | 'loading'
  | 'error'
  | 'action-review'   // <-- intro + optional action context
  | 'capture'
  | 'finalizing'
  | 'result';
type VerificationResult = 'success' | 'failed' | 'review' | null;

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-fc4cf30d`;

const HEADERS = {
  Authorization: `Bearer ${publicAnonKey}`,
  apikey: publicAnonKey,
};

async function apiPost(url: string, body?: Record<string, unknown>) {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { ...HEADERS, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json();
    if (!res.ok) console.error(`[HostedVerification] POST ${url} failed:`, data);
    return { ok: res.ok, data };
  } catch (err) {
    console.error(`[HostedVerification] POST ${url} network error:`, err);
    return { ok: false, data: null };
  }
}

export function HostedVerificationPage() {
  const { sessionId } = useParams<{ sessionId: string }>();

  const [step, setStep] = useState<PageStep>('loading');
  const [error, setError] = useState<string | null>(null);
  const [sessionData, setSessionData] = useState<SessionData | null>(null);
  const [captureSessionData, setCaptureSessionData] = useState<CaptureSessionData | null>(null);
  const [result, setResult] = useState<VerificationResult>(null);
  const [resultMessage, setResultMessage] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // ---- Load session data ----

  const fetchSessionData = useCallback(async () => {
    if (!sessionId) { setError('Invalid session link'); setStep('error'); return; }

    try {
      const res = await fetch(`${API_BASE}/remote-session/${sessionId}/data`, {
        headers: HEADERS,
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed to load session');
      }
      const d = await res.json();
      setSessionData(d.session);

      await apiPost(`${API_BASE}/remote-session/${sessionId}/opened`);
      setStep('action-review');
    } catch (err: any) {
      setError(err.message || 'Failed to load verification session');
      setStep('error');
    }
  }, [sessionId]);

  useEffect(() => { fetchSessionData(); }, [fetchSessionData]);

  // ---- Dispute handler (action auth only) ----

  const handleDispute = async () => {
    if (!sessionId || isProcessing) return;
    if (!confirm('Are you sure this is not your request? This will flag the session as disputed.'))
      return;

    setIsProcessing(true);
    try {
      const { ok } = await apiPost(`${API_BASE}/remote-session/${sessionId}/dispute`);
      if (!ok) throw new Error('Failed to submit dispute');
      alert('Your report has been submitted. All pending actions have been frozen.');
      window.close();
    } catch {
      alert('Failed to submit dispute. Please contact support.');
    } finally {
      setIsProcessing(false);
    }
  };

  // ---- Start capture ----

  const handleVerifyAndAuthorize = async () => {
    if (!sessionId || isProcessing) return;

    setIsProcessing(true);
    setStep('loading');

    try {
      const { ok, data } = await apiPost(
        `${API_BASE}/remote-session/${sessionId}/init-session`
      );
      if (!ok || !data?.session_id) {
        throw new Error(data?.error || 'Failed to initialize verification session');
      }

      setCaptureSessionData({
        session_id: data.session_id,
        session_token: data.session_token,
        nonce: data.nonce,
        policy: data.policy,
        upload: data.upload,
      });
      setStep('capture');
    } catch (err: any) {
      setError(err.message);
      setStep('error');
    } finally {
      setIsProcessing(false);
    }
  };

  // ---- Engine callbacks ----

  const handleCaptureComplete = async (captureResult: CaptureResult) => {
    setStep('finalizing');

    try {
      const { ok, data } = await apiPost(
        `${API_BASE}/remote-session/${sessionId}/complete`
      );

      if (ok && data?.success) {
        setResult('success');
        setResultMessage('Your identity has been confirmed.');
      } else if (data?.status === 'rejected') {
        setResult('failed');
        setResultMessage('Verification did not pass the required checks.');
      } else if (data?.status === 'manual_review') {
        setResult('review');
        setResultMessage('Your verification is pending review.');
      } else {
        if (captureResult.decision === 'APPROVE') {
          setResult('success');
          setResultMessage('Identity verified.');
        } else {
          setResult('failed');
          setResultMessage('Verification did not pass. Please try again or contact support.');
        }
      }
    } catch (err: any) {
      console.error('[HostedVerification] Complete error:', err);
      // Still show a result screen rather than leaving the user stuck
      if (captureResult.decision === 'APPROVE') {
        setResult('success');
        setResultMessage('Identity verified.');
      } else {
        setResult('failed');
        setResultMessage('Something went wrong finalizing your verification. Please try again.');
      }
    }
    setStep('result');
  };

  const handleCaptureError = (errMsg: string) => {
    setResult('failed');
    setResultMessage('Something went wrong during the verification process. Please try again.');
    setStep('result');
  };

  // ---- Branding ----

  const orgName = sessionData?.org_branding?.display_name || 'UseSense';
  const primaryColor = sessionData?.org_branding?.primary_color || '#4f46e5';
  const actionText = sessionData?.action_context?.display_text;
  const redirectUrl = sessionData?.org_branding?.redirect_url || null;

  const handleClose = () => {
    if (redirectUrl) window.location.href = redirectUrl;
    else window.close();
  };

  const Header = () => (
    <div className="bg-white border-b border-slate-200 px-6 py-4">
      {sessionData?.org_branding?.logo_url ? (
        <img src={sessionData.org_branding.logo_url} alt={orgName}
             className="h-8 mx-auto object-contain" />
      ) : (
        <div className="text-center">
          <h1 className="text-xl font-semibold" style={{ color: primaryColor }}>
            {orgName}
          </h1>
        </div>
      )}
    </div>
  );

  const Footer = () => (
    <div className="px-6 py-4 text-center text-xs text-slate-500 border-t border-slate-100">
      <a href="https://usesense.ai" target="_blank" rel="noopener noreferrer"
         className="hover:text-slate-700 transition-colors">
        Powered by UseSense
      </a>
    </div>
  );

  // ---- Render: Loading ----
  if (step === 'loading') {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4" />
          <p className="text-slate-600">Loading verification session...</p>
        </div>
      </div>
    );
  }

  // ---- Render: Error ----
  if (step === 'error') {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center">
          <div className="bg-red-50 border border-red-200 rounded-xl p-6">
            <XCircle className="h-12 w-12 text-red-600 mx-auto mb-3" />
            <h2 className="text-xl font-semibold text-red-900 mb-2">Session Not Available</h2>
            <p className="text-red-700">
              {error || 'This verification link is invalid or has expired.'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ---- Render: Action Review ----
  // Two variants: plain authentication vs action authorization

  if (step === 'action-review' && sessionData) {
    const isPlainAuth = sessionData.purpose === 'authentication' || !sessionData.action_context;

    if (isPlainAuth) {
      // --- Plain authentication ---
      return (
        <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex flex-col">
          <Header />
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="max-w-lg w-full space-y-6">
              <div className="text-center space-y-3">
                <h2 className="text-2xl font-semibold text-slate-900">
                  {orgName} has requested you verify your identity.
                </h2>
                <p className="text-slate-600 text-lg">
                  Please complete a quick identity check to confirm you are the
                  account holder.
                </p>
              </div>

              <div className="flex justify-center py-8">
                <div className="inline-flex items-center justify-center w-24 h-24 rounded-full"
                     style={{ backgroundColor: `${primaryColor}20` }}>
                  <CheckCircle2 className="h-12 w-12" style={{ color: primaryColor }} />
                </div>
              </div>

              <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
                <Shield className="w-3.5 h-3.5" />
                <span>End-to-end encrypted &middot; Three-pillar verification</span>
              </div>

              <div className="pt-4">
                <button
                  onClick={handleVerifyAndAuthorize}
                  disabled={isProcessing}
                  className="w-full py-4 rounded-xl font-semibold text-white shadow-md
                             hover:shadow-lg transition-all disabled:opacity-50"
                  style={{ backgroundColor: primaryColor }}
                >
                  {isProcessing ? 'Processing...' : 'Verify My Identity'}
                </button>
              </div>
            </div>
          </div>
          <Footer />
        </div>
      );
    }

    // --- Action authorization ---
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-lg w-full space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-semibold text-slate-900 mb-2">
                {orgName} has requested you verify the following action:
              </h2>
            </div>

            {/* Action context card */}
            <div className="bg-white rounded-2xl border-2 p-6 shadow-sm"
                 style={{ borderColor: primaryColor }}>
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-12 h-12
                                rounded-full mb-4"
                     style={{ backgroundColor: `${primaryColor}20` }}>
                  <AlertCircle className="h-6 w-6" style={{ color: primaryColor }} />
                </div>
                <p className="text-lg font-medium text-slate-900 leading-relaxed">
                  {actionText}
                </p>
              </div>
            </div>

            {/* Risk tier badge */}
            {sessionData.action_context && (
              <div className="flex justify-center">
                <span className={`inline-flex items-center px-3 py-1 rounded-full
                  text-xs font-medium ${
                    sessionData.action_context.risk_tier === 'critical'
                      ? 'bg-red-100 text-red-800'
                      : sessionData.action_context.risk_tier === 'high'
                      ? 'bg-amber-100 text-amber-800'
                      : sessionData.action_context.risk_tier === 'medium'
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-green-100 text-green-800'
                  }`}>
                  {sessionData.action_context.risk_tier.toUpperCase()} RISK
                </span>
              </div>
            )}

            <div className="space-y-3 pt-4">
              <button
                onClick={handleVerifyAndAuthorize}
                disabled={isProcessing}
                className="w-full py-4 rounded-xl font-semibold text-white shadow-md
                           hover:shadow-lg transition-all disabled:opacity-50"
                style={{ backgroundColor: primaryColor }}
              >
                {isProcessing ? 'Processing...' : 'Verify and Authorise'}
              </button>

              <button
                onClick={handleDispute}
                disabled={isProcessing}
                className="w-full py-4 rounded-xl font-medium text-red-700 bg-white
                           border-2 border-red-200 hover:bg-red-50 transition-all
                           disabled:opacity-50"
              >
                This Is Not My Request
              </button>
            </div>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  // ---- Render: Capture ----
  if (step === 'capture' && captureSessionData) {
    return (
      <div className="min-h-screen bg-black flex flex-col">
        <VerificationCaptureEngine
          sessionData={captureSessionData}
          environment={sessionData?.environment || 'sandbox'}
          primaryColor={primaryColor}
          onComplete={handleCaptureComplete}
          onError={handleCaptureError}
        />
        <div className="px-6 py-3 text-center text-xs text-white/50 bg-black">
          <a href="https://usesense.ai" target="_blank" rel="noopener noreferrer"
             className="hover:text-white/70 transition-colors">
            Powered by UseSense
          </a>
        </div>
      </div>
    );
  }

  // ---- Render: Finalizing ----
  if (step === 'finalizing') {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-md w-full text-center space-y-6">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-slate-200 mx-auto"
                 style={{ borderTopColor: primaryColor }} />
            <h2 className="text-xl font-semibold text-slate-900">Processing Verification</h2>
            <p className="text-slate-600">Finalizing your identity check...</p>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  // ---- Render: Result ----
  if (step === 'result' && result && sessionData) {
    const isPlainAuth = sessionData.purpose === 'authentication' || !sessionData.action_context;

    return (
      <div className="min-h-screen bg-white flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-md w-full text-center space-y-6">
            {result === 'success' ? (
              <>
                <div className="inline-flex items-center justify-center w-20 h-20
                                rounded-full bg-green-100">
                  <CheckCircle2 className="h-12 w-12 text-green-600" />
                </div>
                <h2 className="text-2xl font-semibold text-slate-900">
                  {isPlainAuth ? 'Identity Verified' : 'Verification Successful'}
                </h2>
                {isPlainAuth ? (
                  <p className="text-slate-700 text-lg">
                    Your identity has been confirmed. You may now close this page.
                  </p>
                ) : (
                  <>
                    <div className="bg-slate-50 rounded-xl p-6 border border-slate-200">
                      <p className="text-slate-700 mb-2">You have authorised:</p>
                      <p className="text-slate-900 font-medium">{actionText}</p>
                    </div>
                    <p className="text-slate-600">You may now close this page.</p>
                  </>
                )}
              </>
            ) : result === 'review' ? (
              <>
                <div className="inline-flex items-center justify-center w-20 h-20
                                rounded-full bg-amber-100">
                  <AlertCircle className="h-12 w-12 text-amber-600" />
                </div>
                <h2 className="text-2xl font-semibold text-slate-900">Pending Review</h2>
                <p className="text-slate-700">{resultMessage}</p>
              </>
            ) : (
              <>
                <div className="inline-flex items-center justify-center w-20 h-20
                                rounded-full bg-red-100">
                  <XCircle className="h-12 w-12 text-red-600" />
                </div>
                <h2 className="text-2xl font-semibold text-slate-900">Verification Failed</h2>
                <p className="text-slate-700">
                  {resultMessage ||
                    `We could not verify your identity. Please contact ${orgName} for assistance.`}
                </p>
              </>
            )}

            <button
              onClick={handleClose}
              className="w-full py-3 rounded-xl font-medium bg-slate-100 text-slate-900
                         hover:bg-slate-200 transition-all"
            >
              {redirectUrl ? 'Continue' : 'Close'}
            </button>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return null;
}
```

---

## 8. VerificationCaptureEngine: What It Handles (You Don't Have To)

The engine component is a black box from the page wrapper's perspective. Here's what it manages internally:

| Responsibility | Details |
|---|---|
| **Camera access** | `getUserMedia({ video: { facingMode: 'user', 640x480 } })`. Handles `NotAllowedError` and `NotFoundError` with retry UI. |
| **Web integrity signals** | Collects ~40 signals: navigator, screen, WebGL, canvas hash, automation detection, permissions, battery, connection info, timezone, etc. |
| **Environment quality** | Real-time analysis every 500ms: dark/bright detection (luminance), glare detection (overexposed pixels), blur detection (Laplacian variance). Shows inline warnings. |
| **Baseline capture** | 2 seconds of neutral-face frames at policy FPS. |
| **Countdown** | 3-2-1 animated overlay before challenge starts. |
| **Challenge execution** | Supports `head_turn` (directional arrows), `follow_dot` (moving dot), `speak_phrase` (audio prompt). Captures frames per step/waypoint with minimum frame guarantees. |
| **Frame capture** | Canvas-based JPEG capture at 80% quality. Tracks frame count, progress percentage. |
| **Signal upload** | Multipart `POST /v1/sessions/:id/signals` with frames[], metadata.json (timestamps, challenge_response, channel_integrity). |
| **Session completion** | `POST /v1/sessions/:id/complete` to trigger three-pillar verdict (DeepSense + LiveSense + MatchSense). |
| **Auth headers** | Uses `X-Session-Token`, `X-Nonce`, `X-Idempotency-Key` for replay protection. |

### Engine Visual States

| Phase | What the User Sees |
|---|---|
| `camera-request` | Spinner: "Requesting camera access..." |
| `camera-error` | Camera icon + error message + "How to fix" tips + "Try Again" button |
| `instructions` | Challenge type explanation + "Got it - Start" button |
| `face-guide` | Camera feed with blurred oval mask + "Position your face" + "I'm Ready" button |
| `baseline` | Camera feed with oval, "Hold still", progress bar |
| `countdown` | Camera feed with large 3-2-1 number overlay |
| `challenge` | Camera feed with directional arrows / moving dot / phrase prompt |
| `uploading` | Full-screen spinner: "Verifying your presence" |
| `completing` | Full-screen spinner: "Almost done" |

---

## 9. Routing

```typescript
// In your routes configuration:
{ path: '/enroll/:sessionId', Component: HostedEnrollmentPage },
{ path: '/verify/:sessionId', Component: HostedVerificationPage },
```

These are public routes (no auth required) since the session ID in the URL acts as the access token.

---

## 10. Branding Configuration

Operators configure branding in **Settings > Customer-Facing Branding**:

| Setting | Property | Default | Usage |
|---|---|---|---|
| Organisation Display Name | `display_name` | "UseSense" | Page heading: "{orgName} would like to verify your identity." |
| Organisation Logo | `logo_url` | _(none)_ | Replaces text header with logo image (h-8, centered) |
| Primary Brand Colour | `primary_color` | `#4f46e5` | Buttons, progress bars, icon backgrounds, spinner accents |
| Close Redirect URL | `redirect_url` | _(none)_ | "Continue" button destination after result. If empty, shows "Close" (window.close). |

The branding object is embedded in the session data by the backend when the operator creates the remote session. It comes back in the `GET /:id/data` response.

---

## 11. Sequence Diagram: Complete Enrollment Flow

```
Customer Browser                     Backend API
      |                                  |
      |  GET /remote-enrollment/:id/data |
      |--------------------------------->|
      |  { session: EnrollmentData }     |
      |<---------------------------------|
      |                                  |
      |  POST /remote-enrollment/:id/opened
      |--------------------------------->|
      |  200 OK                          |
      |<---------------------------------|
      |                                  |
      |  [User reads intro, clicks       |
      |   "Get Started"]                 |
      |                                  |
      |  POST /remote-enrollment/:id/init-session
      |--------------------------------->|
      |  { session_id, session_token,    |
      |    nonce, policy, upload }        |
      |<---------------------------------|
      |                                  |
      |  [VerificationCaptureEngine      |
      |   takes over]                    |
      |                                  |
      |  getUserMedia (camera)           |
      |  Collect web integrity signals   |
      |  Baseline capture (2s)           |
      |  Countdown 3-2-1 (if challenge)  |
      |  Challenge capture               |
      |                                  |
      |  POST /v1/sessions/:sid/signals  |
      |  (multipart: frames + metadata)  |
      |--------------------------------->|
      |  200 OK                          |
      |<---------------------------------|
      |                                  |
      |  POST /v1/sessions/:sid/complete |
      |--------------------------------->|
      |  { decision, scores, reasons }   |
      |<---------------------------------|
      |                                  |
      |  [Engine calls onComplete]       |
      |                                  |
      |  POST /remote-enrollment/:id/complete
      |--------------------------------->|
      |  { success, identity_id }        |
      |<---------------------------------|
      |                                  |
      |  [Show result screen]            |
```

---

## 12. Important Implementation Notes

### 12.1 API Base URL

```typescript
const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-fc4cf30d`;
```

For the demo Web SDK, replace this with your environment's actual API base URL.

### 12.2 Auth Headers

All hosted page API calls use the Supabase anon key:

```typescript
const HEADERS = {
  Authorization: `Bearer ${publicAnonKey}`,
  apikey: publicAnonKey,
};
```

### 12.3 Engine Sizing

The engine fills its parent container. Wrap it in a `min-h-screen bg-black flex flex-col` div for full-viewport capture. The engine component uses `flex-1 relative` internally.

### 12.4 Error Handling Strategy

- **Network errors during data loading:** Show error screen with message.
- **Session expired/invalid:** Show error screen (backend returns 410/409).
- **Camera denied:** Engine handles this internally with retry UI (never bubbles to page).
- **Upload failure:** Engine calls `onError` -> page shows failed result.
- **Completion failure:** Engine calls `onError` -> page shows failed result.

### 12.5 Idempotency

- `init-session` is idempotent: if called twice, returns the same session credentials (backend checks `usesense_session_id` on the remote record).
- Signal upload uses `X-Idempotency-Key: ${session_id}_${timestamp}`.
- Session completion uses `X-Idempotency-Key: ${session_id}_complete_${timestamp}`.

### 12.6 Session Lifecycle Statuses

```
pending -> link_opened -> capture_in_progress -> approved/rejected/manual_review
                                              -> expired (if past expires_at)
                                              -> disputed (if customer disputes)
```

---

## 13. Testing Checklist

- [ ] Load enrollment page with valid session ID
- [ ] Verify org branding (logo, colour, name) renders correctly
- [ ] Click "Get Started", verify camera prompt appears
- [ ] Complete capture flow through to result screen
- [ ] Test with `head_turn` challenge policy
- [ ] Test with `follow_dot` challenge policy
- [ ] Test with no challenge (passive liveness)
- [ ] Test camera denial -> verify retry UI works
- [ ] Test expired session link -> verify error screen
- [ ] Test already-completed session -> verify 409 error
- [ ] Load verification page with `action_authorization` purpose
- [ ] Verify action context card renders with risk tier badge
- [ ] Test "This Is Not My Request" dispute button
- [ ] Verify redirect URL works on result screen "Continue" button
- [ ] Verify `window.close()` when no redirect URL configured