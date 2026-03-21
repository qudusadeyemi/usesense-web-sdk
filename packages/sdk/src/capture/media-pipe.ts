/**
 * MediaPipe Face Mesh integration.
 *
 * Provides:
 *  - Async CDN loading (non-blocking, graceful degradation)
 *  - Face detection for face guide
 *  - Face guide evaluation (centered, distance, visibility)
 *  - Frame signal extraction (478 landmarks + head pose via FaceLandmarker)
 *  - On-device 3DMM fitting (shape params, geometric ratios, depth)
 *  - Cross-frame consistency scoring
 */

import type { FaceGuideStatus, FrameSignal, OnDevice3DMMFit } from '../types';

// ============================================================================
// Module state
// ============================================================================

let faceLandmarker: any = null;
let isLoading = false;
let isReady = false;

// ============================================================================
// Loading
// ============================================================================

/**
 * Load MediaPipe Face Landmarker from CDN.
 * Non-blocking -- call this early and check isFaceMeshReady() later.
 */
export async function initFaceMesh(): Promise<void> {
  if (isReady || isLoading) return;
  isLoading = true;

  try {
    console.log('[UseSense] Loading MediaPipe Face Mesh...');

    // Dynamic import from CDN
    const vision = await importVisionModule();
    const { FilesetResolver, FaceLandmarker } = vision;

    const filesetResolver = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm'
    );

    faceLandmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
      baseOptions: {
        modelAssetPath:
          'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
        delegate: 'GPU',
      },
      runningMode: 'VIDEO',
      numFaces: 1,
      minFaceDetectionConfidence: 0.3,
      minFacePresenceConfidence: 0.3,
      minTrackingConfidence: 0.3,
      outputFaceBlendshapes: true,
      outputFacialTransformationMatrixes: true,
    });

    isReady = true;
    console.log('[UseSense] MediaPipe Face Mesh loaded successfully');
  } catch (err: any) {
    console.warn(
      '[UseSense] MediaPipe Face Mesh failed to load (graceful degradation):',
      err.message || err
    );
    isReady = false;
  } finally {
    isLoading = false;
  }
}

async function importVisionModule(): Promise<any> {
  // Try ESM dynamic import from CDN
  // Use a variable so bundlers (webpack/next) do not attempt to resolve the URL at build time
  const cdnUrl = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/vision_bundle.mjs';
  try {
    return await (new Function('u', 'return import(u)'))(cdnUrl);
  } catch {
    // Fallback: script tag injection
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src =
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/vision_bundle.js';
      script.onload = () => {
        const w = window as any;
        if (w.FilesetResolver && w.FaceLandmarker) {
          resolve({ FilesetResolver: w.FilesetResolver, FaceLandmarker: w.FaceLandmarker });
        } else {
          reject(new Error('MediaPipe globals not found after script load'));
        }
      };
      script.onerror = () => reject(new Error('Failed to load MediaPipe script'));
      document.head.appendChild(script);
    });
  }
}

export function isFaceMeshReady(): boolean {
  return isReady && faceLandmarker !== null;
}

export function disposeFaceMesh(): void {
  if (faceLandmarker) {
    try {
      const closeResult = faceLandmarker.close();
      // close() may return a Promise in some MediaPipe versions — silence any rejection
      if (closeResult && typeof closeResult.catch === 'function') {
        closeResult.catch(() => {});
      }
    } catch {
      // ignore synchronous errors
    }
    faceLandmarker = null;
  }
  isReady = false;
  isLoading = false;
}

// ============================================================================
// Face Guide Evaluation
// ============================================================================

/**
 * Evaluate face position relative to the camera for guidance feedback.
 */
