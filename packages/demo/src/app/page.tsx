'use client';

import { useState, useCallback, useEffect, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { VerificationCaptureEngine, detectEnvironmentFromKey } from '@usesense/web-sdk';
import type { CaptureResult, CapturePhase, CaptureSessionData } from '@usesense/web-sdk';

// ---------------------------------------------------------------------------
// Mock session data generator
// ---------------------------------------------------------------------------

function getMockSessionData(scenario: string): CaptureSessionData {
  const baseSession = {
    session_id: `mock_sess_${Date.now()}`,
    session_token: `mock_tok_${Date.now()}`,
    nonce: `mock_nonce_${Date.now()}`,
    upload: { max_frames: 30, target_fps: 4, capture_duration_ms: 7500 },
    geometric_coherence: {
      mesh_binding_challenge:
        'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
    },
  };

  switch (scenario) {
    case 'head-turn':
      return {
        ...baseSession,
        policy: {
          challenge_type: 'head_turn',
          challenge: {
            type: 'head_turn',
            seed: 'mock_seed',
            sequence: [
              { direction: 'left', duration_ms: 1500, index: 0 },
              { direction: 'right', duration_ms: 1500, index: 1 },
              { direction: 'center', duration_ms: 1000, index: 2 },
            ],
            total_duration_ms: 4000,
          },
        },
      };
    case 'follow-dot':
      return {
        ...baseSession,
        policy: {
          challenge_type: 'follow_dot',
          challenge: {
            type: 'follow_dot',
            seed: 'mock_seed',
            waypoints: [
              { x: 0.2, y: 0.3, duration_ms: 1200, index: 0 },
              { x: 0.8, y: 0.3, duration_ms: 1200, index: 1 },
              { x: 0.5, y: 0.7, duration_ms: 1200, index: 2 },
            ],
            dot_size_px: 40,
            total_duration_ms: 3600,
          },
        },
      };
    case 'speak-phrase':
      return {
        ...baseSession,
        policy: {
          challenge_type: 'speak_phrase',
          audio_challenge: {
            type: 'speak_phrase',
            seed: 'mock_seed',
            phrase: '3 7 2 9 1',
            total_duration_ms: 5000,
          },
        },
      };
    case 'none':
      return { ...baseSession, policy: { challenge_type: 'none' } };
    default:
      return {
        ...baseSession,
        policy: {
          challenge_type: 'head_turn',
          challenge: {
            type: 'head_turn',
            seed: 'mock_seed',
            sequence: [
              { direction: 'left', duration_ms: 1500, index: 0 },
              { direction: 'center', duration_ms: 1000, index: 1 },
              { direction: 'right', duration_ms: 1500, index: 2 },
            ],
            total_duration_ms: 4000,
          },
        },
      };
  }
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = {
  page: {
    display: 'flex',
    flexDirection: 'column' as const,
    minHeight: '100vh',
    fontFamily: "'DM Sans', sans-serif",
    background: '#FDFCFA',
    color: '#1C1A17',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 32px',
    background: '#FFFFFF',
    borderBottom: '1px solid #E8E5DE',
    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
  },
  headerTitle: {
    fontSize: '1rem',
    fontWeight: 700,
    fontFamily: "'Outfit', sans-serif",
    letterSpacing: '-0.02em',
    whiteSpace: 'nowrap' as const,
  },
  headerBadge: {
    fontSize: '0.72rem',
    fontWeight: 600,
    fontFamily: "'JetBrains Mono', monospace",
    background: 'rgba(79,124,255,0.08)',
    color: '#4F7CFF',
    padding: '4px 10px',
    borderRadius: '6px',
    marginLeft: '10px',
    border: '1px solid rgba(79,124,255,0.2)',
  },
  modeToggleWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: '0',
    background: '#F5F3EF',
    borderRadius: '10px',
    padding: '3px',
  },
  modeBtn: (active: boolean): React.CSSProperties => ({
    padding: '6px 16px',
    border: 'none',
    borderRadius: '8px',
    fontSize: '0.78rem',
    fontWeight: 600,
    fontFamily: "'DM Sans', sans-serif",
    cursor: 'pointer',
    transition: 'all 150ms cubic-bezier(0.16, 1, 0.3, 1)',
    background: active ? '#FFFFFF' : 'transparent',
    color: active ? '#1C1A17' : '#6B6760',
    boxShadow: active ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
  }),
  content: {
    maxWidth: '860px',
    width: '100%',
    margin: '0 auto',
    padding: '32px 24px',
  },
  tabs: {
    display: 'flex',
    gap: '8px',
    marginBottom: '24px',
  },
  tab: (active: boolean, color: string): React.CSSProperties => ({
    padding: '10px 24px',
    border: 'none',
    borderRadius: '9999px',
    fontSize: '0.88rem',
    fontWeight: 600,
    fontFamily: "'DM Sans', sans-serif",
    cursor: 'pointer',
    transition: 'all 150ms cubic-bezier(0.16, 1, 0.3, 1)',
    background: active ? color : '#F5F3EF',
    color: active ? '#FFFFFF' : '#6B6760',
  }),
  card: {
    background: '#FFFFFF',
    borderRadius: '14px',
    border: '1px solid #E8E5DE',
    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
    padding: '28px',
    marginBottom: '20px',
  },
  cardTitle: {
    fontSize: '1rem',
    fontWeight: 700,
    fontFamily: "'Outfit', sans-serif",
    letterSpacing: '-0.02em',
    marginBottom: '20px',
    color: '#1C1A17',
  },
  fieldGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '16px',
  },
  fieldFull: {
    gridColumn: '1 / -1',
  },
  label: {
    display: 'block',
    fontSize: '0.72rem',
    fontWeight: 600,
    fontFamily: "'DM Sans', sans-serif",
    color: '#6B6760',
    marginBottom: '6px',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.06em',
  },
  input: {
    width: '100%',
    height: '44px',
    padding: '0 16px',
    border: '1px solid #E8E5DE',
    borderRadius: '10px',
    fontSize: '0.88rem',
    fontFamily: "'DM Sans', sans-serif",
    outline: 'none',
    transition: 'border-color 150ms cubic-bezier(0.16, 1, 0.3, 1)',
    boxSizing: 'border-box' as const,
    background: '#FFFFFF',
    color: '#1C1A17',
  },
  select: {
    width: '100%',
    height: '44px',
    padding: '0 16px',
    border: '1px solid #E8E5DE',
    borderRadius: '10px',
    fontSize: '0.88rem',
    fontFamily: "'DM Sans', sans-serif",
    outline: 'none',
    background: '#FFFFFF',
    color: '#1C1A17',
    cursor: 'pointer',
    boxSizing: 'border-box' as const,
  },
  colorField: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  colorSwatch: {
    width: '44px',
    height: '44px',
    borderRadius: '10px',
    border: '2px solid #E8E5DE',
    cursor: 'pointer',
    flexShrink: 0,
    padding: 0,
  } as React.CSSProperties,
  startBtn: (color: string, disabled: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '44px',
    padding: '0 24px',
    border: 'none',
    borderRadius: '10px',
    fontSize: '0.88rem',
    fontWeight: 600,
    fontFamily: "'DM Sans', sans-serif",
    cursor: disabled ? 'not-allowed' : 'pointer',
    background: disabled ? '#9E9A92' : color,
    color: '#FFFFFF',
    transition: 'all 150ms cubic-bezier(0.16, 1, 0.3, 1)',
    opacity: disabled ? 0.4 : 1,
    marginTop: '8px',
  }),
  mockNotice: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
    padding: '20px 24px',
    background: 'rgba(255,184,77,0.06)',
    border: '1px solid rgba(255,184,77,0.2)',
    borderRadius: '14px',
    fontSize: '0.85rem',
    fontFamily: "'DM Sans', sans-serif",
    color: '#6B6760',
    marginBottom: '20px',
    lineHeight: '1.6',
  },
  resultCard: {
    background: '#FFFFFF',
    borderRadius: '14px',
    border: '1px solid #E8E5DE',
    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
    padding: '28px',
    marginBottom: '20px',
  },
  decisionBadge: (decision: string): React.CSSProperties => {
    const map: Record<string, { bg: string; color: string; border: string }> = {
      APPROVE: { bg: 'rgba(0,212,170,0.08)', color: '#008066', border: 'rgba(0,212,170,0.2)' },
      REJECT: { bg: 'rgba(255,107,74,0.08)', color: '#B73520', border: 'rgba(255,107,74,0.2)' },
      MANUAL_REVIEW: { bg: 'rgba(255,184,77,0.08)', color: '#B77829', border: 'rgba(255,184,77,0.2)' },
    };
    const s = map[decision] || map.MANUAL_REVIEW;
    return {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '5px',
      padding: '4px 10px',
      borderRadius: '6px',
      fontSize: '0.72rem',
      fontWeight: 600,
      fontFamily: "'DM Sans', sans-serif",
      background: s.bg,
      color: s.color,
      border: `1px solid ${s.border}`,
    };
  },
  scoreRow: {
    display: 'flex',
    gap: '16px',
    marginTop: '16px',
    flexWrap: 'wrap' as const,
  },
  scorePill: {
    flex: '1 1 0',
    minWidth: '140px',
    padding: '14px 16px',
    background: '#F5F3EF',
    borderRadius: '10px',
    textAlign: 'center' as const,
  },
  scoreLabel: {
    fontSize: '0.58rem',
    fontWeight: 700,
    fontFamily: "'DM Sans', sans-serif",
    color: '#9E9A92',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.14em',
  },
  scoreValue: {
    fontSize: '1.8rem',
    fontWeight: 700,
    fontFamily: "'Outfit', sans-serif",
    letterSpacing: '-0.03em',
    color: '#1C1A17',
    marginTop: '4px',
  },
  errorCard: {
    background: 'rgba(255,107,74,0.06)',
    border: '1px solid rgba(255,107,74,0.2)',
    borderRadius: '14px',
    padding: '20px 24px',
    marginBottom: '20px',
    color: '#B73520',
    fontSize: '0.85rem',
    fontFamily: "'DM Sans', sans-serif",
  },
  debugToggle: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 0',
    cursor: 'pointer',
    userSelect: 'none' as const,
  },
  debugPanel: {
    background: '#1C1A17',
    borderRadius: '14px',
    padding: '16px',
    maxHeight: '260px',
    overflowY: 'auto' as const,
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: '0.78rem',
    lineHeight: '1.8',
  },
  debugLine: {
    color: '#D0CCBF',
    whiteSpace: 'pre-wrap' as const,
    wordBreak: 'break-all' as const,
  },
  overlay: {
    position: 'fixed' as const,
    inset: 0,
    zIndex: 50,
    background: '#1C1A17',
  },
  closeBtn: {
    position: 'absolute' as const,
    top: '16px',
    right: '16px',
    zIndex: 60,
    width: '40px',
    height: '40px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(0,0,0,0.5)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '50%',
    color: '#FFFFFF',
    fontSize: '20px',
    cursor: 'pointer',
    transition: 'background 150ms cubic-bezier(0.16, 1, 0.3, 1)',
  },
  metaRow: {
    display: 'flex',
    gap: '24px',
    marginTop: '12px',
    flexWrap: 'wrap' as const,
  },
  metaItem: {
    fontSize: '0.82rem',
    fontFamily: "'JetBrains Mono', monospace",
    color: '#6B6760',
  },
  metaLabel: {
    fontWeight: 600,
    fontFamily: "'DM Sans', sans-serif",
    color: '#9E9A92',
    marginRight: '4px',
  },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function DemoPage() {
  return (
    <Suspense>
      <DemoPageInner />
    </Suspense>
  );
}

function DemoPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const autoStartTriggered = useRef(false);

  // Env-driven defaults for the live demo flow
  const demoApiKey = process.env.NEXT_PUBLIC_DEMO_API_KEY || '';
  const demoMode = (process.env.NEXT_PUBLIC_DEMO_MODE || 'live') as 'mock' | 'live';
  const demoType = (process.env.NEXT_PUBLIC_DEMO_TYPE || 'enrollment') as 'enrollment' | 'authentication';
  const demoPrimaryColor = process.env.NEXT_PUBLIC_DEMO_PRIMARY_COLOR || '#4F7CFF';
  const demoLogoUrl = process.env.NEXT_PUBLIC_DEMO_LOGO_URL || '/logo.svg';

  // Detect whether this is an auto-start session from the /verify lead-gen page
  const isAutoStart = searchParams.get('autostart') === '1';
  const qsExternalId = searchParams.get('externalId');

  const [mode, setMode] = useState<'mock' | 'live'>(isAutoStart ? demoMode : 'mock');
  const [activeFlow, setActiveFlow] = useState<'enrollment' | 'authentication' | null>(null);
  const [activeTab, setActiveTab] = useState<'enrollment' | 'authentication'>(
    isAutoStart ? demoType : 'enrollment',
  );
  const [apiKey, setApiKey] = useState(isAutoStart ? demoApiKey : '');
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.usesense.ai/v1';
  const environment = detectEnvironmentFromKey(apiKey);
  // Use a stable initial value to avoid SSR/client hydration mismatch.
  // Date.now() returns different values at static-generation time vs runtime,
  // which causes React to throw an "Application error" on the first re-render.
  const [externalUserId, setExternalUserId] = useState(
    qsExternalId || 'demo-user-001',
  );
  useEffect(() => {
    if (!qsExternalId) {
      setExternalUserId('demo-user-' + Date.now());
    }
  }, [qsExternalId]);
  const [identityId, setIdentityId] = useState('');
  const [primaryColor, setPrimaryColor] = useState(isAutoStart ? demoPrimaryColor : '#4F7CFF');
  const [logoUrl, setLogoUrl] = useState('');
  const [sessionResult, setSessionResult] = useState<CaptureResult | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);
  // Ref to hold the result for the autostart flow without triggering a
  // re-render.  Using state would cause the overlay condition to fail and
  // unmount the SDK's done screen prematurely.
  const autoStartResultRef = useRef<CaptureResult | null>(null);
  const [mockScenario, setMockScenario] = useState<string>('success');
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const [showDebug, setShowDebug] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionData, setSessionData] = useState<CaptureSessionData | null>(null);

  const addLog = useCallback((message: string) => {
    const ts = new Date().toISOString().slice(11, 23);
    setDebugLogs((prev) => [`[${ts}] ${message}`, ...prev]);
  }, []);

  const startVerification = async (flow: 'enrollment' | 'authentication') => {
    setSessionResult(null);
    setSessionError(null);
    setIsLoading(true);
    addLog(`Starting ${flow} in ${mode} mode`);

    try {
      let data: CaptureSessionData;

      if (mode === 'mock') {
        data = getMockSessionData(mockScenario);
        addLog(`Mock session created: ${data.session_id} (scenario: ${mockScenario})`);
      } else {
        if (!apiKey) {
          throw new Error('API Key is required for live mode');
        }

        addLog('Creating live session via API...');
        const body: Record<string, unknown> = {
          session_type: flow,
          platform: 'web',
          external_user_id: externalUserId,
        };
        if (flow === 'authentication' && identityId) {
          body.identity_id = identityId;
        }

        // Attach lead-gen metadata from /verify page if available
        const leadRaw = sessionStorage.getItem('usesense_lead');
        if (leadRaw) {
          try {
            body.metadata = JSON.parse(leadRaw);
          } catch { /* ignore malformed data */ }
        }

        const res = await fetch(`${apiBaseUrl}/sessions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'x-environment': environment,
          },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const errorText = await res.text();
          throw new Error(`API ${res.status}: ${errorText}`);
        }

        data = (await res.json()) as CaptureSessionData;
        addLog(`Live session created: ${data.session_id}`);
      }

      setSessionData(data);
      setActiveFlow(flow);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setSessionError(message);
      addLog(`Error: ${message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const canStart = mode === 'mock' || (mode === 'live' && apiKey.length > 0);

  // Auto-start verification when redirected from the /verify lead-gen page
  useEffect(() => {
    if (isAutoStart && !autoStartTriggered.current) {
      autoStartTriggered.current = true;
      startVerification(demoType);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAutoStart]);

  // Scores are returned in the 0-100 range by the API.
  const formatScore = (score: number | undefined) =>
    score !== undefined ? score.toFixed(1) + '%' : '--';

  // The API may return pillar verdicts as a plain string OR as {score, verdict}.
  // Render either safely as a string.
  const formatVerdict = (v: unknown): string => {
    if (!v) return '';
    if (typeof v === 'string') return v;
    if (typeof v === 'object' && v !== null) {
      const o = v as Record<string, unknown>;
      const parts: string[] = [];
      if (o.verdict != null) parts.push(String(o.verdict));
      if (o.score != null) parts.push(`${Number(o.score).toFixed(0)}%`);
      return parts.join(' · ');
    }
    return String(v);
  };

  // When auto-starting from /verify, show a minimal loading screen
  // instead of the full configuration UI.
  // On complete/cancel, redirect to the clean /result page.
  // Navigate to the clean result page, storing only safe fields.
  const navigateToResult = useCallback(() => {
    const r = autoStartResultRef.current;
    if (r) {
      sessionStorage.setItem(
        'usesense_result',
        JSON.stringify({
          decision: r.decision,
          channel_trust_score: r.channel_trust_score,
          liveness_score: r.liveness_score,
          dedupe_risk_score: r.dedupe_risk_score,
          session_type: r.session_type,
        }),
      );
    }
    router.push('/result');
  }, [router]);

  // Autostart flow: show a minimal loading screen, then the SDK overlay.
  // We guard on !sessionResult and !sessionError so that the standard
  // demo page is never revealed to autostart users.  The result is stored
  // in a ref (not state) so setting it does NOT unmount the SDK overlay
  // while the user is still on the done screen.
  if (isAutoStart && !sessionResult && !sessionError) {
    return (
      <div style={{ ...styles.page, alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="UseSense" style={{ height: 40, marginBottom: 24 }} />
          <div style={{ fontSize: '1.35rem', fontWeight: 700, fontFamily: "'Outfit', sans-serif", letterSpacing: '-0.02em', color: '#1C1A17', marginBottom: 8 }}>
            Launching verification...
          </div>
          <div style={{ fontSize: '0.88rem', fontFamily: "'DM Sans', sans-serif", color: '#6B6760' }}>
            Please wait while we set up your session.
          </div>
        </div>
        {/* Render overlay if session data arrives */}
        {activeFlow && sessionData && (
          <div style={styles.overlay}>
            <VerificationCaptureEngine
              sessionData={sessionData}
              environment={environment}

              apiBaseUrl={apiBaseUrl}
              primaryColor={primaryColor}
              logoUrl={logoUrl || undefined}
              sessionType={activeFlow}
              onComplete={(result) => {
                // Store in ref (no re-render) so the overlay stays mounted
                // while the user views the SDK's done screen.
                if (result) autoStartResultRef.current = result;
                addLog(`Complete: ${result?.decision ?? 'unknown'}`);
              }}
              onCancel={() => {
                // User clicked "Finish" on the done screen.
                // Redirect to the clean /result page.
                addLog('Redirecting to result page');
                navigateToResult();
              }}
              onError={(error) => {
                addLog(`Error: ${error}`);
                // Redirect to result page even on error -- /result will
                // redirect to /verify if there is no data.
                navigateToResult();
              }}
              onPhaseChange={(phase: CapturePhase, label: string) => {
                addLog(`Phase: ${phase} - ${label}`);
              }}
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={styles.page}>
      {/* Header */}
      <header className="us-header" style={styles.header}>
        <div className="us-header-left" style={{ display: 'flex', alignItems: 'center' }}>
          <span style={{ ...styles.headerTitle, whiteSpace: 'nowrap' as const }}>
            <span style={{ color: '#1C1A17' }}>Use</span>
            <span style={{ color: '#4F7CFF' }}>Sense</span>
            {' '}Web SDK Demo
          </span>
          <span className="us-header-badge" style={styles.headerBadge}>v2.0.0</span>
        </div>
        <div style={styles.modeToggleWrap}>
          <button
            style={styles.modeBtn(mode === 'mock')}
            onClick={() => setMode('mock')}
          >
            Mock
          </button>
          <button
            style={styles.modeBtn(mode === 'live')}
            onClick={() => setMode('live')}
          >
            Live
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="us-content" style={styles.content}>
        {/* Tabs */}
        <div className="us-tabs" style={styles.tabs}>
          <button
            style={styles.tab(activeTab === 'enrollment', primaryColor)}
            onClick={() => setActiveTab('enrollment')}
          >
            Enrollment
          </button>
          <button
            style={styles.tab(activeTab === 'authentication', primaryColor)}
            onClick={() => setActiveTab('authentication')}
          >
            Authentication
          </button>
        </div>

        {/* Mock mode notice */}
        {mode === 'mock' && (
          <div className="us-mock-notice" style={styles.mockNotice}>
            <span style={{ flexShrink: 0, fontSize: '16px', color: '#B77829', fontWeight: 700 }}>!</span>
            <span>
              <strong>Mock Mode:</strong> The SDK will run with simulated session
              data. Since there is no real server backing the session, the upload
              and completion steps will fail with an expected error. This is
              useful for testing the capture UI and challenge flows locally.
            </span>
          </div>
        )}

        {/* Configuration Card */}
        <div className="us-card" style={styles.card}>
          <div style={styles.cardTitle}>Configuration</div>
          <div className="us-field-grid" style={styles.fieldGrid}>
            {/* Mode-specific fields */}
            {mode === 'mock' ? (
              <div>
                <label style={styles.label}>Challenge Scenario</label>
                <select
                  style={styles.select}
                  value={mockScenario}
                  onChange={(e) => setMockScenario(e.target.value)}
                >
                  <option value="success">Head Turn (default)</option>
                  <option value="head-turn">Head Turn (alt sequence)</option>
                  <option value="follow-dot">Follow Dot</option>
                  <option value="speak-phrase">Speak Phrase</option>
                  <option value="none">No Challenge</option>
                </select>
              </div>
            ) : (
              <>
                <div>
                  <label style={styles.label}>API Key</label>
                  <input
                    style={styles.input}
                    type="password"
                    placeholder="sk-..."
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                  />
                </div>
              </>
            )}

            {/* External User ID */}
            <div>
              <label style={styles.label}>External User ID</label>
              <input
                style={styles.input}
                type="text"
                value={externalUserId}
                onChange={(e) => setExternalUserId(e.target.value)}
              />
            </div>

            {/* Identity ID (authentication only) */}
            {activeTab === 'authentication' && (
              <div>
                <label style={styles.label}>Identity ID</label>
                <input
                  style={styles.input}
                  type="text"
                  placeholder="idnt_..."
                  value={identityId}
                  onChange={(e) => setIdentityId(e.target.value)}
                />
              </div>
            )}

            {/* Primary Color */}
            <div>
              <label style={styles.label}>Primary Color</label>
              <div style={styles.colorField}>
                <input
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  style={styles.colorSwatch}
                />
                <input
                  style={{ ...styles.input, flex: 1 }}
                  type="text"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                />
              </div>
            </div>

            {/* Logo URL */}
            <div>
              <label style={styles.label}>Logo URL</label>
              <input
                style={styles.input}
                type="text"
                placeholder="https://..."
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
              />
            </div>
          </div>

          {/* Start Button */}
          <button
            style={styles.startBtn(primaryColor, !canStart || isLoading)}
            disabled={!canStart || isLoading}
            onClick={() => startVerification(activeTab)}
          >
            {isLoading
              ? 'Creating Session...'
              : `Start ${activeTab === 'enrollment' ? 'Enrollment' : 'Authentication'}`}
          </button>
        </div>

        {/* Error Card */}
        {sessionError && (
          <div style={styles.errorCard}>
            <div style={{ fontWeight: 700, marginBottom: '6px' }}>Error</div>
            <div>{sessionError}</div>
          </div>
        )}

        {/* Result Card */}
        {sessionResult && (
          <div className="us-result-card us-card" style={styles.resultCard}>
            <div
              className="us-result-header"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '8px',
              }}
            >
              <div style={styles.cardTitle}>Verification Result</div>
              <span style={styles.decisionBadge(sessionResult.decision)}>
                {sessionResult.decision}
              </span>
            </div>

            <div className="us-meta-row" style={styles.metaRow}>
              <div style={styles.metaItem}>
                <span style={styles.metaLabel}>Session ID:</span>
                {sessionResult.session_id}
              </div>
              {sessionResult.identity_id && (
                <div style={styles.metaItem}>
                  <span style={styles.metaLabel}>Identity ID:</span>
                  {sessionResult.identity_id}
                </div>
              )}
              {sessionResult.timestamp && (
                <div style={styles.metaItem}>
                  <span style={styles.metaLabel}>Timestamp:</span>
                  {new Date(sessionResult.timestamp).toLocaleString()}
                </div>
              )}
            </div>

            <div className="us-score-row" style={styles.scoreRow}>
              <div className="us-score-pill" style={styles.scorePill}>
                <div style={styles.scoreLabel}>Channel Trust</div>
                <div className="us-score-value" style={styles.scoreValue}>
                  {formatScore(sessionResult.channel_trust_score)}
                </div>
                {sessionResult.pillar_verdicts?.channel_trust && (
                  <div style={{ fontSize: '0.72rem', fontFamily: "'JetBrains Mono', monospace", color: '#9E9A92', marginTop: '2px' }}>
                    {formatVerdict(sessionResult.pillar_verdicts.channel_trust)}
                  </div>
                )}
              </div>
              <div className="us-score-pill" style={styles.scorePill}>
                <div style={styles.scoreLabel}>Liveness</div>
                <div className="us-score-value" style={styles.scoreValue}>
                  {formatScore(sessionResult.liveness_score)}
                </div>
                {sessionResult.pillar_verdicts?.liveness && (
                  <div style={{ fontSize: '0.72rem', fontFamily: "'JetBrains Mono', monospace", color: '#9E9A92', marginTop: '2px' }}>
                    {formatVerdict(sessionResult.pillar_verdicts.liveness)}
                  </div>
                )}
              </div>
              <div className="us-score-pill" style={styles.scorePill}>
                <div style={styles.scoreLabel}>MatchSense Risk</div>
                <div className="us-score-value" style={styles.scoreValue}>
                  {formatScore(sessionResult.dedupe_risk_score != null ? 100 - sessionResult.dedupe_risk_score : undefined)}
                </div>
                {sessionResult.pillar_verdicts?.dedupe && (
                  <div style={{ fontSize: '0.72rem', fontFamily: "'JetBrains Mono', monospace", color: '#9E9A92', marginTop: '2px' }}>
                    {formatVerdict(sessionResult.pillar_verdicts.dedupe)}
                  </div>
                )}
              </div>
            </div>

            {Array.isArray(sessionResult.reasons) && sessionResult.reasons.length > 0 && (
              <div style={{ marginTop: '16px' }}>
                <div
                  style={{
                    fontSize: '0.58rem',
                    fontWeight: 700,
                    fontFamily: "'DM Sans', sans-serif",
                    color: '#9E9A92',
                    marginBottom: '6px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.14em',
                  }}
                >
                  Reasons
                </div>
                <ul
                  style={{
                    margin: 0,
                    paddingLeft: '18px',
                    fontSize: '0.82rem',
                    fontFamily: "'DM Sans', sans-serif",
                    color: '#6B6760',
                  }}
                >
                  {sessionResult.reasons.map((r, i) => (
                    <li key={i} style={{ marginBottom: '2px' }}>
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Debug Panel */}
        <div className="us-card" style={styles.card}>
          <div
            style={styles.debugToggle}
            onClick={() => setShowDebug(!showDebug)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') setShowDebug(!showDebug);
            }}
          >
            <span style={{ fontSize: '0.88rem', fontWeight: 600, fontFamily: "'DM Sans', sans-serif", color: '#6B6760' }}>
              Debug Logs ({debugLogs.length})
            </span>
            <span
              style={{
                fontSize: '12px',
                color: '#9E9A92',
                transform: showDebug ? 'rotate(180deg)' : 'none',
                transition: 'transform 150ms cubic-bezier(0.16, 1, 0.3, 1)',
                display: 'inline-block',
              }}
            >
              &#9660;
            </span>
          </div>
          {showDebug && (
            <div style={styles.debugPanel}>
              {debugLogs.length === 0 ? (
                <div style={{ color: '#6B6760' }}>
                  No events yet. Start a verification to see logs.
                </div>
              ) : (
                debugLogs.map((log, i) => (
                  <div key={i} style={styles.debugLine}>
                    {log}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </main>

      {/* Verification Overlay */}
      {activeFlow && sessionData && (
        <div style={styles.overlay}>
          <VerificationCaptureEngine
            sessionData={sessionData}
            environment={environment}
            anonKey={gatewayKey}
            apiBaseUrl={apiBaseUrl}
            primaryColor={primaryColor}
            logoUrl={logoUrl || undefined}
            sessionType={activeFlow}
            onComplete={(result) => {
              // Called immediately when the decision arrives (before user dismisses).
              // Store the result so it is ready to display once the overlay closes.
              if (result) setSessionResult(result);
              addLog(`Complete: ${result?.decision ?? 'unknown'}`);
            }}
            onCancel={() => {
              // Fired by the "Finish" button on the done screen and by the cancel
              // pill -- both route back to the main demo page.
              setActiveFlow(null);
              addLog('Verification closed by user');
            }}
            onError={(error) => {
              setSessionError(error);
              setActiveFlow(null);
              addLog(`Error: ${error}`);
            }}
            onPhaseChange={(phase: CapturePhase, label: string) => {
              addLog(`Phase: ${phase} - ${label}`);
            }}
          />
        </div>
      )}
    </div>
  );
}
