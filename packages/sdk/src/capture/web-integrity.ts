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

import type {
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
