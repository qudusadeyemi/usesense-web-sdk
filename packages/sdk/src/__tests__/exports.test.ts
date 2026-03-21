import { describe, it, expect } from 'vitest';
import * as SDK from '../index';

describe('@usesense/web-sdk exports', () => {
  it('exports createUseSenseClient', () => {
    expect(SDK.createUseSenseClient).toBeDefined();
    expect(typeof SDK.createUseSenseClient).toBe('function');
  });

  it('exports UseSenseVerification component', () => {
    expect(SDK.UseSenseVerification).toBeDefined();
  });

  it('exports QualityIndicator component', () => {
    expect(SDK.QualityIndicator).toBeDefined();
  });

  it('exports ImageQualityAnalyzer', () => {
    expect(SDK.ImageQualityAnalyzer).toBeDefined();
  });

  it('exports isWebAuthnSupported', () => {
    expect(SDK.isWebAuthnSupported).toBeDefined();
    expect(typeof SDK.isWebAuthnSupported).toBe('function');
  });

  it('exports error utilities', () => {
    expect(SDK.createError).toBeDefined();
    expect(SDK.getUserMessage).toBeDefined();
  });

  it('exports redactDecision utility', () => {
    expect(SDK.redactDecision).toBeDefined();
    expect(typeof SDK.redactDecision).toBe('function');
  });
});

describe('redactDecision', () => {
  it('strips sensitive scoring from decision', () => {
    const fullDecision = {
      session_id: 'sess_123',
      organization_id: 'org_456',
      session_type: 'enrollment' as const,
      identity_id: 'ident_789',
      decision: 'APPROVE' as const,
      matrix_decision: 'APPROVE' as const,
      rule_applied: 'default',
      channel_trust_score: 95,
      liveness_score: 92,
      dedupe_risk_score: 5,
      pillar_verdicts: {
        deepsense: { score: 95, verdict: 'pass' as const },
        livesense: { score: 92, verdict: 'pass' as const },
        dedupe: { score: 95, verdict: 'pass' as const },
      },
      verdict_metadata: { source: 'default', logic: 'weakest_link' as const, hardGateTripped: false },
      reasons: ['All passed'],
      timestamp: '2026-01-01T00:00:00Z',
      signature: 'sha256:abc123',
      debug: {},
      integrity_flags: [],
    };

    const redacted = SDK.redactDecision(fullDecision);

    expect(redacted.session_id).toBe('sess_123');
    expect(redacted.decision).toBe('APPROVE');
    expect(redacted.session_type).toBe('enrollment');
    expect(redacted.identity_id).toBe('ident_789');
    expect(redacted.timestamp).toBe('2026-01-01T00:00:00Z');

    // Sensitive fields should NOT be present
    expect((redacted as any).channel_trust_score).toBeUndefined();
    expect((redacted as any).liveness_score).toBeUndefined();
    expect((redacted as any).dedupe_risk_score).toBeUndefined();
    expect((redacted as any).pillar_verdicts).toBeUndefined();
    expect((redacted as any).signature).toBeUndefined();
  });
});

describe('createError', () => {
  it('creates a UseSenseError with code and message', () => {
    const error = SDK.createError('NETWORK_ERROR', 'Connection failed');
    expect(error.code).toBe('NETWORK_ERROR');
    expect(error.message).toBe('Connection failed');
    expect(error.name).toBe('UseSenseError');
  });
});

describe('getUserMessage', () => {
  it('returns user-friendly message for known error codes', () => {
    const error = SDK.createError('CAMERA_PERMISSION_DENIED', 'Camera denied');
    const message = SDK.getUserMessage(error);
    expect(message).toContain('camera');
  });
});
