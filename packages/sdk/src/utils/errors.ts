/**
 * Error utilities for UseSense Web SDK v2.0.0
 */

import { ErrorCode, UseSenseError } from '../types';

/**
 * Create a typed UseSense error.
 */
export function createError(
  code: ErrorCode,
  message: string,
  details?: any
): UseSenseError {
  return new UseSenseError(code, message, details);
}

/**
 * Map a camera getUserMedia error to a user-friendly message.
 */
export function getCameraErrorMessage(err: any): string {
  if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
    return 'Camera access denied. Please allow camera permissions in your browser settings.';
  }
  if (err.name === 'NotFoundError') {
    return 'No camera detected. Please connect a camera and try again.';
  }
  if (err.name === 'NotReadableError') {
    return 'Camera is in use by another application. Please close other apps using the camera.';
  }
  if (err.name === 'OverconstrainedError') {
    return 'Camera does not support the required settings. Please try a different camera.';
  }
  return 'Could not access camera. Please check your device and try again.';
}

/**
 * Get user-friendly error message for a known error code.
 */
export function getUserMessage(error: UseSenseError): string {
  const messages: Record<ErrorCode, string> = {
    CAMERA_PERMISSION_DENIED:
      'Camera access is required for verification. Please allow camera access in your browser settings.',
    CAMERA_NOT_FOUND:
      'No camera detected. Please connect a camera and try again.',
    CAMERA_IN_USE:
      'Camera is in use by another application. Please close other apps using the camera.',
    MIC_PERMISSION_DENIED:
      'Microphone access is required. Please allow microphone access in your browser settings.',
    NETWORK_ERROR:
      'Connection issue. Please check your internet and try again.',
    SESSION_EXPIRED:
      'Your session has expired. Please start a new verification.',
    SESSION_NOT_FOUND:
      'Session not found. Please start a new verification.',
    INVALID_TOKEN:
      'Session token is invalid. Please start a new session.',
    NONCE_MISMATCH:
      'Security check failed. Please start a new session.',
    INSUFFICIENT_CREDITS:
      'Service temporarily unavailable. Please try again later.',
    IDENTITY_BLOCKLISTED:
      'This identity has been restricted.',
    IDENTITY_NOT_FOUND:
      'Identity not found. Please ensure the identity ID is correct.',
    INVALID_REQUEST:
      'Invalid request. Please check the parameters.',
    INVALID_UPLOAD:
      'Upload failed validation. Please try again.',
    UPLOAD_TIMEOUT:
      'Upload timed out. Please check your connection and try again.',
    SERVER_ERROR:
      'Server error. Please try again or contact support.',
    UNKNOWN_ERROR:
      'Something went wrong. Please try again.',
  };

  return messages[error.code] || error.message;
}
