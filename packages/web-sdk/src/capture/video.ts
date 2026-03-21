import { FrameMetadata } from '../types';
import { createError } from '../utils/errors';

/**
 * Video capture manager
 */
export class VideoCapture {
  private stream: MediaStream | null = null;
  private videoElement: HTMLVideoElement | null = null;
  private canvasElement: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private mockMode = false;

  /**
   * Request camera permission and start video stream
   */
  async requestCameraAccess(targetFps: number = 15): Promise<MediaStream> {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 720 },
          height: { ideal: 1280 },
          frameRate: { ideal: targetFps }
        },
        audio: false
      });

      return this.stream;
    } catch (error) {
      // Enable mock mode when camera permission is denied
      console.warn('[UseSense SDK] Camera permission denied, enabling mock mode');
      this.mockMode = true;
      
      // Return a mock stream for demo purposes
      return this.createMockStream();
    }
  }

  /**
   * Create a mock media stream for demo mode
   */
  private createMockStream(): MediaStream {
    // Create a canvas for mock video
    const canvas = document.createElement('canvas');
    canvas.width = 720;
    canvas.height = 1280;
    
    // @ts-ignore - captureStream is available on canvas
    const mockStream = canvas.captureStream(15);
    
    return mockStream;
  }

  /**
   * Initialize video element with stream
   */
  initializeVideo(stream: MediaStream, videoElement: HTMLVideoElement): void {
    this.stream = stream;
    this.videoElement = videoElement;
    
    if (!this.mockMode) {
      this.videoElement.srcObject = stream;
      this.videoElement.play();
    } else {
      // In mock mode, we don't need to set srcObject
      // We'll generate frames directly
    }
  }

  /**
   * Wait for video to be ready
   */
  async waitForVideoReady(): Promise<void> {
    if (this.mockMode) {
      // In mock mode, we're immediately ready
      return Promise.resolve();
    }

    if (!this.videoElement) {
      throw createError('UNKNOWN_ERROR', 'Video element not initialized');
    }

    return new Promise((resolve, reject) => {
      if (!this.videoElement) {
        reject(createError('UNKNOWN_ERROR', 'Video element not initialized'));
        return;
      }

      if (this.videoElement.readyState >= 2) {
        resolve();
        return;
      }

      const onReady = () => {
        this.videoElement?.removeEventListener('loadeddata', onReady);
        resolve();
      };

      this.videoElement.addEventListener('loadeddata', onReady);

      // Timeout after 10 seconds
      setTimeout(() => {
        this.videoElement?.removeEventListener('loadeddata', onReady);
        reject(createError('TIMEOUT', 'Video failed to load'));
      }, 10000);
    });
  }

  /**
   * Capture frames at specified interval
   */
  async captureFrames(
    durationMs: number,
    targetFps: number,
    maxFrames: number,
    onFrame?: (frameData: { blob: Blob; metadata: FrameMetadata }) => void
  ): Promise<{ frames: Blob[]; metadata: FrameMetadata[] }> {
    // Create canvas if not exists
    if (!this.canvasElement) {
      this.canvasElement = document.createElement('canvas');
      this.ctx = this.canvasElement.getContext('2d');
    }

    if (!this.ctx) {
      throw createError('UNKNOWN_ERROR', 'Failed to get canvas context');
    }

    const frames: Blob[] = [];
    const metadata: FrameMetadata[] = [];
    const intervalMs = 1000 / targetFps;
    let frameIndex = 0;

    return new Promise((resolve, reject) => {
      const startTime = performance.now();
      const captureStartTime = Date.now();

      const captureFrame = async () => {
        try {
          if (frameIndex >= maxFrames) {
            clearInterval(intervalId);
            clearTimeout(timeoutId);
            resolve({ frames, metadata });
            return;
          }

          const blob = await this.captureFrame();
          if (!blob) return;

          const frameMeta: FrameMetadata = {
            frame_index: frameIndex,
            capture_timestamp_ms: Date.now(),
            performance_timestamp_ms: performance.now() - startTime,
            frame_blob_size_bytes: blob.size,
            resolution_w: this.canvasElement!.width,
            resolution_h: this.canvasElement!.height
          };

          frames.push(blob);
          metadata.push(frameMeta);

          if (onFrame) {
            onFrame({ blob, metadata: frameMeta });
          }

          frameIndex++;
        } catch (error) {
          clearInterval(intervalId);
          clearTimeout(timeoutId);
          reject(error);
        }
      };

      const intervalId = setInterval(captureFrame, intervalMs);

      const timeoutId = setTimeout(() => {
        clearInterval(intervalId);
        resolve({ frames, metadata });
      }, durationMs);
    });
  }

  /**
   * Capture a single frame from video
   * 
   * CRITICAL: Frames are captured RAW (non-mirrored) for backend pose analysis.
   * AWS Rekognition expects raw webcam frames where:
   *   - User turning LEFT → nose moves RIGHT in image → positive Yaw
   *   - User turning RIGHT → nose moves LEFT in image → negative Yaw
   * 
   * The video preview CAN be mirrored (CSS transform: scaleX(-1)) for user
   * comfort, but the canvas capture MUST NOT apply any horizontal flip.
   * 
   * v1.10.7: Backend head_turn validation now uses corrected Yaw thresholds
   * that expect raw, non-mirrored frames.
   */
  async captureFrame(): Promise<Blob | null> {
    if (!this.canvasElement || !this.ctx) {
      return null;
    }

    if (this.mockMode) {
      // Generate a mock frame
      return this.captureMockFrame();
    }

    if (!this.videoElement) {
      return null;
    }

    // Set canvas size to match video
    this.canvasElement.width = this.videoElement.videoWidth;
    this.canvasElement.height = this.videoElement.videoHeight;

    // Draw video frame to canvas -- NO MIRRORING
    // DO NOT use ctx.scale(-1, 1) or any horizontal flip here
    this.ctx.drawImage(
      this.videoElement,
      0,
      0,
      this.canvasElement.width,
      this.canvasElement.height
    );

    // Convert to blob
    return new Promise((resolve) => {
      this.canvasElement!.toBlob(
        (blob) => {
          resolve(blob);
        },
        'image/jpeg',
        0.85
      );
    });
  }

  /**
   * Generate a mock frame for demo mode
   */
  private async captureMockFrame(): Promise<Blob | null> {
    if (!this.canvasElement || !this.ctx) {
      return null;
    }

    // Set canvas size
    this.canvasElement.width = 720;
    this.canvasElement.height = 1280;

    // Generate a mock frame with face-like representation
    const ctx = this.ctx;
    const width = this.canvasElement.width;
    const height = this.canvasElement.height;

    // Background gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, '#E8EAF6');
    gradient.addColorStop(1, '#C5CAE9');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // Draw a simple face representation
    const centerX = width / 2;
    const centerY = height / 2;

    // Face circle
    ctx.fillStyle = '#FFE0B2';
    ctx.beginPath();
    ctx.arc(centerX, centerY, 150, 0, Math.PI * 2);
    ctx.fill();

    // Eyes
    ctx.fillStyle = '#424242';
    ctx.beginPath();
    ctx.arc(centerX - 50, centerY - 30, 15, 0, Math.PI * 2);
    ctx.arc(centerX + 50, centerY - 30, 15, 0, Math.PI * 2);
    ctx.fill();

    // Smile
    ctx.strokeStyle = '#424242';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(centerX, centerY + 20, 60, 0.2 * Math.PI, 0.8 * Math.PI);
    ctx.stroke();

    // Add "Demo Mode" text
    ctx.fillStyle = '#4F63F5';
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('DEMO MODE', centerX, 60);
    ctx.font = '14px sans-serif';
    ctx.fillText('Synthetic Video Frame', centerX, height - 60);

    // Convert to blob
    return new Promise((resolve) => {
      this.canvasElement!.toBlob(
        (blob) => {
          resolve(blob);
        },
        'image/jpeg',
        0.85
      );
    });
  }

  /**
   * Get current video resolution
   */
  getResolution(): { width: number; height: number } {
    if (!this.videoElement) {
      return { width: 0, height: 0 };
    }

    return {
      width: this.videoElement.videoWidth,
      height: this.videoElement.videoHeight
    };
  }

  /**
   * Check if video has adequate lighting
   */
  checkLighting(): { isLowLight: boolean; brightness: number } {
    if (!this.videoElement || !this.canvasElement || !this.ctx) {
      return { isLowLight: false, brightness: 0 };
    }

    // Sample center region of video
    const width = this.canvasElement.width;
    const height = this.canvasElement.height;
    const sampleWidth = Math.floor(width * 0.3);
    const sampleHeight = Math.floor(height * 0.3);
    const x = Math.floor((width - sampleWidth) / 2);
    const y = Math.floor((height - sampleHeight) / 2);

    const imageData = this.ctx.getImageData(x, y, sampleWidth, sampleHeight);
    const data = imageData.data;

    // Calculate average brightness
    let sum = 0;
    for (let i = 0; i < data.length; i += 4) {
      // Average RGB (ignore alpha)
      const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
      sum += avg;
    }

    const brightness = sum / (data.length / 4);
    const isLowLight = brightness < 60; // Threshold for low light

    return { isLowLight, brightness };
  }

  /**
   * Stop camera stream and release resources
   */
  stop(): void {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }

    if (this.videoElement) {
      this.videoElement.srcObject = null;
      this.videoElement = null;
    }

    this.canvasElement = null;
    this.ctx = null;
  }

  /**
   * Get the active stream
   */
  getStream(): MediaStream | null {
    return this.stream;
  }
}