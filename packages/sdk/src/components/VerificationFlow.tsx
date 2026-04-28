'use client';

/**
 * <VerificationFlow/> -- mixed biometric + document orchestrator
 *
 * Drives the pure flow machine and renders the appropriate capture
 * component for each step. For document steps, owns the lifecycle:
 * startDocumentExtraction -> render <DocumentCapture/> -> submitDocumentImage.
 *
 * Strictly forward (v1): no go-back. The machine is shaped to make
 * `goBack` an additive transition.
 *
 * Biometric session data must be supplied per biometric step (host app
 * creates the session on its backend). Document sessions are created
 * automatically when the document step is entered.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { VerificationCaptureEngine } from './VerificationCaptureEngine';
import { DocumentCapture } from '../document-capture';
import {
  startDocumentExtraction,
  submitDocumentImage,
} from '../documents';
import { prepareDocumentImage } from '../prepare-document-image';
import {
  cancel as cancelMachine,
  currentStep,
  init as initMachine,
  isComplete,
  recordResult,
  toResult,
} from '../flow/flow-machine';
import type { FlowState, FlowStep, MixedFlowResult } from '../flow/types';
import type { CaptureSessionData, Environment } from '../types';
import type { DocumentSession } from '../documents';

export interface VerificationFlowProps {
  /** Ordered list of steps to run. Must be non-empty. */
  steps: FlowStep[];

  /** API key (for document step session creation). */
  apiKey: string;

  /** API base URL. Defaults to https://api.usesense.ai/v1 */
  apiBaseUrl?: string;

  /** Environment override; otherwise inferred from apiKey. */
  environment?: Environment;

  /**
   * Resolves biometric session data when a biometric step is entered.
   * The host app should call its own backend to create a session and
   * return the resulting CaptureSessionData.
   */
  resolveBiometricSession: () => Promise<CaptureSessionData>;

  /** Brand colour applied to all child components. */
  primaryColor?: string;

  /** Called when every step has produced a result. */
  onComplete: (result: MixedFlowResult) => void;

  /** Called on unrecoverable error. */
  onError: (message: string) => void;

  /** Called when the user cancels the flow. */
  onCancel?: () => void;
}

type DocumentStepStage =
  | { stage: 'starting' }
  | { stage: 'capturing'; session: DocumentSession }
  | { stage: 'submitting'; session: DocumentSession }
  | { stage: 'error'; message: string };

export function VerificationFlow({
  steps,
  apiKey,
  apiBaseUrl,
  environment,
  resolveBiometricSession,
  primaryColor,
  onComplete,
  onError,
  onCancel,
}: VerificationFlowProps): JSX.Element | null {
  const [state, setState] = useState<FlowState>(() => initMachine(steps));
  const [biometricSession, setBiometricSession] = useState<CaptureSessionData | null>(null);
  const [docStage, setDocStage] = useState<DocumentStepStage | null>(null);
  const cancelledRef = useRef(false);

  const step = currentStep(state);

  // Notify on completion exactly once.
  useEffect(() => {
    if (isComplete(state)) {
      onComplete(toResult(state));
    }
  }, [state, onComplete]);

  // Resolve biometric session whenever we enter a biometric step.
  useEffect(() => {
    if (!step || step.kind !== 'biometric') {
      setBiometricSession(null);
      return;
    }
    let cancelled = false;
    setBiometricSession(null);
    resolveBiometricSession()
      .then((session) => {
        if (!cancelled) setBiometricSession(session);
      })
      .catch((err) => {
        if (!cancelled) onError(`Biometric session failed: ${err?.message ?? err}`);
      });
    return () => {
      cancelled = true;
    };
  }, [step, resolveBiometricSession, onError]);

  // Start a document session whenever we enter a document step.
  useEffect(() => {
    if (!step || step.kind !== 'document') {
      setDocStage(null);
      return;
    }
    if (!environment) {
      onError('VerificationFlow: environment is required for document steps');
      return;
    }
    let cancelled = false;
    setDocStage({ stage: 'starting' });
    startDocumentExtraction({
      apiKey,
      apiBaseUrl,
      environment,
      documentType: step.documentType,
    })
      .then((session) => {
        if (!cancelled) setDocStage({ stage: 'capturing', session });
      })
      .catch((err) => {
        const message = `Document session failed: ${err?.message ?? err}`;
        if (!cancelled) {
          setDocStage({ stage: 'error', message });
          onError(message);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [step, apiKey, apiBaseUrl, environment, onError]);

  const handleBiometricComplete = useCallback(
    (result: Parameters<NonNullable<Parameters<typeof VerificationCaptureEngine>[0]['onComplete']>>[0]) => {
      setState((prev) => recordResult(prev, { kind: 'biometric', result }));
    },
    [],
  );

  const handleDocumentCapture = useCallback(
    async (blob: Blob) => {
      if (!step || step.kind !== 'document') return;
      if (!docStage || docStage.stage !== 'capturing') return;
      if (!environment) {
        onError('VerificationFlow: environment is required for document submit');
        return;
      }
      const { session } = docStage;
      setDocStage({ stage: 'submitting', session });
      try {
        // <DocumentCapture/> already produced a prepared JPEG, but we need
        // the dimensions (and a canonical re-encode) for the submit payload.
        const prepared = await prepareDocumentImage({ source: blob });
        const submitted = await submitDocumentImage({
          apiBaseUrl,
          environment,
          session,
          image: {
            blob: prepared.blob,
            width: prepared.width,
            height: prepared.height,
            byteLength: prepared.byteLength,
          },
          side: step.side,
        });
        setState((prev) =>
          recordResult(prev, {
            kind: 'document',
            documentType: step.documentType,
            side: step.side,
            result: submitted,
          }),
        );
      } catch (err) {
        const message = `Document submit failed: ${(err as Error)?.message ?? err}`;
        setDocStage({ stage: 'error', message });
        onError(message);
      }
    },
    [step, docStage, apiBaseUrl, environment, onError],
  );

  const handleCancel = useCallback(() => {
    if (cancelledRef.current) return;
    cancelledRef.current = true;
    setState((prev) => cancelMachine(prev));
    onCancel?.();
  }, [onCancel]);

  const inferredEnv = useMemo(() => environment, [environment]);

  if (!step) return null; // complete or cancelled

  if (step.kind === 'biometric') {
    if (!biometricSession) {
      return <FlowLoading message="Preparing biometric session…" />;
    }
    return (
      <VerificationCaptureEngine
        sessionData={biometricSession}
        environment={inferredEnv}
        apiBaseUrl={apiBaseUrl}
        primaryColor={primaryColor}
        onComplete={handleBiometricComplete}
        onError={onError}
        onCancel={handleCancel}
      />
    );
  }

  // document step
  if (!docStage || docStage.stage === 'starting') {
    return <FlowLoading message="Preparing document session…" />;
  }
  if (docStage.stage === 'submitting') {
    return <FlowLoading message="Submitting document…" />;
  }
  if (docStage.stage === 'error') {
    return <FlowLoading message={docStage.message} />;
  }
  return (
    <DocumentCapture
      documentType={step.documentType}
      side={step.side}
      primaryColor={primaryColor}
      onCapture={(blob) => {
        void handleDocumentCapture(blob);
      }}
      onCancel={handleCancel}
      onError={onError}
    />
  );
}

function FlowLoading({ message }: { message: string }): JSX.Element {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(28,26,23,0.92)',
        color: '#FDFCFA',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'DM Sans', sans-serif",
        fontSize: '0.95rem',
        zIndex: 9999,
      }}
    >
      {message}
    </div>
  );
}
