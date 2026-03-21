import { AudioMetadata } from '../types';
import { createError, handlePermissionError } from '../utils/errors';

/**
 * Audio capture manager
 */
export class AudioCapture {
  private stream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private startTime: number = 0;

  /**
   * Request microphone permission and start audio stream
   */
  async requestMicrophoneAccess(): Promise<MediaStream> {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        },
        video: false
      });

      return this.stream;
    } catch (error) {
      throw handlePermissionError(error, 'microphone');
    }
  }

  /**
   * Start recording audio
   */
  startRecording(stream?: MediaStream): void {
    const audioStream = stream || this.stream;
    if (!audioStream) {
      throw createError('UNKNOWN_ERROR', 'Audio stream not initialized');
    }

    // Determine best audio format
    let mimeType = 'audio/webm';
    if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
      mimeType = 'audio/webm;codecs=opus';
    } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
      mimeType = 'audio/mp4';
    }

    this.mediaRecorder = new MediaRecorder(audioStream, { mimeType });
    this.audioChunks = [];
    this.startTime = Date.now();

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.audioChunks.push(event.data);
      }
    };

    this.mediaRecorder.start(100); // Collect data every 100ms
  }

  /**
   * Stop recording and return audio blob
   */
  async stopRecording(): Promise<{ blob: Blob; metadata: AudioMetadata }> {
    if (!this.mediaRecorder) {
      throw createError('UNKNOWN_ERROR', 'Media recorder not initialized');
    }

    return new Promise((resolve, reject) => {
      const endTime = Date.now();

      this.mediaRecorder!.onstop = () => {
        const mimeType = this.mediaRecorder!.mimeType;
        const blob = new Blob(this.audioChunks, { type: mimeType });

        const metadata: AudioMetadata = {
          audio_mime_type: mimeType,
          audio_duration_ms: endTime - this.startTime,
          audio_start_timestamp_ms: this.startTime,
          audio_end_timestamp_ms: endTime,
          audio_blob_size_bytes: blob.size
        };

        resolve({ blob, metadata });
      };

      this.mediaRecorder!.onerror = (error) => {
        reject(createError('UNKNOWN_ERROR', 'Audio recording failed', error));
      };

      this.mediaRecorder!.stop();
    });
  }

  /**
   * Check if recording is active
   */
  isRecording(): boolean {
    return this.mediaRecorder?.state === 'recording';
  }

  /**
   * Stop audio stream and release resources
   */
  stop(): void {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }

    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }

    this.mediaRecorder = null;
    this.audioChunks = [];
  }

  /**
   * Get the active stream
   */
  getStream(): MediaStream | null {
    return this.stream;
  }
}
