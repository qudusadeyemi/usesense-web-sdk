import React from 'react';

interface IntroScreenProps {
  sessionType: 'enrollment' | 'authentication';
  environment?: 'sandbox' | 'production';
  logoUrl?: string;
  onStart: () => void;
  loading?: boolean;
}

export const IntroScreen: React.FC<IntroScreenProps> = ({
  sessionType,
  environment,
  logoUrl,
  onStart,
  loading = false,
}) => {
  const isEnrollment = sessionType === 'enrollment';

  const title = isEnrollment ? 'Identity Enrollment' : 'Identity Verification';
  const subtitle = isEnrollment
    ? 'Complete a quick biometric check to enroll your identity. You will need to allow camera access and follow the on-screen prompts.'
    : 'Complete a quick biometric check to verify your identity. You will need to allow camera access and follow the on-screen prompts.';
  const buttonLabel = isEnrollment ? 'Start Enrollment' : 'Start Verification';

  const steps = isEnrollment
    ? [
        'Camera access will be requested',
        'Position your face in the guide oval',
        'Follow prompts -- you may be asked to turn your head or follow a dot',
      ]
    : [
        'Camera access will be requested',
        'Position your face in the guide oval',
        'Follow prompts -- you may be asked to turn your head or follow a dot',
      ];

  const envLabel = environment === 'production' ? 'Production' : 'Sandbox';

  return (
    <div className="usesense-screen">
      {logoUrl && (
        <img
          src={logoUrl}
          alt="Logo"
          style={{ height: '40px', marginBottom: '32px' }}
        />
      )}

      <h1 className="usesense-title" style={{ fontSize: '24px', fontWeight: 700, marginBottom: '12px' }}>
        {title}
      </h1>
      <p className="usesense-subtitle" style={{ marginBottom: '28px' }}>
        {subtitle}
      </p>

      {/* Camera icon */}
      <div style={{ marginBottom: '28px', display: 'flex', justifyContent: 'center' }}>
        <div
          style={{
            width: '88px',
            height: '88px',
            borderRadius: '50%',
            backgroundColor: 'rgba(79, 99, 245, 0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg
            width="40"
            height="40"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ color: 'var(--usesense-primary)' }}
          >
            <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
            <circle cx="12" cy="13" r="3" />
          </svg>
        </div>
      </div>

      {/* What to expect */}
      <div
        style={{
          backgroundColor: '#F8F9FA',
          border: '1px solid #E5E7EB',
          borderRadius: '12px',
          padding: '16px 20px',
          marginBottom: '20px',
          textAlign: 'left',
        }}
      >
        <p style={{ fontSize: '14px', fontWeight: 600, color: '#1A1A1A', marginBottom: '10px' }}>
          What to expect:
        </p>
        <ol style={{ margin: 0, padding: 0, listStyle: 'none' }}>
          {steps.map((step, i) => (
            <li
              key={i}
              style={{
                display: 'flex',
                gap: '10px',
                fontSize: '14px',
                color: '#6B7280',
                marginBottom: i < steps.length - 1 ? '8px' : 0,
                lineHeight: '1.5',
              }}
            >
              <span style={{ color: '#9CA3AF', flexShrink: 0, minWidth: '16px' }}>{i + 1}.</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </div>

      {/* Trust badges */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px',
          fontSize: '12px',
          color: '#9CA3AF',
          marginBottom: '24px',
        }}
      >
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
        <span>End-to-end encrypted &middot; Three-pillar verification &middot; {envLabel}</span>
      </div>

      {/* CTA */}
      <button
        className="usesense-button"
        onClick={onStart}
        disabled={loading}
        style={{ opacity: loading ? 0.7 : 1 }}
      >
        {loading ? (
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
            <span
              style={{
                display: 'inline-block',
                width: '16px',
                height: '16px',
                border: '2px solid rgba(255,255,255,0.4)',
                borderTopColor: 'white',
                borderRadius: '50%',
                animation: 'usesense-spin 0.8s linear infinite',
              }}
            />
            Starting...
          </span>
        ) : (
          buttonLabel
        )}
      </button>
    </div>
  );
};
