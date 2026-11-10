import { describe, it, expect, vi } from 'vitest';
import {
  ColourSequencePlayer,
  COLOUR_MAX_RUNS,
  EVIDENCE_CONTRACT,
  POSE_METHOD_V3,
  buildEvidenceUpload,
  captureClockMs,
  frameEvidenceFields,
  framesPerSegment,
  colourOnsetLatencies,
  estimateColourLag,
  parseEvidenceConfig,
  roundAll,
  roundTo,
  selectMeshSignals,
  setWhiteBalanceLock,
  webEvidenceCapability,
  type ColourSequenceConfig,
} from '../capture/evidence';
import { computeHeadPoseFromMatrix } from '../capture/media-pipe';
import { CoverWatch, COVER_WATCH, measureFaceRegions } from '../capture/face-cover';
import { FACE_OVAL } from '../capture/quality-gate';
import { computeMeshDigest } from '../utils/crypto';
import { exposureTime, VideoFrameClock } from '../capture/frame-capture';

// ── Fixtures (no real faces anywhere) ──────────────────────────────────────

/** The evidence block exactly as Watchtower's evidenceBlockFromChallenge sends it for a web session. */
const WEB_BLOCK = {
  contract: 'evidence-v1',
  colour_sequence: { id: 'cs_7f3a9c21', colours: ['#3D6BFF', '#FFD23F', '#B04DFF'], segment_ms: 600, lead_in_ms: 300, opacity: 0.35 },
  closer_step: { enabled: false, target_scale: 1.4, min_scale: 1.25 },
  binding_v2: { enabled: false },
  landmarks: { required: true, format: 'mp_norm_v1' },
};

const SEQ: ColourSequenceConfig = {
  id: 'cs_7f3a9c21',
  colours: ['#3D6BFF', '#FFD23F', '#B04DFF'],
  segmentMs: 600,
  leadInMs: 300,
  opacity: 0.35,
};

/** Row-major 4x4 for R = Rz(roll) * Ry(yaw) * Rx(pitch), degrees. */
function matrixFrom(yawDeg: number, pitchDeg: number, rollDeg: number): number[] {
  const r = Math.PI / 180;
  const [y, p, z] = [yawDeg * r, pitchDeg * r, rollDeg * r];
  const Rx = [[1, 0, 0], [0, Math.cos(p), -Math.sin(p)], [0, Math.sin(p), Math.cos(p)]];
  const Ry = [[Math.cos(y), 0, Math.sin(y)], [0, 1, 0], [-Math.sin(y), 0, Math.cos(y)]];
  const Rz = [[Math.cos(z), -Math.sin(z), 0], [Math.sin(z), Math.cos(z), 0], [0, 0, 1]];
  const mul = (a: number[][], b: number[][]) => a.map((row, i) => b[0].map((_, j) => row.reduce((s, _v, k) => s + a[i][k] * b[k][j], 0)));
  const R = mul(Rz, mul(Ry, Rx));
  return [...R[0], 1.5, ...R[1], -2.25, ...R[2], -40.123456, 0, 0, 0, 1];
}

/** Watchtower evidence-record.ts poseFromMatrix, copied verbatim (the server's reading). */
function serverPose(m: number[]) {
  const RAD = 180 / Math.PI;
  const r = (row: number, col: number) => m[row * 4 + col];
  return {
    yaw: Math.atan2(-r(2, 0), Math.sqrt(r(0, 0) ** 2 + r(1, 0) ** 2)) * RAD,
    pitch: Math.atan2(r(2, 1), r(2, 2)) * RAD,
    roll: Math.atan2(r(1, 0), r(0, 0)) * RAD,
  };
}

/** Watchtower evidence-geometry.ts handednessFlipped, copied verbatim. */
function serverHandednessFlipped(flat: number[]): boolean | null {
  const x = (i: number) => flat[i * 3];
  const votes = [x(33) - x(263), x(133) - x(362), x(61) - x(291)];
  if (votes.every((v) => v < 0)) return false;
  if (votes.every((v) => v > 0)) return true;
  return null;
}

