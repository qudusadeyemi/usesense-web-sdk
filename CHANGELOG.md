# Changelog

All notable changes to the UseSense Web SDK will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [4.2.0] - 2026-04-11

First public release since `1.0.0`, coordinated with UseSense iOS SDK `v4.2.0`
and the UseSense Watchtower edge function `v49+`. Ships the accumulated SDK
`v4.1.0` feature set (inline step-up PAD, auth migration) together with
MediaPipe FaceLandmarker integration, binding proof protocol updates, and a
cluster of UX and stability improvements that landed during the interim
development cycle.

### Added

#### Inline Step-Up PAD
- ✨ Flash Reflection challenge with three color flashes and facial reflection detection
- ✨ RMAS (Randomized Micro-Actions Sequence) challenge with three randomised actions and a 15-second timeout
- ✨ Client-side Suspicion Engine with four weighted signals (micro-tremor, temporal smoothness, brightness stability, sharpness pattern)
- ✨ New events: `step_up_triggered`, `step_up_completed`

#### MediaPipe Face Mesh
- 🎯 `@mediapipe/tasks-vision` integration for on-device face landmarks
- 🌐 Shared CDN at `cdn.usesense.ai` for MediaPipe asset delivery (model weights, WASM runtime, vision bundle)
- 📦 `MediaPipeModelInfo` constants exported from the SDK entry point so integrators can pin or verify the model version
- ⚡ `preloadMediaPipeAssets()` helper for eager loading before the session starts
- 🏷️ `loadFailed` flag on the client for fine-grained MediaPipe error handling
- 📤 `X-UseSense-MediaPipe-Model-Version` header stamped on upload requests so the backend can correlate the loaded model bytes with the captured signals
- 📌 Model bytes pinned to `mediapipe_face_landmarker@64184e22`

#### Server-Side Init
- ✨ Token exchange flow via `createUseSenseClient` with a server-minted `clientToken`, for reference image matching (KYC) and zero-credential-exposure deployments

#### Verification Package
- 🔐 Binding proof protocol `v3.0.28`: per-frame HMAC-SHA256 binding the mesh data to the JPEG hash, matching iOS SDK `v4.2.0` wire format byte-for-byte
- 📐 Verification package shape aligned with backend D7 scoring spec (`shapeParams`, `pose`, `depthPlausibility`, `geometricRatios`, `poseRatios2D`, `frameHash`, `meshDigest`, `bindingProof`, `frameIndex`)
- 🧮 Cross-frame consistency scoring (L2 distance between shape vectors) and preliminary score (weighted combo of depth plausibility and consistency)

#### Telemetry and Events
- 🧪 Suspicion debug logging to surface server-side data absence diagnostics
- 🆕 Error codes: `TOKEN_EXPIRED`, `TOKEN_ALREADY_USED`, `INSUFFICIENT_CREDITS`, `NONCE_MISMATCH`

### Changed

- 🔐 Auth migration: Supabase gateway headers (`apikey`, `Authorization: Bearer`) removed. SDK now communicates through the Cloudflare Worker proxy at `api.usesense.ai/v1`. Only `x-api-key`, `x-session-token`, `x-nonce`, and `x-environment` headers are sent.
- 🎨 Brand Manual v3.0 applied across SDK and demo: DeepSense Blue `#4F7CFF`, LiveSense Purple `#7C5CFC`, MatchSense Green `#00D4AA`, warm neutral palette. Default primary color updated, button radius changed from 12 to 10.
- 📱 Mobile responsive layout across the SDK capture engine and demo app
- 🎯 MatchSense score now shown as uniqueness (inverted from risk) in the demo UI
- 📝 Result page CTA renamed from "Get Started" to "Sign Up"
- 🔄 Pose extraction now uses the row-major matrix directly with no coordinate transform, standard ZYX order (`standard_zyx_v2`)

### Fixed

- 📷 Pose extraction gimbal-lock singular case (previously produced NaN near pitch ±90°)
- 📷 Coordinate system change-of-basis applied correctly for pose extraction
- 🔄 SDK overlay unmount and stale closure bug in the autostart flow
- 🌐 Font loading race condition in the SDK, plus default favicon fallback
- 🔑 `externalUserId` race condition when initialised from a URL query parameter
- 🖼️ Removed org logo from verification overlay to avoid conflicting with guidance UI
- 💰 Anonymous key prop removed from demo autostart flow (was inherited from the old auth model)
- 🧪 Mesh digest format reverted to server-compatible shape to match backend `computeMeshDigest` byte-for-byte

### Internal

- Package structure: monorepo under `packages/sdk` (publishable) and `packages/demo` (Next.js showcase), managed via npm workspaces
- Demo app deployed to Vercel with Web Analytics integration
- `/verify` lead-gen page with auto-start demo flow
- `/result` clean result page for Try UseSense flow
- Lead-gen data stored in sessionStorage and passed as session metadata

