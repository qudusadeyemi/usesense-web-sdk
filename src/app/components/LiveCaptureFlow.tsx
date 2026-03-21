/**
 * LiveCaptureFlow — In-app hosted-page-style flow for live mode
 *
 * Wraps the VerificationCaptureEngine with:
 *   Introduction screen → Session creation → Capture engine → Result screen
 *
 * Used by DemoPage when the user clicks Start Enrollment / Start Authentication
 * in live mode.
 */

import React, { useState, useCallback, useRef } from 'react';
import {
  CircleCheck, CircleX, TriangleAlert, Camera, Fingerprint,
  Shield, ArrowLeft, Loader2,
} from 'lucide-react';
import {
  VerificationCaptureEngine,
  type CaptureSessionData,
  type CaptureResult,
  type CapturePhase,
} from './verification-capture-engine';
import type { UseSenseClient, CreateSessionResponse, RedactedDecisionObject } from '../lib/usesense-sdk';

// ─── Types ────────────────────────────────────────────────────────────────────

interface LiveCaptureFlowProps {
  client: UseSenseClient;
  sessionType: 'enrollment' | 'authentication';
  externalUserId?: string;
  identityId?: string;
  metadata?: Record<string, any>;
  environment: 'sandbox' | 'production';
  primaryColor?: string;
  onComplete: (decision: RedactedDecisionObject) => void;
  onError: (error: { code: string; message: string; details?: any }) => void;
  onCancel: () => void;
}

type FlowStep = 'intro' | 'creating' | 'capture' | 'finalizing' | 'result';
type FlowResult = 'success' | 'failed' | 'review' | null;

// ─── Component ────────────────────────────────────────────────────────────────

