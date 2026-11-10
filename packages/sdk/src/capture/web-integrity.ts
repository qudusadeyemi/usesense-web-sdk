/**
 * DeepSense browser signal collection -- v4.1
 *
 * Produces a channel_integrity payload that exactly matches the backend
 * scoring spec. All keys, nesting, and value types must stay in sync with
 * the v4.1 unified spec (Chapter 5).
 *
 * Frame-timing fields (avg_frame_interval_ms, frame_timestamps),
 * camera_permission_granted, camera_resolution, and screen_detection
 * are populated by the component at upload time because they are not
 * known until capture completes.
 */

import { collectCameraInventory } from './capture-source';
import type {
  AutomationSignals,
  WebIntegritySignals,
  FeatureSupportSignals,
  PermissionsStateSignals,
} from '../types';

/**
 * Collect all browser integrity signals for DeepSense scoring.
 */
export async function collectWebIntegritySignals(): Promise<WebIntegritySignals> {
  // ── Feature support (all synchronous) ──────────────────────────────────
  const feature_support: FeatureSupportSignals = {
    supports_webgl: detectWebGL(),
    supports_webgl2: detectWebGL2(),
    supports_web_audio:
      typeof AudioContext !== 'undefined' ||
      typeof (window as any).webkitAudioContext !== 'undefined',
    supports_webrtc: typeof RTCPeerConnection !== 'undefined',
    supports_media_recorder: typeof MediaRecorder !== 'undefined',
    supports_wasm: typeof WebAssembly !== 'undefined',
    supports_service_worker: 'serviceWorker' in navigator,
    supports_intersection_observer: typeof IntersectionObserver !== 'undefined',
    supports_web_crypto: !!(
      typeof crypto !== 'undefined' && (crypto as any).subtle
    ),
    supports_shared_array_buffer: typeof SharedArrayBuffer !== 'undefined',
  };

  // ── Permissions state (async, best-effort) ──────────────────────────────
  const permissions_state: PermissionsStateSignals = {
    camera: 'unsupported',
    microphone: 'unsupported',
    geolocation: 'unsupported',
    notifications: 'unsupported',
  };
  if (navigator.permissions) {
    for (const name of [
      'camera',
      'microphone',
      'geolocation',
      'notifications',
    ] as const) {
      try {
        const r = await navigator.permissions.query({
          name: name as PermissionName,
        });
        permissions_state[name] = r.state;
      } catch {
        // leave as 'unsupported'
      }
    }
  }

  // ── Synchronous signals ─────────────────────────────────────────────────
  const signals: WebIntegritySignals = {
    channel_type: 'web',

    user_agent: navigator.userAgent,
    webdriver: !!(navigator as any).webdriver,
    do_not_track: (navigator as any).doNotTrack ?? null,
    automation_detected: detectAutomation(),
    automation: collectAutomationSignals(),

    cookie_enabled: navigator.cookieEnabled,
    has_focus: document.hasFocus(),
    visibility_state: document.visibilityState,

    hardware_concurrency: navigator.hardwareConcurrency || null,
    device_memory: (navigator as any).deviceMemory || null,
    max_touch_points: navigator.maxTouchPoints ?? null,

    screen_resolution: `${screen.width}x${screen.height}`,
    screen_available: `${screen.availWidth}x${screen.availHeight}`,
    color_depth: screen.colorDepth || null,
    viewport_size: `${window.innerWidth}x${window.innerHeight}`,
    device_pixel_ratio: window.devicePixelRatio || 1,

    timezone: null,
    timezone_offset: new Date().getTimezoneOffset(),
    language: navigator.language,
    languages: navigator.languages ? [...navigator.languages] : [],

    canvas_hash: computeCanvasHash(),
    webgl_vendor: null,
    webgl_renderer: null,
    webgl_extensions: [],
    audio_fingerprint: null,

    // Populated by the component at upload time
    avg_frame_interval_ms: 0,
    frame_timestamps: [],

    feature_support,
    permissions_state,

    collected_at: new Date().toISOString(),
  };

  // ── Timezone ────────────────────────────────────────────────────────────
  try {
    signals.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    // not available
  }

  // ── WebGL renderer strings + extensions ─────────────────────────────────
  try {
    const canvas = document.createElement('canvas');
    const gl =
      canvas.getContext('webgl2') ||
      canvas.getContext('webgl') ||
      canvas.getContext('experimental-webgl');
    if (gl) {
      const glCtx = gl as WebGLRenderingContext;
      const dbg = glCtx.getExtension('WEBGL_debug_renderer_info');
      if (dbg) {
        signals.webgl_vendor = glCtx.getParameter(dbg.UNMASKED_VENDOR_WEBGL) || null;
        signals.webgl_renderer = glCtx.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || null;
      }
      signals.webgl_extensions = glCtx.getSupportedExtensions() || [];
    }
  } catch {
    // not available
  }

  // ── Audio fingerprint (OfflineAudioContext oscillator) ───────────────────
  try {
    signals.audio_fingerprint = await computeAudioFingerprint();
  } catch {
    // not available
  }

  // ── Battery Status API ──────────────────────────────────────────────────
  try {
    const b = await (navigator as any).getBattery?.();
    if (b) {
      signals.battery = {
        charging: b.charging,
        level: b.level,
      };
    }
  } catch {
    // not available (Firefox, Safari)
  }

  // ── Camera inventory (no prompt) ────────────────────────────────────────
  // enumerateDevices() without opening the camera: a count, plus labels only
  // when the origin already holds camera permission. Client-reported and
  // spoofable; the server treats it as evidence, never proof (G03).
  try {
    const inventory = await collectCameraInventory();
    if (inventory) signals.camera_inventory = inventory;
  } catch {
    // not available
  }

  // ── Network Information API ─────────────────────────────────────────────
  try {
    const conn =
      (navigator as any).connection ||
      (navigator as any).mozConnection ||
      (navigator as any).webkitConnection;
    if (conn) {
      signals.connection = {
        effective_type: conn.effectiveType || null,
        downlink: conn.downlink ?? null,
        rtt: conn.rtt ?? null,
        save_data: conn.saveData ?? null,
      };
    }
  } catch {
    // not available
  }

  console.log(
    `[UseSense] Collected ${Object.keys(signals).length} web integrity signals`
  );
  return signals;
}

