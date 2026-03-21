import React, { useState, useMemo } from 'react';
import {
  Shield, Focus, Sun, Eye, Zap, Globe, Key, Check, Settings,
  Camera, ArrowRight, Fingerprint, CircleCheck, CircleX, Clock,
  Copy, ChevronUp, ChevronDown, TriangleAlert
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../components/ui/select';
import { Switch } from '../components/ui/switch';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../components/ui/collapsible';
import {
  createUseSenseClient,
  UseSenseVerification,
} from '../lib/usesense-sdk';
import type {
  RedactedDecisionObject,
  UseSenseEvent,
} from '../lib/usesense-sdk';
import { UseSenseError } from '../lib/usesense-sdk/types';
import { LiveCaptureFlow } from '../components/LiveCaptureFlow';

const DEFAULT_API_BASE_URL = 'https://api.usesense.ai/functions/v1/make-server-fc4cf30d';

type DemoMode = 'mock' | 'live';

export default function DemoPage() {
  // Mode Selection
  const [mode, setMode] = useState<DemoMode>('mock');
  const [apiKey, setApiKey] = useState('');
  const [gatewayKey, setGatewayKey] = useState('');
  const [backendUrl, setBackendUrl] = useState('');
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [apiKeyCopied, setApiKeyCopied] = useState(false);
  const [identityCopied, setIdentityCopied] = useState(false);
  const [sessionCopied, setSessionCopied] = useState(false);

  // Session State
  const [externalUserId, setExternalUserId] = useState('demo-user-' + Date.now());
  const [identityId, setIdentityId] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#4F63F5');
  const [logoUrl, setLogoUrl] = useState('');
  const [audioMode, setAudioMode] = useState<'never' | 'risk_based' | 'always'>('risk_based');
  const [enableWebAuthn, setEnableWebAuthn] = useState(false);
  const [activeFlow, setActiveFlow] = useState<'enrollment' | 'authentication' | null>(null);
  const [sessionResult, setSessionResult] = useState<RedactedDecisionObject | null>(null);
  const [sessionError, setSessionError] = useState<UseSenseError | null>(null);
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const [mockScenario, setMockScenario] = useState<'success' | 'failure' | 'manual_review' | 'step-up-head-turn' | 'step-up-follow-dot' | 'step-up-speak-phrase' | 'challenge'>('success');
  const [webIntegritySignals, setWebIntegritySignals] = useState<any>(null);
  const [showFullJson, setShowFullJson] = useState(false);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);

  // Extract environment from API key (new prefix scheme: pk_ = prod, sk_ = sandbox, dk_ = dev)
  const environment = useMemo(() => {
    if (mode === 'mock') return 'sandbox';
    if (!apiKey) return 'sandbox';
    if (apiKey.startsWith('pk_')) return 'production';
    return 'sandbox'; // sk_ and dk_ = sandbox
  }, [mode, apiKey]);

  // Check if Live mode is ready
  const isLiveModeReady = mode === 'live' && apiKey.length > 0;

  // Create SDK client
  const client = useMemo(() => {
    const effectiveBaseUrl = backendUrl || DEFAULT_API_BASE_URL;

    if (mode === 'mock') {
      return createUseSenseClient({
        apiBaseUrl: effectiveBaseUrl,
        apiKey: 'sk_demo_mock_key',
        branding: {
          primaryColor,
          logoUrl: logoUrl || undefined,
          buttonRadius: 12,
        },
        options: {
          audioEnabled: audioMode,
          stepUpPolicy: 'risk_based',
          captureDurationMs: 2500,
          targetFps: 15,
          maxFrames: 40,
          webAuthnEnabled: enableWebAuthn,
        },
      });
    } else {
      return createUseSenseClient({
        apiBaseUrl: effectiveBaseUrl,
        apiKey: apiKey || 'sk_demo_temp_key',
        gatewayKey: gatewayKey || undefined,
        branding: {
          primaryColor,
          logoUrl: logoUrl || undefined,
          buttonRadius: 12,
        },
        options: {
          audioEnabled: audioMode,
          stepUpPolicy: 'risk_based',
          captureDurationMs: 2500,
          targetFps: 15,
          maxFrames: 40,
          webAuthnEnabled: enableWebAuthn,
        },
      });
    }
  }, [mode, apiKey, gatewayKey, backendUrl, primaryColor, logoUrl, audioMode, enableWebAuthn]);

  // Set mock scenario only in mock mode
  if (mode === 'mock') {
    client.setMockScenario(mockScenario);
  }

  const addDebugLog = (message: string) => {
    setDebugLogs(prev => [...prev, `[${new Date().toISOString().substr(11, 8)}] ${message}`]);
  };

  const handleEvent = (event: UseSenseEvent) => {
    addDebugLog(`Event: ${event.type}`);

    if (event.type === 'web_integrity_collected' && event.data) {
      setWebIntegritySignals(event.data);
      addDebugLog('Web integrity signals collected');
    }
  };

  const handleComplete = (decision: RedactedDecisionObject) => {
    setSessionResult(decision);
    if (decision.identity_id) {
      setIdentityId(decision.identity_id);
    }
    addDebugLog(`Decision: ${decision.decision}`);
    // Security: do not log scores, reasons, or pillar details to the client
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

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    if (type === 'apiKey') {
      setApiKeyCopied(true);
      setTimeout(() => setApiKeyCopied(false), 2000);
    } else if (type === 'identity') {
      setIdentityCopied(true);
      setTimeout(() => setIdentityCopied(false), 2000);
    } else if (type === 'session') {
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
    if (newMode === 'live' && !apiKey) {
      setShowApiKeyInput(true);
    }
  };

  const getDecisionBadge = (decision: string) => {
    switch (decision) {
      case 'APPROVE': return 'bg-green-600';
      case 'REJECT': return 'bg-red-600';
      case 'MANUAL_REVIEW': return 'bg-yellow-600';
      default: return 'bg-slate-600';
    }
  };

  if (activeFlow) {
    // Live mode: use the full hosted-page-style capture flow
    if (mode === 'live') {
      return (
        <LiveCaptureFlow
          client={client}
          sessionType={activeFlow}
          externalUserId={activeFlow === 'enrollment' ? externalUserId : undefined}
          identityId={activeFlow === 'authentication' ? identityId : undefined}
          metadata={{ demo: true, mode, timestamp: Date.now() }}
          environment={environment}
          primaryColor={primaryColor}
          onComplete={handleComplete}
          onError={(err) => handleError(new UseSenseError(err.code as any, err.message, err.details))}
          onCancel={() => setActiveFlow(null)}
        />
      );
    }

    // Mock mode: use the original SDK verification component
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 50 }}>
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
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            padding: '8px 16px',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            zIndex: 51,
          }}
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-50">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Hero Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-xl"
              style={{
                backgroundColor: primaryColor,
                background: `linear-gradient(135deg, ${primaryColor} 0%, ${primaryColor}dd 100%)`,
              }}
            >
              <Shield className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-4xl font-bold text-slate-900">
              UseSense Web SDK
            </h1>
          </div>
          <p className="text-lg text-slate-600 mb-2">
            Production-ready biometric verification &bull; Server v1.17.4 &bull; Two-Phase Capture
          </p>

          {/* Feature Highlights */}
          <div className="flex flex-wrap items-center justify-center gap-2 mb-4">
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-cyan-50 border border-cyan-200 text-cyan-800 text-xs font-semibold">
              <Focus className="w-3.5 h-3.5" />
              <span>Blur Detection</span>
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold">
              <Sun className="w-3.5 h-3.5" />
              <span>Lighting Analysis</span>
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-violet-50 border border-violet-200 text-violet-800 text-xs font-semibold">
              <Eye className="w-3.5 h-3.5" />
              <span>Real-time Guidance</span>
            </div>
          </div>

          {/* Mode Selector */}
          <div className="inline-flex items-center gap-2 p-1 bg-white rounded-xl shadow-lg border-2 border-slate-200">
            <button
              onClick={() => handleModeSwitch('mock')}
              className={`
                relative flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition-all duration-200
                ${mode === 'mock'
                  ? 'bg-purple-600 text-white shadow-lg scale-105'
                  : 'text-slate-700 hover:bg-slate-100'
                }
              `}
            >
              <Zap className="w-5 h-5" />
              <span>Mock Mode</span>
            </button>
            <button
              onClick={() => handleModeSwitch('live')}
              className={`
                relative flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition-all duration-200
                ${mode === 'live'
                  ? 'bg-green-600 text-white shadow-lg scale-105'
                  : 'text-slate-700 hover:bg-slate-100'
                }
              `}
            >
              <Globe className="w-5 h-5" />
              <span>Live Mode</span>
            </button>
          </div>

          {/* Mode Info Banner */}
          <div className="mt-4 max-w-2xl mx-auto">
            {mode === 'mock' ? (
              <Alert className="bg-purple-50 border-purple-200 text-purple-900">
                <Zap className="w-4 h-4 text-purple-600" />
                <AlertDescription className="text-sm font-medium">
                  <strong>Mock Mode:</strong> Instant testing without backend APIs. Perfect for UI exploration and integration testing.
                </AlertDescription>
              </Alert>
            ) : (
              <Alert className="bg-green-50 border-green-200 text-green-900">
                <Globe className="w-4 h-4 text-green-600" />
                <AlertDescription className="text-sm font-medium">
                  <strong>Live Mode:</strong> Connect to real UseSense backend with 3-pillar verdict matrix (DeepSense, LiveSense, Dedupe).
                </AlertDescription>
              </Alert>
            )}
          </div>
        </div>

        {/* Live Mode: API Key Configuration */}
        {mode === 'live' && (
          <Card className="mb-6 border-2 border-blue-200 bg-white shadow-lg">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                    <Key className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <CardTitle className="text-lg text-slate-900">API Key Configuration</CardTitle>
                    <CardDescription className="text-slate-600">
                      Enter your UseSense API key to connect
                    </CardDescription>
                  </div>
                </div>
                {isLiveModeReady && (
                  <Badge className="bg-green-600 text-white hover:bg-green-600">
                    <Check className="w-3 h-3 mr-1" />
                    Connected
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {mode === 'live' && showApiKeyInput && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">API Key</label>
                  <input
                    type="text"
                    value={apiKey}
                    onChange={(e) => {
                      let cleaned = e.target.value.trim();
                      cleaned = cleaned.replace(/^#.*\n?/gm, '');
                      cleaned = cleaned.replace(/^```.*\n?/gm, '');
                      cleaned = cleaned.trim();
                      setApiKey(cleaned);
                    }}
                    placeholder="sk_... or pk_... or dk_..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                  />
                  {apiKey && !apiKey.startsWith('sk_') && !apiKey.startsWith('pk_') && !apiKey.startsWith('dk_') && (
                    <p className="text-sm text-red-600">
                      API key should start with <code>pk_</code> (production), <code>sk_</code> (sandbox), or <code>dk_</code> (development)
                    </p>
                  )}
                  <p className="text-xs text-gray-500">
                    Enter your UseSense API key from the dashboard. Auth: <code>X-API-Key</code> header + Supabase gateway
                  </p>
                </div>
              )}

              {apiKey && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="text-xs font-semibold text-slate-500 uppercase mb-2">Key Prefix</div>
                    <div className="font-mono text-base font-bold text-slate-900">
                      {apiKey.substring(0, Math.min(apiKey.indexOf('_', 3) + 1, 10)) || apiKey.substring(0, 6)}...
                    </div>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="text-xs font-semibold text-slate-500 uppercase mb-2">Environment</div>
                    <Badge
                      className={
                        environment === 'production' ? 'bg-green-600 text-white' : 'bg-blue-600 text-white'
                      }
                    >
                      {environment === 'production' ? 'Production (pk_)' : 'Sandbox (sk_/dk_)'}
                    </Badge>
                  </div>
                </div>
              )}

              {!apiKey && (
                <Alert className="bg-blue-50 border-blue-200">
                  <AlertDescription className="text-sm text-blue-900">
                    <strong>Need an API key?</strong> Generate one in your UseSense dashboard under Settings.
                    Use <code className="bg-blue-100 px-1.5 py-0.5 rounded font-mono">sk_</code> for sandbox,{' '}
                    <code className="bg-blue-100 px-1.5 py-0.5 rounded font-mono">pk_</code> for production, or{' '}
                    <code className="bg-blue-100 px-1.5 py-0.5 rounded font-mono">dk_</code> for development.
                  </AlertDescription>
                </Alert>
              )}

              {environment === 'production' && (
                <Alert className="bg-yellow-50 border-yellow-300">
                  <TriangleAlert className="w-4 h-4 text-yellow-600" />
                  <AlertDescription className="text-sm text-yellow-900 font-medium">
                    <strong>Production Mode:</strong> Sessions will be processed in your live environment and may incur charges.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        )}

        {/* Mock Mode: Test Scenario Selector */}
        {mode === 'mock' && (
          <Card className="mb-6 border-2 border-purple-200 bg-white shadow-lg">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                  <Settings className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <CardTitle className="text-lg text-slate-900">Mock Scenario</CardTitle>
                  <CardDescription className="text-slate-600">
                    Choose how the mock backend should respond
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Select value={mockScenario} onValueChange={(v: any) => setMockScenario(v)}>
                <SelectTrigger className="bg-white h-12 text-base">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="success">APPROVE - All pillars pass</SelectItem>
                  <SelectItem value="failure">REJECT - Low scores, pillar failures</SelectItem>
                  <SelectItem value="manual_review">MANUAL_REVIEW - Borderline scores</SelectItem>
                  <SelectItem value="step-up-head-turn">Head Turn Challenge</SelectItem>
                  <SelectItem value="step-up-follow-dot">Follow Dot Challenge</SelectItem>
                  <SelectItem value="step-up-speak-phrase">Speak Phrase Challenge</SelectItem>
                  <SelectItem value="challenge">Random Challenge</SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        )}

        {/* Session Policy Config (v1.17.4) */}
        {/* Removed — supplementary analysis section has been removed from the SDK */}

        {/* Verification Flows */}
        {(mode === 'mock' || isLiveModeReady) && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-slate-900">Verification Flows</CardTitle>
              <CardDescription>
                {mode === 'mock'
                  ? 'Test enrollment and authentication with instant mock responses'
                  : `Connected to ${environment} environment`
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="enrollment">
                <TabsList className="grid w-full grid-cols-2 mb-4">
                  <TabsTrigger value="enrollment">Enrollment</TabsTrigger>
                  <TabsTrigger value="authentication">Authentication</TabsTrigger>
                </TabsList>

                <TabsContent value="enrollment" className="space-y-4">
                  <div>
                    <Label htmlFor="externalUserId">External User ID</Label>
                    <Input
                      id="externalUserId"
                      value={externalUserId}
                      onChange={(e) => setExternalUserId(e.target.value)}
                      placeholder="your-user-id-123"
                      className="mt-1.5"
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      Your application's user identifier (stored on identity record)
                    </p>
                  </div>

                  <div className="p-8 rounded-lg bg-gradient-to-br from-slate-50 to-white border-2 border-dashed border-slate-200">
                    <div className="text-center space-y-3">
                      <div className="w-16 h-16 rounded-full bg-slate-100 mx-auto flex items-center justify-center">
                        <Camera className="w-8 h-8 text-slate-400" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg mb-1">Ready to Enroll</h3>
                        <p className="text-sm text-slate-600">
                          Create &rarr; Capture &rarr; Upload &rarr; Complete
                        </p>
                      </div>
                    </div>
                  </div>

                  <Button
                    onClick={startEnrollment}
                    className="w-full h-12 text-base"
                    style={{ backgroundColor: primaryColor }}
                  >
                    Start Enrollment
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                </TabsContent>

                <TabsContent value="authentication" className="space-y-4">
                  <div>
                    <Label htmlFor="identityId">Identity ID</Label>
                    <Input
                      id="identityId"
                      value={identityId}
                      onChange={(e) => setIdentityId(e.target.value)}
                      placeholder="ident_abc123def456"
                      className="mt-1.5 font-mono"
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      Identity ID from a previous enrollment (see results below)
                    </p>
                  </div>

                  <div className="p-8 rounded-lg bg-gradient-to-br from-slate-50 to-white border-2 border-dashed border-slate-200">
                    <div className="text-center space-y-3">
                      <div className="w-16 h-16 rounded-full bg-slate-100 mx-auto flex items-center justify-center">
                        <Fingerprint className="w-8 h-8 text-slate-400" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg mb-1">Ready to Authenticate</h3>
                        <p className="text-sm text-slate-600">
                          Verify identity against enrolled biometric template
                        </p>
                      </div>
                    </div>
                  </div>

                  <Button
                    onClick={startAuthentication}
                    className="w-full h-12 text-base"
                    disabled={!identityId}
                    style={{ backgroundColor: identityId ? primaryColor : undefined }}
                  >
                    Start Authentication
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        )}

        {/* Session Results - Enhanced for 3-pillar verdict */}
        {sessionResult && (
          <Card className={`mb-6 border-2 ${
            sessionResult.decision === 'APPROVE' ? 'border-green-200 bg-green-50/30' :
            sessionResult.decision === 'REJECT' ? 'border-red-200 bg-red-50/30' :
            'border-yellow-200 bg-yellow-50/30'
          }`}>
            <CardHeader>
              <div className="flex items-center gap-2">
                {sessionResult.decision === 'APPROVE' ? (
                  <CircleCheck className="w-5 h-5 text-green-600" />
                ) : sessionResult.decision === 'REJECT' ? (
                  <CircleX className="w-5 h-5 text-red-600" />
                ) : (
                  <Clock className="w-5 h-5 text-yellow-600" />
                )}
                <div>
                  <CardTitle className="text-slate-900">Verification Result</CardTitle>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Top-level decision only — scores, pillars, reasons, and flags are hidden for security */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-3 bg-white rounded-lg border">
                  <Label className="text-xs text-slate-500">Decision</Label>
                  <div className="mt-1">
                    <Badge className={`${getDecisionBadge(sessionResult.decision)} text-white`}>
                      {sessionResult.decision}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Identity ID */}
              {sessionResult.identity_id && (
                <div className="p-3 bg-white rounded border">
                  <Label className="text-xs text-slate-600">Identity ID (save for authentication)</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="font-mono text-sm break-all flex-1">{sessionResult.identity_id}</p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setIdentityId(sessionResult.identity_id!);
                        copyToClipboard(sessionResult.identity_id!, 'identity');
                      }}
                    >
                      {identityCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    </Button>
                  </div>
                </div>
              )}

              {/* Session ID */}
              <div className="p-3 bg-white rounded border">
                <Label className="text-xs text-slate-600">Session ID</Label>
                <div className="flex items-center gap-2 mt-1">
                  <p className="font-mono text-sm break-all flex-1">{sessionResult.session_id}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(sessionResult.session_id, 'session')}
                  >
                    {sessionCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  </Button>
                </div>
              </div>

              {/* Full Decision JSON removed for security — do not expose internal verdict data to the client */}
            </CardContent>
          </Card>
        )}

        {/* Session Error */}
        {sessionError && (
          <Card className="mb-6 border-2 border-red-200 bg-red-50/30">
            <CardHeader>
              <div className="flex items-center gap-2">
                <CircleX className="w-5 h-5 text-red-600" />
                <CardTitle className="text-slate-900">Verification Error</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <Alert className="bg-white border-red-200">
                <AlertDescription className="text-sm text-red-800">
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
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        )}

        {/* Advanced Settings */}
        <Collapsible open={showAdvancedSettings} onOpenChange={setShowAdvancedSettings}>
          <Card className="mb-6">
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-slate-50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Settings className="w-5 h-5 text-slate-600" />
                    <CardTitle className="text-slate-900">Advanced Settings</CardTitle>
                  </div>
                  {showAdvancedSettings ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </div>
                <CardDescription>
                  Customize branding, audio, and capture settings
                </CardDescription>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="space-y-4 pt-0">
                {/* Primary Color */}
                <div>
                  <Label htmlFor="primaryColor" className="text-sm">Primary Color</Label>
                  <div className="flex gap-2 mt-1.5">
                    <Input
                      id="primaryColor"
                      type="color"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="w-16 h-9"
                    />
                    <Input
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      placeholder="#4F63F5"
                      className="font-mono text-sm"
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
                    ].map((preset) => (
                      <button
                        key={preset.color}
                        className="w-full h-8 rounded border-2 hover:scale-105 transition"
                        style={{
                          backgroundColor: preset.color,
                          borderColor: primaryColor === preset.color ? '#000' : 'transparent',
                        }}
                        onClick={() => setPrimaryColor(preset.color)}
                        title={preset.name}
                      />
                    ))}
                  </div>
                </div>

                {/* Logo URL */}
                <div>
                  <Label htmlFor="logoUrl" className="text-sm">Logo URL (Optional)</Label>
                  <Input
                    id="logoUrl"
                    value={logoUrl}
                    onChange={(e) => setLogoUrl(e.target.value)}
                    placeholder="https://example.com/logo.png"
                    className="mt-1.5 text-sm"
                  />
                </div>

                {/* Audio Mode & WebAuthn */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="audioMode" className="text-sm">Audio Mode</Label>
                    <Select value={audioMode} onValueChange={(v: any) => setAudioMode(v)}>
                      <SelectTrigger className="mt-1.5">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="never">Never</SelectItem>
                        <SelectItem value="risk_based">Risk-Based</SelectItem>
                        <SelectItem value="always">Always</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex flex-col justify-end">
                    <div className="flex items-center justify-between h-9 px-3 border rounded-md">
                      <Label htmlFor="webauthn" className="text-sm cursor-pointer">WebAuthn</Label>
                      <Switch
                        id="webauthn"
                        checked={enableWebAuthn}
                        onCheckedChange={setEnableWebAuthn}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Web Integrity & Debug Logs */}
        {(webIntegritySignals || debugLogs.length > 0) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Web Integrity Signals */}
            {webIntegritySignals && (
              <Card className="border-2 border-green-200 bg-white shadow-lg">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                      <Shield className="w-6 h-6 text-green-600" />
                    </div>
                    <div>
                      <CardTitle className="text-lg text-slate-900">Web Integrity Signals</CardTitle>
                      <CardDescription className="text-slate-600">
                        DeepSense channel trust input signals
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                      <div className="text-xs font-semibold text-slate-500 uppercase mb-1">Screen</div>
                      <p className="font-mono text-sm font-bold text-slate-900">{webIntegritySignals.screen_resolution}</p>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                      <div className="text-xs font-semibold text-slate-500 uppercase mb-1">Viewport</div>
                      <p className="font-mono text-sm font-bold text-slate-900">{webIntegritySignals.viewport_size}</p>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                      <div className="text-xs font-semibold text-slate-500 uppercase mb-1">Hardware Cores</div>
                      <p className="font-mono text-sm font-bold text-slate-900">{webIntegritySignals.hardware_concurrency}</p>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                      <div className="text-xs font-semibold text-slate-500 uppercase mb-1">Device Memory</div>
                      <p className="font-mono text-sm font-bold text-slate-900">{webIntegritySignals.device_memory} GB</p>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                      <div className="text-xs font-semibold text-slate-500 uppercase mb-1">Timezone</div>
                      <p className="font-mono text-xs text-slate-900">{webIntegritySignals.timezone}</p>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                      <div className="text-xs font-semibold text-slate-500 uppercase mb-1">Camera Perm</div>
                      <p className="font-mono text-sm font-bold text-slate-900">{webIntegritySignals.permissions_state?.camera}</p>
                    </div>
                  </div>

                  {/* GPU Info */}
                  {webIntegritySignals.webgl_renderer && (
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                      <div className="text-xs font-semibold text-slate-500 uppercase mb-1">GPU Renderer</div>
                      <p className="font-mono text-xs text-slate-900 break-all">{webIntegritySignals.webgl_renderer}</p>
                    </div>
                  )}

                  {/* Risk Indicators */}
                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-slate-700 uppercase">Risk Indicators</div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className={`p-2 rounded border ${webIntegritySignals.webdriver ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
                        <span className="text-xs font-medium">WebDriver: </span>
                        <span className={`text-xs font-bold ${webIntegritySignals.webdriver ? 'text-red-600' : 'text-green-600'}`}>
                          {webIntegritySignals.webdriver ? 'Detected (-25)' : 'Clear'}
                        </span>
                      </div>
                      <div className={`p-2 rounded border bg-green-50 border-green-200`}>
                        <span className="text-xs font-medium">Canvas Hash: </span>
                        <span className="text-xs font-bold text-green-600 font-mono">
                          {webIntegritySignals.canvas_hash}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Full JSON Toggle */}
                  <div>
                    <Button
                      variant="outline"
                      onClick={() => setShowFullJson(!showFullJson)}
                      className="w-full"
                      size="sm"
                    >
                      {showFullJson ? 'Hide Full JSON' : 'View Full JSON'}
                    </Button>
                    {showFullJson && (
                      <div className="p-4 bg-slate-900 rounded-lg overflow-x-auto mt-3 max-h-80 overflow-y-auto">
                        <pre className="text-xs text-green-400 font-mono">
                          {JSON.stringify(webIntegritySignals, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Debug Logs */}
            {debugLogs.length > 0 && (
              <Card className="border-2 border-slate-200 bg-white shadow-lg">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
                      <Settings className="w-6 h-6 text-slate-600" />
                    </div>
                    <div>
                      <CardTitle className="text-lg text-slate-900">Debug Logs</CardTitle>
                      <CardDescription className="text-slate-600">
                        {debugLogs.length} event{debugLogs.length !== 1 ? 's' : ''} recorded
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="bg-slate-900 rounded-lg p-4 max-h-96 overflow-y-auto">
                    <div className="space-y-1">
                      {debugLogs.map((log, index) => (
                        <p key={index} className="text-xs font-mono text-green-400">
                          {log}
                        </p>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="text-center text-sm text-slate-500 mt-8">
          <p>
            Built with UseSense &bull;{' '}
            {mode === 'mock' ? (
              <> Testing in <strong>Mock Mode</strong></>
            ) : (
              <> Connected to <strong>{environment}</strong> environment</>
            )}
            {' '}&bull; SDK v1.17.4 &bull; Server v1.17.4
          </p>
        </div>
      </div>
    </div>
  );
}