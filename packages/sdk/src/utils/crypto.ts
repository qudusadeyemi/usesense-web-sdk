/**
 * Cryptographic utilities for frame hashing and mesh-to-frame binding.
 *
 * - SHA-256 frame hashing prevents frame injection
 * - HMAC-SHA256 binding proofs prevent mesh spoofing
 */

/**
 * Convert a hex string to a Uint8Array.
 */
export function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Convert a Uint8Array to a hex string.
 */
export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Compute SHA-256 hash of raw frame bytes (JPEG).
 * Returns lowercase hex string.
 */
export async function hashFrame(frameBytes: Uint8Array): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', frameBytes as unknown as BufferSource);
  return bytesToHex(new Uint8Array(hashBuffer));
}

/**
 * Compute a canonical digest of mesh data for binding.
 * Input: shape params array + pose object.
 * Returns lowercase hex SHA-256 hash.
 */
export async function computeMeshDigest(
  shapeParams: number[],
  pose: { yaw: number; pitch: number; roll: number }
): Promise<string> {
  const canonical = JSON.stringify({
    s: shapeParams,
    p: [pose.yaw, pose.pitch, pose.roll],
  });
  const hashBuffer = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(canonical)
  );
  return bytesToHex(new Uint8Array(hashBuffer));
}

/**
 * Compute HMAC-SHA256 binding proof.
 *
 * proof = HMAC-SHA256(challenge, "frameHash:meshDigest")
 *
 * @param challengeHex - The mesh_binding_challenge from session creation (hex)
 * @param frameHash    - SHA-256 of the raw JPEG frame (hex)
 * @param meshDigest   - SHA-256 of canonical mesh data (hex), or "nomesh"
 * @returns Hex-encoded HMAC
 */
export async function computeBindingProof(
  challengeHex: string,
  frameHash: string,
  meshDigest: string
): Promise<string> {
  const keyBytes = hexToBytes(challengeHex);
  const key = await crypto.subtle.importKey(
    'raw',
    keyBytes as unknown as BufferSource,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const message = new TextEncoder().encode(`${frameHash}:${meshDigest}`);
  const signature = await crypto.subtle.sign('HMAC', key, message);
  return bytesToHex(new Uint8Array(signature));
}
