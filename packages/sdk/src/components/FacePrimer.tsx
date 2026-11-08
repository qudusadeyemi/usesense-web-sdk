/**
 * The face primer: the one screen before the camera opens, shared by the
 * Flow runner's face step and the capture engine's intro so Sessions, Flows
 * and the native SDKs all show the same thing ("Take a selfie" / "Start face
 * scan"). Purely presentational: colours and fonts come in as tokens, so it
 * works inside the Flow runner's theme and inside the engine alike.
 */

import React from 'react';

/** The design tokens the primer and its frame read. */
export interface PrimerTokens {
  bg: string;
  fg: string;
  muted: string;
  border: string;
  primary: string;
  primaryFg: string;
  fontDisplay: string;
  fontBody: string;
  buttonRadius: number;
  buttonStyle: 'filled' | 'outline';
  backgroundImage?: string;
}

/** Built-in primer copy (same strings as iOS and Android). */
export const FACE_PRIMER_COPY = {
  title: 'Take a selfie',
  body: "A quick face scan confirms you're a real, live person.",
  start: 'Start face scan',
  busy: 'Please wait…',
  cancel: 'Cancel',
} as const;

/**
 * A full-height screen: a brand header (logo or name, optional Cancel), the
 * content centred, and the "Secured by" footer.
 */
export function PrimerFrame({ tokens: t, brandName, logoUrl, onCancel, cancelLabel = FACE_PRIMER_COPY.cancel, fixed = false, children }: {
  tokens: PrimerTokens;
  brandName?: string | null;
  logoUrl?: string | null;
  onCancel?: () => void;
  cancelLabel?: string;
  /** Fixed full-viewport overlay (Flow runner) instead of filling the parent (engine). */
  fixed?: boolean;
  children: React.ReactNode;
}) {
  const name = brandName || 'Sense';
  const co = brandName && brandName !== 'Sense' ? `${brandName} · Sense` : 'Sense';
  return (
    <div style={{
      position: fixed ? 'fixed' : 'absolute', inset: 0, background: t.bg, color: t.fg,
      display: 'flex', flexDirection: 'column', fontFamily: t.fontBody, textAlign: 'left',
      ...(fixed ? { zIndex: 2147483600 } : { zIndex: 40 }),
      ...(t.backgroundImage ? { backgroundImage: `url(${t.backgroundImage})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}),
    }}>
      <div style={{ height: 56, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', borderBottom: `1px solid ${t.border}` }}>
        {logoUrl
          ? <img src={logoUrl} alt={name} style={{ height: 28, maxWidth: 160, objectFit: 'contain' }} />
          : <span style={{ fontWeight: 600, color: t.fg, fontFamily: t.fontDisplay }}>{name}</span>}
        {onCancel && (
          <button type="button" onClick={onCancel} aria-label={cancelLabel} style={{
            position: 'absolute', right: 16, background: 'none', border: 'none', color: t.muted,
            cursor: 'pointer', fontSize: 14, fontFamily: t.fontBody,
          }}>{cancelLabel}</button>
        )}
      </div>
      <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>{children}</main>
      <div style={{ padding: 12, textAlign: 'center', fontSize: 11, color: t.muted, fontFamily: t.fontBody }}>Secured by {co}</div>
    </div>
  );
}

/** Title, body and the start button, centred. */
export function FacePrimerBody({ tokens: t, busy = false, title, body, start, onStart }: {
  tokens: PrimerTokens;
  busy?: boolean;
  title?: string;
  body?: string;
  start?: string;
  onStart: () => void;
}) {
  const outline = t.buttonStyle === 'outline';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, maxWidth: 380, textAlign: 'center' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: t.fg, fontFamily: t.fontDisplay, letterSpacing: '-0.01em' }}>
        {title ?? FACE_PRIMER_COPY.title}
      </h1>
      <p style={{ color: t.muted, margin: 0, fontFamily: t.fontBody, fontSize: 15 }}>{body ?? FACE_PRIMER_COPY.body}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}>
        <button type="button" onClick={onStart} disabled={busy} style={{
          background: outline ? 'transparent' : t.primary,
          color: outline ? t.primary : t.primaryFg,
          border: outline ? `1.5px solid ${t.primary}` : 'none',
          borderRadius: t.buttonRadius, padding: '14px 16px',
          fontSize: 16, fontWeight: 600, fontFamily: t.fontBody,
          cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.5 : 1, width: '100%',
        }}>{busy ? FACE_PRIMER_COPY.busy : (start ?? FACE_PRIMER_COPY.start)}</button>
      </div>
    </div>
  );
}
