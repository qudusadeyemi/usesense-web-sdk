# @usesense/web-sdk

Production-quality Web SDK for Sense human verification flows. Collects comprehensive signals (video frames, optional audio, web integrity heuristics, optional WebAuthn) and transmits them to the Sense backend for evaluation.

## Features

- 🎥 **Video Capture**: High-quality frame capture with configurable FPS and duration
- 🎤 **Optional Audio**: Risk-based or always-on audio recording
- 🔒 **Web Integrity Heuristics**: Comprehensive browser fingerprinting and environment signals
- 🔐 **WebAuthn Support**: Optional credential binding for enhanced security
- 🎯 **Step-Up Challenges**: Head turn, follow dot, and speak phrase challenges
- 🎨 **Customizable Branding**: Logo, colors, and styling
- 📱 **Responsive Design**: Mobile-first, calm, and trustworthy UX
- 🚀 **TypeScript**: Full type safety and autocomplete
- ⚡ **Production Ready**: Error handling, retries, and idempotency

## Installation

```bash
npm install @usesense/web-sdk
# or
yarn add @usesense/web-sdk
# or
pnpm add @usesense/web-sdk
```

## Quick Start

There are two ways to integrate. Both keep your API key on your server.

- **Run a Flow** (recommended): your server starts a run of a Flow you built in the dashboard, and `flows.run` drives every step in the browser (consent, forms, documents, face capture, review).
- **Sessions**: a single face capture (enrollment, authentication or liveness) through `UseSenseSDK` or the `VerificationCaptureEngine` React component.

React 18 or 19 (`react` and `react-dom`) must be installed in your app; both entry points render with it.

## Run a Flow

**1. Your server starts the run** with your secret API key and returns `flowRun.id` and `sdkToken` to the page:

```bash
curl -X POST https://api.usesense.ai/v1/flow-runs \
  -H "x-api-key: sk_your_key" -H "content-type: application/json" \
  -d '{ "flowId": "YOUR_FLOW_ID", "subject": { "externalRef": "user-123" }, "mint_sdk_token": true }'
# 201 { "flowRun": { "id": "...", "state": "pending", ... }, "stepRuns": [], "sdkToken": "...", "expiresAt": "..." }
```

The token is bound to that one run and expires after 30 minutes (`sdk_token_ttl_seconds` sets it, 60 s to 24 h).

**2. The page runs it:**

```typescript
import { flows, FlowError } from '@usesense/web-sdk';

const { flowRunId, sdkToken } = await fetch('/api/start-verification').then((r) => r.json());

try {
  const result = await flows.run({ flowRunId, sdkToken });
  // result: { flowRunId, state, outcome }
  if (result.state === 'awaiting_review') showUnderReview();
  else showDone();
} catch (e) {
  if (e instanceof FlowError && e.code === 'token_expired') restartFromServer();
}
```

