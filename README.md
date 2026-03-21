# UseSense Web SDK

Production-quality Web SDK for human verification flows with comprehensive signal collection for LiveSense and DeepSense integrity analysis.

## 🎯 Overview

UseSense provides a complete web-based identity verification solution that:

- **Captures high-quality biometric signals** (video frames, optional audio)
- **Collects web integrity heuristics** (browser fingerprint, device signals)
- **Supports step-up challenges** (head turn, follow dot, speak phrase)
- **Provides a calm, trustworthy UX** with minimal friction
- **Works across all modern browsers** with graceful degradation

## 📦 Packages

This repository contains:

### [@usesense/web-sdk](./packages/web-sdk)

The core SDK package that client applications integrate. Provides:

- React components for embedded verification flows
- Headless mode for programmatic control
- Comprehensive TypeScript types
- Event-based architecture
- Customizable branding

### [web-demo](./examples/web-demo)

A complete Next.js demo application showcasing:

- Enrollment flow (first-time registration)
- Authentication flow (returning user verification)
- Real-time customization and configuration
- Debug console with event logs and integrity signals

## 🚀 Quick Start

### For SDK Users

```bash
npm install @usesense/web-sdk
```

```tsx
import { createUseSenseClient, UseSenseVerification } from '@usesense/web-sdk';

const client = createUseSenseClient({
  apiBaseUrl: 'https://api.usesense.ai',
  organizationId: 'org_your_company',  // From UseSense dashboard
  tenantKey: 'your-tenant-key',
  environment: 'production'
});

function App() {
  return (
    <UseSenseVerification
      client={client}
      sessionType="enrollment"
      onComplete={(decision) => {
        console.log('Verified:', decision);
      }}
    />
  );
}
```

### For SDK Developers

```bash
# Install dependencies for all packages
npm install

# Build the SDK
cd packages/web-sdk
npm run build

# Run the demo
cd ../../examples/web-demo
npm run dev
```

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Client Application                      │
│  (Your fintech app, marketplace, social platform, etc.)     │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ Embeds
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                  @usesense/web-sdk                           │
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Video      │  │    Audio     │  │   Web        │      │
│  │   Capture    │  │   Capture    │  │   Integrity  │      │
│  │   Module     │  │   Module     │  │   Module     │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   WebAuthn   │  │  Challenge   │  │     API      │      │
│  │   Module     │  │   Module     │  │   Client     │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                               │
│  ┌─────────────────────────────────────────────────┐        │
│  │          React UI Components                     │        │
│  │  (Intro, Permissions, Capture, Success, etc.)   │        │
│  └─────────────────────────────────────────────────┘        │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ HTTPS POST
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                  UseSense Backend                            │
│                                                               │
│  • LiveSense: Liveness detection & spoof analysis            │
│  • DeepSense: Fraud detection & device trust                 │
│  • Identity matching (1:1 and 1:N)                           │
│  • Dedupe detection                                          │
│  • Risk-based policy engine                                  │
│  • Audit logs & compliance                                   │
└─────────────────────────────────────────────────────────────┘
```

## 🎨 Design Philosophy

UseSense is built with a **minimal, calm, and trustworthy** aesthetic:

- **Soft neutral backgrounds** (#F8F9FA)
- **Configurable primary colors** (default: #4F63F5)
- **Large touch targets** (min 48px height)
- **Clear, reassuring microcopy** (no fraud/AI/deepfake language)
- **Smooth transitions** and responsive feedback
- **Under 5 seconds** completion time

## 🏢 Multi-Tenant Architecture

UseSense provides **complete data isolation** between organizations:

### Organization-Level Isolation

Every verification session is scoped by:
- **Organization ID** - Your unique identifier
- **Environment** - Sandbox or Production

```typescript
const client = createUseSenseClient({
  apiBaseUrl: 'https://api.usesense.ai',
  organizationId: 'org_your_company',  // ← Complete isolation per org
  environment: 'sandbox',               // ← Separate sandbox/production data
  tenantKey: 'your-api-key'
});
```

### What's Isolated:

✅ **Sessions** - Each org has separate sessions  
✅ **Identities** - Face templates are org-specific  
✅ **Storage** - S3 files in org-specific folders  
✅ **Rekognition** - Face matching only within same org  
✅ **Dashboard** - Only see your organization's data

### Isolation Guarantees:

- ❌ Org A cannot access Org B's sessions
- ❌ Org A cannot authenticate against Org B's identities
- ❌ Rekognition never matches faces across organizations
- ❌ No data leakage between sandbox and production

**See:** [Multi-Tenancy Integration Notes](/MULTI_TENANCY_INTEGRATION_NOTES.md)

## 🔐 Security & Privacy

### What We Collect

- **Video frames**: Captured locally, transmitted via encrypted POST
- **Optional audio**: Only when required by backend policy
- **Web integrity signals**: Browser fingerprint (no PII)
- **Optional WebAuthn**: Platform authenticator binding

### What We Don't Do

- ❌ Store video/audio in localStorage or IndexedDB
- ❌ Send biometric data to third parties
- ❌ Access location, contacts, or other sensitive data
- ❌ Run evaluation or scoring in the browser

### Privacy Principles

- All capture data is kept **in-memory only**
- Media tracks are **released immediately** after upload
- Requests include **idempotency keys** to prevent duplicates
- No PII in web integrity signals (only device characteristics)

## 📊 Signals Collected

### LiveSense (Video/Audio)

- **Video frames**: 15 FPS for 2.5 seconds (configurable)
- **Frame metadata**: Timestamps, resolution, size
- **Optional audio snippet**: Short recording for voice liveness
- **Challenge responses**: Head turn, follow dot, speak phrase

### DeepSense-Web (Integrity Heuristics)

- **Browser signals**: User agent, platform, languages
- **Hardware**: CPU cores, device memory, screen properties
- **Security flags**: WebDriver detection, cookie status
- **Media devices**: Camera/mic counts (no labels without permission)
- **Performance**: Event loop lag, navigation timing
- **WebGL fingerprint**: Minimal renderer/vendor hash

## 🌐 Browser Compatibility

| Browser | Version | Support Level |
|---------|---------|---------------|
| Chrome  | 80+     | ✅ Full       |
| Safari  | 14+     | ✅ Full       |
| Firefox | 75+     | ✅ Full       |
| Edge    | 80+     | ✅ Full       |

**Required APIs:**
- `getUserMedia` (camera/microphone)
- `MediaRecorder` (audio capture)
- `Canvas` (frame extraction)
- `WebAuthn` (optional)

## 🔄 Session Flow

### Enrollment

```
1. Client creates session       → POST /v1/sessions
2. SDK requests camera access
3. SDK captures video frames
4. SDK collects web integrity
5. SDK uploads signals          → POST /v1/sessions/{id}/signals
6. SDK completes session        → POST /v1/sessions/{id}/complete
7. Backend returns decision     → { decision, scores, identity_id }
```

### Authentication

```
1. Client creates session       → POST /v1/sessions (with identity_id)
2. SDK requests camera access
3. SDK captures video frames
4. SDK collects web integrity
5. SDK uploads signals          → POST /v1/sessions/{id}/signals
6. Backend matches against template
7. SDK completes session        → POST /v1/sessions/{id}/complete
8. Backend returns decision     → { decision, match_score }
```

## 📈 Decision & Scores

### Decision Types

- **APPROVE**: User verified, proceed with action
- **REJECT**: Verification failed, deny access
- **MANUAL_REVIEW**: Inconclusive, queue for human review
- **STEP_UP_REQUIRED**: Trigger additional verification

### Scores (0-100)

- **channel_trust_score**: Device and browser integrity
- **liveness_score**: Confidence that user is present
- **dedupe_risk_score**: Risk of duplicate enrollment / match quality

## 🛠 Development

### Prerequisites

- Node.js 18+
- pnpm, npm, or yarn

### Setup

```bash
# Clone repository
git clone https://github.com/usesense/web-sdk.git
cd web-sdk

