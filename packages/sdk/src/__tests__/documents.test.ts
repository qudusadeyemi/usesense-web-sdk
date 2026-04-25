import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  startDocumentExtraction,
  submitDocumentImage,
  getDocument,
} from '../documents';

const ORIGINAL_FETCH = globalThis.fetch;

type FetchCall = [url: string, init: RequestInit];

function mockFetchOnce(response: { status?: number; body: unknown }) {
  const calls: FetchCall[] = [];
  const fn = vi.fn(async (url: string, init: RequestInit) => {
    calls.push([url, init]);
    return new Response(JSON.stringify(response.body), {
      status: response.status ?? 200,
      headers: { 'Content-Type': 'application/json' },
    });
  });
  globalThis.fetch = fn as unknown as typeof fetch;
  return { fn, calls };
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
        document_id: 'doc_123',
        document_token: 'tok_abc',
        document_type: 'identity',
        expires_at: '2026-04-25T12:30:00.000Z',
      },
    });

    const session = await startDocumentExtraction({
      apiKey: 'pk_test_xyz',
      environment: 'sandbox',
      documentType: 'identity',
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
    });

    expect(session).toEqual({
      documentId: 'doc_123',
      documentToken: 'tok_abc',
      documentType: 'identity',
      expiresAt: '2026-04-25T12:30:00.000Z',
    });
  });

  it('honours custom apiBaseUrl', async () => {
    const m = mockFetchOnce({
      body: {
        document_id: 'd',
        document_token: 't',
        document_type: 'identity',
        expires_at: 'x',
      },
    });
    await startDocumentExtraction({
      apiKey: 'pk_test',
      environment: 'sandbox',
      documentType: 'identity',
      apiBaseUrl: 'https://staging.usesense.ai/v1',
    });
    expect(m.calls[0]![0]).toBe('https://staging.usesense.ai/v1/documents');
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
      })
    ).rejects.toThrow('invalid api key');
  });
});

describe('submitDocumentImage', () => {
  it('POSTs multipart to /v1/documents/:id/extract with token header', async () => {
    const m = mockFetchOnce({
      body: {
        document_id: 'doc_123',
        status: 'completed',
        extraction: {
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
        failure_reason: null,
      },
    });

    const blob = new Blob([new Uint8Array([0xff, 0xd8, 0xff])], {
      type: 'image/jpeg',
    });

    const result = await submitDocumentImage({
      session: {
        documentId: 'doc_123',
        documentToken: 'tok_abc',
        documentType: 'identity',
        expiresAt: '2026-04-25T12:30:00.000Z',
      },
      environment: 'sandbox',
      image: { blob, width: 1600, height: 1012, byteLength: blob.size },
      side: 'front',
    });

    expect(m.fn).toHaveBeenCalledOnce();
    const [url, init] = m.calls[0]!;
    expect(url).toBe('https://api.usesense.ai/v1/documents/doc_123/extract');
    expect(init.method).toBe('POST');
    const headers = init.headers as Record<string, string>;
    expect(headers['x-document-token']).toBe('tok_abc');
    expect(headers['x-environment']).toBe('sandbox');
    expect(init.body).toBeInstanceOf(FormData);
    const fd = init.body as FormData;
    expect(fd.get('side')).toBe('front');
    const file = fd.get('file');
    expect(file).toBeInstanceOf(Blob);

    expect(result.status).toBe('completed');
    expect(result.failureReason).toBeNull();
    expect(result.extraction).not.toBeNull();
    expect(result.extraction!.fullName).toBe('Ada Lovelace');
    expect(result.extraction!.dateOfBirth).toBe('1815-12-10');
    expect(result.extraction!.rawProvider).toBe('infrared');
    expect(result.extraction!.rawProviderRequestId).toBe('req_xyz');
  });

  it('returns failure result without extraction', async () => {
    mockFetchOnce({
      body: {
        document_id: 'doc_123',
        status: 'failed',
        extraction: null,
        failure_reason: 'unreadable_image',
      },
    });
    const blob = new Blob([new Uint8Array([0xff])], { type: 'image/jpeg' });
    const result = await submitDocumentImage({
      session: {
        documentId: 'doc_123',
        documentToken: 't',
        documentType: 'identity',
        expiresAt: 'x',
      },
      environment: 'sandbox',
      image: { blob, width: 100, height: 100, byteLength: 1 },
      side: 'front',
    });
    expect(result.status).toBe('failed');
    expect(result.extraction).toBeNull();
    expect(result.failureReason).toBe('unreadable_image');
  });

  it('throws on non-2xx', async () => {
    mockFetchOnce({
      status: 413,
      body: { error: { message: 'image too large' } },
    });
    const blob = new Blob([new Uint8Array([0xff])], { type: 'image/jpeg' });
    await expect(
      submitDocumentImage({
        session: {
          documentId: 'doc_123',
          documentToken: 't',
          documentType: 'identity',
          expiresAt: 'x',
        },
        environment: 'sandbox',
        image: { blob, width: 1, height: 1, byteLength: 1 },
        side: 'front',
      })
    ).rejects.toThrow('image too large');
  });
});

describe('getDocument', () => {
  it('GETs /v1/documents/:id with token header and returns flat result', async () => {
    const m = mockFetchOnce({
      body: {
        document_id: 'doc_123',
        status: 'completed',
        extraction: {
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
        failure_reason: null,
      },
    });

    const result = await getDocument({
      session: {
        documentId: 'doc_123',
        documentToken: 'tok',
        documentType: 'identity',
        expiresAt: 'x',
      },
      environment: 'production',
    });

    const [url, init] = m.calls[0]!;
    expect(url).toBe('https://api.usesense.ai/v1/documents/doc_123');
    expect(init.method).toBe('GET');
    const headers = init.headers as Record<string, string>;
    expect(headers['x-document-token']).toBe('tok');
    expect(headers['x-environment']).toBe('production');
    expect(result.status).toBe('completed');
    expect(result.extraction!.documentNumber).toBe('A1');
  });
});
