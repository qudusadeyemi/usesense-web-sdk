/**
 * Document extraction client.
 *
 * Two operations on the /v1/documents resource:
 *   POST /v1/documents/extract             upload raw bytes + trigger extraction
 *   GET  /v1/documents/:id                 read current status + extraction
 *
 * Upload model ("Direct Binary Stream"): the SDK POSTs raw file bytes directly
 * to the API as the request body (Content-Type: application/octet-stream).
 * Document metadata travels in request headers so the backend can make routing
 * decisions before buffering the body, then pipe the stream straight to S3.
 * This avoids Base64 inflation and Edge Function memory pressure.
 *
 * The SDK speaks UseSense-native shapes only. The provider behind the scenes
 * (Infrared today) is encapsulated server-side; a `rawProvider` field on the
 * extraction names it for traceability.
 */

import type { Environment } from './types';

const DEFAULT_API_BASE = 'https://api.usesense.ai/v1';

// ============================================================================
// Types (snake_case on the wire, camelCase in TS)
// ============================================================================

/**
 * Broad categories of document the SDK can capture and submit.
 *
 * - `identity`           -- any government-issued photo ID. The caller MUST
 *                           also supply an `IdSubtype` (see below) so the SDK
 *                           can pick the correct capture guide and label, and
 *                           so the backend can verify rather than guess.
 * - `organisation_doc`   -- business document (incorporation cert, business
 *                           registration, EIN letter)
 * - `proof_of_address`   -- utility bill, bank statement, government letter
 * - `tax_doc`            -- tax return, W-2/W-8, equivalents
 * - `invoice`            -- supplier or customer invoice
 *
 * Paper documents (organisation_doc / proof_of_address / tax_doc / invoice)
 * share an A-series aspect-ratio guide. The backend uses the value to route
 * extraction.
 */
export type DocumentType =
  | 'identity'
  | 'organisation_doc'
  | 'proof_of_address'
  | 'tax_doc'
  | 'invoice';

/**
 * Specific kinds of identity document. Owned by the SDK -- deliberately not
 * a provider-specific concept. The caller declares this up-front when
 * `documentType === 'identity'`; the backend reconciles the declared subtype
 * against what the image actually contains and may correct or flag it on the
 * returned `DocumentExtraction.idSubtype`.
 *
 * - `passport`         -- ICAO TD-3 booklet, opened to the data page (~1.42)
 * - `drivers_license`  -- ID-1 card (~1.586)
 * - `national_id`      -- ID-1 card (~1.586)
 * - `residence_permit` -- ID-1 card (~1.586)
 */
export type IdSubtype =
  | 'passport'
  | 'drivers_license'
  | 'national_id'
  | 'residence_permit';

export type DocumentSide = 'front' | 'back';

export type DocumentStatus = 'pending' | 'completed' | 'failed';

export interface DocumentSession {
  documentId: string;
  documentToken: string;
  documentType: DocumentType;
  /** Set when documentType === 'identity'; null otherwise. */
  idSubtype: IdSubtype | null;
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
  /**
   * The ID subtype the backend ultimately determined this document to be.
   * May differ from the subtype declared by the caller at start time -- for
   * example if the user uploaded a national ID after selecting drivers_license.
   * Null when documentType !== 'identity', or when the backend couldn't
   * classify (in which case `failureReason` on `DocumentResult` will explain).
   */
  idSubtype: IdSubtype | null;
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
  /**
   * Required when `documentType === 'identity'`; must be omitted otherwise.
   * The SDK validates this at the call site rather than expressing it as a
   * discriminated union, to keep the FlowStep shape flat.
   */
  idSubtype?: IdSubtype;
  apiBaseUrl?: string;
}

export async function startDocumentExtraction(
  params: StartDocumentExtractionParams
): Promise<DocumentSession> {
  assertIdSubtypeShape(params.documentType, params.idSubtype);
  const base = params.apiBaseUrl || DEFAULT_API_BASE;
  const res = await fetch(`${base}/documents`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': params.apiKey,
      'x-environment': params.environment,
    },
    body: JSON.stringify({
      document_type: params.documentType,
      ...(params.idSubtype ? { id_subtype: params.idSubtype } : {}),
    }),
  });
  const body = await readJson(res, 'start document extraction');
  return {
    documentId: body.id,
    documentToken: body.document_token ?? '',
    documentType: body.document_type,
    idSubtype: body.request?.id_subtype ?? null,
    expiresAt: body.expires_at ?? body.created_at ?? '',
  };
}

