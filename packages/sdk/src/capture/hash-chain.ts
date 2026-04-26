/**
 * LiveSense v4 hash-chain builder + terminal-hash signer (web).
 *
 * Phase 1 ticket X-6.
 *
 * Protocol (must match watchtower's chain-signature.tsx exactly):
 *
 *   chain[0] = SHA-256(session_token || frame[0])
 *   chain[i] = SHA-256(chain[i-1] || frame[i])   for i > 0
 *
 * The terminal value chain[N-1] is signed by a platform key. On the web
 * we have two tiers:
 *
 *   - WebAuthn platform authenticator (web_attested):
 *       A resident credential bound to this origin with userVerification
 *       available. The signature comes from a hardware-backed key on
 *       recent Chrome/Edge/Safari with TPM/TEE.
 *
 *   - Ephemeral ECDSA P-256 in IndexedDB (web_unattested):
 *       Generated once per session, non-exportable within the limits
 *       of Web Crypto, stored in IndexedDB keyed by session_id. This
 *       gives the server a verifiable per-session signature even on
 *       browsers without WebAuthn platform-authenticator support.
 *       Weaker than WebAuthn but still binds the session.
 *
 * The caller chooses which tier to use by constructing either a
 * WebAuthnSigner or an EphemeralKeySigner. Both implement the Signer
 * interface so the rest of the pipeline is agnostic.
 */

// ─── Public types ───────────────────────────────────────────────────────────

export type ChainAssuranceLevel = 'web_attested' | 'web_unattested';

export interface ChainSigner {
  /** Returns the attested public key as DER-encoded SPKI (what the server verifies with). */
  getPublicKeySpki(): Promise<Uint8Array>;
  /** Sign the terminal hash. Returns raw or DER ECDSA bytes. */
  sign(terminalHash: Uint8Array): Promise<Uint8Array>;
  /** Attestation tier this signer produces. */
  assuranceLevel: ChainAssuranceLevel;
}

export interface ChainUploadPayload {
  /** Per-frame SHA-256 hex hashes in capture order. */
  readonly frameHashes: string[];
  /** Terminal chain value as hex. */
  readonly terminalHashHex: string;
  /** Signature over terminal hash as base64url. */
  readonly signatureB64: string;
  /** Public key as base64url-encoded SPKI DER. */
  readonly publicKeySpkiB64: string;
  /** Assurance tier claimed by the signer. */
  readonly assuranceLevel: ChainAssuranceLevel;
}

// ─── Chain builder ──────────────────────────────────────────────────────────

/**
 * Incremental chain builder. Call `append(frameBytes)` in capture order.
 * `terminal()` returns the terminal hash; `terminalHex()` returns it as hex.
 *
 * Reset state by constructing a new instance.
 */
export class HashChainBuilder {
  private readonly sessionTokenBytes: Uint8Array;
  private current: Uint8Array | null = null;
  private frameHashes: string[] = [];
  private appendCount = 0;

  constructor(sessionToken: string) {
    this.sessionTokenBytes = new TextEncoder().encode(sessionToken);
  }

  /**
   * Append one frame. Returns the per-frame SHA-256 hash as hex (useful for
   * logging and for the frame_hashes[] upload field).
   */
  async append(frameBytes: Uint8Array): Promise<string> {
    const frameHash = await sha256(frameBytes);
    this.frameHashes.push(bytesToHex(frameHash));
    if (this.appendCount === 0) {
      this.current = await sha256(concat(this.sessionTokenBytes, frameHash));
    } else {
      this.current = await sha256(concat(this.current!, frameHash));
    }
    this.appendCount += 1;
    return this.frameHashes[this.frameHashes.length - 1];
  }

  /**
   * Convenience: accept a precomputed per-frame hash instead of raw bytes.
   * The capture loop may already hash frames for other purposes (luminance,
   * dedupe) so recomputing is wasteful.
   */
  async appendWithHash(frameHashHex: string): Promise<void> {
    const frameHash = hexToBytes(frameHashHex);
    this.frameHashes.push(frameHashHex.toLowerCase());
    if (this.appendCount === 0) {
      this.current = await sha256(concat(this.sessionTokenBytes, frameHash));
    } else {
      this.current = await sha256(concat(this.current!, frameHash));
    }
    this.appendCount += 1;
  }

  terminal(): Uint8Array {
    if (!this.current) throw new Error('hash-chain: empty chain; append first');
    return this.current;
  }

  terminalHex(): string {
    return bytesToHex(this.terminal());
  }

  getFrameHashes(): string[] {
    return this.frameHashes.slice();
  }

