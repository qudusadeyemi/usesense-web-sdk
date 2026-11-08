import { describe, it, expect, afterEach, vi } from 'vitest';
import { createHash } from 'node:crypto';
import {
  VIRTUAL_CAMERA_DRIVERS,
  collectCameraInventory,
  collectCaptureSourceEvidence,
  matchVirtualCameraLabel,
} from '../capture/capture-source';

// The server (watchtower-api modules/device-trust/capture-source.ts) keeps the
// same list and a parity test; ids and order must not drift.
const SERVER_DRIVER_IDS = [
  'obs', 'manycam', 'snap_camera', 'xsplit', 'e2esoft_vcam', 'ivcam', 'camtwist', 'mmhmm',
  'nvidia_broadcast', 'logi_capture', 'droidcam', 'epoccam', 'iriun', 'camo', 'vmix', 'splitcam',
  'youcam', 'streamlabs', 'wirecast', 'unity_capture', 'akvcam', 'v4l2loopback', 'ndi', 'chromacam',
  'facerig', 'avatarify', 'generic_virtual',
];

const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile/15E148';

function stubBrowser(devices: Array<Partial<MediaDeviceInfo>> | 'throws' | 'none') {
  vi.stubGlobal('navigator', {
    userAgent: UA,
    mediaDevices: devices === 'none' ? undefined : {
      enumerateDevices: async () => {
        if (devices === 'throws') throw new Error('nope');
        return devices;
      },
    },
  });
}

function fakeStream(track: Partial<MediaStreamTrack> & Record<string, unknown>): MediaStream {
  return { getVideoTracks: () => [track] } as unknown as MediaStream;
}

const sha32 = (s: string) => createHash('sha256').update(s).digest('hex').slice(0, 32);

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('virtual camera driver list', () => {
  it('matches the server list (ids and order)', () => {
    expect(VIRTUAL_CAMERA_DRIVERS.map((d) => d.id)).toEqual(SERVER_DRIVER_IDS);
  });
  it('attributes a label to the most specific driver', () => {
    expect(matchVirtualCameraLabel('OBS Virtual Camera')).toEqual({ id: 'obs', name: 'OBS Virtual Camera', confidence: 'high' });
    expect(matchVirtualCameraLabel('Some Virtual Device')?.id).toBe('generic_virtual');
    expect(matchVirtualCameraLabel('FaceTime HD Camera')).toBeNull();
    expect(matchVirtualCameraLabel('  ')).toBeNull();
    expect(matchVirtualCameraLabel(null)).toBeNull();
  });
});

describe('collectCameraInventory', () => {
  it('counts video inputs and keeps only non-empty labels', async () => {
    stubBrowser([
      { kind: 'videoinput', label: 'FaceTime HD Camera', deviceId: 'a' },
      { kind: 'videoinput', label: '', deviceId: 'b' },
      { kind: 'videoinput', label: 'OBS Virtual Camera', deviceId: 'c' },
      { kind: 'audioinput', label: 'Mic', deviceId: 'm' },
    ]);
    const inv = await collectCameraInventory();
    expect(JSON.stringify(inv)).toBe(
      '{"video_input_count":3,"labels":["FaceTime HD Camera","OBS Virtual Camera"],"virtual_label_matches":["obs"]}',
    );
  });
  it('is null when enumerateDevices is missing or throws', async () => {
    stubBrowser('none');
    expect(await collectCameraInventory()).toBeNull();
    stubBrowser('throws');
    expect(await collectCameraInventory()).toBeNull();
  });
});

