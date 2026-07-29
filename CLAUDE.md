# CLAUDE.md

## Project Overview
UseSense Web SDK -- TypeScript npm package for biometric identity verification.
Monorepo with two packages:
  - packages/sdk/ -- the publishable npm package (@usesense/web-sdk)
  - packages/demo/ -- demo app showcasing the SDK (Next.js)

## Architecture
- SDK is a pure client-side TypeScript library, no server-side code
- SDK calls the UseSense public API at /api/v1/* endpoints
- API base URL is configurable via createUseSenseClient({ apiKey, apiBaseUrl })
- Demo app is a Next.js app that imports the SDK via workspace link
- npm workspaces manage the monorepo

## SDK Public API
- UseSenseSDK -- imperative wrapper. `new UseSenseSDK({ apiBaseUrl })`, then
  `startWithSession(sessionData, target)` (Pattern A: session created by the
  integrator's backend), `start(target)` (Pattern B: SDK creates the session
  from a configured apiKey), or `startWithToken(...)` (Pattern C: server init).
  Events via `on('complete' | 'error' | 'phaseChange', handler)`.
- VerificationCaptureEngine -- React component for the capture UI.
- DocumentCapture, runFlow / FlowRunner -- document and Flow entry points.
- All types are exported from the package root
- SDK has zero runtime dependencies (peer deps: react, react-dom)

NOTE: `createUseSenseClient` and `UseSenseVerification` do NOT exist and never
did. They were documented here and in the public API docs, which is how a
customer came to report that "implementation with the npm package was not
possible after downloading the package". Verify a symbol against
`packages/sdk/dist/index.d.ts` before documenting it.

## Environment resolution
The environment is NOT inferred client-side. Precedence in the capture engines
is: explicit `environment` prop, then `sessionData.environment` (stamped by the
server from the API key that created the session), then `production`. Never
default this to sandbox: the engines send `?env=` on every upload, so guessing
wrong strands live sessions on an unresolvable lookup.

## Build
- SDK builds with tsup (ESM + CJS + .d.ts)
- Demo builds with Next.js

## Commands
```bash
npm install                    # install all workspace deps
npm run build:sdk              # build SDK only
npm run build:demo             # build demo (requires SDK built first)
npm run build                  # build both
npm run dev:sdk                # SDK watch mode
npm run dev:demo               # demo dev server
npm run test                   # run SDK tests
npm run typecheck              # type check SDK
npm run lint                   # lint SDK
```

## Coding Standards
- No em dashes in any text or comments
- TypeScript strict mode
- All public SDK functions must have JSDoc comments
- All public types must be exported from index.ts
- Semver versioning: breaking changes = major, features = minor, fixes = patch

## Git Conventions
- Branch naming: feature/, bugfix/, hotfix/, chore/
- Commit messages: conventional commits (feat:, fix:, chore:, docs:)
- All changes go through PRs; no direct pushes to main

## Testing
- SDK: Vitest
- Demo: N/A (visual testing)

## Deployment
- main -> production (npm publish + demo deploy)
- staging -> staging demo deploy
- PRs get Vercel preview deployments (demo)
