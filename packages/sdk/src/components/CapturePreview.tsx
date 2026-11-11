/**
 * A static preview of one capture screen with a given brand, for the
 * dashboard's live brand preview (Watchtower's Brand page). Same stylesheet,
 * resolver and components as the live engine; no camera, no network, no
 * MediaPipe, no session. Buttons do nothing.
 */

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { getEngineStyles } from './styles';
import { captureThemeVars } from '../capture/capture-theme';
import { CaptureCanvas, captureOval } from '../capture/contour-scan';
import { primerCopy, extraCheckSentence, type EndScreen } from '../capture/extra-check';
import { BottomSheet, CaptureBrandContext, CaptureLoader, ChallengeOverlay, EndPage, IconBadge, BrandHeader, LeaveDialog, PoweredBySense, StoryPage } from './ExtraCheck';
import { resolveEngineBrand, usePrefersDark, injectCaptureFontCss } from './capture-brand';
import { USESENSE_FONTS_URL } from './styles';
import type { FlowAppearance } from '../flows/theme';
import type { FlowCopy } from '../flows/copy';
import type { SessionBranding } from '../types';

/** Every screen the preview can show. */
export type CapturePreviewScreen =
  | 'primer' | 'primer_two' | 'loading' | 'camera_request'
  | 'align' | 'align_warning' | 'scan'
  | 'extra_check_sheet' | 'head_turn' | 'follow_dot'
  | 'upload' | 'upload_failed' | 'leave'
  | EndScreen;

/** The screens, in flow order (for a picker). */
export const CAPTURE_PREVIEW_SCREENS: CapturePreviewScreen[] = [
  'primer', 'primer_two', 'loading', 'camera_request', 'align', 'align_warning', 'scan',
  'extra_check_sheet', 'head_turn', 'follow_dot', 'upload', 'upload_failed', 'leave',
  'approved', 'review', 'rejected', 'rejected_retry', 'camera_denied', 'camera_stopped',
  'mic_denied', 'offline', 'expired', 'error',
];

export interface CapturePreviewProps {
  /** Which screen to show. */
  screen: CapturePreviewScreen;
  /** Code-layer appearance (what an integrator would pass). */
  appearance?: FlowAppearance;
  /** Code-layer copy (`copy.capture` is read). */
  copy?: FlowCopy;
  /** Dashboard brand (org + Flow), as the server would send it. The dashboard preview usually passes its draft here. */
  branding?: SessionBranding | null;
  /** Legacy code fields. */
  primaryColor?: string;
  logoUrl?: string;
  displayName?: string;
  /** Force the device colour scheme for `mode: 'auto'` (default: the browser's). */
  prefersDark?: boolean;
  /** A still image under the camera screens (e.g. an illustrated face). Default: the plain camera background. */
  cameraImageUrl?: string;
  /** Progress for the scan / extra-check ring and the upload bar, 0 to 1. Default 0.6. */
  progress?: number;
  className?: string;
  style?: CSSProperties;
}

const noop = () => {};

/**
 * Render one capture screen with a brand, statically. Fills its container
 * (give it a phone-sized box). Safe to mount many at once.
 */
