import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  startDocumentExtraction,
  submitDocumentImage,
  getDocument,
} from '../documents';

const ORIGINAL_FETCH = globalThis.fetch;

type FetchCall = [url: string, init: RequestInit];

/**
 * Sequential fetch mock: each call shifts the next scripted response.
 * Useful for submitDocumentImage which makes three requests in order:
 * upload-url, S3 PUT, /extract.
 */
function mockFetchSequence(responses: Array<{ status?: number; body?: unknown; text?: string }>) {
  const calls: FetchCall[] = [];
  const queue = [...responses];
  const fn = vi.fn(async (url: string, init: RequestInit) => {
    calls.push([url, init]);
    const next = queue.shift();
    if (!next) throw new Error(`unexpected fetch call: ${url}`);
    const body = next.text ?? (next.body !== undefined ? JSON.stringify(next.body) : '');
    return new Response(body, {
      status: next.status ?? 200,
      headers: { 'Content-Type': 'application/json' },
    });
  });
  globalThis.fetch = fn as unknown as typeof fetch;
  return { fn, calls };
}

function mockFetchOnce(response: { status?: number; body: unknown }) {
  return mockFetchSequence([response]);
}

beforeEach(() => {
  globalThis.fetch = ORIGINAL_FETCH;
});

afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH;
  vi.restoreAllMocks();
});

describe('startDocumentExtraction', () => {
  it('POSTs to /v1/documents with api key + environment headers', async () => {
    const m = mockFetchOnce({
      body: {
        id: 'doc_123',
        document_type: 'identity',
        request: { id_subtype: 'passport' },
        created_at: '2026-04-25T12:30:00.000Z',
      },
    });

    const session = await startDocumentExtraction({
      apiKey: 'pk_test_xyz',
      environment: 'sandbox',
      documentType: 'identity',
      idSubtype: 'passport',
    });

    expect(m.fn).toHaveBeenCalledOnce();
    const [url, init] = m.calls[0]!;
    expect(url).toBe('https://api.usesense.ai/v1/documents');
    expect(init.method).toBe('POST');
    const headers = init.headers as Record<string, string>;
    expect(headers['x-api-key']).toBe('pk_test_xyz');
    expect(headers['x-environment']).toBe('sandbox');
    expect(headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(init.body as string)).toEqual({
      document_type: 'identity',
      id_subtype: 'passport',
    });

    expect(session.documentId).toBe('doc_123');
    expect(session.documentType).toBe('identity');
    expect(session.idSubtype).toBe('passport');
  });

  it('honours custom apiBaseUrl', async () => {
    const m = mockFetchOnce({
      body: {
        id: 'd',
        document_type: 'identity',
        request: {},
      },
    });
    await startDocumentExtraction({
      apiKey: 'pk_test',
      environment: 'sandbox',
      documentType: 'identity',
      idSubtype: 'passport',
      apiBaseUrl: 'https://staging.usesense.ai/v1',
    });
    expect(m.calls[0]![0]).toBe('https://staging.usesense.ai/v1/documents');
  });

  it('accepts the new DocumentType values', async () => {
    const m = mockFetchOnce({
      body: {
        id: 'd',
        document_type: 'organisation_doc',
        request: {},
      },
    });
    await startDocumentExtraction({
      apiKey: 'pk_test',
      environment: 'sandbox',
      documentType: 'organisation_doc',
    });
    expect(JSON.parse(m.calls[0]![1].body as string)).toEqual({
      document_type: 'organisation_doc',
    });
  });

  it('throws with server error message on non-2xx', async () => {
    mockFetchOnce({
      status: 401,
      body: { error: { message: 'invalid api key' } },
    });

    await expect(
      startDocumentExtraction({
        apiKey: 'pk_bad',
        environment: 'sandbox',
        documentType: 'identity',
        idSubtype: 'passport',
      })
    ).rejects.toThrow('invalid api key');
  });
});

