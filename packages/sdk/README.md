# @usesense/web-sdk

Production-quality Web SDK for UseSense human verification flows. Collects comprehensive signals (video frames, optional audio, web integrity heuristics, optional WebAuthn) and transmits them to the UseSense backend for evaluation.

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

### React Component (Recommended)

```tsx
import { createUseSenseClient, UseSenseVerification } from '@usesense/web-sdk';

const client = createUseSenseClient({
  apiBaseUrl: 'https://api.usesense.com',
  tenantKey: 'your-tenant-key',
  environment: 'production',
  branding: {
    logoUrl: 'https://yourdomain.com/logo.png',
    primaryColor: '#4F63F5',
    buttonRadius: 12
  },
  options: {
    audioEnabled: 'risk_based',
    captureDurationMs: 2500,
    targetFps: 15,
    maxFrames: 40
  }
});

function MyApp() {
  return (
    <UseSenseVerification
      client={client}
      sessionType="enrollment"
      externalUserId="user-123"
      onComplete={(decision) => {
        console.log('Verification complete:', decision);
      }}
      onError={(error) => {
        console.error('Verification error:', error);
      }}
      onEvent={(event) => {
        console.log('Event:', event.type, event.data);
      }}
    />
  );
}
```

### Headless Mode (Programmatic)

```typescript
import { createUseSenseClient } from '@usesense/web-sdk';

const client = createUseSenseClient({
  apiBaseUrl: 'https://api.usesense.com',
  tenantKey: 'your-tenant-key',
  environment: 'production'
});

// Start enrollment
const session = await client.startEnrollment({
  externalUserId: 'user-123',
  metadata: { source: 'web-app' }
});

// Run verification (captures video, collects signals, uploads)
const decision = await client.runVerificationSession({
  session_id: session.session_id,
  session_token: session.session_token
});

console.log('Decision:', decision.decision);
console.log('Trust Score:', decision.channel_trust_score);
console.log('Liveness Score:', decision.liveness_score);
```

## Configuration

### UseSenseConfig

```typescript
interface UseSenseConfig {
  apiBaseUrl: string;              // UseSense API endpoint
  tenantKey: string;               // Your tenant API key
  environment: 'sandbox' | 'production';
  
  branding?: {
    logoUrl?: string;              // Your company logo
    primaryColor?: string;         // Primary brand color (default: #4F63F5)
    buttonRadius?: number;         // Button border radius in px (default: 12)
    fontFamily?: string;           // Custom font family
  };
  
  options?: {
    audioEnabled?: 'never' | 'risk_based' | 'always';  // default: 'risk_based'
    stepUpPolicy?: 'risk_based' | 'always' | 'never';  // default: 'risk_based'
    captureDurationMs?: number;    // default: 2500
    targetFps?: number;            // default: 15
    maxFrames?: number;            // default: 40
    maxUploadSizeMb?: number;      // default: 10
    webAuthnEnabled?: boolean;     // default: false
  };
}
```

## API Methods

### createUseSenseClient(config)

Create a client instance.

### client.startEnrollment(params)

Start an enrollment session (first-time identity capture).

```typescript
const session = await client.startEnrollment({
  externalUserId: 'user-123',      // Optional: your internal user ID
  metadata: { source: 'mobile' }   // Optional: custom metadata
});
```

### client.startAuthentication(params)

Start an authentication session (verify against existing identity).

```typescript
const session = await client.startAuthentication({
  identityId: 'identity-abc',      // Required: UseSense identity ID
  metadata: { loginType: '2fa' }   // Optional: custom metadata
});
```

### client.runVerificationSession(params)

Run a complete verification session (headless mode).

```typescript
const decision = await client.runVerificationSession({
  session_id: session.session_id,
  session_token: session.session_token
});
```

## Events

The SDK emits events throughout the verification flow:

```typescript
<UseSenseVerification
  client={client}
  sessionType="enrollment"
  onEvent={(event) => {
    switch (event.type) {
      case 'session_created':
        console.log('Session ID:', event.data.session_id);
        break;
      case 'permissions_requested':
        console.log('Requesting:', event.data.type);
        break;
      case 'capture_started':
        console.log('Capturing video...');
        break;
      case 'frame_captured':
        console.log('Frame:', event.data.frame_index);
        break;
      case 'upload_completed':
        console.log('Upload complete');
        break;
      case 'decision_received':
        console.log('Decision:', event.data);
        break;
    }
  }}
/>
```

Event types:
- `session_created`
- `permissions_requested` / `permissions_granted` / `permissions_denied`
- `capture_started` / `frame_captured` / `capture_completed`
- `audio_record_started` / `audio_record_completed`
- `challenge_started` / `challenge_completed`
- `upload_started` / `upload_progress` / `upload_completed`
- `complete_started` / `decision_received`
- `error`

