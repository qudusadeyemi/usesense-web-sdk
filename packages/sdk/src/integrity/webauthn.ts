import { WebAuthnData } from '../types';

/**
 * Check if WebAuthn is supported in this browser
 */
export function isWebAuthnSupported(): boolean {
  return !!(
    window.PublicKeyCredential &&
    navigator.credentials &&
    typeof navigator.credentials.create === 'function' &&
    typeof navigator.credentials.get === 'function'
  );
}

/**
 * Create a WebAuthn credential for session binding
 */
export async function createWebAuthnCredential(
  rpId: string,
  userId: string,
  challenge: Uint8Array
): Promise<WebAuthnData | null> {
  if (!isWebAuthnSupported()) {
    console.warn('[UseSense] WebAuthn not supported in this browser');
    return null;
  }

  try {
    const credential = await navigator.credentials.create({
      publicKey: {
        challenge: challenge as BufferSource,
        rp: {
          name: 'UseSense Verification',
          id: rpId
        },
        user: {
          id: new TextEncoder().encode(userId) as BufferSource,
          name: userId,
          displayName: 'Verification User'
        },
        pubKeyCredParams: [
          { alg: -7, type: 'public-key' }, // ES256
          { alg: -257, type: 'public-key' } // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'preferred'
        },
        timeout: 60000,
        attestation: 'none' // Minimal attestation
      }
    }) as PublicKeyCredential | null;

    if (!credential) {
      return null;
    }

    const response = credential.response as AuthenticatorAttestationResponse;
    
    return {
      credential_id: arrayBufferToBase64Url(credential.rawId),
      authenticator_data: arrayBufferToBase64Url(response.getAuthenticatorData()),
      attestation_object_present: !!response.attestationObject
    };
  } catch (error) {
    console.warn('[UseSense] WebAuthn credential creation failed:', error);
    return null;
  }
}

/**
 * Get an existing WebAuthn credential for authentication binding
 */
export async function getWebAuthnCredential(
  rpId: string,
  challenge: Uint8Array<ArrayBuffer>,
  allowCredentials?: { id: ArrayBuffer; type: 'public-key' }[]
): Promise<WebAuthnData | null> {
  if (!isWebAuthnSupported()) {
    console.warn('[UseSense] WebAuthn not supported in this browser');
    return null;
  }

  try {
    const credential = await navigator.credentials.get({
      publicKey: {
        challenge: challenge as BufferSource,
        rpId,
        allowCredentials: allowCredentials || [],
        userVerification: 'preferred',
        timeout: 60000
      }
    }) as PublicKeyCredential | null;

    if (!credential) {
      return null;
    }

    const response = credential.response as AuthenticatorAssertionResponse;

    return {
      credential_id: arrayBufferToBase64Url(credential.rawId),
      authenticator_data: arrayBufferToBase64Url(response.authenticatorData),
      attestation_object_present: false
    };
  } catch (error) {
    console.warn('[UseSense] WebAuthn credential get failed:', error);
    return null;
  }
}

/**
 * Convert ArrayBuffer to Base64URL string
 */
function arrayBufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Generate a random challenge for WebAuthn
 */
export function generateChallenge(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(32));
}