# Install dependencies
npm install

# Build SDK
cd packages/web-sdk
npm run build

# Run demo
cd ../../examples/web-demo
npm run dev
```

### Demo App Configuration

The demo app now supports **full multi-tenant testing**:

1. **Enter Your Organization ID**
   - Get it from your UseSense dashboard
   - Located in API Configuration panel

2. **Select Environment**
   - Sandbox: Test environment (7-day retention)
   - Production: Live environment (⚠️ use with caution)

3. **Run Verification**
   - Complete enrollment or authentication
   - Note the Session ID

4. **View in Dashboard**
   - Open your UseSense dashboard
   - Filter by organization ID and environment
   - Find your session and view detailed results

**See:** [Demo App Multi-Tenant Guide](/DEMO_APP_MULTI_TENANT_GUIDE.md)

### Testing

```bash
# Type check
cd packages/web-sdk
npm run type-check

# Run demo in dev mode
cd ../../examples/web-demo
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to test.

## 📚 Documentation

- **SDK README**: [packages/web-sdk/README.md](./packages/web-sdk/README.md)
- **Demo README**: [examples/web-demo/README.md](./examples/web-demo/README.md)
- **API Docs**: https://docs.usesense.com

## 🤝 Support

- **Email**: support@usesense.com
- **Documentation**: https://docs.usesense.com
- **Issues**: https://github.com/usesense/web-sdk/issues

## 📄 License

MIT © UseSense

---

## 🎯 Use Cases

### Fintech

- **Account opening**: KYC/AML compliance with biometric enrollment
- **Transaction approval**: Step-up auth for high-value payments
- **Account recovery**: Passwordless identity verification

### Marketplace

- **Seller verification**: Ensure authentic seller identities
- **Buyer protection**: Verify identity before payment
- **Age verification**: Confirm user meets requirements

### Social Platforms

- **Account creation**: Reduce fake accounts and bots
- **Content moderation**: Verify identity of content creators
- **Community safety**: Step-up verification for sensitive actions

### Healthcare

- **Patient authentication**: Secure access to medical records
- **Telemedicine**: Verify patient identity before consultation
- **Prescription fulfillment**: Confirm identity for controlled substances

### Enterprise

- **Employee authentication**: Passwordless login with biometrics
- **Privileged access**: Step-up verification for sensitive systems
- **Audit compliance**: Biometric proof of access

---

**Built with ❤️ by the UseSense team**
