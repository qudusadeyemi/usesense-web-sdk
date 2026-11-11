/**
 * Extra-check and end-of-flow screens for the guided capture engine
 * (storyboard flows 4 to 6): the "One more quick check" sheet, the challenge
 * overlay drawn on the scan screen (arrow, dot and trail, tick, digits pill
 * and mic meter), the leave dialog, the upload-failed sheet, and the full
 * pages (primer, results, errors). Presentational only; the engine owns the
 * state. Styles: `usesense-xc-*` in styles.ts.
 */

import { createContext, useContext } from 'react';
import { endScreenCopy, type EndScreen, type EndScreenIcon, type EndScreenTone } from '../capture/extra-check';
import { resolveCaptureTheme, type CaptureTheme } from '../capture/capture-theme';
import { CaptureStrings, DEFAULT_CAPTURE_STRINGS } from '../capture/capture-copy';

/** The resolved brand every capture screen reads (BRAND-v1: resolve once, use everywhere). */
export interface CaptureBrand {
  theme: CaptureTheme;
  strings: CaptureStrings;
}

const DEFAULT_BRAND: CaptureBrand = { theme: resolveCaptureTheme(), strings: DEFAULT_CAPTURE_STRINGS };

/** Provided by the engine (and the preview) with the session's resolved brand. */
export const CaptureBrandContext = createContext<CaptureBrand>(DEFAULT_BRAND);

/** The resolved brand for the current capture screen. */
export function useCaptureBrand(): CaptureBrand {
  return useContext(CaptureBrandContext);
}

const ICON_PATHS: Record<EndScreenIcon | 'face' | 'turn' | 'dot' | 'upload', string> = {
  check: 'M5 12.5l4.5 4.5L19 7.5',
  clock: 'M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z',
  x: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9 9l6 6M15 9l-6 6',
  camera: 'M3 7h4l2-3h6l2 3h4v13H3zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  wifi: 'M2 8.8a15 15 0 0 1 20 0M5 12.8a10 10 0 0 1 14 0M8.5 16.4a5 5 0 0 1 7 0M12 20h.01M3 3l18 18',
  mic: 'M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3zM19 10v2a7 7 0 0 1-14 0v-2M12 19v3',
  hourglass: 'M6 2h12M6 22h12M7 2c0 6 10 6 10 10S7 16 7 22M17 2c0 6-10 6-10 10s10 4 10 10',
  alert: 'M12 9v4M12 17h.01M10.3 3.9L2 18a2 2 0 0 0 1.7 3h16.6a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
  face: 'M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2M9 10h.01M15 10h.01M9.5 15a3.5 3.5 0 0 0 5 0',
  turn: 'M3 12a9 9 0 0 1 15.5-6.2M21 12a9 9 0 0 1-15.5 6.2M18 2v4h-4M6 22v-4h4',
  dot: 'M12 12m-3 0a3 3 0 1 0 6 0 3 3 0 1 0-6 0M12 2v3M12 19v3M2 12h3M19 12h3',
  upload: 'M12 16V4M7 9l5-5 5 5M4 20h16',
};

/** Icon tones: glyph = the colour, tile = the colour at 16% (styles: usesense-xc-badge--*). */
type Tone = EndScreenTone | 'info' | 'extra';

/** An icon tile (storyboard: 72 px on pages, 52 px on sheets), corners = shape.radius. */
export function IconBadge({ icon, tone, size }: { icon: keyof typeof ICON_PATHS; tone: Tone; size: number }) {
  const glyph = size >= 64 ? 36 : 26;
  return (
    <span className={`usesense-xc-badge usesense-xc-badge--${tone}`} style={{ width: size, height: size }} aria-hidden="true">
      <svg width={glyph} height={glyph} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d={ICON_PATHS[icon]} />
      </svg>
    </span>
  );
}

/** The brand header on page-surface screens: the logo, else the display name (placement `none` hides it). */
export function BrandHeader() {
  const { theme } = useCaptureBrand();
  const { logo, displayName } = theme;
  if (logo.placement === 'none' || (!logo.url && !displayName)) return null;
  return (
    <div className={`usesense-xc-header${logo.placement === 'center' ? ' usesense-xc-header--center' : ''}`}>
      {logo.url
        ? <img src={logo.url} alt={displayName ?? ''} />
        : <span className="usesense-xc-header-name">{displayName}</span>}
    </div>
  );
}

/** "Powered by Sense" (fixed, on every capture screen). */
export function PoweredBySense({ camera = false }: { camera?: boolean }) {
  return <div className={`usesense-powered${camera ? ' usesense-powered--camera' : ''}`} aria-hidden={camera ? 'true' : undefined}>Powered by Sense</div>;
}

