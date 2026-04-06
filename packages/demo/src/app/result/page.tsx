'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

// ---------------------------------------------------------------------------
// Types (subset of CaptureResult -- only what we display)
// ---------------------------------------------------------------------------

interface ResultData {
  decision: string;
  channel_trust_score?: number;
  liveness_score?: number;
  dedupe_risk_score?: number;
  session_type?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'usesense_result';

const VERDICT_CONFIG: Record<string, {
  label: string;
  description: string;
  iconBg: string;
  iconColor: string;
  icon: 'check' | 'x' | 'review';
}> = {
  APPROVE: {
    label: 'Verified',
    description: 'Your identity has been successfully verified. You are confirmed as a real, unique human.',
    iconBg: 'rgba(0,212,170,0.08)',
    iconColor: '#00D4AA',
    icon: 'check',
  },
  REJECT: {
    label: 'Not Verified',
    description: 'We were unable to verify your identity in this session. This can happen due to lighting, camera quality, or other environmental factors.',
    iconBg: 'rgba(255,107,74,0.08)',
    iconColor: '#FF6B4A',
    icon: 'x',
  },
  MANUAL_REVIEW: {
    label: 'Under Review',
    description: 'Your session requires additional review. This is normal and does not indicate a problem.',
    iconBg: 'rgba(255,184,77,0.08)',
    iconColor: '#FFB84D',
    icon: 'review',
  },
};

const PILLAR_CONFIG = [
  { key: 'channel_trust_score' as const, label: 'DeepSense', sublabel: 'Channel Trust', color: '#4F7CFF', invert: false },
  { key: 'liveness_score' as const, label: 'LiveSense', sublabel: 'Liveness', color: '#7C5CFC', invert: false },
  { key: 'dedupe_risk_score' as const, label: 'MatchSense', sublabel: 'Uniqueness', color: '#00D4AA', invert: true },
];

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

function CheckIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  );
}

function ReviewIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

