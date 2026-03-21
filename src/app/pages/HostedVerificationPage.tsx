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
import { CircleCheck, CircleX, CircleAlert, Shield } from 'lucide-react';
import { API_BASE, GATEWAY_HEADERS } from '../lib/supabase-config';
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
  | 'action-review'
  | 'capture'
  | 'finalizing'
  | 'result';
type VerificationResult = 'success' | 'failed' | 'review' | null;

// ---- API Helper ----

async function apiPost(url: string, body?: Record<string, unknown>) {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { ...GATEWAY_HEADERS, 'Content-Type': 'application/json' },
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

// ---- Component ----

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
        headers: GATEWAY_HEADERS,
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
          <h1 className="text-xl" style={{ color: primaryColor, fontWeight: 600 }}>
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
            <CircleX className="h-12 w-12 text-red-600 mx-auto mb-3" />
            <h2 className="text-xl text-red-900 mb-2" style={{ fontWeight: 600 }}>Session Not Available</h2>
            <p className="text-red-700">
              {error || 'This verification link is invalid or has expired.'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ---- Render: Action Review ----
  if (step === 'action-review' && sessionData) {
    const isPlainAuth = sessionData.purpose === 'authentication' || !sessionData.action_context;

    if (isPlainAuth) {
      return (
        <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex flex-col">
          <Header />
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="max-w-lg w-full space-y-6">
              <div className="text-center space-y-3">
                <h2 className="text-2xl text-slate-900" style={{ fontWeight: 600 }}>
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
                  <CircleCheck className="h-12 w-12" style={{ color: primaryColor }} />
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
                  className="w-full py-4 rounded-xl text-white shadow-md
                             hover:shadow-lg transition-all disabled:opacity-50"
                  style={{ backgroundColor: primaryColor, fontWeight: 600 }}
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
              <h2 className="text-2xl text-slate-900 mb-2" style={{ fontWeight: 600 }}>
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
                  <CircleAlert className="h-6 w-6" style={{ color: primaryColor }} />
                </div>
                <p className="text-lg text-slate-900" style={{ fontWeight: 500, lineHeight: '1.625' }}>
                  {actionText}
                </p>
              </div>
            </div>

            {/* Risk tier badge */}
            {sessionData.action_context && (
              <div className="flex justify-center">
                <span className={`inline-flex items-center px-3 py-1 rounded-full
                  text-xs ${
                    sessionData.action_context.risk_tier === 'critical'
                      ? 'bg-red-100 text-red-800'
                      : sessionData.action_context.risk_tier === 'high'
                      ? 'bg-amber-100 text-amber-800'
                      : sessionData.action_context.risk_tier === 'medium'
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-green-100 text-green-800'
                  }`} style={{ fontWeight: 500 }}>
                  {sessionData.action_context.risk_tier.toUpperCase()} RISK
                </span>
              </div>
            )}

            <div className="space-y-3 pt-4">
              <button
                onClick={handleVerifyAndAuthorize}
                disabled={isProcessing}
                className="w-full py-4 rounded-xl text-white shadow-md
                           hover:shadow-lg transition-all disabled:opacity-50"
                style={{ backgroundColor: primaryColor, fontWeight: 600 }}
              >
                {isProcessing ? 'Processing...' : 'Verify and Authorise'}
              </button>

              <button
                onClick={handleDispute}
                disabled={isProcessing}
                className="w-full py-4 rounded-xl text-red-700 bg-white
                           border-2 border-red-200 hover:bg-red-50 transition-all
                           disabled:opacity-50"
                style={{ fontWeight: 500 }}
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
            <h2 className="text-xl text-slate-900" style={{ fontWeight: 600 }}>Processing Verification</h2>
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
                  <CircleCheck className="h-12 w-12 text-green-600" />
                </div>
                <h2 className="text-2xl text-slate-900" style={{ fontWeight: 600 }}>
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
                      <p className="text-slate-900" style={{ fontWeight: 500 }}>{actionText}</p>
                    </div>
                    <p className="text-slate-600">You may now close this page.</p>
                  </>
                )}
              </>
            ) : result === 'review' ? (
              <>
                <div className="inline-flex items-center justify-center w-20 h-20
                                rounded-full bg-amber-100">
                  <CircleAlert className="h-12 w-12 text-amber-600" />
                </div>
                <h2 className="text-2xl text-slate-900" style={{ fontWeight: 600 }}>Pending Review</h2>
                <p className="text-slate-700">{resultMessage}</p>
              </>
            ) : (
              <>
                <div className="inline-flex items-center justify-center w-20 h-20
                                rounded-full bg-red-100">
                  <CircleX className="h-12 w-12 text-red-600" />
                </div>
                <h2 className="text-2xl text-slate-900" style={{ fontWeight: 600 }}>Verification Failed</h2>
                <p className="text-slate-700">
                  {resultMessage ||
                    `We could not verify your identity. Please contact ${orgName} for assistance.`}
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