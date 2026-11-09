/**
 * Constants describing the MediaPipe image segmentation model used by the
 * covered-face check (capture-test-kit/COVER-v1.md). Same model and bytes as
 * the iOS and Android SDKs (Android: SegmenterModelInfo).
 *
 * The Web SDK does not bundle the 16 MB model. It fetches it at runtime, like
 * the face landmarker model: first from cdn.usesense.ai (the sha256 pinned in
 * the path), then from the pinned upstream URL. The bytes are checked against
 * {@link SegmenterModelInfo.sha256} before use.
 */
export const SegmenterModelInfo = {
  /** Upstream model and version path segment. */
  version: 'selfie_multiclass_256x256/float32/1',

  /** SHA-256 of the canonical selfie_multiclass_256x256.tflite bytes. */
  sha256: 'c6748b1253a99067ef71f7e26ca71096cd449baefa8f101900ea23016507e0e0',

  /** Size of the canonical model in bytes. */
  sizeBytes: 16371837,

  /** Upstream URL the canonical bytes come from (pinned version). */
  sourceUrl:
    'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/1/selfie_multiclass_256x256.tflite',

  /** Default CDN URL, same host and layout as the face landmarker model. */
  defaultCdnUrl:
    'https://cdn.usesense.ai/mediapipe/selfie_multiclass_256x256/c6748b1253a99067ef71f7e26ca71096cd449baefa8f101900ea23016507e0e0/selfie_multiclass_256x256.tflite',

  /** Stable identifier for logs: "mediapipe_selfie_multiclass@<short-sha>". */
  versionLabel: 'mediapipe_selfie_multiclass@c6748b12',
} as const;
