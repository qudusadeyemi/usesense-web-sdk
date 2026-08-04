# Changelog

All notable changes to the UseSense Web SDK will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [4.8.1] - 2026-08-04

### Fixed

- **"Verification is temporarily unavailable" for a document that was fine.** The
  document upload branch had two outcomes: `provider` -> "temporarily
  unavailable", everything else -> "please retake it". A file that arrived cut
  short took the first path, so a subject holding a perfectly good ID was told
  to wait out an outage that was not happening, and the retry re-sent identical
  bytes. The server now reports `reason: "incomplete"` and carries the
  instruction in `message`; neither old branch fits it, since nothing upstream
  is wrong and a retake changes nothing. Adds the third branch and a
  `documentIncomplete` copy key. `too_large` now also prefers the server's
  message, which is the only place the exceeded limit is known.

  Note: the corruption that produced this in production was server-side and is
  already fixed. This release only changes what the subject is told.

## [4.8.0] - 2026-07-29

### Added

- ✨ **The capture screen is now themeable.** `VerificationCaptureEngine` accepts a `theme` prop (`EngineTheme`, exported from the package root) covering background, foreground, muted, card and border colours, the primary foreground, success/destructive/warning, display and body fonts, and the light-mode surfaces used by the intro and result screens. Every token falls back to the palette that shipped before, so omitting `theme` renders exactly as it did.

### Fixed

- 🐛 **White-labelling no longer stops at the capture screen.** `FlowAppearance` covers colours, typography, shape, logo, background, icons and loader, but none of it reached the face capture step: `FlowRunner` passed a single `primaryColor` and the engine ignored the flow theme entirely. A fully white-labelled flow still handed the subject an unbranded dark screen at the step they look at most. The resolved theme is now mapped onto the engine.
- 🐛 `FlowRunner` now forwards `logoUrl` and `displayName` to the capture engine. It never had.
- 🐛 In dark mode, the engine's intro and result screens followed a hardcoded light surface and flashed white mid-flow. They now track the dark palette.

### Known gaps

- `icons`, `loader`, `shape` (radius and button style) and `background.imageUrl` from `FlowAppearance` are not yet mapped onto the capture screen. Colour, typography and the light/dark surfaces are.
- Sessions must pass `theme` explicitly. Dashboard-configured appearance is applied automatically for Flows only.

## [4.7.0] - 2026-07-29

### Fixed

- 🐛 **The capture environment no longer defaults to sandbox.** `VerificationCaptureEngine` did `environmentProp ?? 'sandbox'` while its published type said the environment was "inferred from the API key prefix". No inference existed. Because the engine sends `?env=` on every upload, a production session mounted without an explicit prop had its signals looked up in the sandbox scope and rejected, and the run rendered a "Sandbox" badge over live traffic. Precedence is now: explicit prop, then `sessionData.environment` (stamped by the server at session creation), then `production`. `StraightLineCaptureEngine` had the same default and is fixed with it.
- 🐛 **Upload and completion failures now surface.** On failure the engine called `onError` but never left the `uploading` phase, so the UI sat on "Almost done" indefinitely while only the host was notified. There was no error phase beyond `camera-error`.

### Added

- ✨ `failed` capture phase: a terminal state for post-capture failures, with a message and a retry action.
- ✨ `CaptureSessionData.environment`, the environment the server recorded for the session. Optional for wire compatibility with older backends; the capture engines prefer it over any local default. Pass the session body from `POST /v1/sessions` through unchanged so the SDK never has to guess.

### Changed

- ⬆️ React 19 is now an accepted peer dependency (`^18.0.0 || ^19.0.0`). `^18.0.0` alone made the package uninstallable on a React 19 app.

## [4.6.0] - 2026-06-27

### Changed

- 🎨 Rebranded front-facing copy from UseSense to Sense.

## [4.5.0] - 2026-06-27

### Added

- ✨ **White-labeling.** `FlowAppearance` (full color palette + dark-mode overrides, typography, shape/button style, logo, background, custom icons/illustrations, and loader) plus `FlowCopy` (every subject-facing string and privacy disclosure) overrides on `runFlow`, merged SDK-init > dashboard org settings > built-in default. Exported from the package root; see `docs/WHITE_LABEL.md`.
- 🎨 Hosted-run-page parity for the flow runner: brand theme, dark mode, bundled brand fonts, branded loaders, and the id_number step.

### Fixed

- Server-configured `typography.fontCss` is now injected (was read from SDK-init only); blank color overrides fall back instead of clobbering; `background.color` applies in light mode only; a blank copy override falls through to the server value instead of the built-in default.

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
