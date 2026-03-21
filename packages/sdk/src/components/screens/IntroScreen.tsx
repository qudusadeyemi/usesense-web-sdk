import React from 'react';

interface IntroScreenProps {
  logoUrl?: string;
}

export const IntroScreen: React.FC<IntroScreenProps> = ({ logoUrl }) => {
  return (
    <div className="usesense-screen">
      {logoUrl && (
        <img
          src={logoUrl}
          alt="Logo"
          style={{ height: '40px', marginBottom: '32px' }}
        />
      )}
      <div className="usesense-spinner" />
      <h1 className="usesense-title" style={{ marginTop: '24px' }}>
        Verifying your presence
      </h1>
      <p className="usesense-subtitle">
        Please wait a moment
      </p>
    </div>
  );
};
