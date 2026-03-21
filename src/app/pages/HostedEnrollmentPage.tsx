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
import { CircleCheck, CircleX, Camera, TriangleAlert, Shield } from 'lucide-react';
import { API_BASE, GATEWAY_HEADERS } from '../lib/supabase-config';
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

// ---- API Helper ----

async function apiPost(url: string, body?: Record<string, unknown>) {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { ...GATEWAY_HEADERS, 'Content-Type': 'application/json' },
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
        headers: GATEWAY_HEADERS,
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed to load enrollment session');
      }
      const d = await res.json();
      setEnrollmentData(d.session);

      // Notify backend: link opened (audit trail)
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

    setStep('loading');
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
          <h1 className="text-xl" style={{ color: primaryColor, fontWeight: 600 }}>
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
            <CircleX className="h-12 w-12 text-red-600 mx-auto mb-3" />
            <h2 className="text-xl text-red-900 mb-2" style={{ fontWeight: 600 }}>Session Not Available</h2>
            <p className="text-red-700">
              {error || 'This enrollment link is invalid or has expired.'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================
  // RENDER: Introduction
  // ============================================================

  if (step === 'introduction') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-lg w-full space-y-6">
            {/* Title & Description */}
            <div className="text-center space-y-4">
              <h2 className="text-2xl text-slate-900" style={{ fontWeight: 600 }}>
                {orgName} would like to verify your identity.
              </h2>
              <p className="text-slate-600 text-lg" style={{ lineHeight: '1.625' }}>
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
              <p className="text-sm text-slate-800" style={{ fontWeight: 500 }}>What to expect:</p>
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
                className="w-full py-4 rounded-xl text-white shadow-md
                           hover:shadow-lg transition-all"
                style={{ backgroundColor: primaryColor, fontWeight: 600 }}
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
            <h2 className="text-xl text-slate-900" style={{ fontWeight: 600 }}>
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
                  <CircleCheck className="h-12 w-12 text-green-600" />
                </div>
                <h2 className="text-2xl text-slate-900" style={{ fontWeight: 600 }}>
                  Enrollment Successful
                </h2>
                <p className="text-slate-700 text-lg" style={{ lineHeight: '1.625' }}>
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
              className="w-full py-3 rounded-xl bg-slate-100 text-slate-900
                         hover:bg-slate-200 transition-all"
              style={{ fontWeight: 500 }}
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