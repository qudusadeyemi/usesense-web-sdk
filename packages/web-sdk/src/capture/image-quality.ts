/**
 * Real-time Image Quality Analyzer for UseSense Web SDK
 *
 * Performs frame-level analysis of:
 *   - Blur detection (Laplacian variance method)
 *   - Brightness adequacy (luminance histogram analysis)
 *   - Contrast sufficiency (standard deviation of luminance)
 *   - Exposure balance (over/under-exposure detection)
 *
 * All analysis runs on a downsampled grayscale canvas for performance.
 * The analyzer is designed to run at ~4-5 Hz without blocking the main thread.
 *
 * @module capture/image-quality
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type QualityLevel = 'good' | 'acceptable' | 'poor';

export interface BlurAnalysis {
  /** Laplacian variance — higher is sharper. */
  laplacianVariance: number;
  /** Normalised sharpness 0-100 */
  sharpnessScore: number;
  level: QualityLevel;
  /** True when the frame is too blurry for reliable face matching */
  isBlurry: boolean;
}

export interface LightingAnalysis {
  /** Mean brightness 0-255 */
  meanBrightness: number;
  /** Standard deviation of pixel brightness */
  contrast: number;
  /** Fraction of pixels in the dark zone (<40) */
  underExposedRatio: number;
  /** Fraction of pixels in the bright zone (>215) */
  overExposedRatio: number;
  /** Normalised lighting score 0-100 */
  lightingScore: number;
  level: QualityLevel;
  isTooDark: boolean;
  isTooBright: boolean;
  isLowContrast: boolean;
}

export interface QualityGuidance {
  /** Primary guidance message for the user */
  message: string;
  /** Guidance severity */
  severity: 'info' | 'warning' | 'critical';
  /** Icon hint for UI rendering */
  icon: 'blur' | 'dark' | 'bright' | 'contrast' | 'good' | 'check';
}

export interface ImageQualityReport {
  blur: BlurAnalysis;
  lighting: LightingAnalysis;
  /** Overall quality score 0-100 (weighted combination) */
  overallScore: number;
  overallLevel: QualityLevel;
  /** True when quality is sufficient for backend processing */
  isAcceptable: boolean;
  /** Sorted guidance list — most critical first */
  guidance: QualityGuidance[];
  /** Analysis timestamp */
  timestamp: number;
  /** Analysis duration in ms */
  analysisMs: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Thresholds — tuned for typical webcam conditions
// ─────────────────────────────────────────────────────────────────────────────

const BLUR_THRESHOLD_POOR = 30;      // Laplacian variance below this = very blurry
const BLUR_THRESHOLD_ACCEPTABLE = 80; // Below this = somewhat blurry

const BRIGHTNESS_TOO_DARK = 55;      // Mean brightness below this
const BRIGHTNESS_TOO_BRIGHT = 210;   // Mean brightness above this
const BRIGHTNESS_IDEAL_LOW = 80;
const BRIGHTNESS_IDEAL_HIGH = 180;

const CONTRAST_TOO_LOW = 25;         // Std dev below this = low contrast
const CONTRAST_ACCEPTABLE = 40;

const EXPOSURE_RATIO_WARN = 0.25;    // 25% of pixels clipped
const EXPOSURE_RATIO_CRITICAL = 0.45; // 45% of pixels clipped

/** Downsampled analysis resolution for performance */
const ANALYSIS_WIDTH = 160;
const ANALYSIS_HEIGHT = 120;

// ─────────────────────────────────────────────────────────────────────────────
// Analyzer Class
// ─────────────────���───────────────────────────────────────────────────────────

export class ImageQualityAnalyzer {
  private analysisCanvas: HTMLCanvasElement;
  private analysisCtx: CanvasRenderingContext2D;
  private grayBuffer: Float32Array;
  private lastReport: ImageQualityReport | null = null;

  constructor() {
    this.analysisCanvas = document.createElement('canvas');
    this.analysisCanvas.width = ANALYSIS_WIDTH;
    this.analysisCanvas.height = ANALYSIS_HEIGHT;
    this.analysisCtx = this.analysisCanvas.getContext('2d', {
      willReadFrequently: true,
    })!;
    this.grayBuffer = new Float32Array(ANALYSIS_WIDTH * ANALYSIS_HEIGHT);
  }

  // ─── Public API ──────────────────────────────────────────────────────────

  /**
   * Analyse a video element's current frame.
   * Should be called at 4-5 Hz for smooth UX feedback.
   */
  analyzeFrame(video: HTMLVideoElement): ImageQualityReport {
    const t0 = performance.now();

    // Downsample to analysis canvas
    this.analysisCtx.drawImage(video, 0, 0, ANALYSIS_WIDTH, ANALYSIS_HEIGHT);
    const imageData = this.analysisCtx.getImageData(0, 0, ANALYSIS_WIDTH, ANALYSIS_HEIGHT);

    // Convert to grayscale
    this.toGrayscale(imageData.data);

    // Run analyses
    const blur = this.analyzeBlur();
    const lighting = this.analyzeLighting();

    // Compute overall score (weighted)
    const overallScore = Math.round(blur.sharpnessScore * 0.45 + lighting.lightingScore * 0.55);
    const overallLevel: QualityLevel =
      overallScore >= 65 ? 'good' :
      overallScore >= 40 ? 'acceptable' : 'poor';

    // Build guidance
    const guidance = this.buildGuidance(blur, lighting);

    const report: ImageQualityReport = {
      blur,
      lighting,
      overallScore,
      overallLevel,
      isAcceptable: overallScore >= 35,
      guidance,
      timestamp: Date.now(),
      analysisMs: Math.round((performance.now() - t0) * 100) / 100,
    };

    this.lastReport = report;
    return report;
  }

