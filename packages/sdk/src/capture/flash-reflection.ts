/**
 * Flash Reflection Challenge -- Client-side presentation attack detection.
 *
 * Displays 3 random colored overlays on the device screen. A real face reflects
 * these colors (skin albedo changes under colored illumination). A face displayed
 * on an external screen does NOT -- the screen's backlight overwhelms any
 * reflected flash.
 *
 * Protocol:
 *   1. Pick 3 random colors
 *   2. For each: baseline 400ms, flash 600ms with overlay, compute RGB delta
 *   3. Pass if >= 2 of 3 flashes show delta >= 8 with correct direction
 */

import type { FlashResult, FlashReflectionEvidence } from '../types';

const FLASH_COLORS = ['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF'];
const BASELINE_MS = 400;
const FLASH_MS = 600;
const DELTA_THRESHOLD = 8;

type OverlayCallback = (color: string | null) => void;

/**
 * Run the flash reflection challenge.
 *
 * @param videoElement - The active camera video element
 * @param setOverlayColor - Callback to set/clear the color overlay in the UI
 * @returns Evidence object with per-flash results
 */
export async function runFlashReflection(
  videoElement: HTMLVideoElement,
  setOverlayColor: OverlayCallback
): Promise<FlashReflectionEvidence> {
  // Pick 3 random colors (no duplicates)
  const shuffled = [...FLASH_COLORS].sort(() => Math.random() - 0.5);
  const selectedColors = shuffled.slice(0, 3);

  const flashes: FlashResult[] = [];

  for (const color of selectedColors) {
    // Baseline: clear overlay, wait for render + 400ms, sample
    setOverlayColor(null);
    await waitForRender();
    await sleep(BASELINE_MS);
    const baselineRgb = sampleFaceRegionRgb(videoElement);

    // Flash: show overlay, wait for render + 600ms, sample
    setOverlayColor(color);
    await waitForRender();
    await sleep(FLASH_MS);
    const flashRgb = sampleFaceRegionRgb(videoElement);

    // Compute delta
    const dR = flashRgb[0] - baselineRgb[0];
    const dG = flashRgb[1] - baselineRgb[1];
    const dB = flashRgb[2] - baselineRgb[2];
    const colorDelta = Math.sqrt(dR * dR + dG * dG + dB * dB);

    // Check direction: dominant channel shift should match flash color
    const reflectionDetected = colorDelta >= DELTA_THRESHOLD && checkDirection(color, dR, dG, dB);

    flashes.push({
      color,
      durationMs: FLASH_MS,
      baselineRgb: baselineRgb as [number, number, number],
      flashRgb: flashRgb as [number, number, number],
      colorDelta: Math.round(colorDelta * 10) / 10,
      reflectionDetected,
    });
  }

  // Clear overlay
  setOverlayColor(null);

  const passCount = flashes.filter(f => f.reflectionDetected).length;
  const passed = passCount >= 2;
  const avgDelta = flashes.reduce((s, f) => s + f.colorDelta, 0) / flashes.length;

  return {
    type: 'flash_reflection',
    flashes,
    passed,
    confidence: passed ? Math.min(100, Math.round(avgDelta * 4)) : Math.round(avgDelta * 2),
    overallColorDelta: Math.round(avgDelta * 10) / 10,
  };
}

/**
 * Sample the center 40% of the frame at reduced resolution.
 * Returns [R, G, B] averages.
 */
function sampleFaceRegionRgb(video: HTMLVideoElement): [number, number, number] {
  try {
    const w = 120;
    const h = 90;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return [128, 128, 128];

    ctx.drawImage(video, 0, 0, w, h);

    // Center 40% region
    const x0 = Math.floor(w * 0.3);
    const y0 = Math.floor(h * 0.2);
    const rw = Math.floor(w * 0.4);
    const rh = Math.floor(h * 0.5);
    const data = ctx.getImageData(x0, y0, rw, rh).data;

    let totalR = 0;
    let totalG = 0;
    let totalB = 0;
    const pixelCount = rw * rh;

    for (let i = 0; i < data.length; i += 4) {
      totalR += data[i];
      totalG += data[i + 1];
      totalB += data[i + 2];
    }

    return [
      Math.round(totalR / pixelCount),
      Math.round(totalG / pixelCount),
      Math.round(totalB / pixelCount),
    ];
  } catch {
    return [128, 128, 128];
  }
}

/**
 * Check that the dominant color shift direction matches the flash color.
 */
function checkDirection(color: string, dR: number, dG: number, dB: number): boolean {
  switch (color) {
    case '#FF0000': return dR > 0 && dR >= dG && dR >= dB;
    case '#00FF00': return dG > 0 && dG >= dR && dG >= dB;
    case '#0000FF': return dB > 0 && dB >= dR && dB >= dG;
    case '#FFFF00': return dR > 0 && dG > 0;
    case '#FF00FF': return dR > 0 && dB > 0;
    case '#00FFFF': return dG > 0 && dB > 0;
    default: return true;
  }
}

function waitForRender(): Promise<void> {
  return new Promise(resolve => requestAnimationFrame(() => resolve()));
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