export function CapturePreview(props: CapturePreviewProps) {
  const devicePrefersDark = usePrefersDark();
  const prefersDark = props.prefersDark ?? devicePrefersDark;
  const brand = useMemo(() => resolveEngineBrand({
    appearance: props.appearance, copy: props.copy, branding: props.branding,
    primaryColor: props.primaryColor, logoUrl: props.logoUrl, displayName: props.displayName, prefersDark,
  }), [props.appearance, props.copy, props.branding, props.primaryColor, props.logoUrl, props.displayName, prefersDark]);
  const { theme, strings } = brand;
  const progress = Math.max(0, Math.min(1, props.progress ?? 0.6));
  const s = props.screen;

  const fontCss = theme.typography.fontCss;
  useEffect(() => {
    if (fontCss) { injectCaptureFontCss(fontCss); return; }
    if (typeof document === 'undefined' || document.getElementById('usesense-fonts')) return;
    const link = document.createElement('link');
    link.id = 'usesense-fonts';
    link.rel = 'stylesheet';
    link.href = USESENSE_FONTS_URL;
    document.head.appendChild(link);
  }, [fontCss]);

  const camera = s === 'align' || s === 'align_warning' || s === 'scan' || s === 'extra_check_sheet'
    || s === 'head_turn' || s === 'follow_dot' || s === 'upload' || s === 'upload_failed' || s === 'leave';
  const sheet = s === 'extra_check_sheet' || s === 'upload' || s === 'upload_failed';

  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ W: 0, H: 0 });
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return undefined;
    const measure = () => setSize((o) => (o.W === el.clientWidth && o.H === el.clientHeight ? o : { W: el.clientWidth, H: el.clientHeight }));
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    const c = canvasRef.current;
    if (!c || !camera) return;
    const r = new CaptureCanvas(c, theme.camera, true);
    if (s === 'align') r.draw({ mode: 'align', now: 0 });
    else if (s === 'align_warning') r.draw({ mode: 'align', now: 0, warn: true });
    else if (s === 'scan') r.draw({ mode: 'scan', now: 0, progress });
    else if (s === 'head_turn' || s === 'follow_dot') r.draw({ mode: 'challenge', now: 0, progress, ringColor: theme.camera.challenge });
    else r.draw({ mode: 'upload', now: 0 });
  }, [camera, s, theme.camera, progress, size.W, size.H]);

  const oval = captureOval(size.W, size.H);
  const guidance = s === 'align' ? { text: strings.t('guidance', 'ready') }
    : s === 'align_warning' ? { text: strings.t('guidance', 'closer') }
      : s === 'scan' ? { text: strings.t('guidance', 'ready') }
        : s === 'head_turn' ? strings.headTurn('left', true)
          : s === 'follow_dot' ? { text: strings.t('extraCheck', 'followDot') }
            : null;

  const primer = (two: boolean) => {
    const c = primerCopy(two ? 'head_turn' : 'none', strings);
    return <StoryPage testId={two ? 'primer_two' : 'primer'} icon="face" tone="info" title={c.title} body={c.body} tips={c.tips} primary={c.start} onPrimary={noop} secondary={strings.t('primer', 'cancel')} onSecondary={noop} />;
  };

  const rootClass = [
    'usesense-engine', 'usesense-engine--guided',
    theme.shape.buttonStyle === 'outline' ? 'usesense-engine--btn-outline' : '',
    props.className ?? '',
  ].filter(Boolean).join(' ');

  return (
    <CaptureBrandContext.Provider value={brand}>
      <div
        ref={rootRef}
        className={rootClass}
        data-mode={theme.mode}
        data-screen={s}
        style={{ ...captureThemeVars(theme), minHeight: 0, height: '100%', ...props.style } as CSSProperties}
      >
        <style>{getEngineStyles(theme.page.primary)}</style>
        {s === 'primer' && primer(false)}
        {s === 'primer_two' && primer(true)}
        {(s === 'loading' || s === 'camera_request') && (
          <div className="usesense-xc-loading">
            <BrandHeader />
            {s === 'loading' ? (
              <>
                <CaptureLoader />
                <div className="usesense-xc-loading-title">{strings.t('primer', 'gettingReady')}</div>
              </>
            ) : (
              <>
                <IconBadge icon="camera" tone="info" size={72} />
                <div className="usesense-xc-loading-title">{strings.t('primer', 'cameraTitle')}</div>
                <div className="usesense-xc-loading-body">{strings.t('primer', 'cameraBody')}</div>
              </>
            )}
            <PoweredBySense />
          </div>
        )}
        {camera && (
          <div className="usesense-camera-container usesense-camera-container--guided">
            {props.cameraImageUrl && (
              <img className="usesense-camera-video" src={props.cameraImageUrl} alt="" aria-hidden="true" style={{ objectFit: 'cover' }} />
            )}
            <canvas ref={canvasRef} className="usesense-contour-canvas" aria-hidden="true" />
            {s === 'head_turn' && <ChallengeOverlay W={size.W} H={size.H} oval={oval} state={{ arrow: 'left' }} />}
            {s === 'follow_dot' && (
              <ChallengeOverlay W={size.W} H={size.H} oval={oval} state={{ dot: { x: 0.78, y: 0.3 }, trail: [{ x: 0.5, y: 0.4 }, { x: 0.78, y: 0.3 }] }} />
            )}
            {sheet && <div className="usesense-capture-blur" />}
            {!sheet && (
              <div className="usesense-capture-top">
                <span className="usesense-capture-circ" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></svg>
                </span>
                <span className="usesense-capture-circ" aria-hidden="true">?</span>
              </div>
            )}
            {guidance && (
              <div className="usesense-guidance" aria-hidden="true">
                <span className="usesense-guidance-text">{guidance.text}</span>
                {guidance.sub && <span className="usesense-guidance-sub">{guidance.sub}</span>}
              </div>
            )}
            {!sheet && <PoweredBySense camera />}
          </div>
        )}
        {s === 'extra_check_sheet' && (
          <BottomSheet icon="turn" tone="extra" title={strings.t('extraCheck', 'sheetTitle')} body={extraCheckSentence('head_turn', [{ direction: 'left' }, { direction: 'right' }], strings)} primary={strings.t('extraCheck', 'continue')} onPrimary={noop} />
        )}
        {s === 'upload_failed' && (
          <BottomSheet icon="upload" tone="warning" title={strings.t('upload', 'failedTitle')} body={strings.t('upload', 'failedBody')} primary={strings.t('upload', 'retry')} onPrimary={noop} />
        )}
        {s === 'upload' && (
          <div className="usesense-upload-sheet">
            <div className="usesense-upload-sheet-title">{strings.t('upload', 'title')}</div>
            <div className="usesense-upload-sheet-bar"><i style={{ width: `${(progress * 100).toFixed(1)}%` }} /></div>
            <div className="usesense-upload-sheet-sub">{strings.t('upload', 'caption')}</div>
          </div>
        )}
        {s === 'leave' && <LeaveDialog onLeave={noop} onStay={noop} />}
        {isEndScreen(s) && <EndPage screen={s} onPrimary={noop} onSecondary={noop} />}
      </div>
    </CaptureBrandContext.Provider>
  );
}

function isEndScreen(s: CapturePreviewScreen): s is EndScreen {
  return ['approved', 'review', 'rejected', 'rejected_retry', 'camera_denied', 'camera_stopped', 'offline', 'expired', 'mic_denied', 'error'].includes(s);
}
