// Hand-written stub for first-time MediaPipe constants integration in Phase 2.
// Future updates land here automatically via the mediapipe-sdk-sync workflow
// in qudusadeyemi/usesense-watchtower, which overwrites this file with content
// generated from .github/mediapipe-sync-templates/mediapipe-model-info.ts.tmpl.
//
// Source:    https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task
// Synced at: 2026-04-10T09:10:00Z (initial Phase 2 bootstrap, no sync run yet)
// Watchtower commit: bootstrap

/**
 * Constants describing the canonical MediaPipe FaceLandmarker model.
 *
 * The Web SDK fetches this model at runtime from cdn.usesense.ai (or a
 * self-hosted CDN passed via mediapipeAssetBaseUrl in the SDK config).
 * These constants let the SDK construct the full URL, attach a stable
 * model version label to upload payloads, and verify response integrity.
 *
 * Kept in sync with usesense-watchtower's canonical manifest by the
 * mediapipe-sdk-sync workflow. Do not modify by hand.
 */
export const MediaPipeModelInfo = {
  /** Upstream version path segment, e.g. "float16/1". */
  version: "float16/1",

  /** SHA-256 of the canonical face_landmarker.task bytes. */
  sha256: "64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff",

  /** Size of the canonical face_landmarker.task in bytes. */
  sizeBytes: 3758596,

  /** Upstream URL the canonical bytes were originally fetched from. */
  sourceUrl: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",

  /** Default CDN URL the bytes are served from. */
  defaultCdnUrl: "https://cdn.usesense.ai/mediapipe/face_landmarker/64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff/face_landmarker.task",

  /**
   * Stable identifier for upload payloads and observability.
   * Format: "mediapipe_face_landmarker@<short-sha>"
   */
  versionLabel: "mediapipe_face_landmarker@64184e22",
} as const;
