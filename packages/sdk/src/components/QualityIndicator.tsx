/**
 * QualityIndicator — real-time image quality feedback overlay
 *
 * Renders a compact, animated indicator strip that sits on top of the video
 * preview to give the user actionable guidance about blur and lighting.
 *
 * Design principles:
 *   - Non-intrusive: small bottom-anchored bar that doesn't block the face oval
 *   - Color-coded: indigo (good), violet (warning), deep-violet (critical)
 *   - Animated transitions between states for polish
 *   - Auto-hides after sustained good quality (3 s) to reduce noise
 *
 * @module components/QualityIndicator
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  ImageQualityAnalyzer,
  ImageQualityReport,
  QualityGuidance,
} from '../capture/image-quality';

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

export interface QualityIndicatorProps {
  /** The HTMLVideoElement to analyze (must be playing) */
  videoRef: React.RefObject<HTMLVideoElement | null>;
  /** Whether analysis is active */
  active?: boolean;
  /** Analysis frequency in Hz (default: 4) */
  analysisHz?: number;
  /** Called on each analysis cycle with the report */
  onQualityReport?: (report: ImageQualityReport) => void;
  /** Whether to auto-hide when quality is good for 3s */
  autoHide?: boolean;
  /** Compact mode (just the bar, no text) */
  compact?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const AUTO_HIDE_DELAY_MS = 3000;

const SEVERITY_COLORS = {
  critical: { bg: 'rgba(124, 58, 237, 0.9)', text: '#fff', border: 'rgba(124, 58, 237, 0.6)' },
  warning:  { bg: 'rgba(167, 139, 250, 0.9)', text: '#fff', border: 'rgba(167, 139, 250, 0.6)' },
  info:     { bg: 'rgba(99, 102, 241, 0.9)', text: '#fff', border: 'rgba(99, 102, 241, 0.6)' },
};

const ICON_MAP: Record<string, string> = {
  blur:     '\u{1F4F7}',  // camera
  dark:     '\u{1F319}',  // crescent moon
  bright:   '\u2600\uFE0F', // sun
  contrast: '\u25D0',      // circle half
  good:     '\u2705',      // check
  check:    '\u2705',
};

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export const QualityIndicator: React.FC<QualityIndicatorProps> = ({
  videoRef,
  active = true,
  analysisHz = 4,
  onQualityReport,
  autoHide = true,
  compact = false,
}) => {
  const analyzerRef = useRef<ImageQualityAnalyzer | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [report, setReport] = useState<ImageQualityReport | null>(null);
  const [isHidden, setIsHidden] = useState(false);
  const goodSinceRef = useRef<number | null>(null);

  // Init analyzer
  useEffect(() => {
    analyzerRef.current = new ImageQualityAnalyzer();
    return () => {
      analyzerRef.current?.dispose();
      analyzerRef.current = null;
    };
  }, []);

  // Analysis loop
  const runAnalysis = useCallback(() => {
    const video = videoRef.current;
    const analyzer = analyzerRef.current;
    if (!video || !analyzer || video.readyState < 2) return;

    const r = analyzer.analyzeFrame(video);
    setReport(r);
    onQualityReport?.(r);

    // Auto-hide logic
    if (autoHide) {
      if (r.overallLevel === 'good') {
        if (!goodSinceRef.current) {
          goodSinceRef.current = Date.now();
        } else if (Date.now() - goodSinceRef.current > AUTO_HIDE_DELAY_MS) {
          setIsHidden(true);
        }
      } else {
        goodSinceRef.current = null;
        setIsHidden(false);
      }
    }
  }, [videoRef, onQualityReport, autoHide]);

  useEffect(() => {
    if (!active) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    const intervalMs = Math.round(1000 / analysisHz);
    intervalRef.current = setInterval(runAnalysis, intervalMs);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [active, analysisHz, runAnalysis]);

  // ─── Render ──────────────────────────────────────────────────────────────

  if (!report || (isHidden && autoHide)) return null;

  // Don't render if there's no guidance (quality is good)
  if (report.guidance.length === 0) return null;

  const topGuidance: QualityGuidance = report.guidance[0];
  const colors = SEVERITY_COLORS[topGuidance.severity];
  const icon = ICON_MAP[topGuidance.icon] || '';

  if (compact) {
    // In compact mode, only show if there are actual quality issues
    if (report.guidance.length === 0) return null;
    
    return (
      <div
        style={{
          position: 'absolute',
          bottom: '42px',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          zIndex: 20,
          transition: 'opacity 0.3s ease',
        }}
      >
        {/* Show simple guidance banner in compact mode */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: colors.bg,
            color: colors.text,
            padding: '6px 10px',
            borderRadius: '12px',
            fontSize: '11px',
            fontWeight: 600,
            backdropFilter: 'blur(8px)',
            boxShadow: `0 2px 6px ${colors.border}`,
          }}
        >
          <span style={{ fontSize: '14px', lineHeight: 1 }}>{icon}</span>
          <span>{topGuidance.message}</span>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        position: 'absolute',
        top: '8px',
        left: '8px',
        right: '8px',
        zIndex: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        transition: 'opacity 0.4s ease, transform 0.3s ease',
        opacity: 1,
        pointerEvents: 'none',
      }}
    >
      {/* Main guidance banner */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: colors.bg,
          color: colors.text,
          padding: '8px 12px',
          borderRadius: '8px',
          fontSize: '13px',
          fontWeight: 600,
          backdropFilter: 'blur(8px)',
          boxShadow: `0 2px 8px ${colors.border}`,
          transition: 'background 0.3s ease',
        }}
      >
        <span style={{ fontSize: '16px', lineHeight: 1 }}>{icon}</span>
        <span style={{ flex: 1 }}>{topGuidance.message}</span>
      </div>
    </div>
  );
};

