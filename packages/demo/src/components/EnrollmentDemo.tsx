'use client';

import { useState } from 'react';
import { createUseSenseClient, UseSenseVerification, FinalDecisionObject, UseSenseError } from '@usesense/web-sdk';

interface EnrollmentDemoProps {
  onEvent: (event: any) => void;
}

export function EnrollmentDemo({ onEvent }: EnrollmentDemoProps) {
  const [started, setStarted] = useState(false);
  const [externalUserId, setExternalUserId] = useState('demo-user-' + Date.now());
  const [primaryColor, setPrimaryColor] = useState('#4F63F5');
  const [audioEnabled, setAudioEnabled] = useState<'never' | 'risk_based' | 'always'>('risk_based');
  const [webAuthnEnabled, setWebAuthnEnabled] = useState(false);
  const [result, setResult] = useState<FinalDecisionObject | null>(null);
  const [error, setError] = useState<UseSenseError | null>(null);

  const client = createUseSenseClient({
    apiBaseUrl: process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.usesense.ai/functions/v1/watchtower-api/api/v1',
    apiKey: process.env.NEXT_PUBLIC_API_KEY || 'sk_demo_mock_key',
    branding: {
      logoUrl: '/logo.svg',
      primaryColor,
      buttonRadius: 12,
    },
    options: {
      audioEnabled,
      stepUpPolicy: 'risk_based',
      captureDurationMs: 2500,
      targetFps: 15,
      maxFrames: 40,
      webAuthnEnabled,
    },
  });

  const handleStart = () => {
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
    console.log('[EnrollmentDemo] Rendering UseSenseVerification component', { externalUserId, client });
    return (
      <div style={{ width: '100%', minHeight: '600px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <UseSenseVerification
          client={client}
          sessionType="enrollment"
          externalUserId={externalUserId}
          metadata={{ demo: true, timestamp: Date.now() }}
          onEvent={onEvent}
          onComplete={handleComplete}
          onError={handleError}
        />
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h2 style={styles.cardTitle}>Enrollment Flow</h2>
        <p style={styles.cardDescription}>
          First-time identity capture and registration. This creates a new biometric template
          for the user in the UseSense system.
        </p>

        <div style={styles.form}>
          <div style={styles.formGroup}>
            <label style={styles.label}>External User ID</label>
            <input
              type="text"
              value={externalUserId}
              onChange={(e) => setExternalUserId(e.target.value)}
              style={styles.input}
              placeholder="your-internal-user-id"
            />
            <p style={styles.hint}>Your application's user identifier</p>
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

          <div style={styles.formGroup}>
            <label style={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={webAuthnEnabled}
                onChange={(e) => setWebAuthnEnabled(e.target.checked)}
                style={styles.checkbox}
              />
              Enable WebAuthn Binding
            </label>
            <p style={styles.hint}>Binds verification to this device (Touch ID, Face ID, Windows Hello). Makes session replay attacks harder by requiring the same physical device.</p>

          <div style={{ marginTop: '12px' }}>
            <label style={styles.label}>Audio Mode</label>
            <select
              value={audioEnabled}
              onChange={(e) => setAudioEnabled(e.target.value as 'never' | 'risk_based' | 'always')}
              style={styles.select}
            >
              <option value="never">Never</option>
              <option value="risk_based">Risk-Based</option>
              <option value="always">Always</option>
            </select>
            <p style={styles.hint}>
              <strong>Never:</strong> No audio. <strong>Risk-Based:</strong> Backend decides (speak phrase needs this). <strong>Always:</strong> Ambient audio always captured.
            </p>
          </div>
        </div>

        {result && (
          <div style={styles.result}>
            <div style={{
              ...styles.resultHeader,
              backgroundColor: result.decision === 'APPROVE' ? '#10B981' : result.decision === 'MANUAL_REVIEW' ? '#F59E0B' : '#EF4444'
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
                <span>Dedupe Risk:</span>
                <strong>{result.dedupe_risk_score}</strong>
              </div>
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
          Start Enrollment
        </button>
      </div>

      <div style={styles.infoCard}>
        <h3 style={styles.infoTitle}>What happens during enrollment?</h3>
        <ul style={styles.infoList}>
          <li>📹 Video frames captured (15 FPS for 2.5 seconds)</li>
          <li>🔊 Optional audio snippet recorded</li>
          <li>🌐 Web integrity signals collected (browser fingerprint)</li>
          <li>🔐 Optional WebAuthn credential created</li>
          <li>🚀 All data uploaded to UseSense for processing</li>
          <li>✅ Backend evaluates liveness, dedupe, and channel trust</li>
          <li>🎯 Returns final decision with scores</li>
        </ul>

        <h3 style={styles.infoTitle}>Integration Note</h3>
        <p style={styles.infoText}>
          This demo uses mock backend responses. In production, configure your API endpoint
          and tenant key via environment variables:
        </p>
        <pre style={styles.codeBlock}>
{`NEXT_PUBLIC_API_BASE_URL=https://api.usesense.ai/functions/v1/watchtower-api/api/v1
NEXT_PUBLIC_API_KEY=sk_your_sandbox_key_here`}
        </pre>
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
  select: {
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
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '14px',
    cursor: 'pointer',
  },
  checkbox: {
    width: '18px',
    height: '18px',
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
  infoText: {
    fontSize: '14px',
    color: '#6B7280',
    lineHeight: '1.6',
    marginBottom: '12px',
  },
  codeBlock: {
    backgroundColor: '#1F2937',
    color: '#F9FAFB',
    padding: '16px',
    borderRadius: '8px',
    fontSize: '13px',
    fontFamily: 'monospace',
    overflow: 'auto',
  },
};