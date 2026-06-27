/**
 * The Flows namespace. Sessions and Flows coexist; this is a parallel entry
 * point to the existing single-step capture APIs.
 *
 *   import { flows } from '@usesense/web-sdk';
 *   const result = await flows.run({ flowRunId, sdkToken });
 *
 * The FlowRunner React component and the FlowsClient HTTP wrapper are also
 * exported for advanced use cases (custom modal chrome, server-side stubs in
 * tests, etc.).
 */

import { run } from './run';

export const flows = { run } as const;

export { FlowRunner } from './FlowRunner';
export { createFlowsClient } from './client';
export { FlowError } from './types';
export type { FlowsClient, FlowsClientOptions, InitSessionResponse, UploadDocumentResponse } from './client';
export type {
  CameraFacing,
  CaptureHints,
  FlowErrorCode,
  FlowOutcome,
  FlowRunResult,
  FlowRunState,
  FlowRunView,
  FormField,
  FormFieldError,
  FormFieldType,
  InfoAction,
  InfoBullet,
  InfoBulletIcon,
  InfoCta,
  InfoSecondaryCta,
  IdTypeOption,
  PendingAction,
  RunFlowOptions,
} from './types';
export type {
  FlowTheme, ThemePreference,
  FlowAppearance, AppearanceColors, AppearanceTypography, AppearanceShape,
} from './theme';
export type { FlowCopy } from './copy';
