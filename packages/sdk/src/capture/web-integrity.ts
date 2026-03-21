/**
 * DeepSense browser signal collection (~50 signals).
 *
 * Collected once during initialization and sent with the signal upload.
 * Each signal is collected best-effort; failures are silently skipped.
 */

import type { WebIntegritySignals } from '../types';

/**
 * Collect all browser integrity signals for DeepSense scoring.
 */
export async function collectWebIntegritySignals(): Promise<WebIntegritySignals> {
  const signals: WebIntegritySignals = {
    // Identity
    user_agent: navigator.userAgent,
    platform: navigator.platform,
    language: navigator.language,
    languages: navigator.languages ? [...navigator.languages] : [],

    // Automation detection
    webdriver: !!(navigator as any).webdriver,
    automation_detected:
      !!(navigator as any).webdriver ||
      !!(window as any).callPhantom ||
      !!(window as any)._phantom ||
      !!(window as any).__nightmare ||
      !!(window as any).domAutomation ||
      !!(window as any).domAutomationController ||
      /HeadlessChrome/.test(navigator.userAgent) ||
      /Selenium|PhantomJS|Nightmare/.test(navigator.userAgent),

    // Screen
    screen_width: screen.width,
    screen_height: screen.height,
    screen_resolution: `${screen.width}x${screen.height}`,
    color_depth: screen.colorDepth,
    pixel_ratio: window.devicePixelRatio || 1,
    avail_width: screen.availWidth,
    avail_height: screen.availHeight,

    // Window
    inner_width: window.innerWidth,
    inner_height: window.innerHeight,

    // Locale
    timezone: null,
    timezone_offset: new Date().getTimezoneOffset(),

    // Feature support
    supports_webgl: detectWebGL(),
    supports_webgl2: detectWebGL2(),
    supports_webaudio:
      typeof AudioContext !== 'undefined' ||
      typeof (window as any).webkitAudioContext !== 'undefined',
    supports_webrtc: !!(
      navigator.mediaDevices && navigator.mediaDevices.getUserMedia
    ),
    supports_wasm: typeof WebAssembly !== 'undefined',
    supports_service_worker: 'serviceWorker' in navigator,
    supports_indexeddb: typeof indexedDB !== 'undefined',
    supports_localstorage: detectLocalStorage(),
    supports_cookie: navigator.cookieEnabled,
    supports_touch: navigator.maxTouchPoints > 0,
    max_touch_points: navigator.maxTouchPoints || 0,

    // Canvas fingerprint
    canvas_hash: computeCanvasHash(),

    // Hardware
    hardware_concurrency: navigator.hardwareConcurrency || null,
    device_memory: (navigator as any).deviceMemory || null,

    // Network
    connection_type: null,
    connection_effective_type: null,
    connection_downlink: null,
    connection_rtt: null,

    // WebGL renderer
    webgl_vendor: null,
    webgl_renderer: null,

    // Permissions (filled below)
    camera_permission: null,
    microphone_permission: null,

    collected_at: new Date().toISOString(),
  };

  // Timezone
  try {
    signals.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    // not available
  }

  // Network connection info
  try {
    const conn =
      (navigator as any).connection ||
      (navigator as any).mozConnection ||
      (navigator as any).webkitConnection;
    if (conn) {
      signals.connection_type = conn.type || null;
      signals.connection_effective_type = conn.effectiveType || null;
      signals.connection_downlink = conn.downlink ?? null;
      signals.connection_rtt = conn.rtt ?? null;
    }
  } catch {
    // not available
  }

  // WebGL renderer extraction
  try {
    const canvas = document.createElement('canvas');
    const gl =
      canvas.getContext('webgl2') ||
      canvas.getContext('webgl') ||
      canvas.getContext('experimental-webgl');
    if (gl) {
      const debugExt = (gl as WebGLRenderingContext).getExtension(
        'WEBGL_debug_renderer_info'
      );
      if (debugExt) {
        signals.webgl_vendor =
          (gl as WebGLRenderingContext).getParameter(
            debugExt.UNMASKED_VENDOR_WEBGL
          ) || null;
        signals.webgl_renderer =
          (gl as WebGLRenderingContext).getParameter(
            debugExt.UNMASKED_RENDERER_WEBGL
          ) || null;
      }
    }
  } catch {
    // not available
  }

  // Permissions state (async, best-effort)
  if (navigator.permissions) {
    try {
      const cam = await navigator.permissions.query({
        name: 'camera' as PermissionName,
      });
      signals.camera_permission = cam.state;
    } catch {
      // not supported
    }
    try {
      const mic = await navigator.permissions.query({
        name: 'microphone' as PermissionName,
      });
      signals.microphone_permission = mic.state;
    } catch {
      // not supported
    }
  }

  console.log(
    `[UseSense] Collected ${Object.keys(signals).length} web integrity signals`
  );

  return signals;
}

// ── Helpers ──────────────────────────────────────────────────────────────

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

function detectLocalStorage(): boolean {
  try {
    localStorage.setItem('_usesense_test', '1');
    localStorage.removeItem('_usesense_test');
    return true;
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
