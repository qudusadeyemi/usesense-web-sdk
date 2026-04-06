/**
 * Screen detection signal collection for channel_integrity.screen_detection.
 *
 * Computes 4 signals from captured frame data:
 *   - luminance_histogram_spread: width of luminance distribution
 *   - edge_energy_ratio: high-frequency to total energy
 *   - frame_luminance_cv: coefficient of variation across frames
 *   - color_channel_uniformity: how uniform RGB channels are
 */

import type { ScreenDetectionSignals } from '../types';

/**
 * Compute screen detection signals from captured frame luminances
 * and the last captured video frame.
 *
 * @param frameLuminances - Per-frame average luminance values
 * @param lastFrameCanvas - Canvas containing the last captured frame (for edge/color analysis)
 */
export function computeScreenDetectionSignals(
  frameLuminances: number[],
  lastFrameCanvas: HTMLCanvasElement | null
): ScreenDetectionSignals {
  return {
    luminance_histogram_spread: computeLuminanceHistogramSpread(lastFrameCanvas),
    edge_energy_ratio: computeEdgeEnergyRatio(lastFrameCanvas),
    frame_luminance_cv: computeFrameLuminanceCV(frameLuminances),
    color_channel_uniformity: computeColorChannelUniformity(lastFrameCanvas),
  };
}

/**
 * Luminance histogram spread (0-1).
 * Real scenes have wide distribution. Screens have narrow, peaked distribution.
 */
function computeLuminanceHistogramSpread(canvas: HTMLCanvasElement | null): number {
  if (!canvas) return 0.5;

  try {
    const ctx = canvas.getContext('2d');
    if (!ctx) return 0.5;

    // Downscale for speed
    const w = 120;
    const h = 90;
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = w;
    tempCanvas.height = h;
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return 0.5;

    tempCtx.drawImage(canvas, 0, 0, w, h);
    const data = tempCtx.getImageData(0, 0, w, h).data;

    // Build histogram (256 bins)
    const hist = new Uint32Array(256);
    const pixelCount = w * h;
    for (let i = 0; i < data.length; i += 4) {
      const lum = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
      hist[Math.min(255, lum)]++;
    }

    // Find the 5th and 95th percentile
    let sum = 0;
    let p5 = 0;
    let p95 = 255;
    const target5 = pixelCount * 0.05;
    const target95 = pixelCount * 0.95;
    for (let i = 0; i < 256; i++) {
      sum += hist[i];
      if (sum >= target5 && p5 === 0) p5 = i;
      if (sum >= target95) { p95 = i; break; }
    }

    return (p95 - p5) / 255;
  } catch {
    return 0.5;
  }
}

/**
 * Edge energy ratio (0-1).
 * Real scenes have more high-frequency detail than screen captures.
 */
function computeEdgeEnergyRatio(canvas: HTMLCanvasElement | null): number {
  if (!canvas) return 0.5;

  try {
    const ctx = canvas.getContext('2d');
    if (!ctx) return 0.5;

    const w = 120;
    const h = 90;
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = w;
    tempCanvas.height = h;
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return 0.5;

    tempCtx.drawImage(canvas, 0, 0, w, h);
    const data = tempCtx.getImageData(0, 0, w, h).data;

    // Compute luminance
    const lums = new Float32Array(w * h);
    for (let i = 0, pi = 0; i < data.length; i += 4, pi++) {
      lums[pi] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    }

    // Compute edge energy (horizontal + vertical gradients)
    let edgeEnergy = 0;
    let totalEnergy = 0;
    for (let y = 0; y < h - 1; y++) {
      for (let x = 0; x < w - 1; x++) {
        const pi = y * w + x;
        const dx = lums[pi + 1] - lums[pi];
        const dy = lums[pi + w] - lums[pi];
        edgeEnergy += dx * dx + dy * dy;
        totalEnergy += lums[pi] * lums[pi];
      }
    }

    return totalEnergy > 0 ? Math.min(1, edgeEnergy / totalEnergy) : 0.5;
  } catch {
    return 0.5;
  }
}

/**
 * Frame luminance CV (coefficient of variation across frames).
 * Low CV = stable lighting (suspicious for screens).
 */
function computeFrameLuminanceCV(frameLuminances: number[]): number {
  if (frameLuminances.length < 2) return 0;

  const mean = frameLuminances.reduce((a, b) => a + b, 0) / frameLuminances.length;
  if (mean < 0.001) return 0;

  const variance = frameLuminances.reduce((s, l) => s + (l - mean) ** 2, 0) / frameLuminances.length;
  return Math.sqrt(variance) / mean;
}

/**
 * Color channel uniformity (0-1).
 * How uniform the RGB channels are relative to each other.
 * Screens tend to have more uniform channel ratios.
 */
function computeColorChannelUniformity(canvas: HTMLCanvasElement | null): number {
  if (!canvas) return 0.5;

  try {
    const ctx = canvas.getContext('2d');
    if (!ctx) return 0.5;

    const w = 60;
    const h = 45;
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = w;
    tempCanvas.height = h;
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return 0.5;

    tempCtx.drawImage(canvas, 0, 0, w, h);
    const data = tempCtx.getImageData(0, 0, w, h).data;

    let totalR = 0;
    let totalG = 0;
    let totalB = 0;
    const pixelCount = w * h;

    for (let i = 0; i < data.length; i += 4) {
      totalR += data[i];
      totalG += data[i + 1];
      totalB += data[i + 2];
    }

    const avgR = totalR / pixelCount;
    const avgG = totalG / pixelCount;
    const avgB = totalB / pixelCount;
    const mean = (avgR + avgG + avgB) / 3;

    if (mean < 1) return 0.5;

    // CV of channel means -- low CV = uniform
    const channelVariance = ((avgR - mean) ** 2 + (avgG - mean) ** 2 + (avgB - mean) ** 2) / 3;
    const channelCV = Math.sqrt(channelVariance) / mean;

    // Invert: low CV -> high uniformity
    return Math.max(0, Math.min(1, 1 - channelCV * 5));
  } catch {
    return 0.5;
  }
}
