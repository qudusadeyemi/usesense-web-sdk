/**
 * Covered-face segmentation at runtime (COVER-v1.md section 1): MediaPipe's
 * selfie_multiclass_256x256 run off the tracking loop, on the latest frame
 * whenever the previous run is done.
 *
 * The model (16 MB) is not in the npm bundle. A dedicated Web Worker fetches
 * it (cdn.usesense.ai, then the pinned upstream URL), checks its size and
 * sha256, and runs the segmenter, so neither the download, the hash nor a
 * segmentation ever blocks the main thread or the landmarker's
 * detectForVideo. Where a worker can't start (a strict CSP without blob:
 * workers), the segmenter runs on the main thread in its own task, between
 * tracker frames, never inside one.
 *
 * If the model can't be loaded (network, hash mismatch, no WebAssembly), the
 * segmentation is off: the gate does not wait on it, the scan's change watch
 * still runs, and the failure is logged and reported by
 * {@link getCoverSegmenterState}. Capture is not blocked by a missing model.
 */

import { SegmenterModelInfo } from '../segmenter-model-info';
import { COVER_THRESHOLDS, isCovered, measureFaceCover, type FaceCover } from './face-cover';

const TASKS_VISION = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18';

/** Options for {@link initCoverSegmenter}. */
export interface InitCoverSegmenterOptions {
  /**
   * Model URL to try first (self-hosting). The bytes must hash to
   * SegmenterModelInfo.sha256. Defaults to SegmenterModelInfo.defaultCdnUrl;
   * the pinned upstream URL is always tried after it.
   */
  modelUrl?: string;
}

/** Where the covered-face segmentation is. */
export type CoverSegmenterStatus = 'idle' | 'loading' | 'ready' | 'failed';

/** Load state and timing of the covered-face segmentation, for logs and debugging. */
export interface CoverSegmenterState {
  status: CoverSegmenterStatus;
  /** Runs in a Web Worker (true) or on the main thread (false). */
  worker?: boolean;
  /** The URL the model came from. */
  modelUrl?: string;
  /** The sha256 was checked (Web Crypto available). */
  verified?: boolean;
  /** ms from init to ready. */
  loadMs?: number;
  /** Rolling mean segmentation time, ms. */
  meanRunMs?: number;
  /** Why loading failed. */
  error?: string;
}

/** The latest segmentation of the face and when its frame was taken. */
export interface CoverResult {
  cover: FaceCover;
  covered: boolean;
  /** performance.now() of the frame it was measured on. */
  at: number;
}

// The worker is a classic script (MediaPipe loads its WASM with importScripts
// inside workers) that imports the ES bundle dynamically.
const WORKER_SOURCE = `
let seg = null;
const hex = (b) => Array.from(new Uint8Array(b), (x) => x.toString(16).padStart(2, '0')).join('');
async function loadModel(m) {
  let last = '';
  for (const url of m.urls) {
    try {
      const r = await fetch(url, { credentials: 'omit' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const b = await r.arrayBuffer();
      if (b.byteLength !== m.size) throw new Error('size ' + b.byteLength);
      let verified = false;
      if (self.crypto && self.crypto.subtle) {
        if (hex(await self.crypto.subtle.digest('SHA-256', b)) !== m.sha256) throw new Error('sha256 mismatch');
        verified = true;
      }
      return { buf: b, url, verified };
    } catch (e) { last = url + ': ' + (e && e.message || e); }
  }
  throw new Error(last || 'no model URL');
}
self.onmessage = async (e) => {
  const m = e.data;
  if (m.type === 'init') {
    try {
      const vision = await import(m.bundle);
      const [model, fileset] = await Promise.all([loadModel(m), vision.FilesetResolver.forVisionTasks(m.wasm)]);
      seg = await vision.ImageSegmenter.createFromOptions(fileset, {
        baseOptions: { modelAssetBuffer: new Uint8Array(model.buf), delegate: 'CPU' },
        runningMode: 'IMAGE', outputCategoryMask: true, outputConfidenceMasks: false,
      });
      self.postMessage({ type: 'ready', url: model.url, verified: model.verified });
    } catch (err) { self.postMessage({ type: 'error', message: String(err && err.message || err) }); }
  } else if (m.type === 'segment') {
    try {
      const t0 = performance.now();
      const r = seg.segment(m.bitmap);
      const mask = r.categoryMask;
      const data = mask.getAsUint8Array().slice();
      const w = mask.width, h = mask.height;
      if (r.close) r.close();
      m.bitmap.close();
      self.postMessage({ type: 'mask', id: m.id, w, h, data, ms: performance.now() - t0 }, [data.buffer]);
    } catch (err) {
      try { m.bitmap.close(); } catch (_) {}
      self.postMessage({ type: 'mask', id: m.id, error: String(err && err.message || err) });
    }
  }
};
`;

interface Mask { w: number; h: number; data: Uint8Array; ms: number }

interface Backend {
  segment(bitmap: ImageBitmap): Promise<Mask>;
  close(): void;
}

