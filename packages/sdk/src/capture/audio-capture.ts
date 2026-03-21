/**
 * Audio capture for speak_phrase challenge.
 *
 * Records audio via MediaRecorder with WebM/Opus codec.
 * Returns a Blob suitable for multipart upload.
 */

/**
 * Record audio for a given duration.
 *
 * @param stream - MediaStream that includes an audio track
 * @param durationMs - Recording duration in milliseconds
 * @returns WebM audio blob
 */
export async function recordAudio(
  stream: MediaStream,
  durationMs: number
): Promise<Blob> {
  // Determine supported mime type
  const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
    ? 'audio/webm;codecs=opus'
    : MediaRecorder.isTypeSupported('audio/webm')
      ? 'audio/webm'
      : 'audio/mp4';

  const mediaRecorder = new MediaRecorder(stream, { mimeType });
  const chunks: Blob[] = [];

  mediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  mediaRecorder.start(250); // 250ms timeslice

  await new Promise<void>(resolve => {
    setTimeout(() => {
      if (mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
      }
      resolve();
    }, durationMs);
  });

  // Wait for the stop event to fire so all chunks are flushed
  if (mediaRecorder.state !== 'inactive') {
    await new Promise<void>(resolve => {
      mediaRecorder.onstop = () => resolve();
    });
  }

  return new Blob(chunks, { type: mimeType });
}
