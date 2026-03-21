import React, { useEffect, useRef, useState, useCallback } from 'react';
import { QualityIndicator } from '../QualityIndicator';
import { ImageQualityReport } from '../../capture/image-quality';

interface CaptureScreenProps {
  stream: MediaStream;
  isCapturing: boolean;
  guidance?: string;
  onReady?: () => void;
  logoUrl?: string;
  showOverlay?: boolean;
  onQualityReport?: (report: ImageQualityReport) => void;
}

export const CaptureScreen: React.FC<CaptureScreenProps> = ({
  stream,
  isCapturing,
  guidance,
  onReady,
  logoUrl,
  showOverlay = true,
  onQualityReport,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoReady, setVideoReady] = useState(false);
  const [qualityGuidance, setQualityGuidance] = useState<string | null>(null);
  const [qualityLevel, setQualityLevel] = useState<'good' | 'acceptable' | 'poor'>('good');

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(console.error);
    }
  }, [stream]);

  const handleLoadedData = () => {
    setVideoReady(true);
    onReady?.();
  };

  const handleQualityReport = useCallback((report: ImageQualityReport) => {
    onQualityReport?.(report);

    // Update local guidance state - only show if there are actual issues
    setQualityLevel(report.overallLevel);
    if (report.guidance.length > 0) {
      setQualityGuidance(report.guidance[0].message);
    } else {
      setQualityGuidance(null);
    }
  }, [onQualityReport]);

  const getQualityBorderColor = () => {
    switch (qualityLevel) {
      case 'poor': return 'rgba(124, 58, 237, 0.6)';
      case 'acceptable': return 'rgba(167, 139, 250, 0.5)';
      default: return 'transparent';
    }
  };

  return (
    <div className="usesense-screen">
      {logoUrl && (
        <img
          src={logoUrl}
          alt="Logo"
          style={{ height: '24px', marginBottom: '12px' }}
        />
      )}

      <div
        className="usesense-video-container"
        style={{
          maxWidth: '340px',
          marginBottom: '12px',
          boxShadow: qualityLevel !== 'good'
            ? `0 0 0 3px ${getQualityBorderColor()}`
            : undefined,
          transition: 'box-shadow 0.4s ease',
        }}
      >
        <video
          ref={videoRef}
          className="usesense-video"
          autoPlay
          playsInline
          muted
          onLoadedData={handleLoadedData}
          style={{ transform: 'scaleX(-1)' }}
        />

        {/* Quality indicator overlay */}
        {videoReady && !isCapturing && (
          <QualityIndicator
            videoRef={videoRef}
            active={videoReady && !isCapturing}
            analysisHz={4}
            onQualityReport={handleQualityReport}
            autoHide={true}
          />
        )}

        {/* Compact quality dots during capture */}
        {videoReady && isCapturing && (
          <QualityIndicator
            videoRef={videoRef}
            active={true}
            analysisHz={2}
            onQualityReport={handleQualityReport}
            compact={true}
            autoHide={false}
          />
        )}

        {showOverlay && videoReady && (
          <div className="usesense-video-overlay" />
        )}
      </div>

      {isCapturing ? (
        <>
          <h2 className="usesense-title" style={{ fontSize: '18px' }}>Hold still</h2>
          <p className="usesense-subtitle" style={{ marginBottom: '10px' }}>Stay still for a moment</p>
          <div className="usesense-progress" style={{ marginTop: 0, marginBottom: '10px' }}>
            <div
              className="usesense-progress-bar"
              style={{ width: '100%', transition: 'width 2.5s linear' }}
            />
          </div>
        </>
      ) : (
        <>
          <h2 className="usesense-title" style={{ fontSize: '18px' }}>Position your face</h2>
          {/* Show quality guidance if there's a quality issue, otherwise show static guidance */}
          {qualityGuidance ? (
            <div
              style={{
                marginTop: '10px',
                padding: '10px 14px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.3s ease',
                backgroundColor: qualityLevel === 'poor'
                  ? 'rgba(124, 58, 237, 0.1)'
                  : 'rgba(167, 139, 250, 0.1)',
                color: qualityLevel === 'poor' ? '#6D28D9' : '#7C3AED',
                border: `1px solid ${qualityLevel === 'poor'
                  ? 'rgba(124, 58, 237, 0.2)'
                  : 'rgba(167, 139, 250, 0.2)'}`,
              }}
            >
              <span style={{ fontSize: '16px' }}>
                {qualityLevel === 'poor' ? '\u26A0\uFE0F' : '\u{1F4A1}'}
              </span>
              <span>{qualityGuidance}</span>
            </div>
          ) : guidance ? (
            <div className="usesense-guidance" style={{ marginTop: '10px' }}>{guidance}</div>
          ) : (
            <p className="usesense-subtitle">
              Center your face in the frame
            </p>
          )}
        </>
      )}
    </div>
  );
};