/** 478 synthetic landmarks with many decimals, subject's right eye (33) on the image left. */
function synthFlat(): number[] {
  const out: number[] = [];
  for (let i = 0; i < 478; i++) out.push(0.3 + (i % 37) * 0.0101234567, 0.2 + (i % 41) * 0.0123456789, -0.0312345678 + i * 1e-6);
  const set = (i: number, x: number) => { out[i * 3] = x; };
  set(33, 0.36); set(133, 0.45); set(362, 0.55); set(263, 0.64); set(61, 0.42); set(291, 0.58);
  return out;
}

/** A fake requestAnimationFrame the test steps by hand. */
function fakeFrames() {
  let next = 1;
  const pending = new Map<number, (t: number) => void>();
  return {
    requestFrame: (cb: (t: number) => void) => { const id = next++; pending.set(id, cb); return id; },
    cancelFrame: (id: number) => { pending.delete(id); },
    /** Run every pending callback at time t. */
    tick(t: number) { const cbs = [...pending.values()]; pending.clear(); cbs.forEach((cb) => cb(t)); },
    get pending() { return pending.size; },
  };
}

function player(opts: { now?: () => number; origin?: number; lock?: (l: boolean) => boolean | Promise<boolean> } = {}) {
  const frames = fakeFrames();
  let clockNow = 0;
  const p = new ColourSequencePlayer(SEQ, (t) => captureClockMs(t, opts.origin ?? 1000), {
    requestFrame: frames.requestFrame,
    cancelFrame: frames.cancelFrame,
    now: opts.now ?? (() => clockNow),
    lockWhiteBalance: opts.lock,
  });
  const tints: Array<[string | null, number]> = [];
  p.host = { showTint: (c, o) => tints.push([c, o]) };
  return { p, frames, tints, setNow: (t: number) => { clockNow = t; } };
}

/** Watchtower scoreReflection's order check: segments read issued[i % n]. */
const matchesIssued = (segments: Array<{ colour: string }>) => segments.every((s, i) => s.colour === SEQ.colours[i % SEQ.colours.length]);

// ── Section 1: the evidence block ─────────────────────────────────────────

describe('parseEvidenceConfig (EVIDENCE-v1 section 1)', () => {
  it('is null when the block is absent (old server) or not an object', () => {
    expect(parseEvidenceConfig(undefined)).toBeNull();
    expect(parseEvidenceConfig(null)).toBeNull();
    expect(parseEvidenceConfig('evidence-v1')).toBeNull();
    expect(parseEvidenceConfig([WEB_BLOCK])).toBeNull();
  });

  it('treats another contract as absent', () => {
    expect(parseEvidenceConfig({ ...WEB_BLOCK, contract: 'evidence-v2' })).toBeNull();
    expect(parseEvidenceConfig({ ...WEB_BLOCK, contract: undefined })).toBeNull();
  });

  it('decodes the web block as the server sends it, flags read not assumed', () => {
    const e = parseEvidenceConfig(WEB_BLOCK)!;
    expect(e.colourSequence).toEqual(SEQ);
    expect(e.closerStep).toEqual({ enabled: false, targetScale: 1.4, minScale: 1.25 });
    expect(e.bindingV2Enabled).toBe(false);
    expect(e.landmarks).toEqual({ required: true, format: 'mp_norm_v1' });
    // A native-shaped block decodes its flags too (no per-platform hard-coding).
    const native = parseEvidenceConfig({ ...WEB_BLOCK, closer_step: { enabled: true }, binding_v2: { enabled: true } })!;
    expect(native.closerStep?.enabled).toBe(true);
    expect(native.bindingV2Enabled).toBe(true);
  });

  it('ignores unknown keys and reads every key as optional', () => {
    const e = parseEvidenceConfig({ contract: 'evidence-v1', future_key: { anything: 1 } })!;
    expect(e).toEqual({ colourSequence: null, closerStep: null, bindingV2Enabled: false, landmarks: null });
    const extra = parseEvidenceConfig({ ...WEB_BLOCK, colour_sequence: { ...WEB_BLOCK.colour_sequence, new_field: 'x' } })!;
    expect(extra.colourSequence?.id).toBe('cs_7f3a9c21');
  });

  it('reads a malformed colour sequence as absent, and upper-cases colours', () => {
    const bad = (cs: unknown) => parseEvidenceConfig({ ...WEB_BLOCK, colour_sequence: cs })!.colourSequence;
    expect(bad({ ...WEB_BLOCK.colour_sequence, colours: ['blue'] })).toBeNull();
    expect(bad({ ...WEB_BLOCK.colour_sequence, colours: [] })).toBeNull();
    expect(bad({ ...WEB_BLOCK.colour_sequence, id: '' })).toBeNull();
    expect(bad({ ...WEB_BLOCK.colour_sequence, segment_ms: -1 })).toBeNull();
    expect(bad({ ...WEB_BLOCK.colour_sequence, opacity: 'high' })).toBeNull();
    expect(bad('cs')).toBeNull();
    expect(bad({ ...WEB_BLOCK.colour_sequence, colours: ['#3d6bff', '#ffd23f'] })?.colours).toEqual(['#3D6BFF', '#FFD23F']);
  });
});

