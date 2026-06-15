/**
 * run.ts — vanilla wrapper around the FlowRunner React component.
 *
 * Mirrors the imperative pattern of UseSenseSDK (sdk.ts): mount a React root
 * onto a container, drive the action loop, resolve with the outcome, unmount.
 *
 * Sessions stay first-class — this module adds Flows as a new namespace and
 * does not touch any existing session API.
 */

import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { FlowRunner } from './FlowRunner';
import { FlowError, type FlowRunResult, type RunFlowOptions } from './types';

/**
 * Run an operator-authored Flow inside the host app. Resolves when the run
 * reaches a terminal state (completed / cancelled / errored / abandoned).
 * Rejects with a FlowError on transport / token / unsupported-action faults.
 */
export function run(options: RunFlowOptions): Promise<FlowRunResult> {
  if (!React || !React.createElement) {
    throw new FlowError('unknown', 'flows.run requires React. Install react + react-dom in your host app.');
  }
  if (!createRoot) {
    throw new FlowError('unknown', 'flows.run requires react-dom 18+. Install react-dom >= 18.');
  }

  return new Promise<FlowRunResult>((resolve, reject) => {
    let root: Root | null = null;
    let ownsContainer = false;
    let container = options.container ?? null;

    if (!container) {
      container = document.createElement('div');
      container.setAttribute('data-usesense-flow-runner', '');
      document.body.appendChild(container);
      ownsContainer = true;
    }

    const cleanup = () => {
      try { root?.unmount(); } catch { /* ignore */ }
      if (ownsContainer && container?.parentNode) container.parentNode.removeChild(container);
    };

    root = createRoot(container);
    root.render(
      React.createElement(FlowRunner, {
        options,
        onResult: (result) => { cleanup(); resolve(result); },
        onError: (error) => { cleanup(); reject(error); },
      })
    );
  });
}
