/**
 * Unit tests for HashChainBuilder + EphemeralKeySigner + round-trip
 * verification (X-6).
 *
 * These tests mirror the protocol in watchtower's chain-signature.tsx so
 * a session signed here can be verified there.
 */

import { describe, it, expect } from 'vitest';

import {
  HashChainBuilder,
  EphemeralKeySigner,
  buildChainUploadPayload,
} from '../capture/hash-chain';

const webcrypto = globalThis.crypto;

async function sha256(bytes: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(
    await webcrypto.subtle.digest('SHA-256', bytes as unknown as BufferSource),
  );
}

function concat(...xs: Uint8Array[]): Uint8Array {
  let total = 0;
  for (const x of xs) total += x.length;
  const out = new Uint8Array(total);
  let off = 0;
  for (const x of xs) {
    out.set(x, off);
    off += x.length;
  }
  return out;
}

function bytesToHex(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += bytes[i].toString(16).padStart(2, '0');
  return s;
}

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
  return out;
}

function b64uToBytes(s: string): Uint8Array {
  let b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4) b64 += '=';
  const bin = typeof atob !== 'undefined'
    ? atob(b64)
    // @ts-ignore Node fallback
    : Buffer.from(b64, 'base64').toString('binary');
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

describe('HashChainBuilder (X-6)', () => {
  it('two-frame golden vector matches spec formula', async () => {
    const token = 'tok_abc';
    const f0 = new TextEncoder().encode('frame-0-bytes');
    const f1 = new TextEncoder().encode('frame-1-bytes');

    const h0 = await sha256(f0);
    const h1 = await sha256(f1);
    const c0 = await sha256(concat(new TextEncoder().encode(token), h0));
    const expected = await sha256(concat(c0, h1));

    const b = new HashChainBuilder(token);
    await b.append(f0);
    await b.append(f1);

    expect(b.terminalHex()).toBe(bytesToHex(expected));
    expect(b.getFrameHashes()).toEqual([bytesToHex(h0), bytesToHex(h1)]);
    expect(b.length()).toBe(2);
  });

  it('single-frame case', async () => {
    const token = 'x';
    const f0 = new TextEncoder().encode('solo');
    const h0 = await sha256(f0);
    const expected = await sha256(concat(new TextEncoder().encode(token), h0));

    const b = new HashChainBuilder(token);
    await b.append(f0);
    expect(b.terminalHex()).toBe(bytesToHex(expected));
  });

  it('terminal() before any append throws', () => {
    const b = new HashChainBuilder('t');
    expect(() => b.terminal()).toThrow(/empty chain/);
  });

  it('appendWithHash matches append result', async () => {
    const token = 'same';
    const f0 = new TextEncoder().encode('abc');
    const f1 = new TextEncoder().encode('def');

    const b1 = new HashChainBuilder(token);
    await b1.append(f0);
    await b1.append(f1);

    const b2 = new HashChainBuilder(token);
    await b2.appendWithHash(bytesToHex(await sha256(f0)));
    await b2.appendWithHash(bytesToHex(await sha256(f1)));

    expect(b2.terminalHex()).toBe(b1.terminalHex());
  });
});

describe('EphemeralKeySigner + buildChainUploadPayload round trip (X-6)', () => {
  it('signs terminal hash; signature verifies under exported SPKI', async () => {
    // Build a small chain.
    const token = 'roundtrip_session';
    const builder = new HashChainBuilder(token);
    await builder.append(new TextEncoder().encode('f0'));
    await builder.append(new TextEncoder().encode('f1'));
    await builder.append(new TextEncoder().encode('f2'));

    const signer = new EphemeralKeySigner('sess-1');
    const payload = await buildChainUploadPayload(builder, signer);

    // Replay the verification path: import SPKI, verify signature over terminal.
    const spki = b64uToBytes(payload.publicKeySpkiB64);
    const key = await webcrypto.subtle.importKey(
      'spki',
      spki as unknown as BufferSource,
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['verify'],
    );
    const sig = b64uToBytes(payload.signatureB64);
    const terminal = hexToBytes(payload.terminalHashHex);

    const ok = await webcrypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      key,
      sig as unknown as BufferSource,
      terminal as unknown as BufferSource,
    );
    expect(ok).toBe(true);
    expect(payload.assuranceLevel).toBe('web_unattested');
    expect(payload.frameHashes).toHaveLength(3);
  });

  it('tampered terminal hash does not verify', async () => {
    const builder = new HashChainBuilder('t');
    await builder.append(new TextEncoder().encode('x'));
    const signer = new EphemeralKeySigner('sess-2');
    const payload = await buildChainUploadPayload(builder, signer);

    const spki = b64uToBytes(payload.publicKeySpkiB64);
    const key = await webcrypto.subtle.importKey(
      'spki',
      spki as unknown as BufferSource,
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['verify'],
    );
    const sig = b64uToBytes(payload.signatureB64);
    const tampered = hexToBytes(payload.terminalHashHex.replace(/^./, (c) => (c === 'f' ? '0' : 'f')));

    const ok = await webcrypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      key,
      sig as unknown as BufferSource,
      tampered as unknown as BufferSource,
    );
    expect(ok).toBe(false);
  });
});