## Final Decision Object

```typescript
interface FinalDecisionObject {
  session_id: string;
  session_type: 'enrollment' | 'authentication';
  identity_id?: string;
  decision: 'APPROVE' | 'REJECT' | 'MANUAL_REVIEW' | 'STEP_UP_REQUIRED';
  channel_trust_score: number;   // 0-100
  liveness_score: number;         // 0-100
  dedupe_risk_score: number;      // 0-100
  reasons: string[];              // Why this decision was made
  rule_applied?: string;
  timestamp: string;
  signature: string;              // Backend signature for verification
}
```

## Error Handling

The SDK provides typed errors:

```typescript
import { UseSenseError } from '@usesense/web-sdk';

try {
  const decision = await client.runVerificationSession(params);
} catch (error) {
  if (error instanceof UseSenseError) {
    console.error('Error code:', error.code);
    console.error('Message:', error.message);
    
    switch (error.code) {
      case 'CAMERA_PERMISSION_DENIED':
        // Show instructions to enable camera
        break;
      case 'NETWORK_ERROR':
        // Retry logic
        break;
      case 'SESSION_EXPIRED':
        // Start new session
        break;
      case 'QUOTA_EXCEEDED':
        // Show "try later" message
        break;
    }
  }
}
```

Error codes:
- `CAMERA_PERMISSION_DENIED`
- `MIC_PERMISSION_DENIED`
- `NETWORK_ERROR`
- `SESSION_EXPIRED`
- `QUOTA_EXCEEDED`
- `USER_CANCELLED`
- `FACE_NOT_DETECTED`
- `LOW_LIGHT`
- `TIMEOUT`
- `UNKNOWN_ERROR`

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

```typescript
const client = createUseSenseClient({
  // ...
  options: {
    webAuthnEnabled: true
  }
});
```

### Web Integrity Signals

The SDK collects browser environment data for fraud detection:
- User agent, platform, languages
- Hardware capabilities (CPU cores, device memory)
- Screen properties and pixel ratio
- Media device counts (no labels without permission)
- WebGL fingerprint (renderer/vendor only)
- Performance timing
- WebDriver detection

**No PII is collected.** All signals are used for risk assessment by the UseSense backend.

### Content Security Policy (PDF document upload)

In Flows **document capture**, the subject can upload a PDF as well as scan with the camera. Since the SDK ships with **zero bundled dependencies**, it converts a PDF's first page to an image by **lazy-loading `pdfjs` from jsDelivr** the first time a PDF is selected (nothing is loaded for image uploads or camera capture). If your site enforces a strict Content-Security-Policy, allowlist the CDN so PDF conversion works:

```
script-src  https://cdn.jsdelivr.net;
worker-src  https://cdn.jsdelivr.net;    # pdfjs parses/renders on a Web Worker
connect-src https://cdn.jsdelivr.net;    # fetching the worker module
```

If the CDN is blocked (CSP or offline), PDF conversion **fails gracefully** — the subject is prompted to upload a photo (JPG/PNG) instead, and image uploads and camera capture are unaffected. No CSP change is needed if your flows only accept image uploads.

## Troubleshooting

### Camera Permission Issues

**Safari iOS:**
- Camera access requires HTTPS or localhost
- Check Settings > Safari > Camera

**Chrome:**
- Check site settings: chrome://settings/content/camera
- Ensure no other tab is using the camera

### Network Errors

- Verify `apiBaseUrl` is correct
- Check CORS configuration on your backend
- Ensure `tenantKey` is valid

### WebAuthn Not Working

- Requires HTTPS (except localhost)
- Platform authenticator must be available
- User may need to enable in browser settings

## Advanced Usage

### Custom Styling

Override CSS variables:

```css
.usesense-container {
  --usesense-primary: #4F63F5;
  --usesense-background: #F8F9FA;
  --usesense-surface: #FFFFFF;
  --usesense-text: #1A1A1A;
  --usesense-text-secondary: #6B7280;
  --usesense-border: #E5E7EB;
  --usesense-error: #EF4444;
  --usesense-success: #10B981;
}
```

### Event Tracking

```typescript
client.on('*', (event) => {
  // Send to analytics
  analytics.track('UseSense Event', {
    type: event.type,
    timestamp: event.timestamp,
    data: event.data
  });
});
```

## Support

- **Documentation:** https://docs.usesense.com
- **Email:** support@usesense.com
- **Issues:** https://github.com/usesense/web-sdk/issues

## License

MIT © UseSense
