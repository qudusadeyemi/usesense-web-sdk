/**
 * Cryptographic utilities for frame hashing and mesh-to-frame binding.
 *
 * - SHA-256 frame hashing prevents frame injection
 * - HMAC-SHA256 binding proofs prevent mesh spoofing
 *
 * Canonical mesh digest uses field order {s, p, d, l}:
 *   s = shapeParams
 *   p = [yaw, pitch, roll] as array
 *   d = depthPlausibility
 *   l = SHA-256 of Float64Array of landmarks (or "none" if empty)
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
 *
 * Canonical JSON field order is exactly {s, p, d, l} -- the server uses the
 * same ordering. Any deviation causes 100% proof mismatch.
 *
 * @param shapeParams      - PCA shape coefficients (may be empty for pose-only)
 * @param pose             - { yaw, pitch, roll } in degrees
 * @param depthPlausibility - 0-100 depth score
 * @param landmarks        - Flat landmark array [x0,y0,z0,...] (1404 values).
 *                           Pass [] if MediaPipe returned no results.
 */
export async function computeMeshDigest(
  shapeParams: number[],
  pose: { yaw: number; pitch: number; roll: number },
  depthPlausibility: number,
  landmarks: number[]
): Promise<string> {
  // l = SHA-256 of the Float64Array buffer of the flat landmarks.
  // MUST use Float64Array (not Float32Array) -- the server uses the same.
  // "none" when no landmarks were captured.
  let landmarksHash = 'none';
  if (landmarks.length > 0) {
    const lmBuf = new Float64Array(landmarks).buffer;
    const lmHashBuf = await crypto.subtle.digest('SHA-256', lmBuf);
    landmarksHash = bytesToHex(new Uint8Array(lmHashBuf));
  }

  // Field order {s, p, d, l} is canonical and must not be changed.
  const canonical = JSON.stringify({
    s: shapeParams,
    p: [pose.yaw, pose.pitch, pose.roll],
    d: depthPlausibility,
    l: landmarksHash,
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
 * @param challengeHex - The mesh_binding_challenge from session creation (hex).
 *                       MUST use hexToBytes, NOT TextEncoder.
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
