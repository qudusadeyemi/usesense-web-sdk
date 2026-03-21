import React from 'react';

interface BlockedScreenProps {
  message?: string;
  logoUrl?: string;
}

export const BlockedScreen: React.FC<BlockedScreenProps> = ({ message, logoUrl }) => {
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
          <path d="m4.9 4.9 14.2 14.2" />
        </svg>
      </div>

      <h1 className="usesense-title">Verification unavailable</h1>
      <p className="usesense-subtitle">
        {message || 'Please try again later or contact support for assistance.'}
      </p>

      <button
        className="usesense-button usesense-button-secondary"
        onClick={() => window.location.reload()}
      >
        Refresh page
      </button>
    </div>
  );
};