// ============================================================================
// submitDocumentImage
// ============================================================================

export interface SubmitDocumentImageParams {
  /** API key for authenticating the extract call. */
  apiKey: string;
  session: DocumentSession;
  environment: Environment;
  image: DocumentImage;
  side: DocumentSide;
  apiBaseUrl?: string;
}

/**
 * Single-step direct binary upload:
 *   POST /v1/documents/extract
 *
 * The raw file bytes are sent as the request body
 * (Content-Type: application/octet-stream). Document metadata travels in
 * headers so the backend can make routing decisions before reading the body
 * and pipe the stream straight to S3 without buffering into memory.
 *
 * Headers sent:
 *   Content-Type:      application/octet-stream
 *   Content-Length:    byte length of the image (lets the backend enforce the 15 MB limit)
 *   x-api-key:         UseSense API key
 *   x-environment:     sandbox | production
 *   x-document-type:   identity | organisation_doc | proof_of_address | tax_doc | invoice
 *   x-document-side:   front | back
 *   x-id-subtype:      passport | drivers_license | national_id | residence_permit (identity only)
 */
export async function submitDocumentImage(
  params: SubmitDocumentImageParams
): Promise<DocumentResult> {
  assertSideForSubtype(params.session.idSubtype, params.side);
  const base = params.apiBaseUrl || DEFAULT_API_BASE;

  const headers: Record<string, string> = {
    'Content-Type': 'application/octet-stream',
    'Content-Length': String(params.image.byteLength),
    'x-api-key': params.apiKey,
    'x-environment': params.environment,
    'x-document-type': params.session.documentType,
    'x-document-side': params.side,
  };

  if (params.session.idSubtype) {
    headers['x-id-subtype'] = params.session.idSubtype;
  }

  const res = await fetch(`${base}/documents/extract`, {
    method: 'POST',
    headers,
    body: params.image.blob,
  });

  const body = await readJson(res, 'submit document image');
  return toDocumentResult(body);
}

// ============================================================================
// getDocument
// ============================================================================

export interface GetDocumentParams {
  apiKey: string;
  session: DocumentSession;
  environment: Environment;
  apiBaseUrl?: string;
}

export async function getDocument(params: GetDocumentParams): Promise<DocumentResult> {
  const base = params.apiBaseUrl || DEFAULT_API_BASE;
  const res = await fetch(`${base}/documents/${params.session.documentId}`, {
    method: 'GET',
    headers: {
      'x-api-key': params.apiKey,
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

const VALID_ID_SUBTYPES: ReadonlySet<IdSubtype> = new Set([
  'passport',
  'drivers_license',
  'national_id',
  'residence_permit',
]);

/**
 * Enforce the invariant that idSubtype is set iff documentType === 'identity'.
 * Thrown as a plain Error so it surfaces to the caller's onError handler the
 * same way as wire errors.
 */
export function assertIdSubtypeShape(
  documentType: DocumentType,
  idSubtype: IdSubtype | undefined,
): void {
  if (documentType === 'identity') {
    if (!idSubtype) {
      throw new Error(
        "idSubtype is required when documentType is 'identity' " +
          "(one of: passport, drivers_license, national_id, residence_permit)",
      );
    }
    if (!VALID_ID_SUBTYPES.has(idSubtype)) {
      throw new Error(`invalid idSubtype: ${idSubtype}`);
    }
  } else if (idSubtype) {
    throw new Error(
      `idSubtype must be omitted when documentType is '${documentType}'`,
    );
  }
}

/**
 * Enforce per-subtype side rules. Passports are single-sided (data page only);
 * ID-1 cards (drivers_license / national_id / residence_permit) accept either
 * side -- the caller decides whether their flow needs back capture.
 */
export function assertSideForSubtype(
  idSubtype: IdSubtype | null | undefined,
  side: DocumentSide,
): void {
  if (idSubtype === 'passport' && side === 'back') {
    throw new Error("passport documents have no back side; use side: 'front'");
  }
}

function toDocumentResult(body: any): DocumentResult {
  return {
    documentId: body.id,
    status: body.status,
    extraction: body.result ? toExtraction(body.result) : null,
    failureReason: body.error?.message ?? null,
  };
}

function toExtraction(e: any): DocumentExtraction {
  return {
    documentType: e.document_type,
    idSubtype: e.id_subtype ?? null,
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