const ICONS = { check: CheckIcon, x: XIcon, review: ReviewIcon };

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ResultPage() {
  const router = useRouter();
  const [result, setResult] = useState<ResultData | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        setResult(JSON.parse(raw));
      } catch {
        // malformed data -- fall through to redirect
      }
    }
    setLoaded(true);
  }, []);

  // Redirect to /verify if no result data
  useEffect(() => {
    if (loaded && !result) {
      router.replace('/verify');
    }
  }, [loaded, result, router]);

  if (!loaded || !result) {
    return (
      <div style={s.page}>
        <div style={{ textAlign: 'center' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="UseSense" style={{ height: 40 }} />
        </div>
      </div>
    );
  }

  const verdict = VERDICT_CONFIG[result.decision] || VERDICT_CONFIG.MANUAL_REVIEW;
  const Icon = ICONS[verdict.icon];
  const formatScore = (v: number | undefined, invert?: boolean) =>
    v !== undefined ? (invert ? (100 - v).toFixed(1) : v.toFixed(1)) + '%' : '--';

  return (
    <div style={s.page}>
      <div style={s.container}>
        {/* Logo */}
        <div style={s.logoWrap}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="UseSense" style={{ height: 40 }} />
        </div>

        {/* Verdict Card */}
        <div className="us-card" style={s.card}>
          {/* Icon */}
          <div style={{ ...s.iconCircle, background: verdict.iconBg, color: verdict.iconColor }}>
            <Icon />
          </div>

          {/* Title */}
          <h1 style={s.title}>{verdict.label}</h1>
          <p style={s.description}>{verdict.description}</p>

          {/* Pillar Scores */}
          <div className="us-score-row" style={s.scoreRow}>
            {PILLAR_CONFIG.map((pillar) => (
              <div key={pillar.key} className="us-score-pill" style={s.scorePill}>
                <div style={{ ...s.pillarLabel, color: pillar.color }}>{pillar.label}</div>
                <div style={s.pillarSublabel}>{pillar.sublabel}</div>
                <div className="us-score-value" style={s.scoreValue}>
                  {formatScore(result[pillar.key], pillar.invert)}
                </div>
              </div>
            ))}
          </div>

          {/* CTAs */}
          <div style={s.ctaGroup}>
            <a href="https://watchtower.usesense.ai/signup" style={s.primaryBtn}>
              Sign Up
            </a>
            <a href="https://usesense.ai" style={s.secondaryBtn}>
              Back to Website
            </a>
          </div>
        </div>

        {/* Footer */}
        <div style={s.footer}>
          <span style={{ whiteSpace: 'nowrap' }}>UseSense</span> &middot; Human presence infrastructure for the AI era.
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const s = {
  page: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    fontFamily: "'DM Sans', sans-serif",
    background: '#FDFCFA',
    color: '#1C1A17',
    padding: '40px 16px',
  },
  container: {
    width: '100%',
    maxWidth: '480px',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
  },
  logoWrap: {
    marginBottom: '32px',
  },
  card: {
    width: '100%',
    background: '#FFFFFF',
    borderRadius: '20px',
    border: '1px solid #E8E5DE',
    boxShadow: '0 4px 12px rgba(0,0,0,0.07)',
    padding: '40px 32px',
    textAlign: 'center' as const,
  },
  iconCircle: {
    width: '80px',
    height: '80px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 24px',
  },
  title: {
    fontSize: '1.6rem',
    fontWeight: 800,
    fontFamily: "'Outfit', sans-serif",
    letterSpacing: '-0.03em',
    lineHeight: 1.15,
    marginBottom: '8px',
  },
  description: {
    fontSize: '0.88rem',
    fontFamily: "'DM Sans', sans-serif",
    color: '#6B6760',
    lineHeight: '1.65',
    maxWidth: '360px',
    margin: '0 auto 32px',
  },
  scoreRow: {
    display: 'flex',
    gap: '12px',
    marginBottom: '32px',
    width: '100%',
  },
  scorePill: {
    flex: '1 1 0',
    padding: '16px 12px',
    background: '#F5F3EF',
    borderRadius: '14px',
    textAlign: 'center' as const,
  },
  pillarLabel: {
    fontSize: '0.58rem',
    fontWeight: 700,
    fontFamily: "'JetBrains Mono', monospace",
    textTransform: 'uppercase' as const,
    letterSpacing: '0.14em',
    marginBottom: '2px',
  },
  pillarSublabel: {
    fontSize: '0.65rem',
    fontFamily: "'DM Sans', sans-serif",
    color: '#9E9A92',
    marginBottom: '8px',
  },
  scoreValue: {
    fontSize: '1.6rem',
    fontWeight: 700,
    fontFamily: "'Outfit', sans-serif",
    letterSpacing: '-0.03em',
    color: '#1C1A17',
  },
  ctaGroup: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px',
    width: '100%',
  },
  primaryBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '52px',
    padding: '0 32px',
    border: 'none',
    borderRadius: '14px',
    fontSize: '1rem',
    fontWeight: 600,
    fontFamily: "'DM Sans', sans-serif",
    background: '#4F7CFF',
    color: '#FFFFFF',
    textDecoration: 'none',
    transition: 'all 150ms cubic-bezier(0.16, 1, 0.3, 1)',
    cursor: 'pointer',
  } as React.CSSProperties,
  secondaryBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '44px',
    padding: '0 24px',
    borderRadius: '10px',
    fontSize: '0.88rem',
    fontWeight: 600,
    fontFamily: "'DM Sans', sans-serif",
    background: '#FFFFFF',
    color: '#1C1A17',
    border: '1px solid #E8E5DE',
    textDecoration: 'none',
    transition: 'all 150ms cubic-bezier(0.16, 1, 0.3, 1)',
    cursor: 'pointer',
  } as React.CSSProperties,
  footer: {
    marginTop: '32px',
    fontSize: '0.75rem',
    fontFamily: "'DM Sans', sans-serif",
    color: '#9E9A92',
    textAlign: 'center' as const,
  },
};