// ── Helpers ───────────────────────────────────────────────────────────────

function detectWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return !!(
      canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
    );
  } catch {
    return false;
  }
}

function detectWebGL2(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return !!canvas.getContext('webgl2');
  } catch {
    return false;
  }
}

function computeCanvasHash(): number {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 50;
    const ctx = canvas.getContext('2d');
    if (!ctx) return 0;

    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillStyle = '#f60';
    ctx.fillRect(125, 1, 62, 20);
    ctx.fillStyle = '#069';
    ctx.fillText('UseSense', 2, 15);
    ctx.fillStyle = 'rgba(102,204,0,0.7)';
    ctx.fillText('UseSense', 4, 17);

    const dataUrl = canvas.toDataURL();
    let hash = 0;
    for (let i = 0; i < dataUrl.length; i++) {
      hash = ((hash << 5) - hash) + dataUrl.charCodeAt(i);
      hash |= 0;
    }
    return hash;
  } catch {
    return 0;
  }
}

// ── Automation evidence (detection only) ──────────────────────────────────

const inputCounts = { pointer: 0, touch: 0, key: 0 };
let countingInput = false;

/**
 * Count real input events (passive listeners, no data kept beyond the counts).
 * Started when this module loads in a browser, so the counts cover the page's
 * whole life up to capture.
 */
export function startInputCounting(): void {
  if (countingInput || typeof window === 'undefined' || typeof window.addEventListener !== 'function') return;
  countingInput = true;
  const opts = { passive: true, capture: true } as AddEventListenerOptions;
  window.addEventListener('pointerdown', () => { inputCounts.pointer++; }, opts);
  window.addEventListener('touchstart', () => { inputCounts.touch++; }, opts);
  window.addEventListener('keydown', () => { inputCounts.key++; }, opts);
}
startInputCounting();

