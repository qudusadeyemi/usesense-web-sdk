import React from 'react';
import { FinalDecisionObject } from '../../types';

interface DeniedScreenProps {
  decision: FinalDecisionObject;
  onContinue: () => void;
  logoUrl?: string;
}

export const DeniedScreen: React.FC<DeniedScreenProps> = ({ decision, onContinue, logoUrl }) => {
  const isManualReview = decision.decision === 'MANUAL_REVIEW';

  return (
    <div className="usesense-screen">
      {logoUrl && (
        <img
          src={logoUrl}
          alt="Logo"
          style={{ height: '40px', marginBottom: '32px' }}
        />
      )}

      <div className={isManualReview ? 'usesense-success-icon' : 'usesense-error-icon'} style={isManualReview ? { color: '#F59E0B' } : undefined}>
        <svg
          width="64"
          height="64"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {isManualReview ? (
            <>
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </>
          ) : (
            <>
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </>
          )}
        </svg>
      </div>

      <h1 className="usesense-title">
        {isManualReview ? 'Under Review' : 'Verification Denied'}
      </h1>
      <p className="usesense-subtitle">
        {isManualReview
          ? 'Your verification is being reviewed. You will be notified of the outcome.'
          : "We couldn't verify your identity. This may be due to security concerns detected during verification."
        }
      </p>

      {/* Security-sensitive check details removed — do not expose reasons, scores, or pillar data to the client */}

      <button
        className="usesense-button"
        onClick={onContinue}
        style={{ marginTop: '24px' }}
      >
        Continue
      </button>

      <p style={{
        marginTop: '16px',
        fontSize: '12px',
        color: '#94a3b8',
        lineHeight: '1.5',
      }}>
        {isManualReview
          ? 'A review case has been created. You will receive an update once the review is complete.'
          : 'If you believe this is an error, please contact support.'
        }
      </p>
    </div>
  );
};