  length(): number {
    return this.appendCount;
  }
}

// ─── WebAuthn signer (web_attested) ─────────────────────────────────────────

/**
 * Minimal shape of a WebAuthn credential we need. The real object is a
 * PublicKeyCredential, but we accept any structurally-matching object to
 * make this module unit-testable without a browser.
 */
export interface WebAuthnCredentialLike {
  rawId: ArrayBuffer;
  response: {
    signature?: ArrayBuffer;
    authenticatorData?: ArrayBuffer;
    clientDataJSON?: ArrayBuffer;
    getPublicKey?: () => ArrayBuffer | null;
  };
}

/**
 * Returns true if the current browser reports that a platform authenticator
 * is usable. Used by the factory below to pick between tiers.
 */
export async function isWebAuthnPlatformAvailable(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.credentials) return false;
  const pubKeyCreds: any =
    (window as any).PublicKeyCredential ||
    (globalThis as any).PublicKeyCredential;
  if (!pubKeyCreds || typeof pubKeyCreds.isUserVerifyingPlatformAuthenticatorAvailable !== 'function') {
    return false;
  }
  try {
    return await pubKeyCreds.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

/**
 * WebAuthn-backed signer. Requires a resident credential registered for
 * the origin. The caller is responsible for registration at session setup
 * time; this signer only signs.
 */
export class WebAuthnSigner implements ChainSigner {
  public readonly assuranceLevel: ChainAssuranceLevel = 'web_attested';
  private readonly credentialId: ArrayBuffer;
  private readonly rpId: string | undefined;
  private cachedSpki: Uint8Array | null = null;

  constructor(credentialId: ArrayBuffer, rpId?: string) {
    this.credentialId = credentialId;
    this.rpId = rpId;
  }

  async getPublicKeySpki(): Promise<Uint8Array> {
    if (this.cachedSpki) return this.cachedSpki;
    throw new Error(
      'WebAuthnSigner: public key must be provided at registration time; set via setPublicKeySpki()',
    );
  }

  setPublicKeySpki(spki: Uint8Array): void {
    this.cachedSpki = spki;
  }

  async sign(terminalHash: Uint8Array): Promise<Uint8Array> {
    if (typeof navigator === 'undefined' || !navigator.credentials) {
      throw new Error('WebAuthnSigner: navigator.credentials not available');
    }
    const assertion = (await navigator.credentials.get({
      publicKey: {
        challenge: terminalHash as unknown as BufferSource,
        allowCredentials: [{ id: this.credentialId, type: 'public-key' }],
        rpId: this.rpId,
        userVerification: 'required',
        timeout: 30_000,
      },
    })) as unknown as WebAuthnCredentialLike | null;

    if (!assertion || !assertion.response || !assertion.response.signature) {
      throw new Error('WebAuthnSigner: no signature returned');
    }
    return new Uint8Array(assertion.response.signature);
  }
}

// ─── Ephemeral IndexedDB signer (web_unattested) ────────────────────────────

const IDB_DB_NAME = 'usesense_v4_keys';
const IDB_STORE_NAME = 'ephemeral_ecdsa_p256';

/**
 * Ephemeral ECDSA P-256 signer backed by IndexedDB.
 *
 * - Generates a non-extractable key pair per session.
 * - Persists the key pair under a session-scoped key so reloads within
 *   the same session can recover it (subject to origin isolation).
 * - Exports only the public key; private key stays in IndexedDB.
 *
 * Non-extractability is limited by what Web Crypto offers; a malicious
 * same-origin script can still use the key. The attestation tier
 * web_unattested captures this weakness.
 */
export class EphemeralKeySigner implements ChainSigner {
  public readonly assuranceLevel: ChainAssuranceLevel = 'web_unattested';
  private readonly storageKey: string;
  private keyPair: CryptoKeyPair | null = null;

  constructor(sessionId: string) {
    this.storageKey = `session:${sessionId}`;
  }

  async getPublicKeySpki(): Promise<Uint8Array> {
    const kp = await this.ensureKey();
    const spki = await crypto.subtle.exportKey('spki', kp.publicKey);
    return new Uint8Array(spki);
  }

  async sign(terminalHash: Uint8Array): Promise<Uint8Array> {
    const kp = await this.ensureKey();
    const sig = await crypto.subtle.sign(
      { name: 'ECDSA', hash: 'SHA-256' },
      kp.privateKey,
      terminalHash as unknown as BufferSource,
    );
    return new Uint8Array(sig);
  }

  private async ensureKey(): Promise<CryptoKeyPair> {
    if (this.keyPair) return this.keyPair;
    const existing = await this.loadFromIdb();
    if (existing) {
      this.keyPair = existing;
      return existing;
    }
    const kp = (await crypto.subtle.generateKey(
      { name: 'ECDSA', namedCurve: 'P-256' },
      false, // non-extractable private key
      ['sign', 'verify'],
    )) as CryptoKeyPair;
    await this.saveToIdb(kp);
    this.keyPair = kp;
    return kp;
  }

  private async openIdb(): Promise<IDBDatabase | null> {
    if (typeof indexedDB === 'undefined') return null;
    return await new Promise((resolve) => {
      const req = indexedDB.open(IDB_DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE_NAME)) {
          db.createObjectStore(IDB_STORE_NAME);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    });
  }

  private async saveToIdb(kp: CryptoKeyPair): Promise<void> {
    const db = await this.openIdb();
    if (!db) return;
    await new Promise<void>((resolve) => {
      const tx = db.transaction(IDB_STORE_NAME, 'readwrite');
      tx.objectStore(IDB_STORE_NAME).put(kp, this.storageKey);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
    db.close();
  }

  private async loadFromIdb(): Promise<CryptoKeyPair | null> {
    const db = await this.openIdb();
    if (!db) return null;
    const kp = await new Promise<CryptoKeyPair | null>((resolve) => {
      const tx = db.transaction(IDB_STORE_NAME, 'readonly');
      const req = tx.objectStore(IDB_STORE_NAME).get(this.storageKey);
      req.onsuccess = () => resolve((req.result as CryptoKeyPair) || null);
      req.onerror = () => resolve(null);
    });
    db.close();
    return kp;
  }
}

// ─── Factory: pick the best available tier ──────────────────────────────────

export interface ChainSignerFactoryOptions {
  /** Session ID, used to scope the ephemeral key. */
  readonly sessionId: string;
  /**
   * If provided, callers can force-select the tier (for tests or to lock in
   * web_unattested when registration/UX reasons make WebAuthn impractical).
   */
  readonly preferTier?: ChainAssuranceLevel;
  /**
   * Pre-registered WebAuthn credential ID for the session's user. If
   * omitted, the factory falls back to EphemeralKeySigner regardless of
   * browser capabilities.
   */
  readonly webauthnCredentialId?: ArrayBuffer;
  readonly webauthnRpId?: string;
  readonly webauthnPublicKeySpki?: Uint8Array;
}

/**
 * Select the strongest available signer. Today the factory returns a
 * WebAuthnSigner when a credential ID is provided AND the platform
 * authenticator is available; otherwise it returns an EphemeralKeySigner.
 */
export async function createChainSigner(
  opts: ChainSignerFactoryOptions,
): Promise<ChainSigner> {
  const forceUnattested = opts.preferTier === 'web_unattested';
  const forceAttested = opts.preferTier === 'web_attested';

  if (!forceUnattested && opts.webauthnCredentialId && opts.webauthnPublicKeySpki) {
    const available = forceAttested ? true : await isWebAuthnPlatformAvailable();
    if (available) {
      const signer = new WebAuthnSigner(opts.webauthnCredentialId, opts.webauthnRpId);
      signer.setPublicKeySpki(opts.webauthnPublicKeySpki);
      return signer;
    }
  }
  return new EphemeralKeySigner(opts.sessionId);
}

// ─── Build the full upload payload ──────────────────────────────────────────

export async function buildChainUploadPayload(
  builder: HashChainBuilder,
  signer: ChainSigner,
): Promise<ChainUploadPayload> {
  const terminal = builder.terminal();
  const sig = await signer.sign(terminal);
  const spki = await signer.getPublicKeySpki();
  return {
    frameHashes: builder.getFrameHashes(),
    terminalHashHex: builder.terminalHex(),
    signatureB64: bytesToB64u(sig),
    publicKeySpkiB64: bytesToB64u(spki),
    assuranceLevel: signer.assuranceLevel,
  };
}

// ─── Primitives ─────────────────────────────────────────────────────────────

async function sha256(bytes: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(
    await crypto.subtle.digest('SHA-256', bytes as unknown as BufferSource),
  );
}

function concat(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

function bytesToHex(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += bytes[i].toString(16).padStart(2, '0');
  return s;
}

function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) throw new Error('hash-chain: odd-length hex');
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
  return out;
}

function bytesToB64u(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  const b64 = typeof btoa !== 'undefined' ? btoa(bin) : nodeBtoa(bin);
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function nodeBtoa(s: string): string {
  // @ts-ignore - Node Buffer path for test env
  return Buffer.from(s, 'binary').toString('base64');
}