export function evaluateFaceGuide(
  videoElement: HTMLVideoElement
): FaceGuideStatus {
  const noFace: FaceGuideStatus = {
    faceDetected: false,
    faceCentered: false,
    faceDistance: 'too_far',
    faceVisible: false,
    message: 'Position your face in the oval',
    ready: false,
  };

  if (!isFaceMeshReady() || !faceLandmarker) return noFace;
  if (!videoElement || videoElement.readyState < 2) return noFace;

  try {
    const timestamp = performance.now();
    const result = faceLandmarker.detectForVideo(videoElement, timestamp);

    if (!result.faceLandmarks || result.faceLandmarks.length === 0) {
      return { ...noFace, message: 'No face detected' };
    }

    const landmarks = result.faceLandmarks[0];
    const videoWidth = videoElement.videoWidth || 640;
    const videoHeight = videoElement.videoHeight || 480;

    // Face bounding box from landmarks
    const xs = landmarks.map((l: any) => l.x);
    const ys = landmarks.map((l: any) => l.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const faceWidth = (maxX - minX) * videoWidth;
    const _faceHeight = (maxY - minY) * videoHeight;
    void _faceHeight;

    // Size check
    if (faceWidth < 100) {
      return {
        faceDetected: true,
        faceCentered: false,
        faceDistance: 'too_far',
        faceVisible: true,
        message: 'Move closer',
        ready: false,
      };
    }
    if (faceWidth > 400) {
      return {
        faceDetected: true,
        faceCentered: false,
        faceDistance: 'too_close',
        faceVisible: true,
        message: 'Move further away',
        ready: false,
      };
    }

    // Center check (face center within +/-15% of video center)
    const faceCenterX = minX + (maxX - minX) / 2;
    const faceCenterY = minY + (maxY - minY) / 2;
    const isCentered =
      Math.abs(faceCenterX - 0.5) < 0.15 &&
      Math.abs(faceCenterY - 0.5) < 0.15;

    if (!isCentered) {
      return {
        faceDetected: true,
        faceCentered: false,
        faceDistance: 'good',
        faceVisible: true,
        message: 'Center your face in the oval',
        ready: false,
      };
    }

    // Eye open check via blendshapes
    const blendshapes =
      result.faceBlendshapes?.[0]?.categories || [];
    const leftBlink =
      blendshapes.find(
        (b: any) => b.categoryName === 'eyeBlinkLeft'
      )?.score || 0;
    const rightBlink =
      blendshapes.find(
        (b: any) => b.categoryName === 'eyeBlinkRight'
      )?.score || 0;

    if (leftBlink > 0.7 || rightBlink > 0.7) {
      return {
        faceDetected: true,
        faceCentered: true,
        faceDistance: 'good',
        faceVisible: true,
        message: 'Please open your eyes',
        ready: false,
      };
    }

    // All checks passed
    return {
      faceDetected: true,
      faceCentered: true,
      faceDistance: 'good',
      faceVisible: true,
      message: 'Ready',
      ready: true,
    };
  } catch (err) {
    console.warn('[UseSense] Face guide evaluation error:', err);
    return noFace;
  }
}

// ============================================================================
// Frame Signal Extraction
// ============================================================================

/**
 * Extract face landmarks and head pose from a video frame.
 */
export function extractFrameSignal(
  videoElement: HTMLVideoElement,
  frameIndex: number,
  phase: 'baseline' | 'challenge'
): FrameSignal | null {
  if (!isFaceMeshReady() || !faceLandmarker) return null;
  if (!videoElement || videoElement.readyState < 2) return null;

  try {
    const timestamp = performance.now();
    const result = faceLandmarker.detectForVideo(videoElement, timestamp);

    if (!result.faceLandmarks || result.faceLandmarks.length === 0) {
      return null;
    }

    const landmarks = result.faceLandmarks[0];
    const flatLandmarks = landmarks.flatMap((lm: any) => [lm.x, lm.y, lm.z]);

    // Head pose from transformation matrix
    let headPose = { yaw: 0, pitch: 0, roll: 0 };
    if (
      result.facialTransformationMatrixes &&
      result.facialTransformationMatrixes.length > 0
    ) {
      const matrix = result.facialTransformationMatrixes[0].data;
      headPose = computeHeadPoseFromMatrix(matrix);
    } else {
      headPose = computeHeadPoseFromLandmarks(landmarks);
    }

    return {
      timestamp,
      frameIndex,
      phase,
      landmarks: flatLandmarks,
      headPose,
      facialTransformationMatrix:
        result.facialTransformationMatrixes?.[0]?.data,
      blendshapes: result.faceBlendshapes?.[0]?.categories,
    };
  } catch (err) {
    console.warn('[UseSense] Frame signal extraction error:', err);
    return null;
  }
}

function computeHeadPoseFromMatrix(
  matrix: Float32Array
): { yaw: number; pitch: number; roll: number } {
  const m = matrix;
  const pitch =
    Math.atan2(-m[6], Math.sqrt(m[2] * m[2] + m[10] * m[10])) *
    (180 / Math.PI);
  const yaw = Math.atan2(m[2], m[10]) * (180 / Math.PI);
  const roll = Math.atan2(m[4], m[5]) * (180 / Math.PI);
  return { yaw, pitch, roll };
}

function computeHeadPoseFromLandmarks(
  landmarks: any[]
): { yaw: number; pitch: number; roll: number } {
  // Nose tip: 1, chin: 152, left ear: 234, right ear: 454
  const noseTip = landmarks[1];
  const leftEar = landmarks[234];
  const rightEar = landmarks[454];
  const chin = landmarks[152];
  const leftEye = landmarks[33];
  const rightEye = landmarks[263];

  const leftDist = noseTip.x - leftEar.x;
  const rightDist = rightEar.x - noseTip.x;
  const yaw =
    Math.atan2(leftDist - rightDist, leftDist + rightDist) *
    (180 / Math.PI) *
    1.5;
  const pitch = (noseTip.y - chin.y) * -180;
  const roll =
    Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x) *
    (180 / Math.PI);

  return { yaw, pitch, roll };
}

