/**
 * capture-source.ts -- capture-source evidence for web captures (gap G03).
 *
 * Ported from Watchtower (frontend/src/utils/capture-source.ts) so the hosted
 * pages can run on the SDK. The payload is byte-compatible with what the
 * hosted capture engine sent: the server scores it in
 * watchtower-api modules/device-trust/capture-source.ts.
 *
 * Collected at capture time from the live MediaStream: the selected video
 * track's label, a SHA-256 hash of its deviceId (never the raw id),
 * track.getSettings(), track.getCapabilities() where the browser has it, the
 * video-input inventory from enumerateDevices(), and a match against a
 * maintained list of known virtual camera drivers. Sent as
 * `channel_integrity.capture_source`; the server re-runs the matcher and the
 * inconsistency checks itself and never trusts the client's own verdict.
 *
 * EVIDENCE, NOT PROOF. Labels and settings are whatever the driver and the
 * page report. Anyone controlling the browser can rename a virtual camera or
 * patch these APIs, so a clean report proves nothing and a match is a strong
 * hint, not a verdict.
 *
 * The driver list below MUST stay in step with VIRTUAL_CAMERA_DRIVERS on the
 * server (same ids, same order); capture-source.test.ts pins the ids.
 */

/** A known virtual camera driver, matched against device labels. */
export interface VirtualCameraDriver {
  readonly id: string;
  readonly name: string;
  readonly pattern: RegExp;
  readonly confidence: 'high' | 'medium';
}

/** Known virtual camera drivers, most specific first (generic catch-all last). */
export const VIRTUAL_CAMERA_DRIVERS: readonly VirtualCameraDriver[] = [
  { id: 'obs', name: 'OBS Virtual Camera', pattern: /\bobs\b.*(virtual|cam)|obs-camera|obs virtualcam/i, confidence: 'high' },
  { id: 'manycam', name: 'ManyCam', pattern: /manycam/i, confidence: 'high' },
  { id: 'snap_camera', name: 'Snap Camera', pattern: /snap\s*camera/i, confidence: 'high' },
  { id: 'xsplit', name: 'XSplit VCam', pattern: /xsplit/i, confidence: 'high' },
  { id: 'e2esoft_vcam', name: 'e2eSoft VCam', pattern: /e2e\s*soft|\bvcam\b/i, confidence: 'high' },
  { id: 'ivcam', name: 'iVCam', pattern: /\bivcam\b/i, confidence: 'high' },
  { id: 'camtwist', name: 'CamTwist', pattern: /camtwist/i, confidence: 'high' },
  { id: 'mmhmm', name: 'mmhmm', pattern: /mmhmm/i, confidence: 'high' },
  { id: 'nvidia_broadcast', name: 'NVIDIA Broadcast', pattern: /nvidia\s*broadcast/i, confidence: 'high' },
  { id: 'logi_capture', name: 'Logi Capture virtual camera', pattern: /logi(tech)?\s*capture/i, confidence: 'high' },
  { id: 'droidcam', name: 'DroidCam', pattern: /droid\s*cam/i, confidence: 'high' },
  { id: 'epoccam', name: 'EpocCam', pattern: /epoc\s*cam/i, confidence: 'high' },
  { id: 'iriun', name: 'Iriun Webcam', pattern: /iriun/i, confidence: 'high' },
  { id: 'camo', name: 'Reincubate Camo', pattern: /\bcamo\b|reincubate/i, confidence: 'high' },
  { id: 'vmix', name: 'vMix Video', pattern: /\bvmix\b/i, confidence: 'high' },
  { id: 'splitcam', name: 'SplitCam', pattern: /splitcam/i, confidence: 'high' },
  { id: 'youcam', name: 'CyberLink YouCam', pattern: /\byoucam\b/i, confidence: 'high' },
  { id: 'streamlabs', name: 'Streamlabs virtual camera', pattern: /streamlabs/i, confidence: 'high' },
  { id: 'wirecast', name: 'Wirecast virtual camera', pattern: /wirecast/i, confidence: 'high' },
  { id: 'unity_capture', name: 'Unity Video Capture', pattern: /unity\s*(video\s*)?capture/i, confidence: 'high' },
  { id: 'akvcam', name: 'akvcam / Webcamoid', pattern: /akvcam|webcamoid/i, confidence: 'high' },
  { id: 'v4l2loopback', name: 'v4l2loopback', pattern: /v4l2\s*loopback|dummy video device/i, confidence: 'high' },
  { id: 'ndi', name: 'NDI Virtual Input', pattern: /\bndi\b.*(webcam|virtual|video)/i, confidence: 'high' },
  { id: 'chromacam', name: 'ChromaCam', pattern: /chromacam/i, confidence: 'high' },
  { id: 'facerig', name: 'FaceRig', pattern: /facerig/i, confidence: 'high' },
  { id: 'avatarify', name: 'Avatarify', pattern: /avatarify/i, confidence: 'high' },
  { id: 'generic_virtual', name: 'Generic virtual camera', pattern: /virtual|\bfake\b|loopback|emulat/i, confidence: 'medium' },
];