// ── Sections 4 and 5: per-frame fields ────────────────────────────────────

describe('frame evidence fields (sections 4 and 5)', () => {
  it('rounds to 5 decimals, and never writes -0', () => {
    expect(roundTo(0.1234567, 5)).toBe(0.12346);
    expect(Object.is(roundTo(-0.000001, 5), 0)).toBe(true);
    expect(roundAll([1.000004, -2.123456789])).toEqual([1, -2.12346]);
  });

  it('keeps all 478 points, rounded, in the order given (not mirrored)', () => {
    const flat = synthFlat();
    const f = frameEvidenceFields({ landmarks: flat });
    expect(f.landmarks).toHaveLength(1434);
    expect(f.landmarks.every((v) => Math.abs(v - roundTo(v, 5)) < 1e-12)).toBe(true);
    // The server's mirror check: point 33 left of 263 in the JPEG.
    expect(serverHandednessFlipped(f.landmarks)).toBe(false);
  });

  it('pose is matrix_zyx_v3 from the rounded matrix: the server agrees to the degree', () => {
    for (const [y, p, r] of [[20, 0, 0], [-33.6, 0, 0], [0, 29.2, 0], [0, 0, -9], [12, -8, 5]]) {
      const f = frameEvidenceFields({ landmarks: synthFlat(), matrix: new Float32Array(matrixFrom(y, p, r)) });
      expect(f.transformMatrix).toHaveLength(16);
      expect(f.transformMatrix!.every((v) => Math.abs(v - roundTo(v, 5)) < 1e-12)).toBe(true);
      const s = serverPose(f.transformMatrix!);
      expect(Math.abs(f.pose!.yaw - s.yaw)).toBeLessThan(0.001);
      expect(Math.abs(f.pose!.pitch - s.pitch)).toBeLessThan(0.001);
      expect(Math.abs(f.pose!.roll - s.roll)).toBeLessThan(0.001);
      expect(f.pose!.yaw).toBeCloseTo(y, 1);
      expect(f.pose!.pitch).toBeCloseTo(p, 1);
      expect(f.pose!.roll).toBeCloseTo(r, 1);
    }
  });

  it('no matrix: no pose and no transformMatrix (the engine keeps the legacy label)', () => {
    const f = frameEvidenceFields({ landmarks: synthFlat(), matrix: null });
    expect(f.pose).toBeUndefined();
    expect(f.transformMatrix).toBeUndefined();
    expect(frameEvidenceFields({ landmarks: synthFlat(), matrix: [1, 2, 3] }).pose).toBeUndefined();
  });

  it('carries only eyeBlinkLeft and eyeBlinkRight, 3 decimals', () => {
    const f = frameEvidenceFields({
      landmarks: synthFlat(),
      blendshapes: [
        { categoryName: '_neutral', score: 0.9 },
        { categoryName: 'eyeBlinkLeft', score: 0.041234 },
        { categoryName: 'eyeBlinkRight', score: 0.0625 },
        { categoryName: 'jawOpen', score: 0.3 },
      ],
    });
    expect(f.blendshapes).toEqual({ eyeBlinkLeft: 0.041, eyeBlinkRight: 0.063 });
    expect(frameEvidenceFields({ landmarks: synthFlat(), blendshapes: [{ categoryName: 'eyeBlinkLeft', score: 0.1 }] }).blendshapes).toBeUndefined();
  });

  it('the digest is computed over the rounded landmarks the upload carries', async () => {
    const f = frameEvidenceFields({ landmarks: synthFlat(), matrix: matrixFrom(10, 0, 0) });
    const sent = JSON.parse(JSON.stringify({ landmarks: f.landmarks, pose: f.pose }));
    const a = await computeMeshDigest([0.1], f.pose!, 80, f.landmarks);
    const b = await computeMeshDigest([0.1], sent.pose, 80, sent.landmarks);
    expect(a).toBe(b);
    const raw = await computeMeshDigest([0.1], f.pose!, 80, synthFlat());
    expect(raw).not.toBe(a);
  });
});

