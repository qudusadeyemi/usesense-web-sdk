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
export type { FlowsClient, FlowsClientOptions, FlowClientContext, InitSessionResponse, UploadDocumentResponse } from './client';
// Theme helpers, for hosts that render the capture engine or their own chrome
// with the same white-label appearance as a Flow.
export { resolveTheme, mergeAppearance, injectBrandFonts, flowThemeToEngineTheme, LIGHT_THEME, DARK_THEME } from './theme';
// Device Trust helpers used by the runner, for hosts with their own runner.
export {
  collectDeviceBinding, deviceBindingFrom, waitForForeground, deviceSignalsNeedsReload,
  DEVICE_SIGNALS_CAPABILITY, FLOW_RUNNER_CAPABILITIES,
} from './device-signals';
export type { DeviceBinding, ForegroundEnv } from './device-signals';
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
  FlowAppearance, AppearanceCapture, AppearanceColors, AppearanceTypography, AppearanceShape,
  AppearanceIcons, AppearanceLoader,
} from './theme';
export type { FlowCopy } from './copy';
