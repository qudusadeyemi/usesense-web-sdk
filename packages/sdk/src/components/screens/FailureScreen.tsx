import React from 'react';
import { UseSenseError } from '../../types';
import { getUserMessage } from '../../utils/errors';

interface FailureScreenProps {
  error: UseSenseError;
  onRetry: () => void;
  logoUrl?: string;
}

export const FailureScreen: React.FC<FailureScreenProps> = ({ error, onRetry, logoUrl }) => {
  return (
    <div className="usesense-screen">
      {logoUrl && (
        <img
          src={logoUrl}
          alt="Logo"
          style={{ height: '40px', marginBottom: '32px' }}
        />
      )}

      <div className="usesense-error-icon">
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
          <circle cx="12" cy="12" r="10" />
          <line x1="12" x2="12" y1="8" y2="12" />
          <line x1="12" x2="12.01" y1="16" y2="16" />
        </svg>
      </div>

      <h1 className="usesense-title">We couldn't verify you</h1>
      <p className="usesense-subtitle">
        {getUserMessage(error)}
      </p>

      <button
        className="usesense-button"
        onClick={onRetry}
      >
        Try again
      </button>
    </div>
  );
};
