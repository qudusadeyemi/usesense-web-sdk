/**
 * Document extraction client.
 *
 * Three operations on the /v1/documents resource:
 *   POST /v1/documents              start an extraction
 *   POST /v1/documents/:id/extract  submit the captured image
 *   GET  /v1/documents/:id          read current status + extraction
 *
 * The SDK speaks UseSense-native shapes only. The provider behind the scenes
 * (Infrared today) is encapsulated server-side; a `rawProvider` field on the
 * extraction names it for traceability.
 */

import type { Environment } from './types';

const DEFAULT_API_BASE = 'https://api.usesense.ai/v1';

// ============================================================================
// Types (flat, snake_case at the wire, camelCase in TS)
// ============================================================================

export type DocumentType = 'identity' | 'passport';

export type DocumentSide = 'front' | 'back';

export type DocumentStatus = 'pending' | 'completed' | 'failed';

export interface DocumentSession {
  documentId: string;
  documentToken: string;
  documentType: DocumentType;
  expiresAt: string;
}

export interface DocumentImage {
  blob: Blob;
  width: number;
  height: number;
  byteLength: number;
}

export interface DocumentExtraction {
  documentType: DocumentType;
  documentNumber: string | null;
  fullName: string | null;
  firstName: string | null;
  lastName: string | null;
  dateOfBirth: string | null;
  nationality: string | null;
  issuingCountry: string | null;
  issueDate: string | null;
  expiryDate: string | null;
  sex: 'M' | 'F' | 'X' | null;
  mrz: string | null;
  rawProvider: 'infrared';
  rawProviderRequestId: string | null;
  capturedAt: string;
}

export interface DocumentResult {
  documentId: string;
  status: DocumentStatus;
  extraction: DocumentExtraction | null;
  failureReason: string | null;
}

// ============================================================================
// startDocumentExtraction
// ============================================================================

export interface StartDocumentExtractionParams {
  apiKey: string;
  environment: Environment;
  documentType: DocumentType;
  apiBaseUrl?: string;
}

export async function startDocumentExtraction(
  params: StartDocumentExtractionParams
): Promise<DocumentSession> {
  const base = params.apiBaseUrl || DEFAULT_API_BASE;
  const res = await fetch(`${base}/documents`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': params.apiKey,
      'x-environment': params.environment,
    },
    body: JSON.stringify({ document_type: params.documentType }),
  });
  const body = await readJson(res, 'start document extraction');
  return {
    documentId: body.document_id,
    documentToken: body.document_token,
    documentType: body.document_type,
    expiresAt: body.expires_at,
  };
}

// ============================================================================
// submitDocumentImage
// ============================================================================

export interface SubmitDocumentImageParams {
  session: DocumentSession;
  environment: Environment;
  image: DocumentImage;
  side: DocumentSide;
  apiBaseUrl?: string;
}

export async function submitDocumentImage(
  params: SubmitDocumentImageParams
): Promise<DocumentResult> {
  const base = params.apiBaseUrl || DEFAULT_API_BASE;
  const fd = new FormData();
  fd.append('file', params.image.blob, `document.${extensionFor(params.image.blob.type)}`);
  fd.append('side', params.side);

  const res = await fetch(`${base}/documents/${params.session.documentId}/extract`, {
    method: 'POST',
    headers: {
      'x-document-token': params.session.documentToken,
      'x-environment': params.environment,
    },
    body: fd,
  });
  const body = await readJson(res, 'submit document image');
  return toDocumentResult(body);
}

// ============================================================================
// getDocument
// ============================================================================

export interface GetDocumentParams {
  session: DocumentSession;
  environment: Environment;
  apiBaseUrl?: string;
}

export async function getDocument(params: GetDocumentParams): Promise<DocumentResult> {
  const base = params.apiBaseUrl || DEFAULT_API_BASE;
  const res = await fetch(`${base}/documents/${params.session.documentId}`, {
    method: 'GET',
    headers: {
      'x-document-token': params.session.documentToken,
      'x-environment': params.environment,
    },
  });
  const body = await readJson(res, 'get document');
  return toDocumentResult(body);
}

// ============================================================================
// internals
// ============================================================================

async function readJson(res: Response, op: string): Promise<any> {
  if (!res.ok) {
    const data = await res.json().catch(() => ({}) as any);
    const msg = data?.error?.message || data?.message || `${op} failed (${res.status})`;
    throw new Error(msg);
  }
  return res.json();
}

function toDocumentResult(body: any): DocumentResult {
  return {
    documentId: body.document_id,
    status: body.status,
    extraction: body.extraction ? toExtraction(body.extraction) : null,
    failureReason: body.failure_reason ?? null,
  };
}

function toExtraction(e: any): DocumentExtraction {
  return {
    documentType: e.document_type,
    documentNumber: e.document_number ?? null,
    fullName: e.full_name ?? null,
    firstName: e.first_name ?? null,
    lastName: e.last_name ?? null,
    dateOfBirth: e.date_of_birth ?? null,
    nationality: e.nationality ?? null,
    issuingCountry: e.issuing_country ?? null,
    issueDate: e.issue_date ?? null,
    expiryDate: e.expiry_date ?? null,
    sex: e.sex ?? null,
    mrz: e.mrz ?? null,
    rawProvider: e.raw_provider,
    rawProviderRequestId: e.raw_provider_request_id ?? null,
    capturedAt: e.captured_at,
  };
}

function extensionFor(mime: string): string {
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  return 'jpg';
}
