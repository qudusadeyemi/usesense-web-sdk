'use client';

import { useState, useCallback } from 'react';
import { VerificationCaptureEngine } from '@usesense/web-sdk';
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
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
    background: '#f8f9fa',
    color: '#1a1a2e',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 32px',
    background: '#ffffff',
    borderBottom: '1px solid #e2e8f0',
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  },
  headerTitle: {
    fontSize: '20px',
    fontWeight: 700,
    letterSpacing: '-0.3px',
  },
  headerBadge: {
    fontSize: '12px',
    fontWeight: 500,
    background: '#eef2ff',
    color: '#4f46e5',
    padding: '2px 8px',
    borderRadius: '4px',
    marginLeft: '10px',
  },
  modeToggleWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: '0',
    background: '#f1f5f9',
    borderRadius: '8px',
    padding: '3px',
  },
  modeBtn: (active: boolean): React.CSSProperties => ({
    padding: '6px 16px',
    border: 'none',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    background: active ? '#ffffff' : 'transparent',
    color: active ? '#1a1a2e' : '#64748b',
    boxShadow: active ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
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
    borderRadius: '24px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    background: active ? color : '#e2e8f0',
    color: active ? '#ffffff' : '#475569',
  }),
  card: {
    background: '#ffffff',
    borderRadius: '12px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
    padding: '28px',
    marginBottom: '20px',
  },
  cardTitle: {
    fontSize: '16px',
    fontWeight: 700,
    marginBottom: '20px',
    color: '#1a1a2e',
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
    fontSize: '13px',
    fontWeight: 600,
    color: '#475569',
    marginBottom: '6px',
  },
  input: {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    fontSize: '14px',
    outline: 'none',
    transition: 'border-color 0.15s ease',
    boxSizing: 'border-box' as const,
    background: '#ffffff',
    color: '#1a1a2e',
  },
  select: {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    fontSize: '14px',
    outline: 'none',
    background: '#ffffff',
    color: '#1a1a2e',
    cursor: 'pointer',
    boxSizing: 'border-box' as const,
  },
  colorField: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  colorSwatch: {
    width: '36px',
    height: '36px',
    borderRadius: '8px',
    border: '2px solid #e2e8f0',
    cursor: 'pointer',
    flexShrink: 0,
    padding: 0,
  } as React.CSSProperties,
  startBtn: (color: string, disabled: boolean): React.CSSProperties => ({
    display: 'block',
    width: '100%',
    padding: '14px 24px',
    border: 'none',
    borderRadius: '10px',
    fontSize: '15px',
    fontWeight: 700,
    cursor: disabled ? 'not-allowed' : 'pointer',
    background: disabled ? '#94a3b8' : color,
    color: '#ffffff',
    transition: 'all 0.15s ease',
    opacity: disabled ? 0.7 : 1,
    marginTop: '8px',
  }),
  mockNotice: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
    padding: '12px 16px',
    background: '#fefce8',
    border: '1px solid #fde68a',
    borderRadius: '8px',
    fontSize: '13px',
    color: '#92400e',
    marginBottom: '20px',
    lineHeight: '1.5',
  },
  resultCard: {
    background: '#ffffff',
    borderRadius: '12px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
    padding: '28px',
    marginBottom: '20px',
  },
  decisionBadge: (decision: string): React.CSSProperties => {
    const map: Record<string, { bg: string; color: string }> = {
      APPROVE: { bg: '#dcfce7', color: '#166534' },
      REJECT: { bg: '#fee2e2', color: '#991b1b' },
      MANUAL_REVIEW: { bg: '#fef9c3', color: '#854d0e' },
    };
    const s = map[decision] || map.MANUAL_REVIEW;
    return {
      display: 'inline-block',
      padding: '4px 14px',
      borderRadius: '6px',
      fontSize: '13px',
      fontWeight: 700,
      background: s.bg,
      color: s.color,
      letterSpacing: '0.5px',
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
    background: '#f8fafc',
    borderRadius: '8px',
    textAlign: 'center' as const,
  },
  scoreLabel: {
    fontSize: '11px',
    fontWeight: 600,
    color: '#64748b',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  },
  scoreValue: {
    fontSize: '22px',
    fontWeight: 700,
    color: '#1a1a2e',
    marginTop: '4px',
  },
  errorCard: {
    background: '#fff1f2',
    border: '1px solid #fecdd3',
    borderRadius: '12px',
    padding: '20px 24px',
    marginBottom: '20px',
    color: '#9f1239',
    fontSize: '14px',
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
    background: '#1e293b',
    borderRadius: '8px',
    padding: '16px',
    maxHeight: '260px',
    overflowY: 'auto' as const,
    fontFamily: "'SF Mono', 'Fira Code', monospace",
    fontSize: '12px',
    lineHeight: '1.7',
  },
  debugLine: {
    color: '#94a3b8',
    whiteSpace: 'pre-wrap' as const,
    wordBreak: 'break-all' as const,
  },
  overlay: {
    position: 'fixed' as const,
    inset: 0,
    zIndex: 50,
    background: '#000000',
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
    border: '1px solid rgba(255,255,255,0.2)',
    borderRadius: '50%',
    color: '#ffffff',
    fontSize: '20px',
    cursor: 'pointer',
    transition: 'background 0.15s ease',
  },
  metaRow: {
    display: 'flex',
    gap: '24px',
    marginTop: '12px',
    flexWrap: 'wrap' as const,
  },
  metaItem: {
    fontSize: '13px',
    color: '#475569',
  },
  metaLabel: {
    fontWeight: 600,
    color: '#64748b',
    marginRight: '4px',
  },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function DemoPage() {
  const [mode, setMode] = useState<'mock' | 'live'>('mock');
  const [activeFlow, setActiveFlow] = useState<'enrollment' | 'authentication' | null>(null);
  const [activeTab, setActiveTab] = useState<'enrollment' | 'authentication'>('enrollment');
  const [apiKey, setApiKey] = useState('');
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.usesense.ai/functions/v1/watchtower-api';
  const gatewayKey = process.env.NEXT_PUBLIC_GATEWAY_KEY || '';
  const [environment, setEnvironment] = useState<'sandbox' | 'production'>('sandbox');
  const [externalUserId, setExternalUserId] = useState('demo-user-' + Date.now());
  const [identityId, setIdentityId] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#4f46e5');
  const [logoUrl, setLogoUrl] = useState('');
  const [sessionResult, setSessionResult] = useState<CaptureResult | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);
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
          external_user_id: externalUserId,
        };
        if (flow === 'authentication' && identityId) {
          body.identity_id = identityId;
        }

        const res = await fetch(`${apiBaseUrl}/v1/sessions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
            apikey: gatewayKey,
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

  const formatScore = (score: number | undefined) =>
    score !== undefined ? (score * 100).toFixed(1) + '%' : '--';

  return (
    <div style={styles.page}>
      {/* Header */}
      <header style={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <span style={styles.headerTitle}>UseSense Web SDK Demo</span>
          <span style={styles.headerBadge}>v2.0.0</span>
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
      <main style={styles.content}>
        {/* Tabs */}
        <div style={styles.tabs}>
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
          <div style={styles.mockNotice}>
            <span style={{ flexShrink: 0, fontSize: '16px' }}>!</span>
            <span>
              <strong>Mock Mode:</strong> The SDK will run with simulated session
              data. Since there is no real server backing the session, the upload
              and completion steps will fail with an expected error. This is
              useful for testing the capture UI and challenge flows locally.
            </span>
          </div>
        )}

        {/* Configuration Card */}
        <div style={styles.card}>
          <div style={styles.cardTitle}>Configuration</div>
          <div style={styles.fieldGrid}>
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

            {/* Environment */}
            <div>
              <label style={styles.label}>Environment</label>
              <select
                style={styles.select}
                value={environment}
                onChange={(e) =>
                  setEnvironment(e.target.value as 'sandbox' | 'production')
                }
              >
                <option value="sandbox">Sandbox</option>
                <option value="production">Production</option>
              </select>
            </div>

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
          <div style={styles.resultCard}>
            <div
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

            <div style={styles.metaRow}>
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

            <div style={styles.scoreRow}>
              <div style={styles.scorePill}>
                <div style={styles.scoreLabel}>Channel Trust</div>
                <div style={styles.scoreValue}>
                  {formatScore(sessionResult.channel_trust_score)}
                </div>
                {sessionResult.pillar_verdicts?.channel_trust && (
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                    {sessionResult.pillar_verdicts.channel_trust}
                  </div>
                )}
              </div>
              <div style={styles.scorePill}>
                <div style={styles.scoreLabel}>Liveness</div>
                <div style={styles.scoreValue}>
                  {formatScore(sessionResult.liveness_score)}
                </div>
                {sessionResult.pillar_verdicts?.liveness && (
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                    {sessionResult.pillar_verdicts.liveness}
                  </div>
                )}
              </div>
              <div style={styles.scorePill}>
                <div style={styles.scoreLabel}>Dedupe Risk</div>
                <div style={styles.scoreValue}>
                  {formatScore(sessionResult.dedupe_risk_score)}
                </div>
                {sessionResult.pillar_verdicts?.dedupe && (
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                    {sessionResult.pillar_verdicts.dedupe}
                  </div>
                )}
              </div>
            </div>

            {sessionResult.reasons && sessionResult.reasons.length > 0 && (
              <div style={{ marginTop: '16px' }}>
                <div
                  style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#64748b',
                    marginBottom: '6px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}
                >
                  Reasons
                </div>
                <ul
                  style={{
                    margin: 0,
                    paddingLeft: '18px',
                    fontSize: '13px',
                    color: '#475569',
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
        <div style={styles.card}>
          <div
            style={styles.debugToggle}
            onClick={() => setShowDebug(!showDebug)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') setShowDebug(!showDebug);
            }}
          >
            <span style={{ fontSize: '14px', fontWeight: 600, color: '#475569' }}>
              Debug Logs ({debugLogs.length})
            </span>
            <span
              style={{
                fontSize: '12px',
                color: '#94a3b8',
                transform: showDebug ? 'rotate(180deg)' : 'none',
                transition: 'transform 0.15s ease',
                display: 'inline-block',
              }}
            >
              &#9660;
            </span>
          </div>
          {showDebug && (
            <div style={styles.debugPanel}>
              {debugLogs.length === 0 ? (
                <div style={{ color: '#64748b' }}>
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
          <button
            style={styles.closeBtn}
            onClick={() => {
              setActiveFlow(null);
              addLog('Verification closed by user');
            }}
            aria-label="Close verification"
          >
            &#10005;
          </button>
          <VerificationCaptureEngine
            sessionData={sessionData}
            environment={environment}
            anonKey={gatewayKey}
            apiBaseUrl={apiBaseUrl}
            primaryColor={primaryColor}
            logoUrl={logoUrl || undefined}
            sessionType={activeFlow}
            onComplete={(result) => {
              setSessionResult(result);
              setActiveFlow(null);
              addLog(`Complete: ${result.decision}`);
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