function modelUrls(opts?: InitCoverSegmenterOptions): string[] {
  const first = opts?.modelUrl ?? SegmenterModelInfo.defaultCdnUrl;
  return first === SegmenterModelInfo.sourceUrl ? [first] : [first, SegmenterModelInfo.sourceUrl];
}

async function workerBackend(opts?: InitCoverSegmenterOptions): Promise<{ backend: Backend; url: string; verified: boolean }> {
  const blobUrl = URL.createObjectURL(new Blob([WORKER_SOURCE], { type: 'text/javascript' }));
  let worker: Worker;
  try { worker = new Worker(blobUrl); } finally { URL.revokeObjectURL(blobUrl); }
  const waiting = new Map<number, (m: Mask | Error) => void>();
  let nextId = 1;
  const ready = new Promise<{ url: string; verified: boolean }>((resolve, reject) => {
    worker.onerror = (e) => reject(new Error(e.message || 'worker error'));
    worker.onmessage = (e: MessageEvent) => {
      const m = e.data;
      if (m.type === 'ready') resolve({ url: m.url, verified: m.verified });
      else if (m.type === 'error') reject(new Error(m.message));
      else if (m.type === 'mask') {
        const done = waiting.get(m.id);
        waiting.delete(m.id);
        done?.(m.error ? new Error(m.error) : { w: m.w, h: m.h, data: m.data, ms: m.ms });
      }
    };
  });
  worker.postMessage({
    type: 'init',
    bundle: `${TASKS_VISION}/vision_bundle.mjs`,
    wasm: `${TASKS_VISION}/wasm`,
    urls: modelUrls(opts),
    size: SegmenterModelInfo.sizeBytes,
    sha256: SegmenterModelInfo.sha256,
  });
  try {
    const r = await ready;
    return {
      ...r,
      backend: {
        segment: (bitmap) => new Promise<Mask>((resolve, reject) => {
          const id = nextId++;
          waiting.set(id, (m) => (m instanceof Error ? reject(m) : resolve(m)));
          worker.postMessage({ type: 'segment', id, bitmap }, [bitmap]);
        }),
        close: () => worker.terminate(),
      },
    };
  } catch (err) {
    worker.terminate();
    throw err;
  }
}

async function sha256Hex(buf: ArrayBuffer): Promise<string | null> {
  if (typeof crypto === 'undefined' || !crypto.subtle) return null;
  const d = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(d), (x) => x.toString(16).padStart(2, '0')).join('');
}

