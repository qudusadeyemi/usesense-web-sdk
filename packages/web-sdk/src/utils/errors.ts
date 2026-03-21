import { ErrorCode, UseSenseError } from '../types';

/**
 * Create a typed UseSense error
 */
export function createError(code: ErrorCode, message: string, details?: any): UseSenseError {
  return new UseSenseError(code, message, details);
}

/**
 * Convert browser permission errors to UseSense errors
 */
export function handlePermissionError(error: any, type: 'camera' | 'microphone'): UseSenseError {
  if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
    return createError(
      type === 'camera' ? 'CAMERA_PERMISSION_DENIED' : 'MIC_PERMISSION_DENIED',
      `${type === 'camera' ? 'Camera' : 'Microphone'} permission denied. Please allow access to continue.`,
      error
    );
  }

  if (error.name === 'NotFoundError') {
    return createError(
      type === 'camera' ? 'CAMERA_PERMISSION_DENIED' : 'MIC_PERMISSION_DENIED',
      `No ${type} device found on this device.`,
      error
    );
  }

  return createError(
    'UNKNOWN_ERROR',
    `Failed to access ${type}: ${error.message}`,
    error
  );
}

/**
 * Convert network / API errors to UseSense errors
 */
export function handleNetworkError(error: any, context?: string): UseSenseError {
  if (error instanceof UseSenseError) {
    return error;
  }

  if (error.name === 'AbortError') {
    return createError('TIMEOUT', 'Request timed out. Please try again.', error);
  }

  if (!navigator.onLine) {
    return createError('NETWORK_ERROR', 'No internet connection. Please check your network and try again.', error);
  }

  // Map HTTP status-based errors propagated from handleErrorResponse
  if (error.status === 429) {
    return createError('QUOTA_EXCEEDED', error.message || 'Rate limit exceeded. Please try again later.', error);
  }

  if (error.code) {
    // Already has a code from handleErrorResponse – wrap it
    const code = mapErrorCode(error.code);
    return createError(code, error.message, error.data);
  }

  const contextMsg = context ? ` (${context})` : '';
  return createError(
    'NETWORK_ERROR',
    `Network error${contextMsg}. Please try again.`,
    error
  );
}

/**
 * Map server error codes to SDK ErrorCode
 */
function mapErrorCode(code: string): ErrorCode {
  const mapping: Record<string, ErrorCode> = {
    unauthorized: 'UNAUTHORIZED',
    UNAUTHORIZED: 'UNAUTHORIZED',
    invalid_token: 'INVALID_TOKEN',
    INVALID_TOKEN: 'INVALID_TOKEN',
    session_expired: 'SESSION_EXPIRED',
    SESSION_EXPIRED: 'SESSION_EXPIRED',
    session_not_found: 'SESSION_NOT_FOUND',
    SESSION_NOT_FOUND: 'SESSION_NOT_FOUND',
    identity_not_found: 'IDENTITY_NOT_FOUND',
    IDENTITY_NOT_FOUND: 'IDENTITY_NOT_FOUND',
    invalid_request: 'INVALID_REQUEST',
    INVALID_REQUEST: 'INVALID_REQUEST',
    invalid_upload: 'INVALID_REQUEST',
    signals_not_uploaded: 'INVALID_REQUEST',
    QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',
    SERVER_ERROR: 'SERVER_ERROR',
    internal_error: 'SERVER_ERROR',
    evaluation_error: 'SERVER_ERROR',
    NOT_FOUND: 'UNKNOWN_ERROR',
  };

  return mapping[code] || 'UNKNOWN_ERROR';
}

/**
 * Get user-friendly error message
 */
export function getUserMessage(error: UseSenseError): string {
  const messages: Record<ErrorCode, string> = {
    CAMERA_PERMISSION_DENIED: 'We need camera access to verify your identity. Please allow camera access in your browser settings.',
    MIC_PERMISSION_DENIED: 'We need microphone access to complete verification. Please allow microphone access in your browser settings.',
    NETWORK_ERROR: 'Connection issue. Please check your internet and try again.',
    SESSION_EXPIRED: 'Your session has expired. Please start over.',
    UNAUTHORIZED: 'Authentication failed. Please check your API key.',
    INVALID_TOKEN: 'Session token is invalid. Please start a new session.',
    SESSION_NOT_FOUND: 'Session not found. Please start a new session.',
    IDENTITY_NOT_FOUND: 'Identity not found. Please ensure the identity ID is correct.',
    INVALID_REQUEST: 'Invalid request. Please check the parameters.',
    QUOTA_EXCEEDED: 'Rate limit reached. Please try again later.',
    USER_CANCELLED: 'Verification was cancelled.',
    FACE_NOT_DETECTED: 'Please position your face in the frame and try again.',
    LOW_LIGHT: 'Lighting is too low. Please move to a brighter area.',
    TIMEOUT: 'Verification took too long. Please try again.',
    SERVER_ERROR: 'Server error. Please try again or contact support.',
    UNKNOWN_ERROR: 'Something went wrong. Please try again.',
  };

  return messages[error.code] || error.message;
}
