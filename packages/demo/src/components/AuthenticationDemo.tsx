'use client';

import { useState } from 'react';
import { createUseSenseClient, UseSenseVerification, FinalDecisionObject, UseSenseError } from '@usesense/web-sdk';

interface AuthenticationDemoProps {
  onEvent: (event: any) => void;
}

export function AuthenticationDemo({ onEvent }: AuthenticationDemoProps) {
  const [started, setStarted] = useState(false);
  const [identityId, setIdentityId] = useState('identity-demo-12345');
  const [primaryColor, setPrimaryColor] = useState('#4F63F5');
  const [result, setResult] = useState<FinalDecisionObject | null>(null);
  const [error, setError] = useState<UseSenseError | null>(null);

  const client = createUseSenseClient({
    apiBaseUrl: process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.usesense.ai/functions/v1/watchtower-api/api/v1',
    apiKey: process.env.NEXT_PUBLIC_API_KEY || 'sk_demo_mock_key',
    gatewayKey: process.env.NEXT_PUBLIC_GATEWAY_KEY,
    branding: {
      logoUrl: '/logo.svg',
      primaryColor,
      buttonRadius: 12,
    },
    options: {
      audioEnabled: 'risk_based',
      stepUpPolicy: 'risk_based',
      captureDurationMs: 2500,
      targetFps: 15,
      maxFrames: 40,
      webAuthnEnabled: true,
    },
  });

  const handleStart = () => {
    if (!identityId) {
      alert('Please enter an Identity ID');
      return;
    }
    setStarted(true);
    setResult(null);
    setError(null);
  };

  const handleComplete = (decision: FinalDecisionObject) => {
    setResult(decision);
    setStarted(false);
  };

  const handleError = (err: UseSenseError) => {
    setError(err);
    setStarted(false);
  };

  if (started) {
    return (
      <UseSenseVerification
        client={client}
        sessionType="authentication"
        identityId={identityId}
        metadata={{ demo: true, timestamp: Date.now() }}
        onEvent={onEvent}
        onComplete={handleComplete}
        onError={handleError}
      />
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h2 style={styles.cardTitle}>Authentication Flow</h2>
        <p style={styles.cardDescription}>
          Verify a returning user against their existing biometric template.
          Requires an Identity ID from a previous enrollment.
        </p>

        <div style={styles.form}>
          <div style={styles.formGroup}>
            <label style={styles.label}>Identity ID</label>
            <input
              type="text"
              value={identityId}
              onChange={(e) => setIdentityId(e.target.value)}
              style={styles.input}
              placeholder="identity-abc-123"
            />
            <p style={styles.hint}>
              The Identity ID returned from a successful enrollment
            </p>
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Primary Color</label>
            <div style={styles.colorInputGroup}>
              <input
                type="color"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                style={styles.colorInput}
              />
              <input
                type="text"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                style={styles.input}
                placeholder="#4F63F5"
              />
            </div>
          </div>
        </div>

        {result && (
          <div style={styles.result}>
            <div style={{
              ...styles.resultHeader,
              backgroundColor: result.decision === 'APPROVE' ? '#10B981' : '#EF4444'
            }}>
              {result.decision}
            </div>
            <div style={styles.resultBody}>
              <div style={styles.resultRow}>
                <span>Session ID:</span>
                <code style={styles.code}>{result.session_id}</code>
              </div>
              <div style={styles.resultRow}>
                <span>Identity ID:</span>
                <code style={styles.code}>{result.identity_id || 'N/A'}</code>
              </div>
              <div style={styles.resultRow}>
                <span>Trust Score:</span>
                <strong>{result.channel_trust_score}</strong>
              </div>
              <div style={styles.resultRow}>
                <span>Liveness Score:</span>
                <strong>{result.liveness_score}</strong>
              </div>
              <div style={styles.resultRow}>
                <span>Match Quality:</span>
                <strong>{100 - result.dedupe_risk_score}</strong>
              </div>
              {result.reasons && result.reasons.length > 0 && (
                <div style={styles.resultRow}>
                  <span>Reasons:</span>
                  <span>{result.reasons.join(', ')}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {error && (
          <div style={styles.error}>
            <strong>Error: {error.code}</strong>
            <p>{error.message}</p>
          </div>
        )}

        <button
          onClick={handleStart}
          style={styles.button}
        >
          Start Authentication
        </button>
      </div>

      <div style={styles.infoCard}>
        <h3 style={styles.infoTitle}>What happens during authentication?</h3>
        <ul style={styles.infoList}>
          <li>📹 Video frames captured from current session</li>
          <li>🔍 Compared against enrolled biometric template</li>
          <li>🎯 Liveness detection ensures user is present</li>
          <li>📊 Match score calculated (1:1 verification)</li>
          <li>🛡️ Risk-based step-up challenges if needed</li>
          <li>✅ Final decision: APPROVE, REJECT, or MANUAL_REVIEW</li>
        </ul>

        <h3 style={styles.infoTitle}>Use Cases</h3>
        <ul style={styles.infoList}>
          <li><strong>Account Login:</strong> Passwordless authentication</li>
          <li><strong>Transaction Approval:</strong> High-value payment verification</li>
          <li><strong>Step-Up Auth:</strong> Access sensitive data or features</li>
          <li><strong>Account Recovery:</strong> Verify identity without password</li>
        </ul>

        <h3 style={styles.infoTitle}>Decision Types</h3>
        <div style={styles.decisionList}>
          <div style={styles.decisionItem}>
            <div style={{ ...styles.decisionBadge, backgroundColor: '#10B981' }}>APPROVE</div>
            <p>User verified. Proceed with requested action.</p>
          </div>
          <div style={styles.decisionItem}>
            <div style={{ ...styles.decisionBadge, backgroundColor: '#EF4444' }}>REJECT</div>
            <p>Verification failed. Deny access or request alternative method.</p>
          </div>
          <div style={styles.decisionItem}>
            <div style={{ ...styles.decisionBadge, backgroundColor: '#F59E0B' }}>MANUAL_REVIEW</div>
            <p>Borderline scores. Queue for human review.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '32px',
    maxWidth: '1200px',
    margin: '0 auto',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: '12px',
    padding: '32px',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
  },
  cardTitle: {
    fontSize: '24px',
    fontWeight: '600',
    marginBottom: '8px',
    color: '#1A1A1A',
  },
  cardDescription: {
    fontSize: '14px',
    color: '#6B7280',
    marginBottom: '24px',
    lineHeight: '1.6',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
    marginBottom: '24px',
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  label: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#1A1A1A',
  },
  input: {
    padding: '10px 12px',
    border: '1px solid #E5E7EB',
    borderRadius: '8px',
    fontSize: '14px',
    color: '#1A1A1A',
    backgroundColor: '#FFFFFF',
  },
  colorInputGroup: {
    display: 'flex',
    gap: '8px',
  },
  colorInput: {
    width: '50px',
    height: '40px',
    border: '1px solid #E5E7EB',
    borderRadius: '8px',
    cursor: 'pointer',
  },
  hint: {
    fontSize: '12px',
    color: '#9CA3AF',
  },
  button: {
    backgroundColor: '#4F63F5',
    color: '#FFFFFF',
    padding: '14px 32px',
    borderRadius: '8px',
    border: 'none',
    fontSize: '16px',
    fontWeight: '500',
    cursor: 'pointer',
    width: '100%',
  },
  result: {
    marginBottom: '24px',
    border: '1px solid #E5E7EB',
    borderRadius: '8px',
    overflow: 'hidden',
  },
  resultHeader: {
    padding: '12px 16px',
    color: '#FFFFFF',
    fontWeight: '600',
    textAlign: 'center',
  },
  resultBody: {
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  resultRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '14px',
  },
  code: {
    backgroundColor: '#F3F4F6',
    padding: '2px 6px',
    borderRadius: '4px',
    fontSize: '12px',
    fontFamily: 'monospace',
  },
  error: {
    padding: '16px',
    backgroundColor: '#FEE2E2',
    border: '1px solid #FCA5A5',
    borderRadius: '8px',
    marginBottom: '24px',
    color: '#991B1B',
  },
  infoCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: '12px',
    padding: '32px',
  },
  infoTitle: {
    fontSize: '18px',
    fontWeight: '600',
    marginBottom: '16px',
    color: '#1A1A1A',
  },
  infoList: {
    listStylePosition: 'outside',
    paddingLeft: '24px',
    marginBottom: '24px',
    lineHeight: '2',
    color: '#4B5563',
  },
  decisionList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  decisionItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    fontSize: '14px',
  },
  decisionBadge: {
    padding: '4px 12px',
    borderRadius: '12px',
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: '12px',
    minWidth: '140px',
    textAlign: 'center',
  },
};