/** A full-screen page: header, icon, title, body, optional tips, then the buttons at the bottom. */
export function StoryPage({ icon, tone, title, body, tips, primary, secondary, onPrimary, onSecondary, testId, illustration }: {
  icon: keyof typeof ICON_PATHS;
  tone: Tone;
  title: string;
  body: string;
  tips?: string[];
  primary?: string;
  secondary?: string;
  onPrimary?: () => void;
  onSecondary?: () => void;
  testId?: string;
  /** appearance.icons: an image that replaces the icon tile. */
  illustration?: string | null;
}) {
  const { theme } = useCaptureBrand();
  const header = theme.logo.placement !== 'none' && !!(theme.logo.url || theme.displayName);
  return (
    <div className={`usesense-xc-page${header ? ' usesense-xc-page--header' : ''}`} role="dialog" aria-labelledby="usesense-xc-page-title" data-screen={testId}>
      {header && <BrandHeader />}
      {illustration
        ? <img className="usesense-xc-illustration" src={illustration} alt="" aria-hidden="true" />
        : <IconBadge icon={icon} tone={tone} size={72} />}
      <h1 id="usesense-xc-page-title" className="usesense-xc-page-title">{title}</h1>
      <p className="usesense-xc-page-body">{body}</p>
      {tips && tips.length > 0 && (
        <ul className="usesense-xc-tips">
          {tips.map((t) => <li key={t}><span aria-hidden="true" />{t}</li>)}
        </ul>
      )}
      <div className="usesense-xc-spacer" />
      {primary && <button type="button" className="usesense-xc-primary" onClick={onPrimary}>{primary}</button>}
      {secondary && <button type="button" className="usesense-xc-secondary" onClick={onSecondary}>{secondary}</button>}
      <PoweredBySense />
    </div>
  );
}

/** The result-page illustration slot for a screen (appearance.icons). */
function illustrationFor(screen: EndScreen, icons: CaptureTheme['icons']): string | null {
  if (screen === 'approved') return icons.success;
  if (screen === 'review') return icons.review;
  if (screen === 'rejected' || screen === 'rejected_retry') return icons.notVerified;
  return null;
}

/** An end screen (result or error) from its id. */
export function EndPage({ screen, app, onPrimary, onSecondary }: {
  screen: EndScreen;
  app?: string | null;
  onPrimary?: () => void;
  onSecondary?: () => void;
}) {
  const { theme, strings } = useCaptureBrand();
  // The engine's strings carry the session's display name; an explicit `app`
  // (older callers) is honoured when the strings have none.
  const S = app && !strings.app ? new CaptureStrings(undefined, app) : strings;
  const c = endScreenCopy(screen, app, S);
  return (
    <StoryPage
      testId={screen}
      illustration={illustrationFor(screen, theme.icons)}
      icon={c.icon}
      tone={c.tone}
      title={c.title}
      body={c.body}
      tips={c.tips}
      primary={c.primary}
      secondary={c.secondary}
      onPrimary={onPrimary}
      onSecondary={onSecondary}
    />
  );
}

/** A bottom sheet over the blurred scan screen (same styling as the upload sheet). */
export function BottomSheet({ icon, tone, title, body, primary, onPrimary, testId }: {
  icon?: keyof typeof ICON_PATHS;
  tone?: Tone;
  title: string;
  body?: string;
  primary?: string;
  onPrimary?: () => void;
  testId?: string;
}) {
  return (
    <div className="usesense-xc-sheet" role="dialog" aria-labelledby="usesense-xc-sheet-title" data-screen={testId}>
      {icon && <IconBadge icon={icon} tone={tone ?? 'extra'} size={52} />}
      <div id="usesense-xc-sheet-title" className="usesense-xc-sheet-title">{title}</div>
      {body && <div className="usesense-xc-sheet-body">{body}</div>}
      {primary && <button type="button" className="usesense-xc-primary usesense-xc-primary--sheet" onClick={onPrimary}>{primary}</button>}
    </div>
  );
}

/** "Leave verification?" with Leave / Keep going. */
export function LeaveDialog({ onLeave, onStay }: { onLeave: () => void; onStay: () => void }) {
  const { strings } = useCaptureBrand();
  const C = { title: strings.t('leave', 'title'), body: strings.t('leave', 'body'), leave: strings.t('leave', 'leave'), stay: strings.t('leave', 'keepGoing') };
  return (
    <div className="usesense-xc-scrim">
      <div className="usesense-xc-dialog" role="alertdialog" aria-labelledby="usesense-xc-leave-title" aria-describedby="usesense-xc-leave-body">
        <div id="usesense-xc-leave-title" className="usesense-xc-dialog-title">{C.title}</div>
        <div id="usesense-xc-leave-body" className="usesense-xc-dialog-body">{C.body}</div>
        <div className="usesense-xc-dialog-buttons">
          <button type="button" className="usesense-xc-dialog-no" onClick={onLeave}>{C.leave}</button>
          {/* Keep going is the safe default. */}
          <button type="button" className="usesense-xc-dialog-yes" onClick={onStay} autoFocus>{C.stay}</button>
        </div>
      </div>
    </div>
  );
}