describe('computeHeadPoseFromMatrix labels (gap 5)', () => {
  it('yaw, pitch and roll each come from their own axis', () => {
    expect(computeHeadPoseFromMatrix(matrixFrom(25, 0, 0))).toEqual({ yaw: 25, pitch: 0, roll: 0 });
    expect(computeHeadPoseFromMatrix(matrixFrom(0, -15, 0))).toEqual({ yaw: 0, pitch: -15, roll: 0 });
    expect(computeHeadPoseFromMatrix(matrixFrom(0, 0, 8))).toEqual({ yaw: 0, pitch: 0, roll: 8 });
  });
});

// ── Section 3: frame rules ────────────────────────────────────────────────

describe('selectMeshSignals (section 3)', () => {
  const hashes = ['h0', 'h1', 'h2', 'h3'];
  it('Web 4.9.1 [0,0,2,2] becomes one entry per frame', () => {
    const out = selectMeshSignals([{ frameIndex: 0, n: 'a' }, { frameIndex: 0, n: 'b' }, { frameIndex: 2, n: 'c' }, { frameIndex: 2, n: 'd' }], hashes);
    expect(out.map((s) => [s.frameIndex, s.n])).toEqual([[0, 'a'], [2, 'c']]);
  });

  it('ascending, unmeshed frames get no entry, out-of-range indices dropped', () => {
    const out = selectMeshSignals([{ frameIndex: 3 }, { frameIndex: 1 }, { frameIndex: 7 }, { frameIndex: -1 }], hashes);
    expect(out.map((s) => s.frameIndex)).toEqual([1, 3]);
  });

  it('two frames with identical bytes (same hash) get one entry', () => {
    const out = selectMeshSignals([{ frameIndex: 0 }, { frameIndex: 1 }, { frameIndex: 2 }], ['x', 'x', 'y']);
    expect(out.map((s) => s.frameIndex)).toEqual([0, 2]);
  });
});

// ── Section 6: colour sequence ────────────────────────────────────────────

