/**
 * SNR upload payload shape and builder.
 *
 * The server accepts SNR evidence on the existing POST
 * /v1/sessions/:id/upload-signals endpoint under `metadata.snr`. This
 * module keeps the shape in one place so the VerificationCaptureEngine
 * integration, the API client, and future refactors stay in sync.
 */

import type {
  SNRChallengeEnvelope,
  SNRRenderManifestEntry,
} from './SNRChallengeController';

/** Shape written to `metadata.snr` in the upload-signals payload. */
export interface SNRUploadPayload {
  challenge_echo: SNRChallengeEnvelope;
  render_manifest: SNRRenderManifestEntry[];
  calibration_frame_index: number;
}

/**
 * Build the SNR metadata block. Throws if the calibration frame index is
 * not a valid non-negative integer; everything else is trust-but-verify
 * server-side.
 */
export function buildSnrUploadPayload(input: {
  challenge: SNRChallengeEnvelope;
  manifest: SNRRenderManifestEntry[];
  calibrationFrameIndex: number;
}): SNRUploadPayload {
  const { challenge, manifest, calibrationFrameIndex } = input;
  if (
    !Number.isInteger(calibrationFrameIndex) ||
    calibrationFrameIndex < 0
  ) {
    throw new Error(
      `buildSnrUploadPayload: calibrationFrameIndex must be a non-negative integer, got ${calibrationFrameIndex}`,
    );
  }
  return {
    challenge_echo: challenge,
    render_manifest: manifest,
    calibration_frame_index: calibrationFrameIndex,
  };
}