/** Framework markers left by common automation tools. */
export function automationMarkers(win: any = typeof window !== 'undefined' ? window : {}, doc: any = typeof document !== 'undefined' ? document : {}, nav: any = typeof navigator !== 'undefined' ? navigator : {}): string[] {
  const out = new Set<string>();
  try {
    if (doc.documentElement?.getAttribute?.('webdriver') !== null && doc.documentElement?.getAttribute?.('webdriver') !== undefined) out.add('webdriver_attr');
    if (doc.__selenium_unwrapped || doc.__webdriver_evaluate || doc.__selenium_evaluate || win._selenium || win.callSelenium || win._Selenium_IDE_Recorder) out.add('selenium');
    if (win.callPhantom || win._phantom) out.add('phantomjs');
    if (win.__nightmare) out.add('nightmare');
    if (win.__playwright__binding__ || win.__pwInitScripts || win.__playwright_evaluation_script__) out.add('playwright');
    if (win.__puppeteer_evaluation_script__ || /__puppeteer_evaluation_script__/.test(String(new Error().stack || ''))) out.add('puppeteer');
    if (win.domAutomation || win.domAutomationController) out.add('dom_automation');
    // ChromeDriver / CDP leave cdc_-prefixed properties on document or window.
    for (const o of [doc, win]) {
      for (const k of Object.keys(o || {})) if (/^\$?cdc_|^\$wdc_/.test(k)) out.add('cdp');
    }
    if (Array.isArray(nav.userAgentData?.brands) && nav.userAgentData.brands.some((b: any) => /headless/i.test(String(b?.brand)))) out.add('cdp');
  } catch {
    // property access threw: ignore, detection is best effort
  }
  return [...out];
}

/** Does navigator.userAgentData tell the same story as the user agent string? */
export function userAgentHintsMismatch(nav: any = typeof navigator !== 'undefined' ? navigator : {}): { mismatch: boolean; detail?: string } {
  const ua = String(nav.userAgent || '');
  const ch = nav.userAgentData;
  if (!ch) return { mismatch: false };
  const platform = String(ch.platform || '').toLowerCase();
  const uaPlatform = /android/i.test(ua) ? 'android' : /windows/i.test(ua) ? 'windows' : /mac os x|macintosh/i.test(ua) ? 'macos' : /cros/i.test(ua) ? 'chrome os' : /linux/i.test(ua) ? 'linux' : '';
  if (platform && uaPlatform && platform !== uaPlatform) return { mismatch: true, detail: `platform ${platform} vs ua ${uaPlatform}` };
  const brands: string[] = Array.isArray(ch.brands) ? ch.brands.map((b: any) => String(b?.brand || '')) : [];
  const claimsChrome = /Chrome\//.test(ua) && !/Edg\//.test(ua);
  if (claimsChrome && brands.length > 0 && !brands.some((b) => /chrom/i.test(b))) return { mismatch: true, detail: `ua says Chrome, brands ${brands.join('|')}` };
  return { mismatch: false };
}

function collectAutomationSignals(): AutomationSignals {
  const ch = userAgentHintsMismatch();
  return {
    markers: automationMarkers(),
    ua_ch_mismatch: ch.mismatch,
    ...(ch.detail ? { ua_ch_detail: ch.detail } : {}),
    input_events: { ...inputCounts },
  };
}

/**
 * Detect automation/headless environments.
 * Checks for common automation indicators.
 */
function detectAutomation(): boolean {
  try {
    const nav = navigator as any;
    const win = window as any;
    const doc = document as any;

    return !!(
      nav.webdriver ||
      win.domAutomation ||
      win.__nightmare ||
      doc.__selenium_unwrapped ||
      win.callPhantom ||
      win._phantom ||
      (nav.userAgent && /HeadlessChrome/.test(nav.userAgent))
    );
  } catch {
    return false;
  }
}

/**
 * Compute audio fingerprint using OfflineAudioContext.
 * Returns a numeric hash of the oscillator output.
 */
async function computeAudioFingerprint(): Promise<number | null> {
  try {
    const OfflineCtx =
      (window as any).OfflineAudioContext ||
      (window as any).webkitOfflineAudioContext;
    if (!OfflineCtx) return null;

    const ctx = new OfflineCtx(1, 44100, 44100);
    const oscillator = ctx.createOscillator();
    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(10000, ctx.currentTime);

    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.setValueAtTime(-50, ctx.currentTime);
    compressor.knee.setValueAtTime(40, ctx.currentTime);
    compressor.ratio.setValueAtTime(12, ctx.currentTime);
    compressor.attack.setValueAtTime(0, ctx.currentTime);
    compressor.release.setValueAtTime(0.25, ctx.currentTime);

    oscillator.connect(compressor);
    compressor.connect(ctx.destination);
    oscillator.start(0);

    const buffer = await ctx.startRendering();
    const data = buffer.getChannelData(0);

    let sum = 0;
    for (let i = 4500; i < 5000; i++) {
      sum += Math.abs(data[i]);
    }

    // Convert to integer hash
    let hash = 0;
    const sumStr = sum.toString();
    for (let i = 0; i < sumStr.length; i++) {
      hash = ((hash << 5) - hash) + sumStr.charCodeAt(i);
      hash |= 0;
    }
    return hash;
  } catch {
    return null;
  }
}
