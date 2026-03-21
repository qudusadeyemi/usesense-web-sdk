import React from 'react';

interface PermissionScreenProps {
  type: 'camera' | 'microphone';
  onRequest: () => void;
  logoUrl?: string;
}

export const PermissionScreen: React.FC<PermissionScreenProps> = ({ type, onRequest, logoUrl }) => {
  const isMicrophone = type === 'microphone';

  return (
    <div className="usesense-screen">
      {logoUrl && (
        <img
          src={logoUrl}
          alt="Logo"
          style={{ height: '40px', marginBottom: '32px' }}
        />
      )}
      
      <div style={{ marginBottom: '24px' }}>
        <svg
          width="64"
          height="64"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ color: 'var(--usesense-primary)', margin: '0 auto', display: 'block' }}
        >
          {isMicrophone ? (
            <>
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" x2="12" y1="19" y2="22" />
            </>
          ) : (
            <>
              <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
              <circle cx="12" cy="13" r="3" />
            </>
          )}
        </svg>
      </div>

      <h1 className="usesense-title">
        {isMicrophone ? 'Microphone access needed' : 'Camera access needed'}
      </h1>
      <p className="usesense-subtitle">
        {isMicrophone
          ? 'We need access to your microphone to complete verification.'
          : 'We need access to your camera to verify your identity.'}
      </p>

      <button
        className="usesense-button"
        onClick={onRequest}
      >
        Continue
      </button>
    </div>
  );
};
