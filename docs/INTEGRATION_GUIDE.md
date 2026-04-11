# UseSense Web SDK Integration Guide

This guide walks through integrating the UseSense Web SDK into your application step-by-step.

## Table of Contents

1. [Installation](#installation)
2. [Basic Setup](#basic-setup)
3. [Enrollment Flow](#enrollment-flow)
4. [Authentication Flow](#authentication-flow)
5. [Customization](#customization)
6. [Error Handling](#error-handling)
7. [Event Tracking](#event-tracking)
8. [Advanced Features](#advanced-features)
9. [Production Checklist](#production-checklist)
10. [Troubleshooting](#troubleshooting)

---

## Installation

### NPM

```bash
npm install @usesense/web-sdk
```

### Yarn

```bash
yarn add @usesense/web-sdk
```

### PNPM

```bash
pnpm add @usesense/web-sdk
```

---

## Basic Setup

### 1. Get Your Credentials

Sign up at [watchtower.usesense.ai](https://watchtower.usesense.ai) and obtain:

- **API Base URL**: `https://api.usesense.ai`
- **Tenant Key**: Your unique API key (treat this as a secret)

### 2. Create a Client Instance

```typescript
import { createUseSenseClient } from '@usesense/web-sdk';

const useSenseClient = createUseSenseClient({
  apiBaseUrl: process.env.NEXT_PUBLIC_USESENSE_API_URL!,
  tenantKey: process.env.NEXT_PUBLIC_USESENSE_TENANT_KEY!,
  environment: 'production',
  branding: {
    logoUrl: '/your-logo.png',
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
```

**⚠️ Security Note:** Never hardcode your tenant key. Use environment variables.

---

## Enrollment Flow

Enrollment creates a new biometric template for a user.

### React Component Approach

```tsx
import { UseSenseVerification } from '@usesense/web-sdk';

function EnrollmentPage() {
  const handleComplete = (decision) => {
    if (decision.decision === 'APPROVE') {
      // Save identity_id to your database
      const identityId = decision.identity_id;
      await saveUserIdentity(userId, identityId);
      
      // Redirect to success page
      router.push('/enrollment-success');
    } else {
      // Handle rejection
      showError('Enrollment failed. Please try again.');
    }
  };

  return (
    <UseSenseVerification
      client={useSenseClient}
      sessionType="enrollment"
      externalUserId={currentUser.id}
      metadata={{
        source: 'web_app',
        accountType: 'premium',
        timestamp: Date.now()
      }}
      onComplete={handleComplete}
      onError={(error) => {
        console.error('Enrollment error:', error);
      }}
    />
  );
}
```

### Headless Approach

```typescript
async function enrollUser() {
  try {
    // 1. Create session
    const session = await useSenseClient.startEnrollment({
      externalUserId: currentUser.id,
      metadata: { source: 'web_app' }
    });

    // 2. Run verification (captures video, collects signals, uploads)
    const decision = await useSenseClient.runVerificationSession({
      session_id: session.session_id,
      session_token: session.session_token
    });

    // 3. Handle result
    if (decision.decision === 'APPROVE') {
      await saveUserIdentity(currentUser.id, decision.identity_id);
      return { success: true, identityId: decision.identity_id };
    } else {
      return { success: false, reason: decision.reasons };
    }
  } catch (error) {
    console.error('Enrollment failed:', error);
    return { success: false, error };
  }
}
```

---

## Authentication Flow

Authentication verifies a returning user against their existing biometric template.

### React Component Approach

```tsx
import { UseSenseVerification } from '@usesense/web-sdk';

function LoginPage() {
  const [identityId, setIdentityId] = useState<string | null>(null);

  useEffect(() => {
    // Fetch identity_id from your database
    const loadIdentity = async () => {
      const user = await getCurrentUser();
      setIdentityId(user.useSenseIdentityId);
    };
    loadIdentity();
  }, []);

  const handleComplete = (decision) => {
    if (decision.decision === 'APPROVE') {
      // Log user in
      await createUserSession(currentUser);
      router.push('/dashboard');
    } else {
      // Authentication failed
      showError('Could not verify your identity. Please try another method.');
    }
  };

  if (!identityId) {
    return <div>Loading...</div>;
  }

  return (
    <UseSenseVerification
      client={useSenseClient}
      sessionType="authentication"
      identityId={identityId}
      metadata={{
        loginAttempt: true,
        ipAddress: userIp,
        timestamp: Date.now()
      }}
      onComplete={handleComplete}
      onError={(error) => {
        console.error('Authentication error:', error);
      }}
    />
  );
}
```

---

## Customization

### Branding

Match your brand identity:

```typescript
const client = createUseSenseClient({
  // ...
  branding: {
    logoUrl: '/logo.png',              // Your company logo
    primaryColor: '#FF6B6B',           // Your brand color
    buttonRadius: 16,                  // Custom button radius
    fontFamily: 'Inter, sans-serif'    // Your brand font
  }
});
```

### Audio Capture

Control when audio is collected:

```typescript
options: {
  audioEnabled: 'never',      // Never collect audio
  audioEnabled: 'risk_based', // Only when backend policy requires (default)
  audioEnabled: 'always'      // Always collect audio snippet
}
```

### Capture Settings

Adjust quality and performance:

```typescript
options: {
  captureDurationMs: 3000,  // Longer capture (default: 2500)
  targetFps: 20,            // Higher frame rate (default: 15)
  maxFrames: 60,            // More frames (default: 40)
  maxUploadSizeMb: 15       // Larger uploads (default: 10)
}
```

### WebAuthn

Add platform authenticator binding:

```typescript
options: {
  webAuthnEnabled: true  // Enable WebAuthn (default: false)
}
```

---

## Error Handling

### Handle All Error Scenarios

```tsx
function MyVerification() {
  const handleError = (error: UseSenseError) => {
    switch (error.code) {
      case 'CAMERA_PERMISSION_DENIED':
        showModal({
          title: 'Camera Access Required',
          message: 'Please enable camera access in your browser settings.',
          action: 'Open Settings'
        });
        break;

      case 'MIC_PERMISSION_DENIED':
        // Fallback to no-audio mode
        retryWithoutAudio();
        break;

      case 'NETWORK_ERROR':
        // Retry with exponential backoff
        scheduleRetry();
        break;

      case 'SESSION_EXPIRED':
        // Start fresh session
        restartVerification();
        break;

      case 'QUOTA_EXCEEDED':
        showModal({
          title: 'Service Unavailable',
          message: 'Verification is temporarily unavailable. Please try again later.'
        });
        break;

      case 'LOW_LIGHT':
        showGuidance('Please move to a brighter area');
        break;

      default:
        showError('Something went wrong. Please try again.');
    }
  };

  return (
    <UseSenseVerification
      client={client}
      sessionType="enrollment"
      onError={handleError}
    />
  );
}
```

---

## Event Tracking

### Monitor Verification Flow

```tsx
function MyVerification() {
  const handleEvent = (event: UseSenseEvent) => {
    // Send to analytics
    analytics.track('UseSense Event', {
      type: event.type,
      timestamp: event.timestamp,
      data: event.data
    });

    // Custom logic based on events
    switch (event.type) {
      case 'permissions_requested':
        setStatus('Requesting camera access...');
        break;

      case 'capture_started':
        setStatus('Capturing video...');
        break;

      case 'upload_started':
        setStatus('Uploading...');
        setProgress(0);
        break;

      case 'upload_progress':
        setProgress(event.data.percent);
        break;

      case 'decision_received':
        setStatus('Complete');
        logDecision(event.data);
        break;
    }
  };

  return (
    <UseSenseVerification
      client={client}
      sessionType="enrollment"
      onEvent={handleEvent}
    />
  );
}
```

### Available Events

- `session_created`
- `permissions_requested` / `permissions_granted` / `permissions_denied`
- `capture_started` / `frame_captured` / `capture_completed`
- `audio_record_started` / `audio_record_completed`
- `challenge_started` / `challenge_completed`
- `upload_started` / `upload_progress` / `upload_completed`
- `complete_started` / `decision_received`
- `error`

---

## Advanced Features

### Step-Up Authentication

Implement risk-based step-up:

```typescript
// Backend determines if step-up is needed based on risk score
const decision = await authenticateUser(identityId);

if (decision.decision === 'STEP_UP_REQUIRED') {
  // Trigger additional verification
  const stepUpDecision = await useSenseClient.startAuthentication({
    identityId,
    metadata: { stepUp: true, originalRisk: decision.risk_score }
  });
  
  // Backend may request challenge (head turn, follow dot, etc.)
}
```

### Session Polling

For long-running backend evaluations:

```typescript
const api = (client as any).api;

// Start polling
const decision = await api.pollUntilComplete(
  session.session_id,
  session.session_token,
  30,    // max attempts
  2000   // interval in ms
);
```

### Custom UI with Headless Mode

Build your own UI using headless mode:

```typescript
// Your custom UI components
function MyCustomUI() {
  const [step, setStep] = useState('intro');

  const runVerification = async () => {
    setStep('requesting_camera');
    
    const session = await client.startEnrollment({ ... });
    
    setStep('capturing');
    
    const decision = await client.runVerificationSession({
      session_id: session.session_id,
      session_token: session.session_token
    });
    
    setStep('complete');
    handleDecision(decision);
  };

  return (
    <div>
      {step === 'intro' && <IntroScreen onStart={runVerification} />}
      {step === 'capturing' && <CaptureProgress />}
      {step === 'complete' && <ResultScreen />}
    </div>
  );
}
```

---

## Production Checklist

### Before Going Live

- [ ] **Use Environment Variables**: Never hardcode API keys
- [ ] **HTTPS Only**: Ensure your site uses HTTPS (required for camera access)
- [ ] **Error Handling**: Implement comprehensive error handling
- [ ] **User Guidance**: Provide clear instructions for camera/mic access
- [ ] **Mobile Testing**: Test on iOS Safari, Android Chrome, etc.
- [ ] **Accessibility**: Ensure verification flow is accessible
- [ ] **Privacy Policy**: Update to mention biometric data collection
- [ ] **Rate Limiting**: Implement client-side rate limiting
- [ ] **Logging**: Set up proper logging for debugging
- [ ] **Monitoring**: Monitor verification success rates

### Security Best Practices

```typescript
// ✅ DO: Use environment variables
const client = createUseSenseClient({
  apiBaseUrl: process.env.NEXT_PUBLIC_USESENSE_API_URL!,
  tenantKey: process.env.NEXT_PUBLIC_USESENSE_TENANT_KEY!,
  environment: 'production'
});

// ❌ DON'T: Hardcode credentials
const client = createUseSenseClient({
  tenantKey: 'sk_live_abc123...' // NEVER DO THIS
});
```

### Performance Optimization

```typescript
// Lazy load SDK to reduce initial bundle size
const UseSenseVerification = dynamic(
  () => import('@usesense/web-sdk').then(mod => mod.UseSenseVerification),
  { ssr: false }
);
```

---

## Troubleshooting

### Camera Not Working

**Issue**: Camera permission denied or not detected

**Solutions**:
1. Check browser permissions (chrome://settings/content/camera)
2. Ensure HTTPS (localhost is OK for dev)
3. Check if another tab is using the camera
4. Verify camera is physically connected/enabled

### Upload Fails

**Issue**: Network error during signal upload

**Solutions**:
1. Check CORS configuration on backend
2. Verify API endpoint is correct
3. Ensure tenant key is valid
4. Check network connectivity
5. Review browser console for errors

### WebAuthn Not Working

**Issue**: WebAuthn credential creation fails

**Solutions**:
1. Ensure HTTPS (localhost is OK for dev)
2. Check if browser supports WebAuthn
3. Verify platform authenticator is available
4. Check if user has enabled biometrics in OS

### Poor Lighting Detection

**Issue**: Users with poor lighting get rejected

**Solutions**:
1. Implement lighting guidance before capture
2. Adjust backend liveness thresholds
3. Add retry with better lighting guidance
4. Consider allowing manual review for edge cases

### Mobile Safari Issues

**Issue**: Verification doesn't work on iOS Safari

**Solutions**:
1. Ensure `playsInline` attribute on video element (SDK handles this)
2. Check iOS version (Safari 14+ required)
3. Verify HTTPS or localhost
4. Test in normal mode (not Private Browsing)

---

## Support

- **Documentation**: https://watchtower.usesense.ai/developer-docs
- **Email**: support@usesense.ai
- **GitHub Issues**: https://github.com/qudusadeyemi/usesense-web-sdk/issues

---

## Additional Resources

- [SDK API Reference](./packages/web-sdk/README.md)
- [Demo Application](./examples/web-demo/README.md)
- [Security Best Practices](https://watchtower.usesense.ai/developer-docs/security)
- [Browser Compatibility Matrix](https://watchtower.usesense.ai/developer-docs/compatibility)

---

**Need help?** Contact support@usesense.ai.