/** A driver a label matched. */
export interface VirtualCameraMatch {
  id: string;
  name: string;
  confidence: 'high' | 'medium';
}

/** The known virtual camera driver a device label names, or null. */
export function matchVirtualCameraLabel(label: string | null | undefined): VirtualCameraMatch | null {
  const l = (label ?? '').trim();
  if (!l) return null;
  for (const d of VIRTUAL_CAMERA_DRIVERS) {
    if (d.pattern.test(l)) return { id: d.id, name: d.name, confidence: d.confidence };
  }
  return null;
}

/** Most labels we send; a machine with more cameras than this is reported by count. */
const MAX_LABELS = 10;
const MAX_LABEL_LENGTH = 120;

async function sha256Hex(value: string): Promise<string | null> {
  try {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
  } catch {
    return null;
  }
}

function clip(label: string): string {
  return label.length > MAX_LABEL_LENGTH ? label.slice(0, MAX_LABEL_LENGTH) : label;
}

function numberRange(r: unknown): { min?: number; max?: number } | null {
  if (!r || typeof r !== 'object') return null;
  const { min, max } = r as { min?: unknown; max?: unknown };
  const out: { min?: number; max?: number } = {};
  if (typeof min === 'number' && Number.isFinite(min)) out.min = min;
  if (typeof max === 'number' && Number.isFinite(max)) out.max = max;
  return out.min === undefined && out.max === undefined ? null : out;
}

