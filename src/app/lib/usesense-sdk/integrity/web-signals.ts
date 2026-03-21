import {
  WebIntegritySignals,
  PermissionsState,
  FeatureSupport,
  BatteryInfo,
  ConnectionInfo,
} from '../types';

/**
 * Collect comprehensive web integrity signals matching the server metadata.json schema.
 * These signals feed into the DeepSense (Channel Trust) scoring pillar.
 */
export async function collectWebIntegritySignals(): Promise<WebIntegritySignals> {
  try {
    const [
      permissions,
      battery,
      connection,
      webglInfo,
    ] = await Promise.all([
      collectPermissionsState(),
      collectBattery(),
      collectConnectionInfo(),
      collectWebGLInfo(),
    ]);

    return {
      webdriver: navigator.webdriver || false,
      permissions_state: permissions,
      webgl_renderer: webglInfo.renderer,
      webgl_vendor: webglInfo.vendor,
      canvas_hash: computeCanvasHash(),
      screen_resolution: `${screen.width}x${screen.height}`,
      hardware_concurrency: navigator.hardwareConcurrency || 0,
      device_memory: (navigator as any).deviceMemory || 0,
      color_depth: screen.colorDepth,
      cookie_enabled: navigator.cookieEnabled,
      has_focus: document.hasFocus(),
      visibility_state: document.visibilityState,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      languages: [...navigator.languages],
      do_not_track: navigator.doNotTrack || null,
      viewport_size: `${window.innerWidth}x${window.innerHeight}`,
      battery,
      connection,
      feature_support: collectFeatureSupport(),
    };
  } catch (error) {
    console.error('[UseSense] Error collecting web integrity signals:', error);
    // Return minimal fallback data
    return {
      webdriver: false,
      permissions_state: { camera: 'unknown', microphone: 'unknown' },
      webgl_renderer: null,
      webgl_vendor: null,
      canvas_hash: 0,
      screen_resolution: `${screen.width}x${screen.height}`,
      hardware_concurrency: navigator.hardwareConcurrency || 0,
      device_memory: 0,
      color_depth: screen.colorDepth,
      cookie_enabled: navigator.cookieEnabled,
      has_focus: document.hasFocus(),
      visibility_state: document.visibilityState,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      languages: [...(navigator.languages || ['en-US'])],
      do_not_track: null,
      viewport_size: `${window.innerWidth}x${window.innerHeight}`,
      battery: null,
      connection: null,
      feature_support: {
        supports_webgl: false,
        supports_web_audio: false,
        supports_webrtc: false,
        supports_media_recorder: false,
        supports_wasm: false,
        supports_service_worker: false,
      },
    };
  }
}

/**
 * Check permissions state (best-effort)
 */
async function collectPermissionsState(): Promise<PermissionsState> {
  const state: PermissionsState = { camera: 'unknown', microphone: 'unknown' };

  if ('permissions' in navigator && navigator.permissions) {
    try {
      const cameraPermission = await navigator.permissions.query({ name: 'camera' as PermissionName });
      state.camera = cameraPermission.state;
    } catch {
      // Permission API not fully supported for camera
    }

    try {
      const micPermission = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      state.microphone = micPermission.state;
    } catch {
      // Permission API not fully supported for microphone
    }
  }

  return state;
}

/**
 * Collect battery info
 */
async function collectBattery(): Promise<BatteryInfo | null> {
  try {
    const b = await (navigator as any).getBattery();
    return { charging: b.charging, level: b.level };
  } catch {
    return null;
  }
}

/**
 * Collect network connection info
 */
function collectConnectionInfo(): ConnectionInfo | null {
  const conn = (navigator as any).connection;
  if (!conn) return null;
  return {
    effectiveType: conn.effectiveType || 'unknown',
    downlink: conn.downlink || 0,
    rtt: conn.rtt || 0,
  };
}

/**
 * Collect WebGL renderer and vendor strings
 */
function collectWebGLInfo(): { renderer: string | null; vendor: string | null } {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || (canvas.getContext('experimental-webgl') as WebGLRenderingContext | null);
    if (!gl) return { renderer: null, vendor: null };

    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    if (!debugInfo) return { renderer: null, vendor: null };

    const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) as string;
    const vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) as string;
    return { renderer, vendor };
  } catch {
    return { renderer: null, vendor: null };
  }
}

/**
 * Compute a canvas fingerprint hash (same algorithm as server reference)
 */
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
    ctx.fillText('UseSense fingerprint', 2, 15);

    const dataUrl = canvas.toDataURL();
    let hash = 0;
    for (let i = 0; i < dataUrl.length; i++) {
      const char = dataUrl.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    return hash;
  } catch {
    return 0;
  }
}

/**
 * Detect feature support flags
 */
function collectFeatureSupport(): FeatureSupport {
  return {
    supports_webgl: !!window.WebGLRenderingContext,
    supports_web_audio: !!(window.AudioContext || (window as any).webkitAudioContext),
    supports_webrtc: !!window.RTCPeerConnection,
    supports_media_recorder: !!window.MediaRecorder,
    supports_wasm: !!window.WebAssembly,
    supports_service_worker: 'serviceWorker' in navigator,
  };
}
