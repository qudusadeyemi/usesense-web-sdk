'use client';

import { useState, useMemo } from 'react';
import {
  Shield, Focus, Sun, Eye, Zap, Globe, Key, Check, Settings,
  Camera, ArrowRight, Fingerprint, CircleCheck, CircleX, Clock,
  Copy, ChevronUp, ChevronDown, TriangleAlert,
} from 'lucide-react';
import {
  createUseSenseClient,
  UseSenseVerification,
} from '@usesense/web-sdk';
import type {
  RedactedDecisionObject,
  UseSenseEvent,
  UseSenseError,
} from '@usesense/web-sdk';

const DEFAULT_API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  'https://api.usesense.ai/functions/v1/watchtower-api/api/v1';

type DemoMode = 'mock' | 'live';
type MockScenario =
  | 'success'
  | 'failure'
  | 'manual_review'
  | 'step-up-head-turn'
  | 'step-up-follow-dot'
  | 'step-up-speak-phrase'
  | 'challenge';

export default function DemoPage() {
  const [mode, setMode] = useState<DemoMode>('mock');
  const [apiKey, setApiKey] = useState('');
  const [externalUserId, setExternalUserId] = useState('demo-user-' + Date.now());
  const [identityId, setIdentityId] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#4F63F5');
  const [logoUrl, setLogoUrl] = useState('');
  const [audioMode, setAudioMode] = useState<'never' | 'risk_based' | 'always'>('risk_based');
  const [enableWebAuthn, setEnableWebAuthn] = useState(false);
  const [activeFlow, setActiveFlow] = useState<'enrollment' | 'authentication' | null>(null);
  const [activeTab, setActiveTab] = useState<'enrollment' | 'authentication'>('enrollment');
  const [sessionResult, setSessionResult] = useState<RedactedDecisionObject | null>(null);
  const [sessionError, setSessionError] = useState<UseSenseError | null>(null);
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const [mockScenario, setMockScenario] = useState<MockScenario>('success');
  const [webIntegritySignals, setWebIntegritySignals] = useState<any>(null);
  const [showFullJson, setShowFullJson] = useState(false);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  const [identityCopied, setIdentityCopied] = useState(false);
  const [sessionCopied, setSessionCopied] = useState(false);

  const environment = useMemo(() => {
    if (mode === 'mock') return 'sandbox';
    if (!apiKey) return 'sandbox';
    if (apiKey.startsWith('pk_')) return 'production';
    return 'sandbox';
  }, [mode, apiKey]);

  const isLiveModeReady = mode === 'live' && apiKey.length > 0;

  const client = useMemo(() => {
    const opts = {
      branding: {
        primaryColor,
        logoUrl: logoUrl || undefined,
        buttonRadius: 12,
      },
      options: {
        audioEnabled: audioMode,
        stepUpPolicy: 'risk_based' as const,
        captureDurationMs: 2500,
        targetFps: 15,
        maxFrames: 40,
        webAuthnEnabled: enableWebAuthn,
      },
    };
    if (mode === 'mock') {
      return createUseSenseClient({
        apiBaseUrl: DEFAULT_API_BASE_URL,
        apiKey: 'sk_demo_mock_key',
        ...opts,
      });
    }
    return createUseSenseClient({
      apiBaseUrl: DEFAULT_API_BASE_URL,
      apiKey: apiKey || 'sk_demo_temp_key',
      gatewayKey: process.env.NEXT_PUBLIC_GATEWAY_KEY,
      ...opts,
    });
  }, [mode, apiKey, primaryColor, logoUrl, audioMode, enableWebAuthn]);

  if (mode === 'mock') {
    client.setMockScenario(mockScenario);
  }

  const addDebugLog = (message: string) =>
    setDebugLogs(prev => [...prev, `[${new Date().toISOString().substr(11, 8)}] ${message}`]);

  const handleEvent = (event: UseSenseEvent) => {
    addDebugLog(`Event: ${event.type}`);
    if (event.type === 'web_integrity_collected' && event.data) {
      setWebIntegritySignals(event.data);
      addDebugLog('Web integrity signals collected');
    }
  };

  const handleComplete = (decision: RedactedDecisionObject) => {
    setSessionResult(decision);
    if (decision.identity_id) setIdentityId(decision.identity_id);
    addDebugLog(`Decision: ${decision.decision}`);
    setActiveFlow(null);
  };

  const handleError = (error: UseSenseError) => {
    setSessionError(error);
    addDebugLog(`Error: ${error.code} - ${error.message}`);
    setActiveFlow(null);
  };

  const startEnrollment = () => {
    setActiveFlow('enrollment');
    setSessionResult(null);
    setSessionError(null);
    setWebIntegritySignals(null);
    setDebugLogs([]);
    addDebugLog(`Mode: ${mode} | Env: ${environment}`);
    addDebugLog('Starting enrollment session...');
  };

  const startAuthentication = () => {
    if (!identityId) {
      alert('Please enter an Identity ID from a previous enrollment');
      return;
    }
    setActiveFlow('authentication');
    setSessionResult(null);
    setSessionError(null);
    setWebIntegritySignals(null);
    setDebugLogs([]);
    addDebugLog(`Mode: ${mode} | Env: ${environment}`);
    addDebugLog('Starting authentication session...');
  };

  const copyToClipboard = (text: string, type: 'identity' | 'session') => {
    navigator.clipboard.writeText(text);
    if (type === 'identity') {
      setIdentityCopied(true);
      setTimeout(() => setIdentityCopied(false), 2000);
    } else {
      setSessionCopied(true);
      setTimeout(() => setSessionCopied(false), 2000);
    }
  };

  const handleModeSwitch = (newMode: DemoMode) => {
    setMode(newMode);
    setSessionResult(null);
    setSessionError(null);
    setWebIntegritySignals(null);
    setDebugLogs([]);
  };

  if (activeFlow) {
    return (
      <div className="fixed inset-0 z-50">
        <UseSenseVerification
          client={client}
          sessionType={activeFlow}
          externalUserId={activeFlow === 'enrollment' ? externalUserId : undefined}
          identityId={activeFlow === 'authentication' ? identityId : undefined}
          metadata={{ demo: true, mode, timestamp: Date.now() }}
          onEvent={handleEvent}
          onComplete={handleComplete}
          onError={handleError}
        />
        <button
          onClick={() => setActiveFlow(null)}
          className="absolute top-4 right-4 z-[51] px-4 py-2 bg-black/50 text-white border-none rounded-lg cursor-pointer text-sm"
        >
          Cancel
        </button>
      </div>
    );
  }

  const decisionBorderClass =
    sessionResult?.decision === 'APPROVE' ? 'border-green-200' :
    sessionResult?.decision === 'REJECT' ? 'border-red-200' :
    'border-yellow-200';

  const decisionBadgeClass =
    sessionResult?.decision === 'APPROVE' ? 'bg-green-600' :
    sessionResult?.decision === 'REJECT' ? 'bg-red-600' :
    'bg-yellow-600';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-50">
      <div className="container mx-auto px-4 py-8 max-w-4xl">

        {/* Hero Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-xl"
              style={{ background: `linear-gradient(135deg, ${primaryColor} 0%, ${primaryColor}dd 100%)` }}
            >
              <Shield className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-4xl font-bold text-slate-900">UseSense Web SDK</h1>
          </div>
          <p className="text-lg text-slate-600 mb-3">
            Production-ready biometric verification &bull; Server v1.17.4 &bull; Two-Phase Capture
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2 mb-5">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-cyan-50 border border-cyan-200 text-cyan-800 text-xs font-semibold">
              <Focus className="w-3.5 h-3.5" /> Blur Detection
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold">
              <Sun className="w-3.5 h-3.5" /> Lighting Analysis
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-violet-50 border border-violet-200 text-violet-800 text-xs font-semibold">
              <Eye className="w-3.5 h-3.5" /> Real-time Guidance
            </span>
          </div>

          {/* Mode Toggle */}
          <div className="inline-flex items-center gap-2 p-1 bg-white rounded-xl shadow-lg border-2 border-slate-200 mb-4">
            <button
              onClick={() => handleModeSwitch('mock')}
              className={`flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition-all duration-200 ${
                mode === 'mock' ? 'bg-slate-800 text-white shadow-lg scale-105' : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Zap className="w-5 h-5" /> Mock Mode
            </button>
            <button
              onClick={() => handleModeSwitch('live')}
              className={`flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition-all duration-200 ${
                mode === 'live' ? 'bg-green-600 text-white shadow-lg scale-105' : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Globe className="w-5 h-5" /> Live Mode
            </button>
          </div>

          {/* Mode Banner */}
          <div className="max-w-2xl mx-auto">
            {mode === 'mock' ? (
              <div className="flex items-start gap-2 px-4 py-3 rounded-lg bg-purple-50 border border-purple-200 text-left">
                <Zap className="w-4 h-4 text-purple-600 mt-0.5 shrink-0" />
                <p className="text-sm font-medium text-purple-900">
                  <strong>Mock Mode:</strong> Instant testing without backend APIs. Perfect for UI exploration and integration testing.
                </p>
              </div>
            ) : (
              <div className="flex items-start gap-2 px-4 py-3 rounded-lg bg-green-50 border border-green-200 text-left">
                <Globe className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
                <p className="text-sm font-medium text-green-900">
                  <strong>Live Mode:</strong> Connect to real UseSense backend with 3-pillar verdict matrix (DeepSense, LiveSense, Dedupe).
                </p>
              </div>
            )}
          </div>
        </div>

        {/* API Key Configuration (Live Mode only) */}
        {mode === 'live' && (
          <div className="mb-6 rounded-xl border-2 border-blue-200 bg-white shadow-lg overflow-hidden">
            <div className="px-6 py-4 flex items-center justify-between border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                  <Key className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">API Key Configuration</h2>
                  <p className="text-sm text-slate-600">Enter your UseSense API key to connect</p>
                </div>
              </div>
              {isLiveModeReady && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-green-600 text-white text-xs font-semibold">
                  <Check className="w-3 h-3" /> Connected
                </span>
              )}
            </div>
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">API Key</label>
                <input
                  type="text"
                  value={apiKey}
                  onChange={(e) => {
                    const v = e.target.value.trim().replace(/^#.*\n?/gm, '').replace(/^```.*\n?/gm, '').trim();
                    setApiKey(v);
                  }}
                  placeholder="sk_... or pk_... or dk_..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm outline-none"
                />
                {apiKey && !apiKey.startsWith('sk_') && !apiKey.startsWith('pk_') && !apiKey.startsWith('dk_') && (
                  <p className="mt-1 text-sm text-red-600">
                    API key should start with <code>pk_</code> (production), <code>sk_</code> (sandbox), or <code>dk_</code> (development)
                  </p>
                )}
                <p className="mt-1 text-xs text-gray-500">
                  Enter your UseSense API key from the dashboard. Auth: <code>X-API-Key</code> header + Supabase gateway
                </p>
              </div>

              {apiKey && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="text-xs font-semibold text-slate-500 uppercase mb-1">Key Prefix</div>
                    <div className="font-mono font-bold text-slate-900">
                      {apiKey.substring(0, Math.min(apiKey.indexOf('_', 3) + 1, 10)) || apiKey.substring(0, 6)}...
                    </div>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="text-xs font-semibold text-slate-500 uppercase mb-1">Environment</div>
                    <span className={`inline-block px-2 py-1 rounded text-white text-xs font-semibold ${environment === 'production' ? 'bg-green-600' : 'bg-blue-600'}`}>
                      {environment === 'production' ? 'Production (pk_)' : 'Sandbox (sk_/dk_)'}
                    </span>
                  </div>
                </div>
              )}

              {!apiKey && (
                <div className="px-4 py-3 rounded-lg bg-blue-50 border border-blue-200">
                  <p className="text-sm text-blue-900">
                    <strong>Need an API key?</strong> Generate one in your UseSense dashboard under Settings. Use{' '}
                    <code className="bg-blue-100 px-1.5 py-0.5 rounded font-mono text-xs">sk_</code> for sandbox,{' '}
                    <code className="bg-blue-100 px-1.5 py-0.5 rounded font-mono text-xs">pk_</code> for production, or{' '}
                    <code className="bg-blue-100 px-1.5 py-0.5 rounded font-mono text-xs">dk_</code> for development.
                  </p>
                </div>
              )}

              {environment === 'production' && (
                <div className="flex items-start gap-2 px-4 py-3 rounded-lg bg-yellow-50 border border-yellow-300">
                  <TriangleAlert className="w-4 h-4 text-yellow-600 mt-0.5 shrink-0" />
                  <p className="text-sm text-yellow-900 font-medium">
                    <strong>Production Mode:</strong> Sessions will be processed in your live environment and may incur charges.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Mock Scenario Selector */}
        {mode === 'mock' && (
          <div className="mb-6 rounded-xl border-2 border-purple-200 bg-white shadow-lg overflow-hidden">
            <div className="px-6 py-4 flex items-center gap-3 border-b border-slate-100">
              <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                <Settings className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Mock Scenario</h2>
                <p className="text-sm text-slate-600">Choose how the mock backend should respond</p>
              </div>
            </div>
            <div className="px-6 py-4">
              <select
                value={mockScenario}
                onChange={(e) => setMockScenario(e.target.value as MockScenario)}
                className="w-full h-12 px-3 border border-slate-200 rounded-lg bg-white text-slate-900 text-base outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              >
                <option value="success">APPROVE - All pillars pass</option>
                <option value="failure">REJECT - Low scores, pillar failures</option>
                <option value="manual_review">MANUAL_REVIEW - Borderline scores</option>
                <option value="step-up-head-turn">Head Turn Challenge</option>
                <option value="step-up-follow-dot">Follow Dot Challenge</option>
                <option value="step-up-speak-phrase">Speak Phrase Challenge</option>
                <option value="challenge">Random Challenge</option>
              </select>
            </div>
          </div>
        )}

        {/* Verification Flows */}
        {(mode === 'mock' || isLiveModeReady) && (
          <div className="mb-6 rounded-xl border border-slate-200 bg-white shadow overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100">
              <h2 className="text-lg font-semibold text-slate-900">Verification Flows</h2>
              <p className="text-sm text-slate-600">
                {mode === 'mock'
                  ? 'Test enrollment and authentication with instant mock responses'
                  : `Connected to ${environment} environment`}
              </p>
            </div>
            <div className="px-6 py-4">
              {/* Tabs */}
              <div className="grid grid-cols-2 gap-1 mb-4 bg-slate-100 p-1 rounded-lg">
                <button
                  onClick={() => setActiveTab('enrollment')}
                  className={`py-2 rounded-md text-sm font-medium transition-all ${
                    activeTab === 'enrollment' ? 'bg-white shadow text-slate-900' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Enrollment
                </button>
                <button
                  onClick={() => setActiveTab('authentication')}
                  className={`py-2 rounded-md text-sm font-medium transition-all ${
                    activeTab === 'authentication' ? 'bg-white shadow text-slate-900' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Authentication
                </button>
              </div>

              {activeTab === 'enrollment' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">External User ID</label>
                    <input
                      type="text"
                      value={externalUserId}
                      onChange={(e) => setExternalUserId(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white text-slate-900 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="mt-1 text-xs text-slate-500">Your application's user identifier (stored on identity record)</p>
                  </div>
                  <div className="p-8 rounded-lg bg-gradient-to-br from-slate-50 to-white border-2 border-dashed border-slate-200">
                    <div className="text-center space-y-3">
                      <div className="w-16 h-16 rounded-full bg-slate-100 mx-auto flex items-center justify-center">
                        <Camera className="w-8 h-8 text-slate-400" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg mb-1">Ready to Enroll</h3>
                        <p className="text-sm text-slate-600">Create &rarr; Capture &rarr; Upload &rarr; Complete</p>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={startEnrollment}
                    className="w-full h-12 text-base font-semibold text-white rounded-lg flex items-center justify-center gap-2 transition-opacity hover:opacity-90"
                    style={{ backgroundColor: primaryColor }}
                  >
                    Start Enrollment <ArrowRight className="w-5 h-5" />
                  </button>
                </div>
              )}

              {activeTab === 'authentication' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Identity ID</label>
                    <input
                      type="text"
                      value={identityId}
                      onChange={(e) => setIdentityId(e.target.value)}
                      placeholder="ident_abc123def456"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white text-slate-900 font-mono text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="mt-1 text-xs text-slate-500">Identity ID from a previous enrollment (see results below)</p>
                  </div>
                  <div className="p-8 rounded-lg bg-gradient-to-br from-slate-50 to-white border-2 border-dashed border-slate-200">
                    <div className="text-center space-y-3">
                      <div className="w-16 h-16 rounded-full bg-slate-100 mx-auto flex items-center justify-center">
                        <Fingerprint className="w-8 h-8 text-slate-400" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg mb-1">Ready to Authenticate</h3>
                        <p className="text-sm text-slate-600">Verify identity against enrolled biometric template</p>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={startAuthentication}
                    disabled={!identityId}
                    className="w-full h-12 text-base font-semibold text-white rounded-lg flex items-center justify-center gap-2 transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ backgroundColor: identityId ? primaryColor : '#94a3b8' }}
                  >
                    Start Authentication <ArrowRight className="w-5 h-5" />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Session Result */}
        {sessionResult && (
          <div className={`mb-6 rounded-xl border-2 ${decisionBorderClass} bg-white shadow overflow-hidden`}>
            <div className="px-6 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                {sessionResult.decision === 'APPROVE' ? (
                  <CircleCheck className="w-5 h-5 text-green-600" />
                ) : sessionResult.decision === 'REJECT' ? (
                  <CircleX className="w-5 h-5 text-red-600" />
                ) : (
                  <Clock className="w-5 h-5 text-yellow-600" />
                )}
                <h2 className="text-lg font-semibold text-slate-900">Verification Result</h2>
              </div>
            </div>
            <div className="px-6 py-4 space-y-3">
              <div className="p-3 rounded-lg border border-slate-200">
                <div className="text-xs text-slate-500 mb-1">Decision</div>
                <span className={`inline-block px-2.5 py-1 rounded text-white text-sm font-semibold ${decisionBadgeClass}`}>
                  {sessionResult.decision}
                </span>
              </div>

              {sessionResult.identity_id && (
                <div className="p-3 rounded-lg border border-slate-200">
                  <div className="text-xs text-slate-600 mb-1">Identity ID (save for authentication)</div>
                  <div className="flex items-center gap-2">
                    <p className="font-mono text-sm break-all flex-1">{sessionResult.identity_id}</p>
                    <button
                      onClick={() => {
                        setIdentityId(sessionResult.identity_id!);
                        copyToClipboard(sessionResult.identity_id!, 'identity');
                      }}
                      className="p-1.5 rounded border border-slate-200 hover:bg-slate-50 shrink-0"
                    >
                      {identityCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                </div>
              )}

              <div className="p-3 rounded-lg border border-slate-200">
                <div className="text-xs text-slate-600 mb-1">Session ID</div>
                <div className="flex items-center gap-2">
                  <p className="font-mono text-sm break-all flex-1">{sessionResult.session_id}</p>
                  <button
                    onClick={() => copyToClipboard(sessionResult.session_id, 'session')}
                    className="p-1.5 rounded border border-slate-200 hover:bg-slate-50 shrink-0"
                  >
                    {sessionCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Session Error */}
        {sessionError && (
          <div className="mb-6 rounded-xl border-2 border-red-200 bg-white shadow overflow-hidden">
            <div className="px-6 py-4 border-b border-red-100">
              <div className="flex items-center gap-2">
                <CircleX className="w-5 h-5 text-red-600" />
                <h2 className="text-lg font-semibold text-slate-900">Verification Error</h2>
              </div>
            </div>
            <div className="px-6 py-4">
              <div className="px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-800">
                <strong>Error Code:</strong> {sessionError.code}
                <br />
                <strong>Message:</strong> {sessionError.message}
                {sessionError.details && (
                  <>
                    <br />
                    <strong>Details:</strong>{' '}
                    <span className="font-mono text-xs">
                      {typeof sessionError.details === 'string'
                        ? sessionError.details
                        : JSON.stringify(sessionError.details)}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Advanced Settings */}
        <div className="mb-6 rounded-xl border border-slate-200 bg-white shadow overflow-hidden">
          <button
            onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
            className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors text-left"
          >
            <div className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-slate-600" />
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Advanced Settings</h2>
                <p className="text-sm text-slate-600">Customize branding, audio, and capture settings</p>
              </div>
            </div>
            {showAdvancedSettings ? <ChevronUp className="w-5 h-5 text-slate-500" /> : <ChevronDown className="w-5 h-5 text-slate-500" />}
          </button>

          {showAdvancedSettings && (
            <div className="px-6 pb-6 space-y-4 border-t border-slate-100 pt-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Primary Color</label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="w-16 h-9 border border-slate-200 rounded-lg cursor-pointer"
                  />
                  <input
                    type="text"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    placeholder="#4F63F5"
                    className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="grid grid-cols-6 gap-2 mt-2">
                  {[
                    { color: '#4F63F5', name: 'UseSense' },
                    { color: '#10B981', name: 'Green' },
                    { color: '#1E3A8A', name: 'Navy' },
                    { color: '#14B8A6', name: 'Teal' },
                    { color: '#7C3AED', name: 'Purple' },
                    { color: '#DC2626', name: 'Red' },
                  ].map(({ color, name }) => (
                    <button
                      key={color}
                      onClick={() => setPrimaryColor(color)}
                      title={name}
                      className="h-8 rounded border-2 hover:scale-105 transition-transform"
                      style={{
                        backgroundColor: color,
                        borderColor: primaryColor === color ? '#000' : 'transparent',
                      }}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Logo URL (Optional)</label>
                <input
                  type="text"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  placeholder="https://example.com/logo.png"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Audio Mode</label>
                  <select
                    value={audioMode}
                    onChange={(e) => setAudioMode(e.target.value as typeof audioMode)}
                    className="w-full h-10 px-3 border border-slate-200 rounded-lg bg-white text-slate-900 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="never">Never</option>
                    <option value="risk_based">Risk-Based</option>
                    <option value="always">Always</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">WebAuthn</label>
                  <label className="flex items-center h-10 px-3 border border-slate-200 rounded-lg cursor-pointer gap-2">
                    <input
                      type="checkbox"
                      checked={enableWebAuthn}
                      onChange={(e) => setEnableWebAuthn(e.target.checked)}
                      className="w-4 h-4"
                    />
                    <span className="text-sm text-slate-700">Enable WebAuthn binding</span>
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Web Integrity + Debug Logs */}
        {(webIntegritySignals || debugLogs.length > 0) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {webIntegritySignals && (
              <div className="rounded-xl border-2 border-green-200 bg-white shadow-lg overflow-hidden">
                <div className="px-6 py-4 flex items-center gap-3 border-b border-slate-100">
                  <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                    <Shield className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">Web Integrity Signals</h2>
                    <p className="text-sm text-slate-600">DeepSense channel trust input signals</p>
                  </div>
                </div>
                <div className="px-6 py-4 space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: 'Screen', value: webIntegritySignals.screen_resolution },
                      { label: 'Viewport', value: webIntegritySignals.viewport_size },
                      { label: 'Hardware Cores', value: webIntegritySignals.hardware_concurrency },
                      { label: 'Device Memory', value: `${webIntegritySignals.device_memory} GB` },
                      { label: 'Timezone', value: webIntegritySignals.timezone },
                      { label: 'Camera Perm', value: webIntegritySignals.permissions_state?.camera },
                    ].map(({ label, value }) => (
                      <div key={label} className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                        <div className="text-xs font-semibold text-slate-500 uppercase mb-1">{label}</div>
                        <p className="font-mono text-sm font-bold text-slate-900">{value}</p>
                      </div>
                    ))}
                  </div>
                  {webIntegritySignals.webgl_renderer && (
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                      <div className="text-xs font-semibold text-slate-500 uppercase mb-1">GPU Renderer</div>
                      <p className="font-mono text-xs text-slate-900 break-all">{webIntegritySignals.webgl_renderer}</p>
                    </div>
                  )}
                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-slate-700 uppercase">Risk Indicators</div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className={`p-2 rounded border ${webIntegritySignals.webdriver ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
                        <span className="text-xs font-medium">WebDriver: </span>
                        <span className={`text-xs font-bold ${webIntegritySignals.webdriver ? 'text-red-600' : 'text-green-600'}`}>
                          {webIntegritySignals.webdriver ? 'Detected (-25)' : 'Clear'}
                        </span>
                      </div>
                      <div className="p-2 rounded border bg-green-50 border-green-200">
                        <span className="text-xs font-medium">Canvas Hash: </span>
                        <span className="text-xs font-bold text-green-600 font-mono">{webIntegritySignals.canvas_hash}</span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowFullJson(!showFullJson)}
                    className="w-full py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    {showFullJson ? 'Hide Full JSON' : 'View Full JSON'}
                  </button>
                  {showFullJson && (
                    <div className="p-4 bg-slate-900 rounded-lg overflow-x-auto max-h-80 overflow-y-auto">
                      <pre className="text-xs text-green-400 font-mono">{JSON.stringify(webIntegritySignals, null, 2)}</pre>
                    </div>
                  )}
                </div>
              </div>
            )}

            {debugLogs.length > 0 && (
              <div className="rounded-xl border-2 border-slate-200 bg-white shadow-lg overflow-hidden">
                <div className="px-6 py-4 flex items-center gap-3 border-b border-slate-100">
                  <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
                    <Settings className="w-6 h-6 text-slate-600" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">Debug Logs</h2>
                    <p className="text-sm text-slate-600">{debugLogs.length} event{debugLogs.length !== 1 ? 's' : ''} recorded</p>
                  </div>
                </div>
                <div className="px-6 py-4">
                  <div className="bg-slate-900 rounded-lg p-4 max-h-96 overflow-y-auto space-y-1">
                    {debugLogs.map((log, i) => (
                      <p key={i} className="text-xs font-mono text-green-400">{log}</p>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="text-center text-sm text-slate-500 mt-8 pb-4">
          <p>
            Built with UseSense &bull;{' '}
            {mode === 'mock' ? (
              <>Testing in <strong>Mock Mode</strong></>
            ) : (
              <>Connected to <strong>{environment}</strong> environment</>
            )}
            {' '}&bull; SDK v1.17.4 &bull; Server v1.17.4
          </p>
        </div>

      </div>
    </div>
  );
}