`flows.run` opens a full-screen overlay (pass `container` to mount it in your own element) and resolves when the run settles. Other options: `appearance`, `copy`, `displayName` (see White-labeling in the [repository README](https://github.com/qudusadeyemi/usesense-web-sdk#readme)), `onCancel` and `apiBaseUrl`.

**3. The result.** `FlowRunResult` is `{ flowRunId, state, outcome }`, where `outcome` is `'APPROVE' | 'REJECT' | 'MANUAL_REVIEW' | null`. `state` is one of:

| `state` | Meaning |
| --- | --- |
| `completed` | The run finished; `outcome` holds the Flow's outcome. |
| `awaiting_review` | Held for a human reviewer. The person has seen the "Under review" screen and is done. The final decision arrives later by webhook (`flow_run.completed`). |
| `cancelled` | The person cancelled. |
| `errored` | A step failed and the Flow ended in error. |
| `abandoned` | The run timed out without the person finishing. |

The client result is for your UI only. Decide on your server, from the `flow_run.completed` webhook or `GET /v1/flow-runs/:id` with your API key.

**4. Errors.** `flows.run` rejects with a `FlowError` whose `code` is one of:

| `code` | What to do |
| --- | --- |
| `token_expired`, `token_invalid` | Start a new run on your server and call `flows.run` again. |
| `network_unavailable` | Let the person retry when they are back online. |
| `permission_denied` | Camera access was refused; explain how to allow it. |
| `provider_unavailable` | A verification provider is down; retry later. |
| `unsupported_action` | The Flow uses a step this SDK version cannot show; upgrade the SDK. |
| `cancelled`, `invalid_input`, `unknown` | `invalid_input` is shown inline by the runner; treat the rest as a failed attempt. |

`serverCode` carries the server's own error code when there is one.

## Keep your API key off the device

For a single face capture, create the session on your server and hand the page a short-lived, single-use client token.

**1. Your server** calls `POST /v1/sessions/create-token`. Any API key works (`pk_` keys are live, `sk_` keys are sandbox); call it from your server so the key never reaches the browser:

```bash
curl -X POST https://api.usesense.ai/v1/sessions/create-token \
  -H "x-api-key: sk_your_key" -H "content-type: application/json" \
  -d '{ "session_type": "enrollment", "platform": "web", "external_user_id": "user-123" }'
# 201 { "client_token": "cli_tok_...", "expires_at": "..." }
```

`session_type` is `enrollment`, `authentication` (with `identity_id`) or `liveness`. The token must be exchanged within 10 minutes.

**2. The page** starts the capture with it:

```typescript
import { UseSenseSDK } from '@usesense/web-sdk';

const { client_token } = await fetch('/api/start-capture').then((r) => r.json());

const sdk = new UseSenseSDK({
  environment: 'sandbox', // match the key that created the token
  sessionType: 'enrollment',
  onResult: (result) => console.log(result.decision),
  onError: (error) => console.error(error),
});
await sdk.startWithToken(client_token, '#usesense'); // target is optional
```

Pass `environment` to match the key that created the token: without an `apiKey` the SDK defaults to `'sandbox'`, and that value is sent with every capture request.

Building your own UI? `exchangeToken` swaps the client token for the session data without mounting anything, ready for `VerificationCaptureEngine` or `sdk.startWithSession(sessionData)`:

```typescript
import { exchangeToken } from '@usesense/web-sdk';

const sessionData = await exchangeToken({ clientToken: client_token });
```

### Embedded in your page

`UseSenseSDK` mounts the capture UI into the target you pass to `start`, `startWithSession` or `startWithToken` (a CSS selector or an element), then `config.mountTo`, else a full-screen overlay. `sdk.mount(target)` re-mounts the current session elsewhere, and `sdk.destroy()` unmounts it and releases the camera.

In a React app, render the engine yourself with session data from your server (`POST /v1/sessions`) or from `exchangeToken`:

```tsx
import { VerificationCaptureEngine } from '@usesense/web-sdk';

<VerificationCaptureEngine
  sessionData={sessionData}
  sessionType="enrollment"
  onComplete={(result) => console.log(result.decision)}
  onError={(error) => console.error(error)}
  onCancel={() => closeModal()}
/>
```

The engine reads the environment from `sessionData.environment`; pass `environment` only to override it.

## Silent device check (Your KYC)

Keep your own KYC provider's web flow. Next to it, `deviceCheck()` sends Sense
the device's signals with **no UI, no camera and no permission prompt**. Sense
scores the device with the camera-free DeepSense engine and links the result to
your provider's result when it reaches your Your KYC connection.

1. **Your server** creates a check with your API key (never ship the key to the
   browser):

   ```bash
   curl -X POST https://api.usesense.ai/v1/device-checks \
     -H "x-api-key: sk_your_key" -H "content-type: application/json" \
     -d '{ "user_ref": "cust_88211", "platform": "web" }'
   # 201 { "deviceCheckId": "dc_...", "token": "dct_...", "nonce": "dn_...", "expiresAt": "..." }
   ```

2. **The page** runs the check around your provider, passing `deviceCheckId`
   into the provider's metadata so Sense can link the two (map it to the Sense
   field **Device check id** on the connection):

   ```typescript
   import { deviceCheck } from '@usesense/web-sdk';

   const { deviceCheckId, token, nonce } = await fetch('/api/start-kyc').then((r) => r.json());
   const check = deviceCheck({ deviceCheckId, token, nonce });

   // 1. Before your provider's SDK opens: integrity signals, no camera.
   const started = await check.start();
   if (!started.ok) console.warn('device check start:', started.error.code);

   // 2. Run your provider as usual, with deviceCheckId in its metadata.
   await provider.start({ metadata: { device_check_id: deviceCheckId } });

   // 3. After it closes: the camera inventory (labels are readable now that
   //    the provider holds the camera permission).
   await check.finish();
   ```

`start()` and `finish()` never reject. They resolve to a `DeviceCheckResult`:
`{ ok: true, received: true, status: 202 }`, or `{ ok: false, error: { code,
message, retryable } }`. The device is never told the score; read it on your
server with `GET /v1/device-checks/:id`.

| `error.code` | Meaning |
| --- | --- |
| `invalid_token`, `token_expired` | 401: wrong token, or more than 15 minutes after create. Create a new check. |
| `nonce_mismatch`, `invalid_input`, `invalid_phase` | 400: wrong nonce or body. |
| `already_started`, `not_started`, `already_finished` | 409: start once, then finish once, in that order. |
| `not_found` | 404: unknown device check id. |
| `unavailable`, `scoring_failed` | 503, after one automatic retry with backoff. |
| `timeout`, `network_error` | No response (each request is aborted after `timeoutMs`, default 10 s), after one retry. |
| `collection_failed` | The browser's signals could not be read; nothing was sent. |

Options: `apiBaseUrl` (alias `baseUrl`, default `https://api.usesense.ai`),
`timeoutMs`, `waitForForeground` (default `true`: a background tab reads as
headless), `foregroundTimeoutMs`, `retryDelayMs` and `fetcher`. On success,
`start()` also returns `deviceBinding`, the device fingerprint inputs, for
your own logs. It is not sent.

### Liveness only

`sessionType: 'liveness'` checks that a real person is in front of the camera,
and nothing else. No identity is created, no face is enrolled and no 1:N
duplicate search runs. A liveness session costs 1 credit. Do not pass an
`identityId`: `start()` throws before any network call (the server rejects it
with a 400).

Create it on your server with `POST /v1/sessions/create-token` and
`"session_type": "liveness"` (no `identity_id`), then start it in the page:

```ts
import { UseSenseSDK } from '@usesense/web-sdk';

const sdk = new UseSenseSDK({ environment: 'sandbox', sessionType: 'liveness' });
sdk.on('complete', (result) => console.log(result.decision));
await sdk.startWithToken(client_token, '#usesense');
```

## Configuration

### UseSenseSDKConfig

```typescript
interface UseSenseSDKConfig {
  apiKey?: string;                 // Only for start() (client-side session creation)
  apiBaseUrl?: string;             // default: https://api.usesense.ai/v1
  environment?: 'sandbox' | 'production';
  mountTo?: HTMLElement | null;    // Default mount target
  sessionType?: 'enrollment' | 'authentication' | 'liveness';
  identityId?: string;             // Required for authentication, not allowed for liveness
  externalUserId?: string;
  metadata?: Record<string, any>;

  primaryColor?: string;           // Legacy; prefer appearance
  logoUrl?: string;                // Legacy; prefer appearance
  displayName?: string;
  appearance?: FlowAppearance;     // White-label look, merged over the dashboard brand
  copy?: FlowCopy;                 // White-label strings (copy.capture)

  onResult?: (result: CaptureResult) => void;
  onError?: (error: string) => void;
  onPhaseChange?: (phase: CapturePhase, label: string) => void;

  antispoofOnDeviceEnabled?: boolean;
  guidedCaptureEnabled?: boolean;
  allowRetryOnReject?: boolean;
}
```

## API Methods

### new UseSenseSDK(config)

Create an instance. It needs React and react-dom 18+ at runtime.

### sdk.startWithToken(clientToken, target?)

Exchange a client token from `POST /v1/sessions/create-token` and mount the capture UI. The recommended way to start a session.

### sdk.startWithSession(sessionData, target?)

Mount the capture UI with session data your server created (`POST /v1/sessions`).

### sdk.start(target?)

Create the session in the browser with `config.apiKey`, then mount. This puts an API key in the page; prefer `startWithToken`.

### sdk.mount(target?), sdk.setBranding(branding), sdk.retry(), sdk.destroy()

Re-mount the current session, update `primaryColor`, `logoUrl`, `displayName`, `appearance` or `copy` in place, restart the capture, or tear everything down.

### flows.run(options)

Run a Flow. See [Run a Flow](#run-a-flow).

## Events

```typescript
sdk.on('complete', (result) => console.log(result.decision));
sdk.on('error', (error) => console.error(error));
sdk.on('phaseChange', (phase, label) => console.log(phase, label));
```

- `complete`: fired with a `CaptureResult` when the capture is decided (same as `onResult`)
- `error`: fired with an error message string (same as `onError`)
- `phaseChange`: fired with `(phase, label)` on every screen change, for example `camera-request`, `face-guide`, `challenge`, `uploading`

Remove a handler with `sdk.off(event, handler)`.

## Capture Result

```typescript
interface CaptureResult {
  session_id: string;
  session_type?: 'enrollment' | 'authentication' | 'liveness';
  decision: 'APPROVE' | 'REJECT' | 'MANUAL_REVIEW';
  identity_id?: string;
  channel_trust_score?: number;   // 0-100
  liveness_score?: number;        // 0-100
  dedupe_risk_score?: number;     // 0-100
  pillar_verdicts?: {
    channel_trust?: string | PillarVerdict;
    liveness?: string | PillarVerdict;
    dedupe?: string | PillarVerdict;
  };
  reasons?: string[];
  timestamp?: string;
}
```

As with Flows, use the result for your UI and make the decision on your server (`GET /v1/sessions/:id/status` or the `verification.completed` webhook).

## Error Handling

Session capture reports errors as a message string through `onError` and the `error` event; the engine shows its own retry and camera-error screens. `start`, `startWithToken` and `exchangeToken` reject with an `Error` when the session cannot be created or the token cannot be exchanged (expired, already used, wrong environment).

```typescript
try {
  await sdk.startWithToken(client_token);
} catch (e) {
  // Token expired or already used: ask your server for a new one.
}
```

Flows reject with a typed `FlowError`; see [Run a Flow](#run-a-flow).

## Browser Compatibility

| Browser | Version | Support |
|---------|---------|---------|
| Chrome  | 80+     | ✅ Full |
| Safari  | 14+     | ✅ Full |
| Firefox | 75+     | ✅ Full |
| Edge    | 80+     | ✅ Full |

**Required APIs:**
- `getUserMedia` (camera/microphone access)
- `MediaRecorder` (audio recording)
- `Canvas` (frame capture)
- `WebAuthn` (optional)

## Security & Privacy

### Data Handling

- Video/audio blobs are **never** stored in localStorage or IndexedDB
- All capture data is kept in-memory only
- Media tracks are released immediately after upload
- Requests include idempotency keys to prevent duplicate submissions

### WebAuthn

When enabled, WebAuthn provides:
- Session binding to prevent replay attacks
- Platform authenticator integration
- No biometric data leaves the device

WebAuthn signing is used by the `V4CaptureEngine` component when you pass a registered credential (`webauthnCredentialId`, `webauthnRpId`, `webauthnPublicKeySpki`); otherwise it signs with an ephemeral key.

### Web Integrity Signals

The SDK collects browser environment data for fraud detection:
- User agent, platform, languages
- Hardware capabilities (CPU cores, device memory)
- Screen properties and pixel ratio
- Media device counts (no labels without permission)
- WebGL fingerprint (renderer/vendor only)
- Performance timing
- WebDriver detection

**No PII is collected.** All signals are used for risk assessment by the Sense backend.

### Content Security Policy (PDF document upload)

In Flows **document capture**, the subject can upload a PDF as well as scan with the camera. Since the SDK ships with **zero bundled dependencies**, it converts a PDF's first page to an image by **lazy-loading `pdfjs` from jsDelivr** the first time a PDF is selected (nothing is loaded for image uploads or camera capture). If your site enforces a strict Content-Security-Policy, allowlist the CDN so PDF conversion works:

```
script-src  https://cdn.jsdelivr.net;
worker-src  https://cdn.jsdelivr.net;    # pdfjs parses/renders on a Web Worker
connect-src https://cdn.jsdelivr.net;    # fetching the worker module
```

If the CDN is blocked (CSP or offline), PDF conversion **fails gracefully**: the subject is prompted to upload a photo (JPG/PNG) instead, and image uploads and camera capture are unaffected. No CSP change is needed if your flows only accept image uploads.

## Troubleshooting

### Camera Permission Issues

**Safari iOS:**
- Camera access requires HTTPS or localhost
- Check Settings > Safari > Camera

**Chrome:**
- Check site settings: chrome://settings/content/camera
- Ensure no other tab is using the camera

### Network Errors

- Verify `apiBaseUrl` is correct (leave it unset for `https://api.usesense.ai`)
- A client token is single-use and expires 10 minutes after create-token; an SDK token expires with its run
- Make sure `environment` matches the API key that created the session or token

### WebAuthn Not Working

- Requires HTTPS (except localhost)
- Platform authenticator must be available
- User may need to enable in browser settings

## Advanced Usage

### Custom Styling

Pass `appearance` (colors, typography, shape, logo, loader) and `copy` to `UseSenseSDK`, `VerificationCaptureEngine` or `flows.run`. Code values are merged over the brand set in the dashboard, field by field. Full reference: [`docs/WHITE_LABEL.md`](https://github.com/qudusadeyemi/usesense-web-sdk/blob/main/docs/WHITE_LABEL.md).

```typescript
import { UseSenseSDK, type FlowAppearance } from '@usesense/web-sdk';

const appearance: FlowAppearance = { colors: { primary: '#E4002B' } };
const sdk = new UseSenseSDK({ environment: 'sandbox', appearance });
```

### Event Tracking

```typescript
sdk.on('phaseChange', (phase, label) => {
  analytics.track('UseSense Phase', { phase, label });
});
```

## Support

- **Guides:** https://docs.usesense.ai
- **API reference:** https://docs.usesense.ai/api
- **Email:** support@usesense.ai
- **Issues:** https://github.com/qudusadeyemi/usesense-web-sdk/issues

## License

MIT © Sense
