import { describe, it, expect } from 'vitest';
import {
  init,
  currentStep,
  recordResult,
  cancel,
  isComplete,
  toResult,
  progress,
  InvalidFlowError,
} from '../flow-machine';
import type { FlowStep } from '../types';
import type { CaptureResult } from '../../types';
import type { DocumentResult } from '../../documents';

const biometricResult: CaptureResult = {
  decision: 'pass',
  identityId: 'id_123',
  pillars: {} as any,
  suspicion: { score: 0, signals: [] } as any,
  metadata: {} as any,
} as any;

const docResult = (side: 'front' | 'back'): DocumentResult => ({
  documentId: `doc_${side}`,
  status: 'complete',
  documentType: 'identity',
  fields: { name: 'Jane Doe' } as any,
  rawProvider: 'infrared' as any,
  createdAt: new Date().toISOString(),
} as any);

describe('flow-machine', () => {
  describe('init', () => {
    it('rejects empty step list', () => {
      expect(() => init([])).toThrow(InvalidFlowError);
    });

    it('rejects non-array input', () => {
      expect(() => init(null as any)).toThrow(InvalidFlowError);
    });

    it('rejects unknown step kind', () => {
      expect(() => init([{ kind: 'mystery' } as any])).toThrow(InvalidFlowError);
    });

    it('rejects document step missing documentType', () => {
      expect(() =>
        init([{ kind: 'document', side: 'front' } as any]),
      ).toThrow(InvalidFlowError);
    });

    it('rejects document step with invalid side', () => {
      expect(() =>
        init([{ kind: 'document', documentType: 'identity', side: 'top' } as any]),
      ).toThrow(InvalidFlowError);
    });

    it('starts in-progress at cursor 0 with valid steps', () => {
      const state = init([{ kind: 'biometric' }]);
      expect(state.status).toBe('in-progress');
      expect(state.cursor).toBe(0);
      expect(state.results).toEqual([]);
    });
  });

  describe('currentStep', () => {
    it('returns the step at cursor', () => {
      const state = init([
        { kind: 'biometric' },
        { kind: 'document', documentType: 'identity', side: 'front' },
      ]);
      expect(currentStep(state)?.kind).toBe('biometric');
    });

    it('returns null when complete', () => {
      let state = init([{ kind: 'biometric' }]);
      state = recordResult(state, { kind: 'biometric', result: biometricResult });
      expect(currentStep(state)).toBeNull();
    });

    it('returns null when cancelled', () => {
      const state = cancel(init([{ kind: 'biometric' }]));
      expect(currentStep(state)).toBeNull();
    });
  });

  describe('recordResult', () => {
    it('advances cursor and appends result', () => {
      const steps: FlowStep[] = [
        { kind: 'biometric' },
        { kind: 'document', documentType: 'identity', side: 'front' },
      ];
      let state = init(steps);
      state = recordResult(state, { kind: 'biometric', result: biometricResult });
      expect(state.cursor).toBe(1);
      expect(state.results).toHaveLength(1);
      expect(state.status).toBe('in-progress');
    });

    it('marks complete on last step', () => {
      let state = init([{ kind: 'biometric' }]);
      state = recordResult(state, { kind: 'biometric', result: biometricResult });
      expect(state.status).toBe('complete');
      expect(isComplete(state)).toBe(true);
    });

    it('rejects mismatched kind', () => {
      const state = init([{ kind: 'biometric' }]);
      expect(() =>
        recordResult(state, {
          kind: 'document',
          documentType: 'identity',
          side: 'front',
          result: docResult('front'),
        }),
      ).toThrow(InvalidFlowError);
    });

    it('rejects mismatched document side', () => {
      const state = init([
        { kind: 'document', documentType: 'identity', side: 'front' },
      ]);
      expect(() =>
        recordResult(state, {
          kind: 'document',
          documentType: 'identity',
          side: 'back',
          result: docResult('back'),
        }),
      ).toThrow(InvalidFlowError);
    });

    it('rejects mismatched documentType', () => {
      const state = init([
        { kind: 'document', documentType: 'identity', side: 'front' },
      ]);
      expect(() =>
        recordResult(state, {
          kind: 'document',
          documentType: 'passport',
          side: 'front',
          result: docResult('front'),
        }),
      ).toThrow(InvalidFlowError);
    });

    it('rejects recording after complete', () => {
      let state = init([{ kind: 'biometric' }]);
      state = recordResult(state, { kind: 'biometric', result: biometricResult });
      expect(() =>
        recordResult(state, { kind: 'biometric', result: biometricResult }),
      ).toThrow(InvalidFlowError);
    });
  });

  describe('cancel', () => {
    it('cancels in-progress flow', () => {
      const state = cancel(init([{ kind: 'biometric' }]));
      expect(state.status).toBe('cancelled');
    });

    it('does not cancel a completed flow', () => {
      let state = init([{ kind: 'biometric' }]);
      state = recordResult(state, { kind: 'biometric', result: biometricResult });
      const after = cancel(state);
      expect(after.status).toBe('complete');
    });
  });

  describe('toResult & progress', () => {
    it('aggregates multi-document + biometric flow in order', () => {
      const steps: FlowStep[] = [
        { kind: 'biometric' },
        { kind: 'document', documentType: 'identity', side: 'front' },
        { kind: 'document', documentType: 'identity', side: 'back' },
        { kind: 'document', documentType: 'passport', side: 'front' },
      ];
      let state = init(steps);
      state = recordResult(state, { kind: 'biometric', result: biometricResult });
      state = recordResult(state, {
        kind: 'document',
        documentType: 'identity',
        side: 'front',
        result: docResult('front'),
      });
      state = recordResult(state, {
        kind: 'document',
        documentType: 'identity',
        side: 'back',
        result: docResult('back'),
      });
      state = recordResult(state, {
        kind: 'document',
        documentType: 'passport',
        side: 'front',
        result: docResult('front'),
      });
      expect(isComplete(state)).toBe(true);
      const result = toResult(state);
      expect(result.steps).toHaveLength(4);
      expect(result.steps[0].kind).toBe('biometric');
      expect(result.steps.map((s) => s.kind)).toEqual([
        'biometric',
        'document',
        'document',
        'document',
      ]);
    });

    it('reports progress accurately', () => {
      let state = init([
        { kind: 'biometric' },
        { kind: 'document', documentType: 'identity', side: 'front' },
      ]);
      expect(progress(state)).toEqual({ completed: 0, total: 2 });
      state = recordResult(state, { kind: 'biometric', result: biometricResult });
      expect(progress(state)).toEqual({ completed: 1, total: 2 });
    });
  });
});