/** Main-thread fallback (no worker): same model checks, runs in its own task. */
async function mainThreadBackend(opts?: InitCoverSegmenterOptions): Promise<{ backend: Backend; url: string; verified: boolean }> {
  const vision = await (new Function('u', 'return import(u)'))(`${TASKS_VISION}/vision_bundle.mjs`);
  let buf: ArrayBuffer | null = null, url = '', verified = false, last = '';
  for (const u of modelUrls(opts)) {
    try {
      const r = await fetch(u, { credentials: 'omit' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const b = await r.arrayBuffer();
      if (b.byteLength !== SegmenterModelInfo.sizeBytes) throw new Error(`size ${b.byteLength}`);
      const h = await sha256Hex(b);
      if (h !== null && h !== SegmenterModelInfo.sha256) throw new Error('sha256 mismatch');
      buf = b; url = u; verified = h !== null;
      break;
    } catch (e: any) { last = `${u}: ${e?.message ?? e}`; }
  }
  if (!buf) throw new Error(last || 'no model URL');
  const fileset = await vision.FilesetResolver.forVisionTasks(`${TASKS_VISION}/wasm`);
  const seg = await vision.ImageSegmenter.createFromOptions(fileset, {
    baseOptions: { modelAssetBuffer: new Uint8Array(buf), delegate: 'CPU' },
    runningMode: 'IMAGE', outputCategoryMask: true, outputConfidenceMasks: false,
  });
  return {
    url, verified,
    backend: {
      segment: (bitmap) => new Promise<Mask>((resolve, reject) => {
        // Its own task: never inside a tracker frame.
        setTimeout(() => {
          try {
            const t0 = performance.now();
            const r = seg.segment(bitmap);
            const mask = r.categoryMask;
            const out = { w: mask.width, h: mask.height, data: mask.getAsUint8Array().slice(), ms: performance.now() - t0 };
            r.close?.();
            resolve(out);
          } catch (e) { reject(e); } finally { bitmap.close(); }
        }, 0);
      }),
      close: () => { try { seg.close(); } catch { /* ignore */ } },
    },
  };
}

/** Long edge of the frame handed to the segmenter (the model runs at 256). */
const SEGMENT_LONG_EDGE = 320;

let backend: Backend | null = null;
let loading: Promise<void> | null = null;
let state: CoverSegmenterState = { status: 'idle' };
let busy = false;
let latest: CoverResult | null = null;
let epoch = 0;

/**
 * Start loading the covered-face segmentation (non-blocking). Call it at the
 * same time as initFaceMesh so the two downloads run in parallel. Safe to
 * call repeatedly; a failed load stays failed until
 * {@link disposeCoverSegmenter}.
 */
export function initCoverSegmenter(opts?: InitCoverSegmenterOptions): Promise<void> {
  if (loading) return loading;
  if (typeof window === 'undefined' || typeof createImageBitmap !== 'function' || typeof WebAssembly === 'undefined') {
    state = { status: 'failed', error: 'unsupported browser (no createImageBitmap or WebAssembly)' };
    console.warn(`[UseSense] Covered-face check unavailable: ${state.error}`);
    loading = Promise.resolve();
    return loading;
  }
  const t0 = performance.now();
  const myEpoch = epoch;
  state = { status: 'loading' };
  loading = (async () => {
    let r: { backend: Backend; url: string; verified: boolean } | null = null;
    let worker = true;
    try {
      r = await workerBackend(opts);
    } catch (err: any) {
      console.warn('[UseSense] Covered-face worker unavailable, using the main thread:', err?.message ?? err);
      worker = false;
      try { r = await mainThreadBackend(opts); } catch (err2: any) {
        if (myEpoch !== epoch) return;
        state = { status: 'failed', worker: false, error: String(err2?.message ?? err2) };
        console.warn(`[UseSense] Covered-face check unavailable (${SegmenterModelInfo.versionLabel}): ${state.error}`);
        return;
      }
    }
    if (myEpoch !== epoch) { r.backend.close(); return; }
    backend = r.backend;
    state = { status: 'ready', worker, modelUrl: r.url, verified: r.verified, loadMs: Math.round(performance.now() - t0) };
    console.log(`[UseSense] Covered-face check ready (${SegmenterModelInfo.versionLabel}, ${worker ? 'worker' : 'main thread'}, ${state.loadMs} ms)`);
  })();
  return loading;
}

/** Load state, model source and timing of the covered-face segmentation. */
export function getCoverSegmenterState(): CoverSegmenterState {
  return { ...state };
}

/** True while the model is loading or loaded: the gate must wait for a result. */
export function isCoverCheckActive(): boolean {
  return state.status === 'loading' || state.status === 'ready';
}

/**
 * Offer the current video frame for segmentation with the subject's
 * normalised landmarks. Starts a run only when none is in flight; returns at
 * once (the result arrives later, see {@link latestCoverResult}).
 */
export function offerCoverFrame(video: HTMLVideoElement, landmarks: ArrayLike<{ x: number; y: number }>, now: number): void {
  if (!backend || busy || !video.videoWidth) return;
  busy = true;
  const vw = video.videoWidth, vh = video.videoHeight;
  const s = Math.min(1, SEGMENT_LONG_EDGE / Math.max(vw, vh));
  const w = Math.max(1, Math.round(vw * s)), h = Math.max(1, Math.round(vh * s));
  const pts = Array.from({ length: landmarks.length }, (_, i) => ({ x: landmarks[i].x, y: landmarks[i].y }));
  const myEpoch = epoch;
  const b = backend;
  createImageBitmap(video, { resizeWidth: w, resizeHeight: h, resizeQuality: 'low' })
    .then((bitmap) => b.segment(bitmap))
    .then((m) => {
      if (myEpoch !== epoch) return;
      const n = state.meanRunMs;
      state.meanRunMs = n === undefined ? m.ms : n * 0.9 + m.ms * 0.1;
      const cover = measureFaceCover(m.data, m.w, m.h, pts, w, h);
      if (cover) latest = { cover, covered: isCovered(cover), at: now };
    })
    .catch((err) => console.warn('[UseSense] Cover segmentation failed:', err?.message ?? err))
    .finally(() => { if (myEpoch === epoch) busy = false; });
}

/** The latest result if it is no older than 3 s at `now`, else null. */
export function latestCoverResult(now: number): CoverResult | null {
  return latest && now - latest.at <= COVER_THRESHOLDS.maxAgeMs ? latest : null;
}

/** Forget the last result (the face was lost). */
export function clearCoverResult(): void {
  latest = null;
}

/**
 * Wait for a result from a frame taken at or after `since`, up to `timeoutMs`
 * (the scan's final check). Resolves with it, or null on timeout or when the
 * segmentation is off.
 */
export async function waitForCoverResult(since: number, timeoutMs: number = COVER_THRESHOLDS.finalWaitMs, isStale?: () => boolean): Promise<CoverResult | null> {
  const end = performance.now() + timeoutMs;
  while (performance.now() < end) {
    if (state.status !== 'ready' || isStale?.()) return null;
    if (latest && latest.at >= since) return latest;
    await new Promise((r) => setTimeout(r, 50));
  }
  return null;
}

/** Stop the worker and forget everything (the engine unmounted). */
export function disposeCoverSegmenter(): void {
  epoch++;
  backend?.close();
  backend = null;
  loading = null;
  busy = false;
  latest = null;
  state = { status: 'idle' };
}