/** What the challenge overlay draws on top of the camera and ring. */
export interface ChallengeOverlayState {
  /** Head Turn: the side arrow. */
  arrow?: 'left' | 'right' | 'up' | 'down' | null;
  /** Follow Dot: the dot and its trail (0-1 of the screen). */
  dot?: { x: number; y: number } | null;
  trail?: { x: number; y: number }[];
  /** The "Done" tick in the oval. */
  tick?: boolean;
  /** Speak Digits: the pill text and the meter bar heights (px). */
  digits?: string | null;
  meter?: number[] | null;
}

/**
 * The extra check drawn on the scan screen, in the container's pixel space
 * (W x H) around the oval. Geometry follows the storyboard (390 x 844).
 */
export function ChallengeOverlay({ W, H, oval, state }: {
  W: number;
  H: number;
  oval: { cx: number; cy: number; rx: number; ry: number };
  state: ChallengeOverlayState;
}) {
  if (!W || !H) return null;
  const { cx, cy, rx, ry } = oval;
  // Arrows sit outside the oval: 40-86 px from the screen edge on a 390 px phone.
  const arrowLen = 46, head = 22;
  const leftX = Math.max(12, cx - rx - 24 - arrowLen);
  const rightX = Math.min(W - 12, cx + rx + 24 + arrowLen);
  const px = (p: { x: number; y: number }) => `${(p.x * W).toFixed(1)} ${(p.y * H).toFixed(1)}`;
  return (
    <>
      <svg className="usesense-xc-overlay" width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
        {state.dot && (
          <g>
            {state.trail && state.trail.length > 1 && (
              <path
                d={`M${state.trail.map(px).join(' L')}`}
                className="usesense-xc-dot-trail" fill="none" strokeOpacity={0.35} strokeWidth={2} strokeDasharray="4 6"
                strokeLinecap="round" strokeLinejoin="round"
              />
            )}
            <circle className="usesense-xc-dot-ring" cx={state.dot.x * W} cy={state.dot.y * H} r={22} fill="none" strokeOpacity={0.5} strokeWidth={2} />
            <circle className="usesense-xc-dot" cx={state.dot.x * W} cy={state.dot.y * H} r={12} />
          </g>
        )}
        {state.arrow === 'left' && (
          <path className="usesense-xc-arrow" d={`M${leftX} ${cy} l ${head} -24 M${leftX} ${cy} l ${head} 24 M${leftX} ${cy} h ${arrowLen}`} />
        )}
        {state.arrow === 'right' && (
          <path className="usesense-xc-arrow" d={`M${rightX} ${cy} l -${head} -24 M${rightX} ${cy} l -${head} 24 M${rightX} ${cy} h -${arrowLen}`} />
        )}
        {state.arrow === 'up' && (
          <path className="usesense-xc-arrow" d={`M${cx} ${Math.max(12, cy - ry - 24 - arrowLen)} l -24 ${head} M${cx} ${Math.max(12, cy - ry - 24 - arrowLen)} l 24 ${head} M${cx} ${Math.max(12, cy - ry - 24 - arrowLen)} v ${arrowLen}`} />
        )}
        {state.arrow === 'down' && (
          <path className="usesense-xc-arrow" d={`M${cx} ${cy + ry + 24 + arrowLen} l -24 -${head} M${cx} ${cy + ry + 24 + arrowLen} l 24 -${head} M${cx} ${cy + ry + 24 + arrowLen} v -${arrowLen}`} />
        )}
        {state.tick && (
          <g className="usesense-xc-tick">
            <circle className="usesense-xc-tick-disc" cx={cx} cy={cy} r={44} />
            <path className="usesense-xc-tick-mark" d={`M${cx - 20} ${cy + 2} l 14 14 l 26 -30`} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </g>
        )}
      </svg>
      {state.digits && <div className="usesense-xc-digits" aria-label={`Numbers: ${state.digits}`}>{state.digits}</div>}
      {state.meter && (
        <div className="usesense-xc-meter" style={{ top: Math.min(H - 60, cy + ry + 110) }} aria-hidden="true">
          {state.meter.map((h, i) => <span key={i} style={{ height: h }} />)}
        </div>
      )}
    </>
  );
}

/** The "Getting ready" loader: appearance.loader (spinner, dots, bar or an image), in primary. */
export function CaptureLoader() {
  const { theme } = useCaptureBrand();
  const { style, imageUrl } = theme.loader;
  if (imageUrl) return <img className="usesense-loader-image" src={imageUrl} alt="" aria-hidden="true" />;
  if (style === 'dots') return <div className="usesense-loader-dots" aria-hidden="true"><span /><span /><span /></div>;
  if (style === 'bar') return <div className="usesense-loader-bar" aria-hidden="true"><i /></div>;
  return <div className="usesense-loader-spinner" aria-hidden="true" />;
}