describe('ColourSequencePlayer (section 6)', () => {
  it('plays lead-in then each colour for segment_ms, on the capture clock from rAF timestamps', () => {
    const { p, frames, tints } = player({ origin: 1000 });
    p.play();
    expect(p.phase.kind).toBe('leadIn');
    frames.tick(16);
    frames.tick(1300.4); // lead-in over (now 0 + 300 <= 1300)
    expect(p.phase).toEqual({ kind: 'segment', index: 0 });
    expect(tints[0]).toEqual(['#3D6BFF', 0.35]);
    frames.tick(1600);
    frames.tick(1900.6);
    frames.tick(2500.6);
    frames.tick(3101);
    expect(p.finished).toBe(true);
    expect(frames.pending).toBe(0);
    const r = p.record;
    expect(r.segments).toEqual([
      { colour: '#3D6BFF', start_ms: 300, end_ms: 901 },
      { colour: '#FFD23F', start_ms: 901, end_ms: 1501 },
      { colour: '#B04DFF', start_ms: 1501, end_ms: 2101 },
    ]);
    expect(r).toMatchObject({ sequence_id: 'cs_7f3a9c21', completed: true, interrupted_reason: null, screen_brightness: null });
    expect(tints[tints.length - 1]).toEqual([null, 0]);
    expect(Number.isInteger(r.segments[0].start_ms)).toBe(true);
  });

  it('a gate pause drops the partly shown colour; the replay resumes there and keeps issued[i % n]', () => {
    const { p, frames, setNow } = player({ origin: 0 });
    p.play();
    frames.tick(300);
    frames.tick(900); // colour 1 done, colour 2 starts
    setNow(1000);
    p.interrupt('gate_pause'); // during colour 2
    let r = p.record;
    expect(r.segments.map((s) => s.colour)).toEqual(['#3D6BFF']);
    expect(r).toMatchObject({ completed: false, interrupted_reason: 'gate_pause' });
    expect(p.nextIndex).toBe(1);
    expect(p.remainingMs()).toBe(300 + 2 * 600);
    setNow(1400);
    p.play();
    frames.tick(1700); // lead-in
    frames.tick(2300);
    frames.tick(2900);
    r = p.record;
    expect(r.segments.map((s) => s.colour)).toEqual(['#3D6BFF', '#FFD23F', '#B04DFF']);
    expect(matchesIssued(r.segments)).toBe(true);
    expect(r.segments[1].start_ms).toBe(1700);
    expect(r.completed).toBe(true);
    // The pause stays on the record: it completed after an interruption.
    expect(r.interrupted_reason).toBe('gate_pause');
    expect(p.runs).toBe(2);
  });

  it('a pause in the lead-in costs no run', () => {
    const { p, frames } = player();
    for (let i = 0; i < 5; i++) { p.play(); frames.tick(100); p.interrupt(); }
    expect(p.runs).toBe(0);
    expect(p.canPlay).toBe(true);
    expect(p.record.segments).toEqual([]);
  });

  it(`stops offering plays after ${COLOUR_MAX_RUNS} plays that showed a colour`, () => {
    const { p, frames, setNow } = player({ origin: 0 });
    let t = 0;
    for (let i = 0; i < COLOUR_MAX_RUNS; i++) {
      setNow(t);
      p.play();
      frames.tick(t + 300);
      p.interrupt();
      t += 1000;
    }
    expect(p.runs).toBe(COLOUR_MAX_RUNS);
    expect(p.canPlay).toBe(false);
    p.play();
    expect(p.isPlaying).toBe(false);
  });

  it('a dropped scan window clears the segments and starts again at the first colour', () => {
    const { p, frames } = player({ origin: 0 });
    p.play();
    frames.tick(300);
    frames.tick(900);
    p.resetForNewWindow();
    expect(p.record.segments).toEqual([]);
    expect(p.nextIndex).toBe(0);
    expect(p.runs).toBe(0);
    expect(p.phase.kind).toBe('idle');
    expect(p.record.sequence_id).toBe('cs_7f3a9c21');
  });

  it('no segment before the camera clock exists', () => {
    const frames = fakeFrames();
    const p = new ColourSequencePlayer(SEQ, () => null, { requestFrame: frames.requestFrame, cancelFrame: frames.cancelFrame, now: () => 0 });
    p.play();
    frames.tick(400);
    expect(p.phase.kind).toBe('leadIn');
    expect(p.record.segments).toEqual([]);
  });

  it('reports awb_locked only when every play locked; unlocks when the tint stops', async () => {
    const lock = vi.fn((l: boolean) => l);
    const { p, frames } = player({ lock });
    p.play();
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    expect(p.record.awb_locked).toBe(true);
    frames.tick(300);
    p.interrupt();
    await new Promise((r) => setTimeout(r, 0));
    expect(lock.mock.calls.map((c) => c[0])).toEqual([true, false]);

    const failing = player({ lock: () => false });
    failing.p.play();
    await new Promise((r) => setTimeout(r, 0));
    expect(failing.p.record.awb_locked).toBe(false);

    const none = player();
    none.p.play();
    expect(none.p.record.awb_locked).toBe(false);
  });

  it('the capture clock is integer ms since the camera opened, never negative', () => {
    expect(captureClockMs(1500.6, 1000)).toBe(501);
    expect(captureClockMs(900, 1000)).toBe(0);
    expect(captureClockMs(5, null)).toBeNull();
  });
});

