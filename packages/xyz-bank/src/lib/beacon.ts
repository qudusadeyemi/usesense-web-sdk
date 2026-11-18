/* Growth beacons for the leave-behind page. Only sent when the link carries a
   tracked-link code (?sr=), the same contract the website and decks use:
   POST {sr, kind, path, label} to the public beacon route. Unknown codes are
   dropped server-side, so this is safe to call. */

const BEACON_URL = (import.meta.env.VITE_GROWTH_BEACON_URL as string | undefined) ?? 'https://www.usesense.ai/api/t';
const CODE_RE = /^[A-Za-z0-9_-]{4,64}$/;

export type BeaconKind = 'page_view' | 'deck_slide' | 'cta_click';

export function beacon(sr: string | null, kind: BeaconKind, label?: string): void {
  if (!sr || !CODE_RE.test(sr)) return;
  const body = JSON.stringify({ sr, kind, path: location.pathname.slice(0, 200), label: label?.slice(0, 120) });
  try {
    // text/plain keeps it a simple request: no CORS preflight.
    const blob = new Blob([body], { type: 'text/plain' });
    if (navigator.sendBeacon?.(BEACON_URL, blob)) return;
    void fetch(BEACON_URL, { method: 'POST', body, headers: { 'Content-Type': 'text/plain' }, keepalive: true, mode: 'no-cors' });
  } catch {
    /* never block the page on tracking */
  }
}