  /**
   * Analyse a canvas element's current content (used by ChallengeScreen
   * which already draws frames to its own capture canvas).
   */
  analyzeCanvas(canvas: HTMLCanvasElement): ImageQualityReport {
    const t0 = performance.now();

    this.analysisCtx.drawImage(canvas, 0, 0, ANALYSIS_WIDTH, ANALYSIS_HEIGHT);
    const imageData = this.analysisCtx.getImageData(0, 0, ANALYSIS_WIDTH, ANALYSIS_HEIGHT);

    this.toGrayscale(imageData.data);

    const blur = this.analyzeBlur();
    const lighting = this.analyzeLighting();

    const overallScore = Math.round(blur.sharpnessScore * 0.45 + lighting.lightingScore * 0.55);
    const overallLevel: QualityLevel =
      overallScore >= 65 ? 'good' :
      overallScore >= 40 ? 'acceptable' : 'poor';

    const guidance = this.buildGuidance(blur, lighting);

    const report: ImageQualityReport = {
      blur,
      lighting,
      overallScore,
      overallLevel,
      isAcceptable: overallScore >= 35,
      guidance,
      timestamp: Date.now(),
      analysisMs: Math.round((performance.now() - t0) * 100) / 100,
    };

    this.lastReport = report;
    return report;
  }

  /** Get the most recent report without re-analyzing */
  getLastReport(): ImageQualityReport | null {
    return this.lastReport;
  }

  /** Clean up resources */
  dispose(): void {
    this.lastReport = null;
  }

  // ─── Grayscale Conversion ───────────────────────────────────────────────

  private toGrayscale(rgba: Uint8ClampedArray): void {
    const len = ANALYSIS_WIDTH * ANALYSIS_HEIGHT;
    for (let i = 0; i < len; i++) {
      const offset = i * 4;
      // ITU-R BT.601 luminance weights
      this.grayBuffer[i] =
        0.299 * rgba[offset] +
        0.587 * rgba[offset + 1] +
        0.114 * rgba[offset + 2];
    }
  }

  // ─── Blur Detection (Laplacian Variance) ─────────────────────────────────

  private analyzeBlur(): BlurAnalysis {
    const w = ANALYSIS_WIDTH;
    const h = ANALYSIS_HEIGHT;
    const gray = this.grayBuffer;

    // Compute Laplacian (4-connected kernel: [0,1,0; 1,-4,1; 0,1,0])
    let sum = 0;
    let sumSq = 0;
    let count = 0;

    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const idx = y * w + x;
        const lap =
          gray[idx - w] +              // top
          gray[idx - 1] +              // left
          gray[idx + 1] +              // right
          gray[idx + w] -              // bottom
          4 * gray[idx];               // center

        sum += lap;
        sumSq += lap * lap;
        count++;
      }
    }

    const mean = sum / count;
    const variance = (sumSq / count) - (mean * mean);
    const laplacianVariance = Math.max(0, variance);

    // Map to 0-100 score
    // Typical webcam: sharp ~200-800+, blurry ~5-30
    const sharpnessScore = Math.min(100, Math.round((laplacianVariance / 300) * 100));

    const isBlurry = laplacianVariance < BLUR_THRESHOLD_POOR;
    const level: QualityLevel =
      laplacianVariance >= BLUR_THRESHOLD_ACCEPTABLE ? 'good' :
      laplacianVariance >= BLUR_THRESHOLD_POOR ? 'acceptable' : 'poor';