describe('setWhiteBalanceLock', () => {
  it('is false where the track does not offer the mode (macOS Chrome)', async () => {
    expect(await setWhiteBalanceLock(null, true)).toBe(false);
    const track = { getCapabilities: () => ({}), getSettings: () => ({}), applyConstraints: vi.fn() } as unknown as MediaStreamTrack;
    expect(await setWhiteBalanceLock(track, true)).toBe(false);
    expect((track.applyConstraints as any)).not.toHaveBeenCalled();
  });

  it('locks at the current colour temperature and reports the mode the track settles on', async () => {
    let mode = 'continuous';
    const applyConstraints = vi.fn(async (c: any) => { mode = c.advanced[0].whiteBalanceMode; });
    const track = {
      getCapabilities: () => ({ whiteBalanceMode: ['manual', 'continuous'] }),
      getSettings: () => ({ whiteBalanceMode: mode, colorTemperature: 5200 }),
      applyConstraints,
    } as unknown as MediaStreamTrack;
    expect(await setWhiteBalanceLock(track, true)).toBe(true);
    expect(applyConstraints).toHaveBeenCalledWith({ advanced: [{ whiteBalanceMode: 'manual', colorTemperature: 5200 }] });
    expect(await setWhiteBalanceLock(track, false)).toBe(true);
    expect(mode).toBe('continuous');
  });
});

// ── Section 2 and 7: metadata.evidence ────────────────────────────────────

describe('buildEvidenceUpload (sections 2 and 7)', () => {
  it('web: closer is the platform skip and nothing else; no binding; honest capability', () => {
    const { p } = player();
    const e = buildEvidenceUpload({ meshAvailable: true, colour: p.record });
    expect(e.contract).toBe(EVIDENCE_CONTRACT);
    expect(e.clock).toBe('capture_monotonic_ms');
    expect(e.closer).toEqual({ completed: false, skipped_reason: 'platform_web' });
    expect('binding' in e).toBe(false);
    expect(e.capability).toEqual({ landmarks: true, blendshapes: true, pose_method: POSE_METHOD_V3, closer_step: false, binding_v2: false });
    expect(e.colour?.sequence_id).toBe('cs_7f3a9c21');
  });

  it('without MediaPipe the capability says so, and no colour key without a sequence', () => {
    const e = buildEvidenceUpload({ meshAvailable: false, colour: null });
    expect(e.capability).toEqual(webEvidenceCapability(false));
    expect(e.capability.pose_method).toBeNull();
    expect('colour' in e).toBe(false);
  });
});

// ── The tint and the covered-face change watch ────────────────────────────