describe('submitDocumentImage (direct binary stream)', () => {
  const session = {
    documentId: 'doc_123',
    documentToken: 'tok_abc',
    documentType: 'identity' as const,
    idSubtype: 'passport' as const,
    expiresAt: '2026-04-25T12:30:00.000Z',
  };

  it('POSTs raw bytes to /extract in a single call with metadata headers', async () => {
    const m = mockFetchOnce({
      body: {
        id: 'doc_123',
        status: 'completed',
        result: {
          document_type: 'identity',
          document_number: 'X1234567',
          full_name: 'Ada Lovelace',
          first_name: 'Ada',
          last_name: 'Lovelace',
          date_of_birth: '1815-12-10',
          nationality: 'GBR',
          issuing_country: 'GBR',
          issue_date: '2020-01-01',
          expiry_date: '2030-01-01',
          sex: 'F',
          mrz: null,
          raw_provider: 'infrared',
          raw_provider_request_id: 'req_xyz',
          captured_at: '2026-04-25T12:00:00.000Z',
        },
        error: null,
      },
    });

    const blob = new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: 'image/jpeg' });

    const result = await submitDocumentImage({
      apiKey: 'pk_test_xyz',
      session,
      environment: 'sandbox',
      image: { blob, width: 1600, height: 1012, byteLength: blob.size },
      side: 'front',
    });

    // Single network call only
    expect(m.fn).toHaveBeenCalledOnce();

    const [url, init] = m.calls[0]!;
    expect(url).toBe('https://api.usesense.ai/v1/documents/extract');
    expect(init.method).toBe('POST');

    // ── Headers carry all metadata ────────────────────────────────────
    const headers = init.headers as Record<string, string>;
    expect(headers['Content-Type']).toBe('application/octet-stream');
    expect(headers['Content-Length']).toBe(String(blob.size));
    expect(headers['x-api-key']).toBe('pk_test_xyz');
    expect(headers['x-environment']).toBe('sandbox');
    expect(headers['x-document-type']).toBe('identity');
    expect(headers['x-document-side']).toBe('front');
    expect(headers['x-id-subtype']).toBe('passport');

    // ── Body is the raw blob, not JSON or base64 ──────────────────────
    expect(init.body).toBe(blob);

    // ── Result mapping ────────────────────────────────────────────────
    expect(result.status).toBe('completed');
    expect(result.failureReason).toBeNull();
    expect(result.extraction).not.toBeNull();
    expect(result.extraction!.fullName).toBe('Ada Lovelace');
    expect(result.extraction!.dateOfBirth).toBe('1815-12-10');
    expect(result.extraction!.rawProvider).toBe('infrared');
    expect(result.extraction!.rawProviderRequestId).toBe('req_xyz');
  });

  it('omits x-id-subtype header for non-identity documents', async () => {
    const nonIdentitySession = {
      documentId: 'doc_456',
      documentToken: 'tok_def',
      documentType: 'invoice' as const,
      idSubtype: null,
      expiresAt: '2026-04-25T12:30:00.000Z',
    };
    const m = mockFetchOnce({
      body: { id: 'doc_456', status: 'completed', result: null, error: null },
    });
    const blob = new Blob([new Uint8Array([0xff])], { type: 'image/jpeg' });
    await submitDocumentImage({
      apiKey: 'pk_test',
      session: nonIdentitySession,
      environment: 'sandbox',
      image: { blob, width: 100, height: 100, byteLength: 1 },
      side: 'front',
    });
    const headers = m.calls[0]![1].headers as Record<string, string>;
    expect(headers['x-id-subtype']).toBeUndefined();
    expect(headers['x-document-type']).toBe('invoice');
  });

  it('returns failure result without extraction', async () => {
    mockFetchOnce({
      body: {
        id: 'doc_123',
        status: 'failed',
        result: null,
        error: { message: 'unreadable_image' },
      },
    });
    const blob = new Blob([new Uint8Array([0xff])], { type: 'image/jpeg' });
    const result = await submitDocumentImage({
      apiKey: 'pk_test',
      session,
      environment: 'sandbox',
      image: { blob, width: 100, height: 100, byteLength: 1 },
      side: 'front',
    });
    expect(result.status).toBe('failed');
    expect(result.extraction).toBeNull();
    expect(result.failureReason).toBe('unreadable_image');
  });

  it('throws on non-2xx from /extract', async () => {
    mockFetchOnce({ status: 413, body: { error: { message: 'image too large' } } });
    const blob = new Blob([new Uint8Array([0xff])], { type: 'image/jpeg' });
    await expect(
      submitDocumentImage({
        apiKey: 'pk_test',
        session,
        environment: 'sandbox',
        image: { blob, width: 1, height: 1, byteLength: 1 },
        side: 'front',
      })
    ).rejects.toThrow('image too large');
  });
});