    return {
      laplacianVariance: Math.round(laplacianVariance * 10) / 10,
      sharpnessScore,
      level,
      isBlurry,
    };
  }

  // ─── Lighting Analysis ───────────────────────────────────────────────────

  private analyzeLighting(): LightingAnalysis {
    const gray = this.grayBuffer;
    const len = gray.length;

    // Compute mean
    let sum = 0;
    for (let i = 0; i < len; i++) {
      sum += gray[i];
    }
    const meanBrightness = sum / len;

    // Compute standard deviation (contrast)
    let varianceSum = 0;
    let darkCount = 0;
    let brightCount = 0;

    for (let i = 0; i < len; i++) {
      const diff = gray[i] - meanBrightness;
      varianceSum += diff * diff;

      if (gray[i] < 40) darkCount++;
      if (gray[i] > 215) brightCount++;
    }

    const contrast = Math.sqrt(varianceSum / len);
    const underExposedRatio = darkCount / len;
    const overExposedRatio = brightCount / len;

    // Determine issues
    const isTooDark = meanBrightness < BRIGHTNESS_TOO_DARK;
    const isTooBright = meanBrightness > BRIGHTNESS_TOO_BRIGHT;
    const isLowContrast = contrast < CONTRAST_TOO_LOW;

    // Compute lighting score
    let lightingScore = 100;

    // Brightness penalty
    if (meanBrightness < BRIGHTNESS_IDEAL_LOW) {
      const deficit = (BRIGHTNESS_IDEAL_LOW - meanBrightness) / BRIGHTNESS_IDEAL_LOW;
      lightingScore -= deficit * 50;
    } else if (meanBrightness > BRIGHTNESS_IDEAL_HIGH) {
      const excess = (meanBrightness - BRIGHTNESS_IDEAL_HIGH) / (255 - BRIGHTNESS_IDEAL_HIGH);
      lightingScore -= excess * 50;
    }

    // Contrast penalty
    if (contrast < CONTRAST_ACCEPTABLE) {
      const deficit = (CONTRAST_ACCEPTABLE - contrast) / CONTRAST_ACCEPTABLE;
      lightingScore -= deficit * 30;
    }

    // Exposure penalty
    if (underExposedRatio > EXPOSURE_RATIO_WARN) {
      lightingScore -= (underExposedRatio - EXPOSURE_RATIO_WARN) * 40;
    }
    if (overExposedRatio > EXPOSURE_RATIO_WARN) {
      lightingScore -= (overExposedRatio - EXPOSURE_RATIO_WARN) * 40;
    }

    lightingScore = Math.max(0, Math.min(100, Math.round(lightingScore)));

    const level: QualityLevel =
      lightingScore >= 60 ? 'good' :
      lightingScore >= 35 ? 'acceptable' : 'poor';

    return {
      meanBrightness: Math.round(meanBrightness * 10) / 10,
      contrast: Math.round(contrast * 10) / 10,
      underExposedRatio: Math.round(underExposedRatio * 1000) / 1000,
      overExposedRatio: Math.round(overExposedRatio * 1000) / 1000,
      lightingScore,
      level,
      isTooDark,
      isTooBright,
      isLowContrast,
    };
  }

  // ─── Guidance Builder ────────────────────────────────────────────────────

  private buildGuidance(blur: BlurAnalysis, lighting: LightingAnalysis): QualityGuidance[] {
    const items: QualityGuidance[] = [];

    // ── Lighting guidance first — lighting issues take priority ────────────
    // When the image is too dark or too bright, blur detection is unreliable
    // (uniformly dark/bright frames have near-zero Laplacian variance),
    // so we suppress blur guidance when lighting is the real problem.

    const hasLightingProblem = lighting.isTooDark || lighting.isTooBright
      || lighting.underExposedRatio > EXPOSURE_RATIO_CRITICAL
      || lighting.overExposedRatio > EXPOSURE_RATIO_CRITICAL;

    // Brightness guidance - prioritize most severe issues
    if (lighting.isTooDark) {
      items.push({
        message: 'Turn on the lights or move to a bright area',
        severity: 'critical',
        icon: 'dark',
      });
    } else if (lighting.isTooBright) {
      items.push({
        message: 'Too bright — move away from direct light',
        severity: 'critical',
        icon: 'bright',
      });
    } else if (lighting.meanBrightness < BRIGHTNESS_IDEAL_LOW && lighting.lightingScore < 50) {
      items.push({
        message: 'A bit dark — more light would help',
        severity: 'warning',
        icon: 'dark',
      });
    }

    // Over/under exposure guidance - critical issues only
    if (lighting.underExposedRatio > EXPOSURE_RATIO_CRITICAL) {
      items.push({
        message: 'Image is too dark — add more lighting',
        severity: 'critical',
        icon: 'dark',
      });
    } else if (lighting.overExposedRatio > EXPOSURE_RATIO_CRITICAL) {
      items.push({
        message: 'Too much glare — reduce backlighting',
        severity: 'critical',
        icon: 'bright',
      });
    }

    // Contrast guidance - only when it's a real problem
    if (lighting.isLowContrast && lighting.contrast < 20) {
      items.push({
        message: 'Low contrast — adjust your lighting',
        severity: 'warning',
        icon: 'contrast',
      });
    }

    // ── Blur guidance — only when lighting is adequate ─────────────────────
    // Laplacian variance is meaningless on uniformly dark/bright frames,
    // so we skip blur guidance when there's a lighting problem.
    if (!hasLightingProblem) {
      if (blur.level === 'poor') {
        items.push({
          message: 'Clean your camera lens or hold your device steady',
          severity: 'critical',
          icon: 'blur',
        });
      } else if (blur.level === 'acceptable' && blur.sharpnessScore < 50) {
        items.push({
          message: 'Image is slightly blurry — hold still',
          severity: 'warning',
          icon: 'blur',
        });
      }
    }

    // Sort by severity: critical first
    const severityOrder = { critical: 0, warning: 1, info: 2 };
    items.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    return items;
  }
}