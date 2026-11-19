/**
 * The run's brand with the developer's settings first (BRAND-v1: code beats
 * the dashboard). The runner's frame, header, footer and loading screens read
 * the flat `logo_url` / `display_name`; taking them straight from the run
 * view showed the operator's dashboard logo and name even when the developer
 * passed their own `appearance.logo` and name.
 */
import type { FlowRunView, RunFlowOptions } from './types';

export type RunBranding = FlowRunView['branding'];

export function codeFirstBranding(server: RunBranding, options: Pick<RunFlowOptions, 'appearance' | 'displayName'>): RunBranding {
  const noLogo = options.appearance?.logo?.placement === 'none';
  const logo = options.appearance?.logo?.url?.trim() || null;
  const name = options.displayName?.trim() || null;
  if (!logo && !name && !noLogo) return server;
  return {
    display_name: name ?? server?.display_name ?? '',
    // placement 'none' from code means no logo, as on the capture screens.
    logo_url: noLogo ? null : logo ?? server?.logo_url ?? null,
    primary_color: server?.primary_color ?? '',
    redirect_url: server?.redirect_url ?? null,
    ...(server?.appearance ? { appearance: server.appearance } : {}),
    ...(server?.copy ? { copy: server.copy } : {}),
  };
}