describe('CoverWatch.hold (the colour tint must not trip the change watch)', () => {
  const W = 200, H = 260;
  const lm = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5 }));
  FACE_OVAL.forEach((k, n) => {
    const t = (n / FACE_OVAL.length) * Math.PI * 2 - Math.PI / 2;
    lm[k] = { x: 0.5 + Math.cos(t) * 0.35, y: 0.5 + Math.sin(t) * 0.3 };
  });
  Object.assign(lm, {
    234: { x: 0.15, y: 0.5 }, 454: { x: 0.85, y: 0.5 }, 151: { x: 0.5, y: 0.335 }, 50: { x: 0.325, y: 0.53 },
    280: { x: 0.675, y: 0.53 }, 5: { x: 0.5, y: 0.5 }, 13: { x: 0.5, y: 0.62 }, 199: { x: 0.5, y: 0.71 },
  });
  const pts = lm.map((p) => ({ x: p.x * W, y: p.y * H }));
  /** Skin gradient, optionally lit by a screen colour at `alpha` (a crude reflection). */
  const regions = (tint?: [number, number, number], alpha = 0.3) => {
    const d = new Uint8ClampedArray(W * H * 4);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const base = [200 - y * 0.2, 150 - y * 0.15, 120 - y * 0.1];
      for (let c = 0; c < 3; c++) d[i + c] = tint ? base[c] * (1 - alpha) + tint[c] * alpha : base[c];
      d[i + 3] = 255;
    }
    return measureFaceRegions(d, W, H, pts);
  };
  const BLUE: [number, number, number] = [0x3d, 0x6b, 0xff];
  const YELLOW: [number, number, number] = [0xff, 0xd2, 0x3f];

  it('control: without the hold, a tint colour reads as a covered face', () => {
    const w = new CoverWatch();
    for (let i = 0; i < 3; i++) w.covered(regions(), i * 33);
    w.covered(regions(BLUE), 100);
    expect(w.covered(regions(BLUE), 133)).toBe(true);
  });

  it('with the hold: never judged during the tint, then a new baseline 500 ms after it', () => {
    const w = new CoverWatch();
    let t = 0;
    for (let i = 0; i < 3; i++, t += 33) w.covered(regions(), t);
    expect(w.hasBaseline).toBe(true);
    // 1.8 s of tint, colour changing every 600 ms, tracked at ~30 fps.
    for (const colour of [BLUE, YELLOW, BLUE]) {
      for (let k = 0; k < 18; k++, t += 33) {
        w.hold(t);
        expect(w.covered(regions(colour), t)).toBe(false);
        expect(w.state).toBe('off');
      }
    }
    // Tint off. Still held for 500 ms (exposure settles).
    const off = t;
    for (; t < off + COVER_WATCH.veilSettleMs - 1; t += 33) {
      expect(w.covered(regions(YELLOW), t)).toBe(false);
      expect(w.state).toBe('off');
    }
    // Then a fresh baseline from the untinted face, and the watch judges again.
    for (let i = 0; i < 3; i++, t += 33) w.covered(regions(), t);
    expect(w.hasBaseline).toBe(true);
    expect(w.covered(regions(), t)).toBe(false);
    expect(w.state).toBe('clear');
    // And it still catches a real change afterwards.
    w.covered(regions(BLUE, 0.6), t + 33);
    expect(w.covered(regions(BLUE, 0.6), t + 66)).toBe(true);
  });
});

describe('framesPerSegment', () => {
  it('counts frames inside the server window [start + 150, end]', () => {
    const segs = [
      { colour: '#FF4D4D', start_ms: 1000, end_ms: 1600 },
      { colour: '#00C2D1', start_ms: 1600, end_ms: 2200 },
    ];
    expect(framesPerSegment(segs, [1100, 1150, 1600, 1700, 1760, 2200])).toEqual([2, 2]);
    expect(framesPerSegment(segs, [900, 1700])).toEqual([0, 0]);
  });
});

describe('exposureTime (frames stamped at exposure, not delivery)', () => {
  it('uses the camera capture time of the drawn frame', () => {
    expect(exposureTime(5143, { captureTime: 5000, callbackAt: 5100 })).toBe(5000);
  });
  it('falls back to the draw time without a plausible capture time', () => {
    expect(exposureTime(5000, null)).toBe(5000);
    expect(exposureTime(5000, { callbackAt: 4990 })).toBe(5000);
    expect(exposureTime(5000, { captureTime: 5200, callbackAt: 4990 })).toBe(5000); // in the future
    expect(exposureTime(5000, { captureTime: 3000, callbackAt: 4990 })).toBe(5000); // stale clock
  });
  it('a 143 ms delivery lag would move a frame into the previous colour; the exposure stamp keeps it', () => {
    const segs = [
      { colour: '#3D6BFF', start_ms: 1000, end_ms: 1600 },
      { colour: '#FFD23F', start_ms: 1600, end_ms: 2200 },
    ];
    // Exposed at 1500 (inside blue's window), delivered 143 ms later (yellow's segment, before its window).
    expect(framesPerSegment(segs, [1500 + 143])).toEqual([0, 0]);
    expect(framesPerSegment(segs, [exposureTime(1643, { captureTime: 1500, callbackAt: 1600 })])).toEqual([1, 0]);
  });
});