export function LiveCaptureFlow({
  client,
  sessionType,
  externalUserId,
  identityId,
  metadata,
  environment,
  primaryColor = '#4F63F5',
  onComplete,
  onError,
  onCancel,
}: LiveCaptureFlowProps) {
  const [step, setStep] = useState<FlowStep>('intro');
  const [captureSession, setCaptureSession] = useState<CaptureSessionData | null>(null);
  const [sessionResponse, setSessionResponse] = useState<CreateSessionResponse | null>(null);
  const [result, setResult] = useState<FlowResult>(null);
  const [resultMessage, setResultMessage] = useState('');
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [phaseLabel, setPhaseLabel] = useState('');

  // Pending result to deliver to parent when user dismisses the result screen.
  // We defer onComplete/onError so the parent doesn't unmount us before
  // the result screen is visible.
  const pendingResultRef = useRef<{
    type: 'complete';
    data: RedactedDecisionObject;
  } | {
    type: 'error';
    data: { code: string; message: string; details?: any };
  } | null>(null);

  // ─── Result screen dismiss handler ──────────────────────────────────────
  // Deliver pending onComplete/onError to parent, then close the flow.
  const handleDismissResult = useCallback(() => {
    const pending = pendingResultRef.current;
    if (pending) {
      if (pending.type === 'complete') {
        onComplete(pending.data);
      } else {
        onError(pending.data);
      }
      pendingResultRef.current = null;
    }
    onCancel();
  }, [onComplete, onError, onCancel]);

  // ─── Create session & start capture ─────────────────────────────────────

  const handleGetStarted = useCallback(async () => {
    setStep('creating');
    setErrorDetail(null);

    try {
      let response: CreateSessionResponse;

      if (sessionType === 'enrollment') {
        response = await client.startEnrollment({
          externalUserId: externalUserId || `user-${Date.now()}`,
          metadata: metadata || { source: 'live_demo' },
        });
      } else {
        if (!identityId) throw new Error('Identity ID is required for authentication');
        response = await client.startAuthentication({
          identityId,
          metadata: metadata || { source: 'live_demo' },
        });
      }

      console.log('[LiveCaptureFlow] Session created:', response.session_id);
      setSessionResponse(response);
      setCaptureSession({
        session_id: response.session_id,
        session_token: response.session_token,
        nonce: response.nonce,
        policy: response.policy,
        upload: response.upload,
      });
      setStep('capture');
    } catch (err: any) {
      console.error('[LiveCaptureFlow] Session creation failed:', err);
      setErrorDetail(err.message || 'Failed to create session');
      setStep('result');
      setResult('failed');
      setResultMessage(err.message || 'Failed to create verification session.');
    }
  }, [client, sessionType, externalUserId, identityId, metadata]);

  // ─── Engine callbacks ──────────────────────────────────────────────────

  const handleCaptureComplete = useCallback(async (captureResult: CaptureResult) => {
    setStep('finalizing');
    console.log('[LiveCaptureFlow] Capture complete, decision:', captureResult.decision);

    // Redact the decision for the client
    const redacted: RedactedDecisionObject = {
      session_id: captureResult.session_id || sessionResponse?.session_id || '',
      session_type: sessionType,
      identity_id: captureResult.identity_id,
      decision: captureResult.decision as any,
      timestamp: captureResult.timestamp || new Date().toISOString(),
    };

    if (captureResult.decision === 'APPROVE') {
      setResult('success');
      setResultMessage(
        sessionType === 'enrollment'
          ? 'Your identity has been enrolled successfully.'
          : 'Your identity has been verified.'
      );
    } else if (captureResult.decision === 'MANUAL_REVIEW') {
      setResult('review');
      setResultMessage('Your verification is pending manual review.');
    } else {
      setResult('failed');
      setResultMessage('Verification did not pass. Please try again.');
    }

    setStep('result');
    pendingResultRef.current = { type: 'complete', data: redacted };
  }, [sessionResponse, sessionType, onComplete]);

  const handleCaptureError = useCallback((errMsg: string) => {
    console.error('[LiveCaptureFlow] Capture error:', errMsg);
    setResult('failed');
    setResultMessage(errMsg || 'Something went wrong during verification.');
    setStep('result');
    pendingResultRef.current = { type: 'error', data: { code: 'CAPTURE_ERROR', message: errMsg } };
  }, [onError]);

  const handlePhaseChange = useCallback((_phase: CapturePhase, label: string) => {
    setPhaseLabel(label);
  }, []);

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  // ─── Introduction screen ────────────────────────────────────────────────

  if (step === 'intro') {
    const isEnrollment = sessionType === 'enrollment';
    return (
      <div className="fixed inset-0 z-50 bg-gradient-to-b from-slate-50 to-white flex flex-col">
        {/* Top bar */}
        <div className="flex items-center justify-between px-5 py-4 bg-white border-b border-slate-200">
          <button
            onClick={onCancel}
            className="flex items-center gap-1.5 text-slate-600 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm" style={{ fontWeight: 500 }}>Back</span>
          </button>
          <span className="text-xs px-2.5 py-1 rounded-full bg-green-100 text-green-700" style={{ fontWeight: 500 }}>
            Live Mode
          </span>
        </div>

        <div className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-lg w-full space-y-6">
            {/* Title */}
            <div className="text-center space-y-3">
              <h2 className="text-2xl text-slate-900" style={{ fontWeight: 600 }}>
                {isEnrollment ? 'Identity Enrollment' : 'Identity Verification'}
              </h2>
              <p className="text-slate-600 text-lg" style={{ lineHeight: '1.625' }}>
                {isEnrollment
                  ? 'Complete a quick biometric check to enroll your identity. You will need to allow camera access and follow the on-screen prompts.'
                  : 'Verify your identity using a quick biometric check. Allow camera access and follow the instructions.'}
              </p>
            </div>

            {/* Icon */}
            <div className="flex justify-center py-6">
              <div
                className="inline-flex items-center justify-center w-24 h-24 rounded-full"
                style={{ backgroundColor: `${primaryColor}20` }}
              >
                {isEnrollment ? (
                  <Camera className="h-12 w-12" style={{ color: primaryColor }} />
                ) : (
                  <Fingerprint className="h-12 w-12" style={{ color: primaryColor }} />
                )}
              </div>
            </div>

            {/* What to expect */}
            <div className="bg-slate-50 rounded-xl p-5 space-y-2.5 border border-slate-200">
              <p className="text-sm text-slate-800" style={{ fontWeight: 500 }}>What to expect:</p>
              <ul className="text-sm text-slate-600 space-y-1.5">
                <li className="flex items-start gap-2">
                  <span className="text-slate-400 mt-0.5">1.</span>
                  Camera access will be requested
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-slate-400 mt-0.5">2.</span>
                  Position your face in the guide oval
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-slate-400 mt-0.5">3.</span>
                  {isEnrollment
                    ? 'Follow prompts — you may be asked to turn your head or follow a dot'
                    : 'Hold still while your identity is verified against your enrolled template'}
                </li>
              </ul>
            </div>

            {/* Security badge */}
            <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
              <Shield className="w-3.5 h-3.5" />
              <span>
                End-to-end encrypted &middot; Three-pillar verification &middot;{' '}
                {environment === 'production' ? 'Production' : 'Sandbox'}
              </span>
            </div>

            {/* CTA */}
            <button
              onClick={handleGetStarted}
              className="w-full py-4 rounded-xl text-white shadow-md hover:shadow-lg transition-all text-base"
              style={{ backgroundColor: primaryColor, fontWeight: 600 }}
            >
              {isEnrollment ? 'Start Enrollment' : 'Start Verification'}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 text-center text-xs text-slate-400 border-t border-slate-100">
          Powered by UseSense &middot; SDK v1.17.7
        </div>
      </div>
    );
  }

  // ─── Creating session spinner ───────────────────────────────────────────

  if (step === 'creating') {
    return (
      <div className="fixed inset-0 z-50 bg-white flex items-center justify-center p-6">
        <div className="text-center space-y-4">
          <Loader2
            className="h-12 w-12 mx-auto animate-spin"
            style={{ color: primaryColor }}
          />
          <h2 className="text-lg text-slate-900" style={{ fontWeight: 600 }}>Creating Session</h2>
          <p className="text-slate-500 text-sm">
            Connecting to {environment} environment...
          </p>
        </div>
      </div>
    );
  }

  // ─── Capture engine (full-screen) ───────────────────────────────────────

  if (step === 'capture' && captureSession) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex flex-col">
        <VerificationCaptureEngine
          sessionData={captureSession}
          environment={environment}
          primaryColor={primaryColor}
          onComplete={handleCaptureComplete}
          onError={handleCaptureError}
          onPhaseChange={handlePhaseChange}
        />
        {/* Cancel button */}
        <button
          onClick={onCancel}
          className="absolute top-4 left-4 z-[60] px-3 py-1.5 bg-black/50 hover:bg-black/70 text-white text-sm rounded-lg backdrop-blur-sm transition-colors"
        >
          Cancel
        </button>
        {/* Footer */}
        <div className="px-6 py-2 text-center text-[11px] text-white/40 bg-black">
          Powered by UseSense
        </div>
      </div>
    );
  }

  // ─── Finalizing spinner ─────────────────────────────────────────────────

  if (step === 'finalizing') {
    return (
      <div className="fixed inset-0 z-50 bg-white flex items-center justify-center p-6">
        <div className="text-center space-y-5">
          <div
            className="animate-spin rounded-full h-16 w-16 border-4 border-slate-200 mx-auto"
            style={{ borderTopColor: primaryColor }}
          />
          <h2 className="text-xl text-slate-900" style={{ fontWeight: 600 }}>
            Processing Verification
          </h2>
          <p className="text-slate-500">
            Running three-pillar analysis...
          </p>
        </div>
      </div>
    );
  }

  // ─── Result screen ──────────────────────────────────────────────────────

  if (step === 'result') {
    return (
      <div className="fixed inset-0 z-50 bg-white flex flex-col">
        <div className="flex items-center px-5 py-4 bg-white border-b border-slate-200">
          <span className="text-sm text-slate-500" style={{ fontWeight: 500 }}>
            {sessionType === 'enrollment' ? 'Enrollment' : 'Verification'} Result
          </span>
        </div>

        <div className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-md w-full text-center space-y-6">
            {result === 'success' ? (
              <>
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100">
                  <CircleCheck className="h-12 w-12 text-green-600" />
                </div>
                <h2 className="text-2xl text-slate-900" style={{ fontWeight: 600 }}>
                  {sessionType === 'enrollment' ? 'Enrollment Successful' : 'Identity Verified'}
                </h2>
                <p className="text-slate-700 text-lg">{resultMessage}</p>
              </>
            ) : result === 'review' ? (
              <>
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-amber-100">
                  <TriangleAlert className="h-12 w-12 text-amber-600" />
                </div>
                <h2 className="text-2xl text-slate-900" style={{ fontWeight: 600 }}>
                  Pending Review
                </h2>
                <p className="text-slate-700">{resultMessage}</p>
              </>
            ) : (
              <>
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-red-100">
                  <CircleX className="h-12 w-12 text-red-600" />
                </div>
                <h2 className="text-2xl text-slate-900" style={{ fontWeight: 600 }}>
                  {sessionType === 'enrollment' ? 'Enrollment Failed' : 'Verification Failed'}
                </h2>
                <p className="text-slate-700">{resultMessage}</p>
              </>
            )}

            <button
              onClick={handleDismissResult}
              className="w-full py-3.5 rounded-xl text-white shadow-md hover:shadow-lg transition-all"
              style={{ backgroundColor: primaryColor, fontWeight: 600 }}
            >
              Back to Dashboard
            </button>
          </div>
        </div>

        <div className="px-6 py-3 text-center text-xs text-slate-400 border-t border-slate-100">
          Powered by UseSense &middot; SDK v1.17.7
        </div>
      </div>
    );
  }

  return null;
}