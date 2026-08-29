// ============================================================================
// Antispoof Classifier (web, v4.2) -- on-device EfficientNet-B0 spoof detection
// ============================================================================
//
// Lazy-loads onnxruntime-web and the CelebA-Spoof antispoof.onnx model, then
// scores each captured face frame locally. Per-frame spoof probabilities are
// attached to the uploaded metadata under signals.deep_classifier_on_device.
//
// Feature-flagged: only active when UseSenseSDKConfig.antispoofOnDeviceEnabled
// is true. When the model fetch fails, onnxruntime-web cannot load, or the
// browser lacks WASM SIMD, the module no-ops and the server path remains
// authoritative.
//
// Model artifact is served from the SDK's public asset host. Override via
// ANTISPOOF_MODEL_URL for self-hosted deployments.
// ============================================================================

import type { DeepClassifierOnDevice, OnDeviceClassifierSample } from '../types';

// onnxruntime-web is a ~6 MB dependency. We load it via a dynamic import so
// that SDK consumers who don't opt into on-device antispoof never pay the
// cost. See docs/sdk-specs/antispoof-classifier-sdk-spec.md §4 (web).
type OrtModule = typeof import('onnxruntime-web');

export interface ClassifierInputFrame {
  frameIndex: number;
  /** Raw JPEG bytes as captured by the frame-capture pipeline. */
  jpegBytes: Uint8Array;
  /** Face bounding box in normalised [0,1] coords (top-left origin). */
  boundingBox: { x: number; y: number; w: number; h: number };
}

const INPUT_SIZE = 224;
const MODEL_BACKBONE = 'efficientnet_b0';
const BBOX_EXPANSION = 1.25;
const IMAGENET_MEAN = [0.485, 0.456, 0.406] as const;
const IMAGENET_STD = [0.229, 0.224, 0.225] as const;

export interface LoadOptions {
  modelVersion?: string;
  /** Full URL to antispoof.onnx. Defaults to UseSense's public asset host. */
  modelUrl?: string;
  threshold?: number;
}

export interface AntispoofClassifier {
  isAvailable: boolean;
  modelVersion: string;
  /** Score a batch of frames. Returns null if the session is unavailable. */
  predictFrames(frames: ClassifierInputFrame[]): Promise<DeepClassifierOnDevice | null>;
  dispose(): Promise<void>;
}

/**
 * Load the classifier. Returns an instance in no-op mode (isAvailable=false)
 * when the model cannot be loaded; never throws.
 */
