# Sense Web SDK Demo

This is a demonstration Next.js application showcasing the integration of the @usesense/web-sdk for human verification flows.

## Features

- **Enrollment Flow**: First-time user registration with biometric capture
- **Authentication Flow**: Returning user verification against existing template
- **Customization**: Real-time branding customization (colors, logos)
- **Debug Console**: Live event monitoring and web integrity signal inspection
- **Configuration Options**: Test different audio modes, WebAuthn, and other SDK features

## Prerequisites

- Node.js 18+ or compatible JavaScript runtime
- A modern web browser (Chrome, Safari, Firefox, Edge)
- Camera access for testing verification flows

## Installation

1. Install dependencies:

```bash
npm install
# or
yarn install
# or
pnpm install
```

2. Set up environment variables (optional):

Create a `.env.local` file in the root directory:

```env
NEXT_PUBLIC_API_BASE_URL=https://api.usesense.com
NEXT_PUBLIC_TENANT_KEY=your-tenant-key-here
```

If not set, the demo will use sandbox mode with mock responses.

## Running the Demo

Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

### Enrollment Flow

1. Click the "Enrollment" tab
2. Enter an external user ID (your internal identifier)
3. Customize branding and options as desired
4. Click "Start Enrollment"
5. Grant camera (and optionally microphone) permissions
6. Follow the on-screen instructions
7. View the decision result and scores

### Authentication Flow

1. Click the "Authentication" tab
2. Enter the Identity ID from a previous enrollment
3. Customize branding as desired
4. Click "Start Authentication"
5. Complete the verification flow
6. View match scores and decision

### Debug Console

Click "Show Debug" to view:
- **Event Log**: Real-time events from the SDK (session created, capture started, etc.)
- **Web Integrity Signals**: Comprehensive browser fingerprint and environment data

## Demo Features

### Customization Options

- **Primary Color**: Change the brand color of the verification UI
- **Audio Mode**: 
  - `never`: No audio capture
  - `risk_based`: Audio captured when backend policy requires it
  - `always`: Always capture audio snippet
- **WebAuthn**: Enable platform authenticator binding for enhanced security

### Decision Types

The backend returns one of four decisions:

- **APPROVE**: User verified successfully
- **REJECT**: Verification failed
- **MANUAL_REVIEW**: Inconclusive, requires human review
- **STEP_UP_REQUIRED**: Additional verification steps needed

## Scores Explained

### Trust Score (0-100)
- Channel integrity and device trust
- Higher = more trusted environment

### Liveness Score (0-100)
- Likelihood that a real person is present
- Higher = stronger liveness signals

### MatchSense Risk Score (0-100)
- For enrollment: Risk of duplicate identity
- For authentication: Inverted match quality (lower = better match)

## Testing Tips

### Camera Issues

- **macOS Safari**: Check System Preferences > Security & Privacy > Camera
- **Chrome**: Visit chrome://settings/content/camera
- **Firefox**: Check browser permissions when prompted

### HTTPS Requirement

Some browsers require HTTPS for camera access. Next.js dev server uses HTTP by default. Options:

1. Use localhost (usually works without HTTPS)
2. Set up local HTTPS: https://nextjs.org/docs/pages/building-your-application/configuring/https

### Mobile Testing

To test on mobile devices:

1. Find your local IP: `ifconfig` (Mac/Linux) or `ipconfig` (Windows)
2. Start dev server: `npm run dev`
3. Access from mobile: `http://YOUR_IP:3000`
4. Ensure your mobile device and computer are on the same network

## Project Structure

```
/examples/web-demo/
├── src/
│   ├── app/
│   │   ├── layout.tsx           # Root layout
│   │   ├── page.tsx              # Main demo page
│   │   └── globals.css           # Global styles
│   └── components/
│       ├── EnrollmentDemo.tsx    # Enrollment flow demo
│       ├── AuthenticationDemo.tsx # Authentication flow demo
│       └── DebugView.tsx         # Debug console
├── package.json
├── tsconfig.json
├── next.config.js
└── README.md
```

## Integration Guide

This demo shows how to integrate the SDK into your own application:

### 1. Install the SDK

```bash
npm install @usesense/web-sdk
```

### 2. Create a Client

```typescript
import { createUseSenseClient } from '@usesense/web-sdk';

const client = createUseSenseClient({
  apiBaseUrl: 'https://api.usesense.com',
  tenantKey: 'your-tenant-key',
  environment: 'production',
  branding: {
    primaryColor: '#4F63F5',
    logoUrl: '/logo.png'
  }
});
```

### 3. Use the React Component

```tsx
import { UseSenseVerification } from '@usesense/web-sdk';

function MyApp() {
  return (
    <UseSenseVerification
      client={client}
      sessionType="enrollment"
      onComplete={(decision) => {
        console.log('Decision:', decision);
      }}
    />
  );
}
```

### 4. Handle Results

```typescript
onComplete={(decision) => {
  if (decision.decision === 'APPROVE') {
    // User verified successfully
    // Proceed with login, transaction, etc.
  } else {
    // Verification failed
    // Show error or alternative authentication method
  }
}}
```

## Building for Production

```bash
npm run build
npm run start
```

## Browser Compatibility

- ✅ Chrome 80+
- ✅ Safari 14+
- ✅ Firefox 75+
- ✅ Edge 80+

## Support

- **SDK Documentation**: See `/packages/web-sdk/README.md`
- **Sense Docs**: https://docs.usesense.com
- **Issues**: https://github.com/usesense/web-sdk/issues

## License

MIT © Sense