describe('VideoFrameClock', () => {
  it('keeps the latest frame stamp and stops cleanly', () => {
    let cb: ((now: number, meta: { captureTime?: number }) => void) | null = null;
    const cancel = vi.fn();
    const video = {
      requestVideoFrameCallback: (f: typeof cb) => { cb = f; return 7; },
      cancelVideoFrameCallback: cancel,
    } as unknown as HTMLVideoElement;
    const clock = new VideoFrameClock();
    clock.start(video);
    cb!(1000, { captureTime: 960 });
    expect(clock.latest).toEqual({ captureTime: 960, callbackAt: 1000 });
    clock.stop();
    expect(cancel).toHaveBeenCalledWith(7);
    expect(clock.latest).toBeNull();
  });
  it('is inert where requestVideoFrameCallback is missing', () => {
    const clock = new VideoFrameClock();
    clock.start({} as HTMLVideoElement);
    expect(clock.latest).toBeNull();
  });
});

describe('colourOnsetLatencies', () => {
  const segs = [
    { colour: '#3D6BFF', start_ms: 1000, end_ms: 1600 },
    { colour: '#FFD23F', start_ms: 1600, end_ms: 2200 },
  ];
  // 30 fps tracked frames; the face shows each colour 90 ms after it starts.
  const samples = Array.from({ length: 80 }, (_, i) => {
    const t = 800 + i * 33;
    const seen = t - 90;
    const r = seen >= 1600 ? 0.40 : seen >= 1000 ? 0.34 : 0.37;
    const b = seen >= 1600 ? 0.24 : seen >= 1000 ? 0.30 : 0.27;
    return { t, r, b };
  });
  it('reads the delay from each colour start to the face changing', () => {
    const lat = colourOnsetLatencies(samples, segs);
    for (const v of lat) { expect(v).not.toBeNull(); expect(v!).toBeGreaterThanOrEqual(90); expect(v!).toBeLessThan(90 + 34); }
  });
  it('null where the chroma does not move', () => {
    expect(colourOnsetLatencies(samples.map((s) => ({ ...s, r: 0.37, b: 0.27 })), segs)).toEqual([null, null]);
  });
});

describe('estimateColourLag', () => {
  const segs = [
    { colour: '#3D6BFF', start_ms: 1000, end_ms: 1600 },
    { colour: '#FFD23F', start_ms: 1600, end_ms: 2200 },
    { colour: '#B04DFF', start_ms: 2200, end_ms: 2800 },
  ];
  const chroma = (hex: string) => {
    const R = parseInt(hex.slice(1, 3), 16), G = parseInt(hex.slice(3, 5), 16), B = parseInt(hex.slice(5, 7), 16);
    return { r: R / (R + G + B), b: B / (R + G + B) };
  };
  /** A face that reflects 2% of the screen colour, seen `lag` ms late, with noise. */
  const trace = (lag: number) => {
    let seed = 7;
    const noise = () => { seed = (seed * 16807) % 2147483647; return (seed / 2147483647 - 0.5) * 0.0015; };
    return Array.from({ length: 70 }, (_, i) => {
      const t = 1000 + i * 33;
      const seg = segs.find((g) => t - lag >= g.start_ms && t - lag < g.end_ms) ?? segs[0];
      const c = chroma(seg.colour);
      return { t, r: 0.4 + 0.02 * (c.r - 0.33) + noise(), b: 0.27 + 0.02 * (c.b - 0.33) + noise() };
    });
  };
  it('finds a 120 ms lag in a noisy small signal', () => {
    const f = estimateColourLag(trace(120), segs)!;
    expect(Math.abs(f.lagMs - 120)).toBeLessThanOrEqual(40);
    expect(f.corr).toBeGreaterThan(f.corrAtZero);
  });
  it('reads about 0 when the face follows the screen', () => {
    expect(estimateColourLag(trace(0), segs)!.lagMs).toBeLessThanOrEqual(40);
  });
  it('null with too few frames', () => {
    expect(estimateColourLag(trace(0).slice(0, 5), segs)).toBeNull();
  });
});
