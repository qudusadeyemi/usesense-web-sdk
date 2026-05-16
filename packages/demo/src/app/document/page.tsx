'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import {
  detectEnvironmentFromKey,
  startDocumentExtraction,
  submitDocumentImage,
  getDocument,
  prepareDocumentImage,
  DocumentImageTooLargeError,
  DocumentCapture,
  MAX_PRE_BASE64_BYTES,
} from '@usesense/web-sdk';
import type {
  DocumentSession,
  DocumentResult,
  DocumentSide,
  DocumentType,
  IdSubtype,
} from '@usesense/web-sdk';

// ---------------------------------------------------------------------------
// Styles — kept inline to match packages/demo/src/app/page.tsx aesthetic.
// If a third page appears, extract these to a shared module.
// ---------------------------------------------------------------------------

const styles = {
  page: {
    display: 'flex',
    flexDirection: 'column' as const,
    minHeight: '100vh',
    fontFamily: "'DM Sans', sans-serif",
    background: '#FDFCFA',
    color: '#1C1A17',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 32px',
    background: '#FFFFFF',
    borderBottom: '1px solid #E8E5DE',
    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
  },
  headerTitle: {
    fontSize: '1rem',
    fontWeight: 700,
    fontFamily: "'Outfit', sans-serif",
    letterSpacing: '-0.02em',
    whiteSpace: 'nowrap' as const,
  },
  headerBadge: {
    fontSize: '0.72rem',
    fontWeight: 600,
    fontFamily: "'JetBrains Mono', monospace",
    background: 'rgba(79,124,255,0.08)',
    color: '#4F7CFF',
    padding: '4px 10px',
    borderRadius: '6px',
    marginLeft: '10px',
    border: '1px solid rgba(79,124,255,0.2)',
  },
  content: {
    maxWidth: '860px',
    width: '100%',
    margin: '0 auto',
    padding: '32px 24px',
  },
  card: {
    background: '#FFFFFF',
    borderRadius: '14px',
    border: '1px solid #E8E5DE',
    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
    padding: '28px',
    marginBottom: '20px',
  },
  cardTitle: {
    fontSize: '1rem',
    fontWeight: 700,
    fontFamily: "'Outfit', sans-serif",
    letterSpacing: '-0.02em',
    marginBottom: '20px',
    color: '#1C1A17',
  },
  fieldGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '16px',
  },
  label: {
    display: 'block',
    fontSize: '0.72rem',
    fontWeight: 600,
    fontFamily: "'DM Sans', sans-serif",
    color: '#6B6760',
    marginBottom: '6px',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.06em',
  },
  input: {
    width: '100%',
    height: '44px',
    padding: '0 16px',
    border: '1px solid #E8E5DE',
    borderRadius: '10px',
    fontSize: '0.88rem',
    fontFamily: "'DM Sans', sans-serif",
    outline: 'none',
    boxSizing: 'border-box' as const,
    background: '#FFFFFF',
    color: '#1C1A17',
  },
  select: {
    width: '100%',
    height: '44px',
    padding: '0 16px',
    border: '1px solid #E8E5DE',
    borderRadius: '10px',
    fontSize: '0.88rem',
    fontFamily: "'DM Sans', sans-serif",
    outline: 'none',
    background: '#FFFFFF',
    color: '#1C1A17',
    cursor: 'pointer',
    boxSizing: 'border-box' as const,
  },
  primaryBtn: (color: string, disabled: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '44px',
    padding: '0 24px',
    border: 'none',
    borderRadius: '10px',
    fontSize: '0.88rem',
    fontWeight: 600,
    fontFamily: "'DM Sans', sans-serif",
    cursor: disabled ? 'not-allowed' : 'pointer',
    background: disabled ? '#9E9A92' : color,
    color: '#FFFFFF',
    opacity: disabled ? 0.4 : 1,
    marginTop: '8px',
  }),
  secondaryBtn: (disabled: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '44px',
    padding: '0 20px',
    border: '1px solid #E8E5DE',
    borderRadius: '10px',
    fontSize: '0.85rem',
    fontWeight: 600,
    fontFamily: "'DM Sans', sans-serif",
    cursor: disabled ? 'not-allowed' : 'pointer',
    background: '#FFFFFF',
    color: disabled ? '#9E9A92' : '#1C1A17',
    opacity: disabled ? 0.5 : 1,
  }),
  notice: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
    padding: '20px 24px',
    background: 'rgba(255,184,77,0.06)',
    border: '1px solid rgba(255,184,77,0.2)',
    borderRadius: '14px',
    fontSize: '0.85rem',
    fontFamily: "'DM Sans', sans-serif",
    color: '#6B6760',
    marginBottom: '20px',
    lineHeight: '1.6',
  },
  errorCard: {
    background: 'rgba(255,107,74,0.06)',
    border: '1px solid rgba(255,107,74,0.2)',
    borderRadius: '14px',
    padding: '20px 24px',
    marginBottom: '20px',
    color: '#B73520',
    fontSize: '0.85rem',
    fontFamily: "'DM Sans', sans-serif",
  },
  preview: {
    width: '100%',
    maxHeight: '320px',
    objectFit: 'contain' as const,
    borderRadius: '10px',
    border: '1px solid #E8E5DE',
    background: '#F5F3EF',
    marginTop: '12px',
  },
  meta: {
    fontSize: '0.78rem',
    fontFamily: "'JetBrains Mono', monospace",
    color: '#6B6760',
    marginTop: '8px',
  },
  decisionBadge: (decision: string): React.CSSProperties => {
    const map: Record<string, { bg: string; color: string; border: string }> = {
      complete: { bg: 'rgba(0,212,170,0.08)', color: '#008066', border: 'rgba(0,212,170,0.2)' },
      failed: { bg: 'rgba(255,107,74,0.08)', color: '#B73520', border: 'rgba(255,107,74,0.2)' },
      pending: { bg: 'rgba(255,184,77,0.08)', color: '#B77829', border: 'rgba(255,184,77,0.2)' },
    };
    const s = map[decision] || map.pending;
    return {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '5px',
      padding: '4px 10px',
      borderRadius: '6px',
      fontSize: '0.72rem',
      fontWeight: 600,
      fontFamily: "'DM Sans', sans-serif",
      background: s.bg,
      color: s.color,
      border: `1px solid ${s.border}`,
    };
  },
  debugPanel: {
    background: '#1C1A17',
    borderRadius: '14px',
    padding: '16px',
    maxHeight: '260px',
    overflowY: 'auto' as const,
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: '0.78rem',
    lineHeight: '1.8',
  },
  debugLine: {
    color: '#D0CCBF',
    whiteSpace: 'pre-wrap' as const,
    wordBreak: 'break-all' as const,
  },
  json: {
    background: '#F5F3EF',
    borderRadius: '10px',
    padding: '14px',
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: '0.75rem',
    color: '#1C1A17',
    overflowX: 'auto' as const,
    margin: 0,
    whiteSpace: 'pre-wrap' as const,
    wordBreak: 'break-all' as const,
  },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const PRIMARY_COLOR = '#4F7CFF';

