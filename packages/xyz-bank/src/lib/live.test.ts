// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { normaliseDecision, packHandoff, pillarState, plainError, unpackHandoff } from './live';

describe('live helpers', () => {
  it('normalises decisions from the API', () => {
    expect(normaliseDecision('APPROVE')).toBe('let');
    expect(normaliseDecision('REJECT')).toBe('stop');
    expect(normaliseDecision('MANUAL_REVIEW')).toBe('review');
    expect(normaliseDecision(null)).toBe('pending');
  });

  it('reads pillar verdicts as strings or objects', () => {
    expect(pillarState('pass')).toBe('pass');
    expect(pillarState({ verdict: 'FAIL' })).toBe('fail');
    expect(pillarState(undefined)).toBe('skip');
  });

  it('says what to do on common errors', () => {
    expect(plainError(401)).toMatch(/API keys/);
    expect(plainError(402)).toMatch(/credits/);
  });

  it('round-trips a hand-off payload, small enough for a QR code, without the API key', async () => {
    const s = {
      session_id: 'ses_123', session_token: 'tok_abc', nonce: 'n', environment: 'sandbox',
      policy: { liveness: { challenges: ['passive', 'head_turn'], frames: 30, thresholds: { a: 0.5, b: 0.7, c: 0.9 } } },
      upload: { max_frames: 30, max_frame_bytes: 200000, accepted: ['image/jpeg'], url: 'https://api.usesense.ai/v1/sessions/ses_123/signals' },
      evidence: { contract: 'EVIDENCE-v1', clock: 'capture', fields: Array.from({ length: 40 }, (_, i) => `field_${i}`) },
    } as never;
    const packed = await packHandoff(s, 'https://api.usesense.ai', { name: 'XYZ Bank', color: '#0F5C4A' });
    expect(packed.length).toBeLessThan(1800);
    expect(packed).not.toContain('sk_');
    const back = await unpackHandoff(packed);
    expect(back?.s.session_id).toBe('ses_123');
    expect(back?.n).toBe('XYZ Bank');
    expect(await unpackHandoff('zgarbage')).toBeNull();
    expect(back?.lg).toBeUndefined();
    // A logo too big for the link travels as a flag; the phone fetches it.
    const flagged = await unpackHandoff(await packHandoff(s, 'https://api.usesense.ai', { name: 'XYZ Bank', color: '#0F5C4A', fetchLogo: true }));
    expect(flagged?.lg).toBe(1);
  });
});
