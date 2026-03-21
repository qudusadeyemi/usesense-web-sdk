# Changelog

All notable changes to the UseSense Web SDK will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