describe('collectCaptureSourceEvidence', () => {
  it('produces the exact payload the hosted engine sent (byte-compatible)', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-08T10:00:00.000Z'));
    stubBrowser([
      { kind: 'videoinput', label: 'FaceTime HD Camera', deviceId: 'dev-1' },
      { kind: 'videoinput', label: 'OBS Virtual Camera', deviceId: 'dev-2' },
    ]);
    const stream = fakeStream({
      label: 'FaceTime HD Camera',
      getSettings: () => ({ deviceId: 'dev-1', width: 1280, height: 720, frameRate: 30, facingMode: 'user', resizeMode: 'none', aspectRatio: 1.7777777777777777 }),
      getCapabilities: () => ({
        width: { min: 1, max: 1920 }, height: { min: 1, max: 1080 }, frameRate: { min: 1, max: 30 },
        facingMode: ['user'], resizeMode: ['none', 'crop-and-scale'],
      }),
    });
    const ev = await collectCaptureSourceEvidence(stream, 'verification_capture_engine');
    const h = sha32('dev-1');
    expect(JSON.stringify(ev)).toBe(
      '{"schema":1,"evidence":"client_reported","surface":"verification_capture_engine",' +
      '"collected_at":"2026-11-08T10:00:00.000Z","label":"FaceTime HD Camera",' +
      `"device_id_hash":"${h}",` +
      '"settings":{"width":1280,"height":720,"frameRate":30,"facingMode":"user","resizeMode":"none",' +
      `"aspectRatio":1.7777777777777777,"device_id_hash":"${h}"},` +
      '"capabilities":{"width":{"min":1,"max":1920},"height":{"min":1,"max":1080},"frameRate":{"min":1,"max":30},' +
      '"facingMode":["user"],"resizeMode":["none","crop-and-scale"]},' +
      '"video_input_count":2,"video_input_labels":["FaceTime HD Camera","OBS Virtual Camera"],' +
      `"selected_in_inventory":true,"user_agent":"${UA}","client_virtual_match":null}`,
    );
  });

  it('hashes, never sends, the raw deviceId, and flags a virtual camera in use', async () => {
    stubBrowser([{ kind: 'videoinput', label: 'OBS Virtual Camera', deviceId: 'raw-device-id' }]);
    const ev = await collectCaptureSourceEvidence(fakeStream({
      label: 'OBS Virtual Camera',
      getSettings: () => ({ deviceId: 'raw-device-id', width: 1920, height: 1080, frameRate: 30 }),
    }), 'verification_capture_engine');
    expect(JSON.stringify(ev)).not.toContain('raw-device-id');
    expect(ev!.device_id_hash).toBe(sha32('raw-device-id'));
    expect(ev!.device_id_hash).toHaveLength(32);
    expect(ev!.client_virtual_match).toEqual({ id: 'obs', name: 'OBS Virtual Camera', confidence: 'high' });
    // getCapabilities missing (older Firefox) is reported as null.
    expect(ev!.capabilities).toBeNull();
  });

  it('caps labels at 10 and 120 characters, and reports a device missing from the inventory', async () => {
    const many = Array.from({ length: 14 }, (_, i) => ({ kind: 'videoinput' as const, label: `Cam ${i} ${'x'.repeat(200)}`, deviceId: `d${i}` }));
    stubBrowser(many);
    const ev = await collectCaptureSourceEvidence(fakeStream({
      label: 'y'.repeat(300),
      getSettings: () => ({ deviceId: 'not-listed' }),
    }), 'hosted_flow_document_camera');
    expect(ev!.video_input_count).toBe(14);
    expect(ev!.video_input_labels).toHaveLength(10);
    expect(ev!.video_input_labels.every((l) => l.length <= 120)).toBe(true);
    expect(ev!.label).toHaveLength(120);
    expect(ev!.selected_in_inventory).toBe(false);
    expect(ev!.surface).toBe('hosted_flow_document_camera');
    // Settings fields the browser did not report are null, not missing.
    expect(ev!.settings).toEqual({
      width: null, height: null, frameRate: null, facingMode: null, resizeMode: null, aspectRatio: null,
      device_id_hash: sha32('not-listed'),
    });
  });

  it('returns null with no stream or no video track, and never throws', async () => {
    stubBrowser([]);
    expect(await collectCaptureSourceEvidence(null, 'x')).toBeNull();
    expect(await collectCaptureSourceEvidence({ getVideoTracks: () => [] } as unknown as MediaStream, 'x')).toBeNull();
    const ev = await collectCaptureSourceEvidence(fakeStream({
      label: 'Cam',
      getSettings: () => { throw new Error('boom'); },
    }), 'x');
    expect(ev!.settings).toBeNull();
    expect(ev!.device_id_hash).toBeNull();
    expect(ev!.selected_in_inventory).toBeNull();
  });
});