// ============================================================================
// On-Device 3DMM Fitting
// ============================================================================

/**
 * Simplified on-device 3DMM fitting from face landmarks.
 * Accepts both the 468-landmark FaceMesh model (1404 floats) and the
 * 478-landmark FaceLandmarker model (1434 floats, adds iris landmarks).
 * Returns shape params, geometric ratios, depth plausibility, and pose ratios.
 */
export function fitOnDevice3DMM(landmarks: number[]): OnDevice3DMMFit | null {
  if (landmarks.length < 1404) return null; // need at least 468 * 3

  const pose = computePoseFromFlatLandmarks(landmarks);
  const shapeParams = computeShapeParams(landmarks);
  const geometricRatios = computeGeometricRatios(landmarks);
  const poseRatios2D = computePoseRatios2D(landmarks);
  const depthPlausibility = computeDepthPlausibility(landmarks);

  return {
    shapeParams,
    pose,
    depthPlausibility,
    geometricRatios,
    poseRatios2D,
  };
}

function computePoseFromFlatLandmarks(
  lm: number[]
): { yaw: number; pitch: number; roll: number } {
  const noseTip = [lm[1 * 3], lm[1 * 3 + 1], lm[1 * 3 + 2]];
  const leftEar = [lm[234 * 3], lm[234 * 3 + 1], lm[234 * 3 + 2]];
  const rightEar = [lm[454 * 3], lm[454 * 3 + 1], lm[454 * 3 + 2]];
  const chin = [lm[152 * 3], lm[152 * 3 + 1], lm[152 * 3 + 2]];
  const leftEye = [lm[33 * 3], lm[33 * 3 + 1], lm[33 * 3 + 2]];
  const rightEye = [lm[263 * 3], lm[263 * 3 + 1], lm[263 * 3 + 2]];

  const leftDist = noseTip[0] - leftEar[0];
  const rightDist = rightEar[0] - noseTip[0];
  const yaw =
    Math.atan2(leftDist - rightDist, leftDist + rightDist) *
    (180 / Math.PI) *
    1.5;
  const pitch = (noseTip[1] - chin[1]) * -180;
  const roll =
    Math.atan2(rightEye[1] - leftEye[1], rightEye[0] - leftEye[0]) *
    (180 / Math.PI);

  return { yaw, pitch, roll };
}

/**
 * 12-dimensional shape parameter vector from inter-landmark distances,
 * normalized by inter-eye distance.
 */