export default function DocumentDemoPage() {
  const apiBaseUrl =
    process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.usesense.ai/v1';
  const defaultApiKey = process.env.NEXT_PUBLIC_DEMO_API_KEY || '';

  const [apiKey, setApiKey] = useState(defaultApiKey);
  const [externalUserId, setExternalUserId] = useState('demo-user-001');
  const [side, setSide] = useState<DocumentSide>('front');
  const [documentType, setDocumentType] = useState<DocumentType>('identity');
  const [idSubtype, setIdSubtype] = useState<IdSubtype>('passport');
  const [showCapture, setShowCapture] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [pickedFile, setPickedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [preparedBytes, setPreparedBytes] = useState<number | null>(null);
  const [preparedDims, setPreparedDims] = useState<{ width: number; height: number } | null>(null);
  const [preparedBlob, setPreparedBlob] = useState<Blob | null>(null);

  const [session, setSession] = useState<DocumentSession | null>(null);
  const [result, setResult] = useState<DocumentResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'start' | 'prepare' | 'submit' | 'get' | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  const environment = useMemo(() => detectEnvironmentFromKey(apiKey), [apiKey]);
  const canStart = apiKey.length > 0 && externalUserId.length > 0;
  const canSubmit = !!session && !!preparedBlob && !busy;
  const canGet = !!session && !busy;

  const log = useCallback((message: string) => {
    const ts = new Date().toISOString().slice(11, 23);
    setLogs((prev) => [`[${ts}] ${message}`, ...prev]);
  }, []);

  const handleStart = async () => {
    setError(null);
    setResult(null);
    setSession(null);
    setBusy('start');
    log(`POST ${apiBaseUrl}/documents (env=${environment})`);
    try {
      const created = await startDocumentExtraction({
        apiKey,
        apiBaseUrl,
        environment,
        documentType,
        ...(documentType === 'identity' ? { idSubtype } : {}),
      });
      setSession(created);
      log(`Document session ${created.documentId} (expires ${created.expiresAt})`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(`Start failed: ${message}`);
      log(`Start error: ${message}`);
    } finally {
      setBusy(null);
    }
  };

  const handleCaptureComplete = useCallback(
    async (blob: Blob, capturedSide: DocumentSide) => {
      setShowCapture(false);
      setSide(capturedSide);
      setError(null);
      setPickedFile(null);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);

      // <DocumentCapture/> already ran prepareDocumentImage; we still need
      // dimensions for the submit payload, so decode once to read them.
      try {
        const bitmap = await createImageBitmap(blob);
        const width = bitmap.width;
        const height = bitmap.height;
        bitmap.close();
        setPreparedBlob(blob);
        setPreparedBytes(blob.size);
        setPreparedDims({ width, height });
        log(
          `Captured (${capturedSide}): ${width}x${height} JPEG, ` +
            `${(blob.size / 1024).toFixed(1)} KB`,
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(`Capture decode failed: ${message}`);
        log(`Capture decode error: ${message}`);
      }
    },
    [previewUrl],
  );

  const handleFilePick = async (file: File | null) => {
    setPickedFile(file);
    setPreparedBlob(null);
    setPreparedBytes(null);
    setPreparedDims(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(file ? URL.createObjectURL(file) : null);
    if (!file) return;

    setBusy('prepare');
    log(`Preparing ${file.name} (${(file.size / 1024).toFixed(1)} KB)`);
    try {
      const prepared = await prepareDocumentImage({ source: file });
      setPreparedBlob(prepared.blob);
      setPreparedBytes(prepared.byteLength);
      setPreparedDims({ width: prepared.width, height: prepared.height });
      log(
        `Prepared ${prepared.width}x${prepared.height} JPEG, ` +
          `${(prepared.byteLength / 1024).toFixed(1)} KB ` +
          `(budget ${(MAX_PRE_BASE64_BYTES / 1024).toFixed(0)} KB)`,
      );
    } catch (err) {
      if (err instanceof DocumentImageTooLargeError) {
        setError('Image still over 3.5MB after compression. Try a smaller photo.');
        log('Prepare failed: DocumentImageTooLargeError');
      } else {
        const message = err instanceof Error ? err.message : String(err);
        setError(`Prepare failed: ${message}`);
        log(`Prepare error: ${message}`);
      }
    } finally {
      setBusy(null);
    }
  };

  const handleSubmit = async () => {
    if (!session || !preparedBlob || preparedBytes === null || !preparedDims) return;
    setError(null);
    setBusy('submit');
    log(`POST ${apiBaseUrl}/documents/${session.documentId}/extract`);
    try {
      const submitted = await submitDocumentImage({
        apiBaseUrl,
        environment,
        session,
        image: {
          blob: preparedBlob,
          width: preparedDims.width,
          height: preparedDims.height,
          byteLength: preparedBytes,
        },
        side,
      });
      setResult(submitted);
      log(`Submit ok: status=${submitted.status}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(`Submit failed: ${message}`);
      log(`Submit error: ${message}`);
    } finally {
      setBusy(null);
    }
  };

  const handleGet = async () => {
    if (!session) return;
    setError(null);
    setBusy('get');
    log(`GET ${apiBaseUrl}/documents/${session.documentId}`);
    try {
      const fetched = await getDocument({
        apiBaseUrl,
        environment,
        session,
      });
      setResult(fetched);
      log(`Get ok: status=${fetched.status}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(`Get failed: ${message}`);
      log(`Get error: ${message}`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <span style={styles.headerTitle}>
            <span style={{ color: '#1C1A17' }}>Use</span>
            <span style={{ color: '#4F7CFF' }}>Sense</span> Document Demo
          </span>
          <span style={styles.headerBadge}>/v1/documents</span>
        </div>
        <a
          href="/"
          style={{
            fontSize: '0.82rem',
            fontWeight: 600,
            color: '#6B6760',
            textDecoration: 'none',
          }}
        >
          ← Biometric demo
        </a>
      </header>

      <main style={styles.content}>
        <div style={styles.notice}>
          <span style={{ flexShrink: 0, fontSize: '16px', color: '#B77829', fontWeight: 700 }}>!</span>
          <span>
            <strong>Backend not deployed yet:</strong> the SDK calls are wired
            against <code>{apiBaseUrl}</code>, but <code>/v1/documents</code> is
            not implemented on the server yet, so start/submit/get will return
            HTTP errors. The image preparation step runs entirely in the browser
            and works today.
          </span>
        </div>

        <div style={styles.card}>
          <div style={styles.cardTitle}>1. Configuration</div>
          <div style={styles.fieldGrid}>
            <div>
              <label style={styles.label}>API Key</label>
              <input
                style={styles.input}
                type="password"
                placeholder="sk-..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
            </div>
            <div>
              <label style={styles.label}>External User ID</label>
              <input
                style={styles.input}
                type="text"
                value={externalUserId}
                onChange={(e) => setExternalUserId(e.target.value)}
              />
            </div>
            <div>
              <label style={styles.label}>Document Type</label>
              <select
                style={styles.select}
                value={documentType}
                onChange={(e) => setDocumentType(e.target.value as DocumentType)}
              >
                <option value="identity">identity</option>
                <option value="organisation_doc">organisation_doc</option>
                <option value="proof_of_address">proof_of_address</option>
                <option value="tax_doc">tax_doc</option>
                <option value="invoice">invoice</option>
              </select>
            </div>
            {documentType === 'identity' && (
              <div>
                <label style={styles.label}>ID Subtype</label>
                <select
                  style={styles.select}
                  value={idSubtype}
                  onChange={(e) => setIdSubtype(e.target.value as IdSubtype)}
                >
                  <option value="passport">passport</option>
                  <option value="drivers_license">drivers_license</option>
                  <option value="national_id">national_id</option>
                  <option value="residence_permit">residence_permit</option>
                </select>
              </div>
            )}
            <div>
              <label style={styles.label}>Side</label>
              <select
                style={styles.select}
                value={side}
                onChange={(e) => setSide(e.target.value as DocumentSide)}
              >
                <option value="front">front</option>
                <option value="back">back</option>
              </select>
            </div>
            <div>
              <label style={styles.label}>API Base URL</label>
              <input style={{ ...styles.input, opacity: 0.6 }} type="text" value={apiBaseUrl} readOnly />
            </div>
          </div>
          <button
            style={styles.primaryBtn(PRIMARY_COLOR, !canStart || busy === 'start')}
            disabled={!canStart || busy === 'start'}
            onClick={handleStart}
          >
            {busy === 'start' ? 'Starting...' : 'Start Document Extraction'}
          </button>
        </div>

        <div style={styles.card}>
          <div style={styles.cardTitle}>2. Capture or Upload Image</div>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <button
              type="button"
              style={styles.primaryBtn(PRIMARY_COLOR, false)}
              onClick={() => setShowCapture(true)}
            >
              Open capture UI
            </button>
            <label style={styles.secondaryBtn(false)}>
              {pickedFile ? 'Choose another file' : 'Or pick a file directly'}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => handleFilePick(e.target.files?.[0] ?? null)}
                style={{ display: 'none' }}
              />
            </label>
          </div>
          {previewUrl && (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previewUrl} alt="document preview" style={styles.preview} />
            </>
          )}
          {pickedFile && (
            <div style={styles.meta}>
              Original: {pickedFile.name} · {(pickedFile.size / 1024).toFixed(1)} KB
            </div>
          )}
          {preparedBytes !== null && preparedDims && (
            <div style={styles.meta}>
              Prepared: {preparedDims.width}x{preparedDims.height} ·{' '}
              {(preparedBytes / 1024).toFixed(1)} KB
            </div>
          )}
        </div>

        <div style={styles.card}>
          <div style={styles.cardTitle}>3. Submit & Poll</div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              style={styles.secondaryBtn(!canSubmit)}
              disabled={!canSubmit}
              onClick={handleSubmit}
            >
              {busy === 'submit' ? 'Submitting...' : 'Submit Image'}
            </button>
            <button
              style={styles.secondaryBtn(!canGet)}
              disabled={!canGet}
              onClick={handleGet}
            >
              {busy === 'get' ? 'Fetching...' : 'Get Status'}
            </button>
          </div>
          {session && (
            <div style={styles.meta}>
              Session: {session.documentId} · expires {new Date(session.expiresAt).toLocaleTimeString()}
            </div>
          )}
        </div>

        {error && (
          <div style={styles.errorCard}>
            <div style={{ fontWeight: 700, marginBottom: '6px' }}>Error</div>
            <div>{error}</div>
          </div>
        )}

        {result && (
          <div style={styles.card}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '16px',
              }}
            >
              <div style={styles.cardTitle}>Result</div>
              <span style={styles.decisionBadge(result.status)}>{result.status}</span>
            </div>
            <pre style={styles.json}>{JSON.stringify(result, null, 2)}</pre>
          </div>
        )}

        <div style={styles.card}>
          <div style={styles.cardTitle}>Debug Logs ({logs.length})</div>
          <div style={styles.debugPanel}>
            {logs.length === 0 ? (
              <div style={{ color: '#6B6760' }}>No events yet.</div>
            ) : (
              logs.map((line, i) => (
                <div key={i} style={styles.debugLine}>
                  {line}
                </div>
              ))
            )}
          </div>
        </div>
      </main>

      {showCapture && (
        <DocumentCapture
          documentType={documentType}
          idSubtype={documentType === 'identity' ? idSubtype : undefined}
          side={side}
          primaryColor={PRIMARY_COLOR}
          onCapture={handleCaptureComplete}
          onCancel={() => setShowCapture(false)}
          onError={(message) => log(`Capture UI error: ${message}`)}
        />
      )}
    </div>
  );
}