export async function loadAntispoofClassifier(
  options: LoadOptions = {},
): Promise<AntispoofClassifier> {
  const modelVersion = options.modelVersion ?? 'v1';
  const threshold = options.threshold ?? 0.5;
  const modelUrl =
    options.modelUrl ??
    `https://sdk-assets.usesense.ai/antispoof/${modelVersion}/antispoof.onnx`;

  let ort: OrtModule | null = null;
  let session: import('onnxruntime-web').InferenceSession | null = null;
  try {
    ort = await import('onnxruntime-web');
    // Configure wasm threading / SIMD based on browser capabilities.
    ort.env.wasm.numThreads = Math.min(
      4,
      typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 1 : 1,
    );
    session = await ort.InferenceSession.create(modelUrl, {
      executionProviders: ['wasm'],
      graphOptimizationLevel: 'all',
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[UseSense] antispoof classifier load failed; falling back to server', err);
    return makeNoOpClassifier(modelVersion);
  }

  const activeOrt = ort;
  const activeSession = session;

  return {
    isAvailable: true,
    modelVersion,
    async predictFrames(frames) {
      if (!activeSession || frames.length === 0) return null;
      const samples: OnDeviceClassifierSample[] = [];

      for (const frame of frames) {
        const start =
          typeof performance !== 'undefined' ? performance.now() : Date.now();
        try {
          const tensor = await preprocess(activeOrt, frame);
          if (!tensor) continue;
          const output = await activeSession.run({ input: tensor });
          const logitsTensor = output.logits ?? Object.values(output)[0];
          if (!logitsTensor) continue;
          const data = logitsTensor.data as Float32Array;
          const spoofProb = softmax2([data[0] ?? 0, data[1] ?? 0])[1];
          const latency =
            (typeof performance !== 'undefined' ? performance.now() : Date.now()) - start;
          samples.push({
            frameIndex: frame.frameIndex,
            spoofProbability: spoofProb,
            latencyMs: Math.round(latency),
            modelVersion,
            backbone: MODEL_BACKBONE,
          });
        } catch (err) {
          // Skip this frame; continue with the batch.
          // eslint-disable-next-line no-console
          console.warn(`[UseSense] antispoof frame ${frame.frameIndex} failed`, err);
          continue;
        }
      }

      if (samples.length === 0) return null;
      return {
        modelVersion,
        backbone: MODEL_BACKBONE,
        threshold,
        samples,
      };
    },
    async dispose() {
      try {
        await activeSession?.release?.();
      } catch {
        /* noop */
      }
    },
  };
}

// ─── Preprocessing ────────────────────────────────────────────────────────

async function preprocess(
  ort: OrtModule,
  frame: ClassifierInputFrame,
): Promise<import('onnxruntime-web').Tensor | null> {
  const bitmap = await decodeJpegToBitmap(frame.jpegBytes);
  if (!bitmap) return null;
  try {
    const canvas = new OffscreenCanvas(INPUT_SIZE, INPUT_SIZE);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const { x, y, w, h } = frame.boundingBox;
    const bw = bitmap.width;
    const bh = bitmap.height;
    const cx = (x + w / 2) * bw;
    const cy = (y + h / 2) * bh;
    const side = Math.max(w * bw, h * bh) * BBOX_EXPANSION;
    const left = Math.max(0, cx - side / 2);
    const top = Math.max(0, cy - side / 2);
    const right = Math.min(bw, cx + side / 2);
    const bottom = Math.min(bh, cy + side / 2);
    if (right <= left || bottom <= top) return null;

    ctx.drawImage(
      bitmap,
      left,
      top,
      right - left,
      bottom - top,
      0,
      0,
      INPUT_SIZE,
      INPUT_SIZE,
    );
    const pixelData = ctx.getImageData(0, 0, INPUT_SIZE, INPUT_SIZE).data;

    // NCHW float32 tensor, ImageNet-normalised.
    const floats = new Float32Array(3 * INPUT_SIZE * INPUT_SIZE);
    const plane = INPUT_SIZE * INPUT_SIZE;
    for (let i = 0; i < plane; i++) {
      const r = pixelData[i * 4] / 255;
      const g = pixelData[i * 4 + 1] / 255;
      const b = pixelData[i * 4 + 2] / 255;
      floats[i] = (r - IMAGENET_MEAN[0]) / IMAGENET_STD[0];
      floats[plane + i] = (g - IMAGENET_MEAN[1]) / IMAGENET_STD[1];
      floats[2 * plane + i] = (b - IMAGENET_MEAN[2]) / IMAGENET_STD[2];
    }
    return new ort.Tensor('float32', floats, [1, 3, INPUT_SIZE, INPUT_SIZE]);
  } finally {
    if (typeof (bitmap as ImageBitmap).close === 'function') {
      (bitmap as ImageBitmap).close();
    }
  }
}

async function decodeJpegToBitmap(bytes: Uint8Array): Promise<ImageBitmap | null> {
  try {
    const blob = new Blob([bytes], { type: 'image/jpeg' });
    return await createImageBitmap(blob);
  } catch {
    return null;
  }
}

function softmax2(logits: [number, number]): [number, number] {
  const m = Math.max(logits[0], logits[1]);
  const e0 = Math.exp(logits[0] - m);
  const e1 = Math.exp(logits[1] - m);
  const denom = e0 + e1;
  if (denom <= 0) return [1, 0];
  return [e0 / denom, e1 / denom];
}

function makeNoOpClassifier(modelVersion: string): AntispoofClassifier {
  return {
    isAvailable: false,
    modelVersion,
    async predictFrames() {
      return null;
    },
    async dispose() {
      /* noop */
    },
  };
}
