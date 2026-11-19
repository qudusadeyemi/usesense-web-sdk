/* A real capture inside the XYZ phone frame on a laptop page. The SDK runs in
   its own window (an iframe of /xyz/phone?embed=1, PhonePage) laid out at a
   real phone's size, PHONE_POINTS wide, then scaled to the frame: on a laptop
   the frame is far smaller than a phone, and at that size the SDK's buttons
   fell off the bottom of the screen. Scaled, the text, buttons and oval all
   shrink together, as in a screenshot of a phone. Expand only changes the
   scale, so the window is never reloaded and the camera keeps running. */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Phone } from '../bank/Screens';
import type { Handoff } from '../lib/live';
import type { Brand } from '../lib/settings';
import type { CaptureMessage } from './PhonePage';

export type CaptureDone = Extract<CaptureMessage, { type: 'xyz-capture-done' }>;

/** Width the SDK lays out at: an iPhone's screen in CSS pixels. */
export const PHONE_POINTS = 390;

/** The first non-transparent background at the top of a page: what a phone's status bar takes on. */
function topColor(doc: Document): string | null {
  let el: Element | null = doc.elementFromPoint(8, 4);
  while (el) {
    const bg = doc.defaultView?.getComputedStyle(el).backgroundColor;
    if (bg && bg !== 'transparent' && !/rgba\([^)]*,\s*0\)$/.test(bg)) return bg;
    el = el.parentElement;
  }
  return null;
}

/** Is an rgb()/rgba() colour dark? Picks a light home indicator over it. */
function isDark(c: string): boolean {
  const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(c);
  if (!m) return false;
  return 0.2126 * +m[1] + 0.7152 * +m[2] + 0.0722 * +m[3] < 110;
}

/** The phone-sized window for a screen of w x h pixels: its width, height and scale. */
export function phoneWindow(w: number, h: number): { width: number; height: number; scale: number } {
  const scale = w > 0 ? w / PHONE_POINTS : 1;
  return { width: PHONE_POINTS, height: Math.round(h / scale), scale };
}

export function PhoneCapture({ handoff, brand, onDone, onFail, onCancel }: {
  handoff: Handoff;
  brand: Brand;
  onDone: (m: CaptureDone) => void;
  onFail: (message: string) => void;
  onCancel: () => void;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const screen = useRef<HTMLDivElement>(null);
  const [win, setWin] = useState(() => phoneWindow(PHONE_POINTS, 760));
  const [bar, setBar] = useState('#fff');
  // Decided once: switching between frame and full screen would reload the capture.
  const [onPhone] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.('(max-width: 640px)').matches);
  // The status bar takes the colour at the top of the capture as its screens change.
  useEffect(() => {
    const t = window.setInterval(() => {
      try {
        const doc = frame.current?.contentDocument;
        const c = doc ? topColor(doc) : null;
        if (c) setBar((b) => (b === c ? b : c));
      } catch { /* not loaded yet */ }
    }, 400);
    return () => window.clearInterval(t);
  }, []);
  // Follow the screen's size (column width, Expand, window resize).
  useLayoutEffect(() => {
    const el = screen.current;
    if (!el || onPhone) return;
    const fit = () => setWin(phoneWindow(el.clientWidth, el.clientHeight));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const latest = useRef({ handoff, onDone, onFail, onCancel });
  latest.current = { handoff, onDone, onFail, onCancel };

  useEffect(() => {
    const on = (e: MessageEvent) => {
      const win = frame.current?.contentWindow;
      if (!win || e.source !== win || e.origin !== location.origin) return;
      const m = e.data as CaptureMessage;
      if (m?.type === 'xyz-capture-ready') win.postMessage({ type: 'xyz-capture-init', handoff: latest.current.handoff } satisfies CaptureMessage, location.origin);
      else if (m?.type === 'xyz-capture-done') latest.current.onDone(m);
      else if (m?.type === 'xyz-capture-error') latest.current.onFail(m.message);
      else if (m?.type === 'xyz-capture-cancel') latest.current.onCancel();
    };
    window.addEventListener('message', on);
    return () => window.removeEventListener('message', on);
  }, []);

  // On a phone the capture is the screen: no mock phone inside a real one.
  if (onPhone) {
    return (
      <div className="cap-full">
        <iframe ref={frame} src={`${import.meta.env.BASE_URL}phone?embed=1`} title={`Face check at ${brand.name}`} allow="camera; microphone; fullscreen; autoplay" />
      </div>
    );
  }

  return (
    <Phone brand={brand} dark={isDark(bar)}>
      <div className="cap-screen" style={{ background: bar }}>
        <div className="cap-view" ref={screen}>
        <iframe
          ref={frame}
          style={{ width: win.width, height: win.height, transform: `scale(${win.scale})` }}
          src={`${import.meta.env.BASE_URL}phone?embed=1`}
          title={`Face check at ${brand.name}`}
          allow="camera; microphone; fullscreen; autoplay"
        />
        </div>
      </div>
    </Phone>
  );
}

/** The same phone, while a check starts or its result is read. */
export function PhoneWait({ brand, text }: { brand: Brand; text: string }) {
  return (
    <Phone brand={brand}>
      <div className="cap-screen cap-wait"><span className="spinner" />{text}</div>
    </Phone>
  );
}