async function videoInputs(): Promise<MediaDeviceInfo[] | null> {
  try {
    if (!navigator.mediaDevices?.enumerateDevices) return null;
    return (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput');
  } catch {
    return null;
  }
}

/** Video-input inventory, sent as `channel_integrity.camera_inventory`. */
export interface CameraInventory {
  video_input_count: number | null;
  /** Non-empty labels only. Browsers blank labels until camera permission is granted. */
  labels: string[];
  virtual_label_matches: string[];
}

/**
 * Camera inventory without opening the camera (no permission prompt). Labels
 * are empty unless the origin already holds camera permission, so this is
 * mostly a count before capture. Used by the camera-free Device Trust step.
 */
export async function collectCameraInventory(): Promise<CameraInventory | null> {
  const inputs = await videoInputs();
  if (!inputs) return null;
  const labels = inputs.map((d) => d.label).filter((l) => !!l).slice(0, MAX_LABELS).map(clip);
  const matches = new Set<string>();
  for (const l of labels) {
    const m = matchVirtualCameraLabel(l);
    if (m) matches.add(m.id);
  }
  return { video_input_count: inputs.length, labels, virtual_label_matches: [...matches] };
}

/** Capture-source evidence, sent as `channel_integrity.capture_source`. */
export interface CaptureSourceEvidence {
  schema: 1;
  /** Always client-reported: nothing in this object is attested. */
  evidence: 'client_reported';
  surface: string;
  collected_at: string;
  label: string | null;
  device_id_hash: string | null;
  settings: {
    width: number | null;
    height: number | null;
    frameRate: number | null;
    facingMode: string | null;
    resizeMode: string | null;
    aspectRatio: number | null;
    device_id_hash: string | null;
  } | null;
  capabilities: {
    width: { min?: number; max?: number } | null;
    height: { min?: number; max?: number } | null;
    frameRate: { min?: number; max?: number } | null;
    facingMode: string[] | null;
    resizeMode: string[] | null;
  } | null;
  video_input_count: number | null;
  video_input_labels: string[];
  selected_in_inventory: boolean | null;
  user_agent: string;
  /** The client's own read of the driver list; the server recomputes it. */
  client_virtual_match: VirtualCameraMatch | null;
}

/**
 * Collect capture-source evidence from the stream that fed a capture. Call it
 * after getUserMedia resolves (labels are populated once permission is held).
 * Never throws: on any failure the field is null, so a capture is never held
 * up by evidence gathering.
 */
export async function collectCaptureSourceEvidence(stream: MediaStream | null, surface: string): Promise<CaptureSourceEvidence | null> {
  try {
    const track = stream?.getVideoTracks?.()[0];
    if (!track) return null;

    let settings: MediaTrackSettings | null = null;
    try { settings = track.getSettings ? track.getSettings() : null; } catch { settings = null; }

    // getCapabilities is missing on older Firefox; absence is reported as null.
    let caps: MediaTrackCapabilities | null = null;
    try {
      const t = track as MediaStreamTrack & { getCapabilities?: () => MediaTrackCapabilities };
      caps = typeof t.getCapabilities === 'function' ? t.getCapabilities() : null;
    } catch { caps = null; }

    const rawDeviceId = settings?.deviceId ?? '';
    const deviceIdHash = rawDeviceId ? await sha256Hex(rawDeviceId) : null;

    const inputs = await videoInputs();
    const labels = (inputs ?? []).map((d) => d.label).filter((l) => !!l).slice(0, MAX_LABELS).map(clip);
    const selectedInInventory = inputs && rawDeviceId ? inputs.some((d) => d.deviceId === rawDeviceId) : null;

    const label = typeof track.label === 'string' ? clip(track.label) : null;
    const capsRecord = caps as (MediaTrackCapabilities & { resizeMode?: string[] }) | null;
    const settingsRecord = settings as (MediaTrackSettings & { resizeMode?: string }) | null;

    return {
      schema: 1,
      evidence: 'client_reported',
      surface,
      collected_at: new Date().toISOString(),
      label,
      device_id_hash: deviceIdHash,
      settings: settingsRecord
        ? {
          width: typeof settingsRecord.width === 'number' ? settingsRecord.width : null,
          height: typeof settingsRecord.height === 'number' ? settingsRecord.height : null,
          frameRate: typeof settingsRecord.frameRate === 'number' ? settingsRecord.frameRate : null,
          facingMode: typeof settingsRecord.facingMode === 'string' && settingsRecord.facingMode ? settingsRecord.facingMode : null,
          resizeMode: typeof settingsRecord.resizeMode === 'string' ? settingsRecord.resizeMode : null,
          aspectRatio: typeof settingsRecord.aspectRatio === 'number' ? settingsRecord.aspectRatio : null,
          device_id_hash: deviceIdHash,
        }
        : null,
      capabilities: capsRecord
        ? {
          width: numberRange(capsRecord.width),
          height: numberRange(capsRecord.height),
          frameRate: numberRange(capsRecord.frameRate),
          facingMode: Array.isArray(capsRecord.facingMode) ? capsRecord.facingMode.slice(0, 8) : null,
          resizeMode: Array.isArray(capsRecord.resizeMode) ? capsRecord.resizeMode.slice(0, 8) : null,
        }
        : null,
      video_input_count: inputs ? inputs.length : null,
      video_input_labels: labels,
      selected_in_inventory: selectedInInventory,
      user_agent: navigator.userAgent,
      client_virtual_match: matchVirtualCameraLabel(label),
    };
  } catch {
    return null;
  }
}