function computeShapeParams(lm: number[]): number[] {
  // Key landmark pairs for shape characterization
  const pairs: [number, number][] = [
    [33, 263],   // inter-eye
    [1, 152],    // nose tip to chin
    [33, 133],   // left eye width
    [263, 362],  // right eye width
    [61, 291],   // mouth width
    [0, 17],     // upper lip to lower lip
    [234, 454],  // ear to ear
    [10, 152],   // forehead to chin
    [33, 1],     // left eye to nose
    [263, 1],    // right eye to nose
    [33, 61],    // left eye to mouth corner
    [263, 291],  // right eye to mouth corner
  ];

  const distances = pairs.map(([a, b]) => {
    const ax = lm[a * 3], ay = lm[a * 3 + 1], az = lm[a * 3 + 2];
    const bx = lm[b * 3], by = lm[b * 3 + 1], bz = lm[b * 3 + 2];
    return Math.sqrt((bx - ax) ** 2 + (by - ay) ** 2 + (bz - az) ** 2);
  });

  // Normalize by inter-eye distance (first pair)
  const ied = distances[0] || 1;
  return distances.map(d => d / ied);
}

function computeGeometricRatios(lm: number[]): number[] {
  const dist = (a: number, b: number) => {
    const ax = lm[a * 3], ay = lm[a * 3 + 1], az = lm[a * 3 + 2];
    const bx = lm[b * 3], by = lm[b * 3 + 1], bz = lm[b * 3 + 2];
    return Math.sqrt((bx - ax) ** 2 + (by - ay) ** 2 + (bz - az) ** 2);
  };

  const ipd = dist(33, 263) || 1;
  return [
    ipd,
    dist(1, 152) / ipd,    // nose-chin / ipd
    dist(234, 454) / ipd,  // ear-ear / ipd
    dist(61, 291) / ipd,   // mouth width / ipd
    dist(10, 152) / ipd,   // forehead-chin / ipd
    dist(33, 1) / ipd,     // left eye-nose / ipd
  ];
}

function computePoseRatios2D(lm: number[]): number[] {
  const noseTip = [lm[1 * 3], lm[1 * 3 + 1]];
  const leftEye = [lm[33 * 3], lm[33 * 3 + 1]];
  const chin = [lm[152 * 3], lm[152 * 3 + 1]];
  const rightEye = [lm[263 * 3], lm[263 * 3 + 1]];
  const forehead = [lm[10 * 3], lm[10 * 3 + 1]];

  const faceHeight = Math.abs(chin[1] - forehead[1]) || 1;
  const faceWidth = Math.abs(rightEye[0] - leftEye[0]) || 1;

  return [
    (noseTip[1] - leftEye[1]) / faceHeight,
    (noseTip[0] - leftEye[0]) / faceWidth,
    (rightEye[1] - leftEye[1]) / faceHeight,
    (chin[0] - noseTip[0]) / faceWidth,
    faceWidth / faceHeight,
  ];
}

function computeDepthPlausibility(lm: number[]): number {
  // Real faces have z-value variation; flat surfaces have near-zero
  const zValues: number[] = [];
  for (let i = 2; i < lm.length; i += 3) {
    zValues.push(lm[i]);
  }
  const mean = zValues.reduce((s, v) => s + v, 0) / zValues.length;
  const variance =
    zValues.reduce((s, v) => s + (v - mean) ** 2, 0) / zValues.length;
  const stdDev = Math.sqrt(variance);
  return Math.min(100, Math.round(stdDev * 1000));
}

// ============================================================================
// Cross-Frame Analysis
// ============================================================================

/**
 * Compute consistency of shape parameters across frames.
 * Higher = more consistent (real face). Lower = variable (spoofed).
 */
export function computeCrossFrameConsistency(
  fits: OnDevice3DMMFit[]
): number {
  if (fits.length < 2) return 0;

  let totalVariance = 0;
  const paramCount = fits[0].shapeParams.length;

  for (let i = 0; i < paramCount; i++) {
    const values = fits.map(f => f.shapeParams[i]);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance =
      values.reduce((sum, val) => sum + (val - mean) ** 2, 0) / values.length;
    totalVariance += variance;
  }

  return Math.max(0, Math.round(100 - totalVariance * 10));
}

/**
 * Compute preliminary geometric coherence score.
 */
export function computePreliminaryGCScore(
  fits: OnDevice3DMMFit[],
  crossFrameConsistency: number
): number {
  if (fits.length === 0) return 0;
  const avgDepth =
    fits.reduce((sum, f) => sum + f.depthPlausibility, 0) / fits.length;
  return Math.round(avgDepth * 0.6 + crossFrameConsistency * 0.4);
}