## [1.0.0] - 2026-02-19

### Added

#### Core SDK
- ✨ Initial release of @usesense/web-sdk
- 🎥 Video capture module with configurable FPS and duration
- 🎤 Audio capture module with risk-based policy support
- 🌐 Web integrity signal collection (comprehensive browser fingerprinting)
- 🔐 WebAuthn integration for optional credential binding
- 🎯 Step-up challenge support (head turn, follow dot, speak phrase)
- 📡 Complete API client for UseSense backend integration
- 🔄 Event-based architecture with comprehensive event types
- ⚡ TypeScript support with full type definitions
- 🎨 Customizable branding (colors, logos, fonts)

#### React Components
- 📱 `UseSenseVerification` - Main embedded verification component
- 🖼️ `IntroScreen` - Initial loading screen
- 🔑 `PermissionScreen` - Camera/microphone permission request
- 📹 `CaptureScreen` - Face framing and video capture
- 🎮 `ChallengeScreen` - Step-up challenges (dot tracking, head turn, speak)
- ⏳ `UploadingScreen` - Upload progress indicator
- ✅ `SuccessScreen` - Verification success
- ❌ `FailureScreen` - Verification failure with retry
- 🚫 `BlockedScreen` - Service unavailable

#### Features
- 🔄 Headless mode for programmatic control
- 🎨 Minimal, calm, trustworthy UI design
- 📊 Comprehensive metadata payload (timestamps, manifests, integrity signals)
- 🔐 Idempotency key support for API requests
- 🚨 Typed error handling with user-friendly messages
- 📈 Event callbacks for analytics and monitoring
- 🌍 Cross-browser compatibility (Chrome, Safari, Firefox, Edge)
- 📱 Mobile-responsive design
- ⚡ Graceful degradation for missing APIs

#### Demo Application
- 🎮 Complete Next.js demo application
- 📝 Enrollment flow demonstration
- 🔐 Authentication flow demonstration
- 🎨 Real-time branding customization
- 🐛 Debug console with event logs
- 📊 Web integrity signal inspector
- 🎯 Configuration options for testing

#### Documentation
- 📖 Comprehensive SDK README
- 📱 Demo application README
- 🔗 Integration guide with code examples
- 🏗️ Architecture overview
- 🔒 Security and privacy documentation
- 🐛 Troubleshooting guide
- 📝 TypeScript API documentation

### Security
- 🔒 No storage of video/audio in localStorage/IndexedDB
- 🔐 In-memory only capture data
- 🚨 Automatic cleanup of media streams
- 🔑 Environment variable support for credentials
- 🛡️ HTTPS requirement for production
- 🔐 Idempotency keys for all mutations

### Performance
- ⚡ Optimized video frame capture (15 FPS default)
- 📦 Minimal bundle size
- 🚀 Lazy loading support
- 🎯 Configurable upload limits
- ⏱️ Sub-5-second completion time

### Browser Support
- ✅ Chrome 80+
- ✅ Safari 14+
- ✅ Firefox 75+
- ✅ Edge 80+

### API Endpoints
- POST `/v1/sessions` - Create verification session
- POST `/v1/sessions/{id}/signals` - Upload capture signals
- POST `/v1/sessions/{id}/complete` - Complete session and get decision
- GET `/v1/sessions/{id}/status` - Poll session status

### Known Limitations
- ⚠️ No mobile native SDK (web only)
- ⚠️ No OS-level attestation (use WebAuthn as alternative)
- ⚠️ Liveness detection happens server-side (not in browser)
- ⚠️ Requires HTTPS in production (localhost OK for dev)

---

## [Unreleased]

### Planned Features
- 🔄 Automatic retry with exponential backoff
- 📊 Built-in analytics dashboard
- 🌐 Internationalization (i18n) support
- 🎨 Pre-built theme presets
- 📱 React Native SDK
- 🔐 Advanced WebAuthn features (conditional UI)
- 🎯 Enhanced challenge types
- 📈 Real-time quality feedback during capture
- 🔍 On-device face detection (optional)
- 🎥 H.264 hardware encoding support

---

## Version History

- **1.0.0** (2026-02-19): Initial release

---

## Migration Guides

### Migrating to 1.0.0

This is the initial release. No migration needed.

---

## Breaking Changes

None yet (initial release).

---

## Deprecations

None yet (initial release).

---

## Support

For questions about this changelog or the SDK:

- **Email**: support@usesense.com
- **Docs**: https://docs.usesense.com
- **GitHub**: https://github.com/usesense/web-sdk

---

**Note**: This changelog follows [semantic versioning](https://semver.org/). Breaking changes will increment the major version.
