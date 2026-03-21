import React from 'react';
import { FinalDecisionObject } from '../../types';

interface SuccessScreenProps {
  decision: FinalDecisionObject;
  onContinue: () => void;
  logoUrl?: string;
}

export const SuccessScreen: React.FC<SuccessScreenProps> = ({ decision, onContinue, logoUrl }) => {
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

      <div className="usesense-success-icon" style={isManualReview ? { color: '#F59E0B' } : undefined}>
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
              <path d="m9 12 2 2 4-4" />
            </>
          )}
        </svg>
      </div>

      <h1 className="usesense-title">
        {isManualReview ? 'Under Review' : "You're verified"}
      </h1>
      <p className="usesense-subtitle">
        {isManualReview
          ? 'Your verification is pending review. You will be notified of the outcome.'
          : 'Your identity has been confirmed'
        }
      </p>

      {/* Security-sensitive check details removed — do not expose reasons/scores to the client */}

      <button
        className="usesense-button"
        onClick={onContinue}
        style={{ marginTop: '24px' }}
      >
        Continue
      </button>
    </div>
  );
};