describe('getDocument', () => {
  it('GETs /v1/documents/:id with api-key + environment headers and returns flat result', async () => {
    const m = mockFetchOnce({
      body: {
        id: 'doc_123',
        status: 'completed',
        result: {
          document_type: 'identity',
          document_number: 'A1',
          full_name: null,
          first_name: null,
          last_name: null,
          date_of_birth: null,
          nationality: null,
          issuing_country: null,
          issue_date: null,
          expiry_date: null,
          sex: null,
          mrz: null,
          raw_provider: 'infrared',
          raw_provider_request_id: null,
          captured_at: '2026-04-25T12:00:00.000Z',
        },
        error: null,
      },
    });

    const result = await getDocument({
      apiKey: 'pk_test',
      session: {
        documentId: 'doc_123',
        documentToken: 'tok',
        documentType: 'identity',
        idSubtype: 'passport',
        expiresAt: 'x',
      },
      environment: 'production',
    });

    const [url, init] = m.calls[0]!;
    expect(url).toBe('https://api.usesense.ai/v1/documents/doc_123');
    expect(init.method).toBe('GET');
    const headers = init.headers as Record<string, string>;
    expect(headers['x-api-key']).toBe('pk_test');
    expect(headers['x-environment']).toBe('production');
    expect(result.status).toBe('completed');
    expect(result.extraction!.documentNumber).toBe('A1');
  });
});

describe('idSubtype validation (startDocumentExtraction)', () => {
  it('throws when documentType=identity and idSubtype is missing', async () => {
    await expect(
      startDocumentExtraction({
        apiKey: 'pk_test',
        environment: 'sandbox',
        documentType: 'identity',
      }),
    ).rejects.toThrow(/idSubtype is required/);
  });

  it('throws when idSubtype is invalid', async () => {
    await expect(
      startDocumentExtraction({
        apiKey: 'pk_test',
        environment: 'sandbox',
        documentType: 'identity',
        idSubtype: 'bogus' as any,
      }),
    ).rejects.toThrow(/invalid idSubtype: bogus/);
  });

  it('throws when idSubtype is set on a non-identity document', async () => {
    await expect(
      startDocumentExtraction({
        apiKey: 'pk_test',
        environment: 'sandbox',
        documentType: 'invoice',
        idSubtype: 'passport' as any,
      }),
    ).rejects.toThrow(/idSubtype must be omitted/);
  });

  it('accepts each valid IdSubtype', async () => {
    for (const subtype of ['passport', 'drivers_license', 'national_id', 'residence_permit'] as const) {
      mockFetchOnce({
        body: {
          id: 'd',
          document_type: 'identity',
          request: { id_subtype: subtype },
        },
      });
      const session = await startDocumentExtraction({
        apiKey: 'pk_test',
        environment: 'sandbox',
        documentType: 'identity',
        idSubtype: subtype,
      });
      expect(session.idSubtype).toBe(subtype);
    }
  });
});

describe('submitDocumentImage side guards', () => {
  it('rejects passport + back without making any network calls', async () => {
    const m = mockFetchSequence([]);
    const session = {
      documentId: 'doc_p',
      documentToken: 'tok',
      documentType: 'identity' as const,
      idSubtype: 'passport' as const,
      expiresAt: 'x',
    };
    const blob = new Blob([new Uint8Array([0xff])], { type: 'image/jpeg' });
    await expect(
      submitDocumentImage({
        apiKey: 'pk_test',
        environment: 'sandbox',
        session,
        image: { blob, width: 100, height: 70, byteLength: blob.size },
        side: 'back',
      }),
    ).rejects.toThrow(/passport documents have no back side/);
    expect(m.fn).not.toHaveBeenCalled();
  });
});
