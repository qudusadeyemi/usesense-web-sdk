import React from 'react';

interface UploadingScreenProps {
  progress?: number;
  logoUrl?: string;
}

export const UploadingScreen: React.FC<UploadingScreenProps> = ({ progress, logoUrl }) => {
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
        Finishing up...
      </h1>
      <p className="usesense-subtitle">
        Please wait while we complete your verification
      </p>

      {progress !== undefined && (
        <div className="usesense-progress">
          <div
            className="usesense-progress-bar"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
};
