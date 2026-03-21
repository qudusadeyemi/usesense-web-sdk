# UseSense iOS SDK — Technical Design Specification

**Version:** 1.17.7  
**Date:** March 7, 2026  
**Platform:** iOS (Swift / SwiftUI)  
**Min Deployment Target:** iOS 16.0  
**Xcode:** 16+  
**Swift:** 5.9+  
**Reference Web SDK:** `/src/app/lib/usesense-sdk/`  
**Backend Endpoint:** `https://api.usesense.ai/functions/v1/make-server-fc4cf30d`

---

## Table of Contents

1. [Overview & Architecture](#1-overview--architecture)
2. [Logo & Brand Assets](#2-logo--brand-assets)
3. [Color System](#3-color-system)
4. [Typography](#4-typography)
5. [Layout & Responsive](#5-layout--responsive)
6. [Component Specifications](#6-component-specifications)
7. [Screen Designs](#7-screen-designs)
8. [Animations & Transitions](#8-animations--transitions)
9. [Image Quality System](#9-image-quality-system)
10. [Capture Pipeline](#10-capture-pipeline)
11. [API & Auth Layer](#11-api--auth-layer)
12. [Security Requirements](#12-security-requirements)
13. [Type Definitions (Swift)](#13-type-definitions-swift)
14. [Demo App Specification](#14-demo-app-specification)

---

## 1. Overview & Architecture

### 1.1 SDK Distribution

The iOS SDK should be distributed as:
- **Swift Package (SPM):** Primary distribution via Swift Package Manager
- **CocoaPods:** Secondary support via `.podspec`
- **XCFramework:** Pre-built binary for manual integration

Module name: `UseSenseSDK`

### 1.2 Session Lifecycle

The SDK follows a four-step session lifecycle against the UseSense backend:

```
1. CREATE  ──  POST /v1/sessions
2. CAPTURE ──  Two-phase: baseline + per-step challenge
3. UPLOAD  ──  POST /v1/sessions/{id}/signals (multipart/form-data)
4. COMPLETE ── POST /v1/sessions/{id}/complete → RedactedDecisionObject
```

```swift
// 1. CREATE — POST /v1/sessions
let session = try await client.startEnrollment(
    externalUserId: "user-123"
)
// Returns: session_id, session_token, nonce, policy, upload config

// 2. CAPTURE — Two-phase: baseline + challenge
let frames = try await captureEngine.runTwoPhaseCapture(
    uploadConfig: session.upload,
    challengeSpec: session.policy.challenge
)

// 3. UPLOAD — POST /v1/sessions/{id}/signals
try await api.uploadSignals(
    sessionId: session.sessionId,
    sessionToken: session.sessionToken,
    frames: frames,
    metadata: metadata
)

// 4. COMPLETE — POST /v1/sessions/{id}/complete
let decision = try await api.completeSession(
    sessionId: session.sessionId,
    sessionToken: session.sessionToken
)
// Returns: RedactedDecisionObject (APPROVE | REJECT | MANUAL_REVIEW)
```

### 1.3 Screen Flow (State Machine)

```
IntroScreen (loading spinner)
    | session created
    v
PermissionScreen (camera)
    | granted
    v
PermissionScreen (microphone)  <-- only if policy.requires_audio
    | granted
    v
CaptureScreen (preview + quality analysis)
    | 1.5s auto-advance
    |--- If challenge required --> ChallengeScreen
    |--- If no challenge       --> finishVerification()
    v
ChallengeScreen
    |-- Instructions phase (modal overlay, blocks until user taps "Got it")
    |-- Face Guide phase (oval overlay, blocks until user taps "My face is ready")
    |-- Baseline phase (2000ms, ~30% of frame budget)
    |-- Countdown phase (3-2-1, 1000ms each step)
    |-- Challenge phase (head_turn | follow_dot | speak_phrase)
    v
UploadingScreen (spinner + optional progress bar)
    | decision received
    v
SuccessScreen | DeniedScreen | SuccessScreen(manual_review)
    | user taps "Continue"
    v
--> returns RedactedDecisionObject to host app
```

### 1.4 Two-Phase Capture Pattern

| Phase | Duration | Frame Budget | UI Overlay |
|-------|----------|-------------|------------|
| Instructions | User-gated (tap to dismiss) | 0 frames | Modal with challenge type explanation |
| Face Guide | User-gated (tap to dismiss) | 0 frames | Oval cutout with dashed border + pulse animation |
| Baseline | 2000ms | ~30% of max_frames | Subtle oval border, "Keep still" text |
| Countdown | 3000ms (3 x 1000ms) | Continues capturing | 3-2-1 pop animation with indigo text |
| Challenge | Server-spec-driven | ~70% of max_frames | Challenge-specific overlay (dot/arrow/phrase) |

> **CRITICAL: No Frame Mirroring on Capture**  
> Captured frames MUST be raw, non-mirrored. The camera preview CAN be mirrored (standard iOS front-camera behavior via `AVCaptureConnection.isVideoMirrored`), but the actual JPEG frames sent to the backend MUST NOT have any horizontal flip. The backend's pose analysis (AWS Rekognition) expects raw camera orientation.

### 1.5 SwiftUI Integration Model

The SDK exposes a SwiftUI `View` that the host app presents modally:

```swift
import UseSenseSDK

struct ContentView: View {
    @State private var showVerification = false
    
    var body: some View {
        Button("Verify Identity") {
            showVerification = true
        }
        .fullScreenCover(isPresented: $showVerification) {
            UseSenseVerificationView(
                client: useSenseClient,
                sessionType: .enrollment,
                externalUserId: "user-123",
                onComplete: { decision in
                    print("Decision: \(decision.decision)")
                    showVerification = false
                },
                onError: { error in
                    print("Error: \(error.code)")
                    showVerification = false
                }
            )
        }
    }
}
```

---

## 2. Logo & Brand Assets

### 2.1 Logo Construction

The UseSense logo is a rounded-rectangle icon containing a shield with a biometric eye scanner and a green checkmark badge.

**SVG source (convert to PDF vector asset for Xcode Asset Catalog):**

```xml
<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <!-- Background: rounded rect with gradient -->
  <defs>
    <linearGradient id="logoBg" x1="0" y1="0" x2="64" y2="64">
      <stop offset="0%" stop-color="#4F63F5"/>
      <stop offset="100%" stop-color="#4F46E5"/>
    </linearGradient>
  </defs>
  <rect width="64" height="64" rx="16" fill="url(#logoBg)"/>

  <!-- Shield outline -->
  <path d="M32 12L18 19V31C18 40.5 24 48.5 32 52C40 48.5 46 40.5 46 31V19L32 12Z"
        fill="white" fill-opacity="0.2"
        stroke="white" stroke-width="2" stroke-linejoin="round"/>

  <!-- Biometric eye: outer ring -->
  <circle cx="32" cy="30" r="8" stroke="white" stroke-width="2" fill="none"/>
  <!-- Biometric eye: inner dot (iris) -->
  <circle cx="32" cy="30" r="3" fill="white"/>

  <!-- Scan crosshair lines (60% opacity) -->
  <line x1="24" y1="30" x2="20" y2="30" stroke="white" stroke-width="1.5"
        stroke-linecap="round" opacity="0.6"/>
  <line x1="40" y1="30" x2="44" y2="30" stroke="white" stroke-width="1.5"
        stroke-linecap="round" opacity="0.6"/>
  <line x1="32" y1="22" x2="32" y2="18" stroke="white" stroke-width="1.5"
        stroke-linecap="round" opacity="0.6"/>
  <line x1="32" y1="38" x2="32" y2="42" stroke="white" stroke-width="1.5"
        stroke-linecap="round" opacity="0.6"/>

  <!-- Success checkmark badge (bottom-right) -->
  <circle cx="44" cy="44" r="8" fill="#10B981" stroke="white" stroke-width="2"/>
  <path d="M40 44L43 47L48 41" stroke="white" stroke-width="2"
        stroke-linecap="round" stroke-linejoin="round"/>
</svg>
```

### 2.2 Logo Specifications

| Asset | Spec | Notes |
|-------|------|-------|
| Logo icon base | 64x64pt, corner radius 16pt | Gradient: `#4F63F5` to `#4F46E5` at 135 degrees |
| Shield outline | 2pt stroke, white | Path centered in icon |
| Biometric eye outer | 8pt radius circle, 2pt stroke | White stroke, no fill, centered at ~47% height |
| Biometric eye inner | 3pt radius circle | White fill (iris dot) |
| Scan crosshair lines | 1.5pt stroke, white, 60% opacity | 4 lines extending from eye ring outward |
| Success badge | 8pt radius green circle | `#10B981` fill, 2pt white stroke, bottom-right |
| Checkmark path | 2pt stroke, white | Inside badge circle |
| Clear space | Minimum 8pt on all sides | No other elements within clear space |
| Minimum display size | 24pt (icon-only), 32pt (with text) | Below this, legibility degrades |

### 2.3 Logo Text Lockup

Horizontal layout:

```
[Icon 36-64pt]  [14pt gap]  UseSense        (22pt, W700, primary text color)
                            iOS SDK          (12pt, W500, secondary text color)
```

- Light background: text `#1A1A1A`, subtitle `#6B7280`
- Dark background: text `#FFFFFF`, subtitle `rgba(255,255,255,0.7)`

### 2.4 Asset Catalog

Provide the logo in the following formats for the Xcode Asset Catalog:

| Asset Name | Formats | Sizes |
|-----------|---------|-------|
| `usesense_logo` | PDF (vector, single-scale) | Universal |
| `usesense_logo_icon` | PDF (vector, single-scale) | Universal |
| App icon (demo app) | PNG | 1024x1024 (App Store), auto-generated 2x/3x |

---

## 3. Color System

### CRITICAL COLOR RULE

> The **indigo guidance theme** applies ONLY to quality indicators, capture-screen warnings, challenge dots, and challenge-screen quality banners. **Outcome screens MUST use their original semantic colors:**
> - Red (`#EF4444`) for failure/error
> - Emerald green (`#10B981`) for success
> - Amber (`#F59E0B`) for manual review

### 3.1 Brand & Primary Colors

| Name | Hex | SwiftUI | Usage |
|------|-----|---------|-------|
| Primary | `#4F63F5` | `Color(red: 0.31, green: 0.39, blue: 0.96)` | Buttons, progress bars, links |
| Primary Dark | `#4F46E5` | `Color(red: 0.31, green: 0.27, blue: 0.90)` | Pressed states, countdown text, instruction CTA |
| Primary Light | `#6366F1` | `Color(red: 0.39, green: 0.40, blue: 0.95)` | Challenge dot fill, phase badges |

### 3.2 Indigo Guidance Theme (Quality + Challenge UI ONLY)

| Name | Value | SwiftUI | Usage |
|------|-------|---------|-------|
| Critical | `#7C3AED` @ 90% | `Color(.sRGB, red: 0.49, green: 0.23, blue: 0.93, opacity: 0.9)` | Critical quality warnings |
| Warning | `#A78BFA` @ 90% | `Color(.sRGB, red: 0.65, green: 0.55, blue: 0.98, opacity: 0.9)` | Moderate quality issues |
| Info | `#6366F1` @ 90% | `Color(.sRGB, red: 0.39, green: 0.40, blue: 0.95, opacity: 0.9)` | Quality-good indicator |
| Critical Banner BG | `#7C3AED` @ 10% | `.opacity(0.1)` | Banner background (poor) |
| Warning Banner BG | `#A78BFA` @ 10% | `.opacity(0.1)` | Banner background (acceptable) |
| Critical Banner Text | `#6D28D9` | `Color(red: 0.43, green: 0.16, blue: 0.85)` | Text when poor |
| Warning Banner Text | `#7C3AED` | `Color(red: 0.49, green: 0.23, blue: 0.93)` | Text when acceptable |
| Critical Banner Border | `#7C3AED` @ 20% | `.opacity(0.2)` | Border for poor banner |
| Warning Banner Border | `#A78BFA` @ 20% | `.opacity(0.2)` | Border for acceptable banner |
| Critical Glow | `#7C3AED` @ 60% | `.shadow(color:radius:)` | Video border glow (poor) |
| Acceptable Glow | `#A78BFA` @ 50% | `.shadow(color:radius:)` | Video border glow (acceptable) |

### 3.3 Semantic Outcome Colors (Outcome Screens ONLY)

| Name | Hex | SwiftUI | Usage |
|------|-----|---------|-------|
| Success / Approve | `#10B981` | `Color(red: 0.06, green: 0.73, blue: 0.51)` | SuccessScreen icon |
| Error / Reject | `#EF4444` | `Color(red: 0.94, green: 0.27, blue: 0.27)` | FailureScreen, DeniedScreen icon |
| Manual Review | `#F59E0B` | `Color(red: 0.96, green: 0.62, blue: 0.04)` | Under Review icon |

### 3.4 Neutral Palette

| Name | Hex | SwiftUI | Usage |
|------|-----|---------|-------|
| Background | `#F8F9FA` | `Color(red: 0.97, green: 0.98, blue: 0.98)` | Container background |
| Surface | `#FFFFFF` | `.white` | Card background |
| Text Primary | `#1A1A1A` | `Color(red: 0.10, green: 0.10, blue: 0.10)` | Titles |
| Text Secondary | `#6B7280` | `Color(red: 0.42, green: 0.45, blue: 0.50)` | Subtitles |
| Border | `#E5E7EB` | `Color(red: 0.90, green: 0.91, blue: 0.92)` | Dividers, borders |
| Video BG | `#000000` | `.black` | Camera preview background |

### 3.5 Challenge-Specific Colors

| Element | Value | Notes |
|---------|-------|-------|
| Challenge dot fill | `#6366F1` | Indigo, matches Primary Light |
| Challenge dot border | `#FFFFFF`, 2pt | White ring around dot |
| Challenge dot glow | `rgba(99, 102, 241, 0.5)` | Shadow radius ~6pt, spread ~4pt |
| Direction arrow circle | `LinearGradient(colors: [#4F46E5, #6366F1], startPoint: .topLeading, endPoint: .bottomTrailing)` | For head_turn |
| Direction arrow circle (center) | `LinearGradient(colors: [#6366F1, #8B5CF6], ...)` | Lighter variant for "center" |
| Direction arrow glow | `rgba(99, 102, 241, 0.5)` | Shadow radius ~15pt |
| Countdown overlay | `rgba(0, 0, 0, 0.4)` | `Color.black.opacity(0.4)` |
| Countdown circle | `rgba(255, 255, 255, 0.95)` | `Color.white.opacity(0.95)` |
| Countdown number | `#4F46E5` | Primary Dark |
| Countdown label BG | `rgba(0, 0, 0, 0.6)` | "Get ready..." pill |
| Face guide overlay mask | `radial-gradient ellipse 55% 42% at center` | Implemented via `Canvas` + mask |
| Face guide dashed border | `rgba(255, 255, 255, 0.8)`, 3pt dashed | `StrokeStyle(lineWidth: 3, dash: [8, 6])` |
| Face guide button | `#4F46E5` fill, white text | "My face is ready" |
| Instructions backdrop | `rgba(0, 0, 0, 0.75)` | `Color.black.opacity(0.75)` |
| Instructions modal | `#FFFFFF`, 16pt radius | Centered card |
| Instructions icon circle | `#E0E7FF` bg, `#4F46E5` icon | 48pt circle |
| Instructions title | `#1E293B` | |
| Instructions body | `#64748B` | |
| Instructions CTA | `#4F46E5` fill, white text | |

### 3.6 Swift Color Extension

```swift
extension Color {
    enum UseSense {
        static let primary = Color(red: 0.31, green: 0.39, blue: 0.96)
        static let primaryDark = Color(red: 0.31, green: 0.27, blue: 0.90)
        static let primaryLight = Color(red: 0.39, green: 0.40, blue: 0.95)
        
        static let success = Color(red: 0.06, green: 0.73, blue: 0.51)
        static let error = Color(red: 0.94, green: 0.27, blue: 0.27)
        static let manualReview = Color(red: 0.96, green: 0.62, blue: 0.04)
        
        static let background = Color(red: 0.97, green: 0.98, blue: 0.98)
        static let surface = Color.white
        static let textPrimary = Color(red: 0.10, green: 0.10, blue: 0.10)
        static let textSecondary = Color(red: 0.42, green: 0.45, blue: 0.50)
        static let border = Color(red: 0.90, green: 0.91, blue: 0.92)
        
        static let qualityCritical = Color(red: 0.49, green: 0.23, blue: 0.93)
        static let qualityWarning = Color(red: 0.65, green: 0.55, blue: 0.98)
        static let qualityInfo = Color(red: 0.39, green: 0.40, blue: 0.95)
        static let criticalBannerText = Color(red: 0.43, green: 0.16, blue: 0.85)
        static let warningBannerText = Color(red: 0.49, green: 0.23, blue: 0.93)
        
        static let challengeDot = Color(red: 0.39, green: 0.40, blue: 0.95)
        static let instructionIconBg = Color(red: 0.88, green: 0.91, blue: 1.0)
        static let instructionTitle = Color(red: 0.12, green: 0.16, blue: 0.23)
        static let instructionBody = Color(red: 0.39, green: 0.44, blue: 0.53)
    }
}
```

---

## 4. Typography

### 4.1 Font Family

The Web SDK uses the system font stack. On iOS, this maps to **SF Pro** (San Francisco), the default system font. Use `Font.system()` in SwiftUI or `UIFont.systemFont()` in UIKit. No custom fonts are required.

### 4.2 Type Scale

| Element | Web CSS | SwiftUI | Size / Weight |
|---------|---------|---------|---------------|
| Screen Title | `font-size: 20px; font-weight: 600` | `.system(size: 20, weight: .semibold)` | 20pt / Semibold |
| Screen Title (compact) | `font-size: 18px; font-weight: 600` | `.system(size: 18, weight: .semibold)` | 18pt / Semibold |
| Screen Subtitle | `font-size: 14px; font-weight: 400` | `.system(size: 14, weight: .regular)` | 14pt / Regular |
| Button Text | `font-size: 16px; font-weight: 500` | `.system(size: 16, weight: .medium)` | 16pt / Medium |
| Phase Badge | `font-size: 12px; font-weight: 600` | `.system(size: 12, weight: .semibold)` | 12pt / Semibold |
| Quality Banner Text | `font-size: 12px; font-weight: 500` | `.system(size: 12, weight: .medium)` | 12pt / Medium |
| Quality Overlay Text | `font-size: 13px; font-weight: 600` | `.system(size: 13, weight: .semibold)` | 13pt / Semibold |
| Countdown Number | `font-size: 60px; font-weight: 900` | `.system(size: 60, weight: .black)` | 60pt / Black |
| Countdown Label | `font-size: 14px; font-weight: 600` | `.system(size: 14, weight: .semibold)` | 14pt / Semibold |
| Instructions Title | `font-size: 16px; font-weight: 700` | `.system(size: 16, weight: .bold)` | 16pt / Bold |
| Instructions Body | `font-size: 13px; font-weight: 400` | `.system(size: 13, weight: .regular)` | 13pt / Regular |
| Direction Arrow | `font-size: 48px; font-weight: bold` | `.system(size: 48, weight: .bold)` | 48pt / Bold |
| Capture Guidance | `font-size: 14px; font-weight: 500` | `.system(size: 14, weight: .medium)` | 14pt / Medium |
| Footer Caption | `font-size: 12px; font-weight: 400` | `.system(size: 12, weight: .regular)` | 12pt / Regular |
| Error Caption | `font-size: 12px; color: #94A3B8` | `.system(size: 12).foregroundStyle(Color(hex: "94A3B8"))` | 12pt, muted |
| Speak Phrase Text | `font-size: 15px; font-weight: 600` | `.system(size: 15, weight: .semibold)` | 15pt / Semibold |

### 4.3 Line Heights

| Element | CSS `line-height` | SwiftUI | Notes |
|---------|-------------------|---------|-------|
| Subtitle | `1.5` | `.lineSpacing(4)` | 14pt * 1.5 = 21pt |
| Instructions body | `1.5` | `.lineSpacing(4)` | 13pt * 1.5 = ~20pt |
| Footer caption | `1.5` | `.lineSpacing(4)` | |

---

## 5. Layout & Responsive

### 5.1 Screen Card Container

| Property | Web Value | iOS pt | SwiftUI |
|----------|-----------|--------|---------|
| Max width | `480px` | `480pt` | `.frame(maxWidth: 480)` |
| Max height | `95vh` | `95%` of screen | `.frame(maxHeight: geo.size.height * 0.95)` |
| Padding | `24px` all sides | `24pt` | `.padding(24)` |
| Corner radius | `16px` | `16pt` | `.clipShape(RoundedRectangle(cornerRadius: 16))` |
| Background | `#FFFFFF` | `.white` | `.background(.white)` |
| Shadow | `0 4px 6px rgba(0,0,0,0.1)` | radius `3pt`, y `2pt` | `.shadow(color: .black.opacity(0.1), radius: 3, y: 2)` |
| Text alignment | `center` | `.center` | `.multilineTextAlignment(.center)` |
| Scroll | `overflow-y: auto` | `ScrollView` | Wrap in `ScrollView` if content overflows |

### 5.2 Video Preview Container

| Property | Web Value | iOS pt | SwiftUI |
|----------|-----------|--------|---------|
| Max width | `340px` | `340pt` | `.frame(maxWidth: 340)` |
| Max height | `50vh` | `50%` of screen | `.frame(maxHeight: geo.size.height * 0.5)` |
| Corner radius | `16px` | `16pt` | `.clipShape(RoundedRectangle(cornerRadius: 16))` |
| Background | `#000000` | `.black` | |
| Aspect ratio | Natural | Source AR | Use `AVCaptureVideoPreviewLayer` aspect fill |
| Mirror (preview) | `scaleX(-1)` | `AVCaptureConnection.isVideoMirrored = true` | Default for front camera |
| Mirror (capture) | **NONE** | **Do NOT flip output** | Raw orientation only |
| Bottom margin (capture) | `12px` | `12pt` | `.padding(.bottom, 12)` |
| Bottom margin (challenge) | `0px` | `0pt` | Flush with quality banner |

### 5.3 Responsive Layout by Device

| Device | Screen Width | Card Behavior | Video Max Width |
|--------|-------------|--------------|----------------|
| iPhone SE (3rd) | 375pt | Full width, padding 24pt | 327pt (fills card) |
| iPhone 14 / 15 | 390pt | Full width, padding 24pt | 340pt |
| iPhone 14/15 Plus | 428pt | Full width, padding 24pt | 340pt |
| iPhone 14/15 Pro Max | 430pt | Full width, padding 24pt | 340pt |
| iPad Mini | 744pt | Max 480pt centered | 400pt |
| iPad Air / Pro 11" | 820pt | Max 480pt centered | 400pt |
| iPad Pro 12.9" | 1024pt | Max 480pt centered | 400pt |

### 5.4 Safe Area Handling

```swift
// The verification view should respect safe areas:
UseSenseVerificationView(...)
    .ignoresSafeArea(.keyboard)  // Don't shift for keyboard
    .edgesIgnoringSafeArea(.all) // Camera preview can extend to edges

// But the card content should respect safe areas:
VStack {
    // Card content
}
.padding(.top, safeAreaInsets.top)
.padding(.bottom, safeAreaInsets.bottom)
```

- On iPhone with Dynamic Island / notch: card starts below the safe area
- Camera preview MAY extend behind the status bar in full-screen mode
- Use `GeometryReader` + `safeAreaInsets` for proper spacing

### 5.5 Full-Screen Container

| Property | Value |
|----------|-------|
| Background | `#F8F9FA` (Background color) |
| Layout | `VStack` with `.frame(maxWidth: .infinity, maxHeight: .infinity)` centered |
| Padding | `16pt` on all sides (around the card) |
| Presentation | `.fullScreenCover` (modal, blocks interaction with host app) |

---

## 6. Component Specifications

### 6.1 Primary Button

| Property | Value | SwiftUI |
|----------|-------|---------|
| Background | `#4F63F5` (or `branding.primaryColor`) | `.background(Color.UseSense.primary)` |
| Text color | `#FFFFFF` | `.foregroundStyle(.white)` |
| Font | 16pt Medium | `.font(.system(size: 16, weight: .medium))` |
| Min height | `48pt` | `.frame(minHeight: 48)` |
| Padding | 14pt vert, 32pt horiz | `.padding(.vertical, 14).padding(.horizontal, 32)` |
| Corner radius | `12pt` | `.clipShape(RoundedRectangle(cornerRadius: 12))` |
| Width | Full width | `.frame(maxWidth: .infinity)` |
| Pressed state | Opacity `0.9` | `.opacity(isPressed ? 0.9 : 1.0)` via `ButtonStyle` |
| Disabled state | Opacity `0.5` | `.disabled(true).opacity(0.5)` |

```swift
struct UseSensePrimaryButton: View {
    let title: String
    let action: () -> Void
    var isDisabled: Bool = false
    
    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.system(size: 16, weight: .medium))
                .foregroundStyle(.white)
                .frame(maxWidth: .infinity, minHeight: 48)
        }
        .background(Color.UseSense.primary)
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .disabled(isDisabled)
        .opacity(isDisabled ? 0.5 : 1.0)
    }
}
```

### 6.2 Secondary Button

| Property | Value |
|----------|-------|
| Background | Transparent (`.clear`) |
| Text color | `#1A1A1A` |
| Border | `1pt` solid `#E5E7EB` |
| All other | Same as primary |

### 6.3 Progress Bar

| Property | Value |
|----------|-------|
| Track height | `4pt` |
| Track color | `#E5E7EB` |
| Track radius | `2pt` |
| Fill color | `#4F63F5` |
| Fill animation | `300ms` ease | 
| Width | Full width (`.frame(maxWidth: .infinity)`) |

```swift
struct UseSenseProgressBar: View {
    let progress: Double  // 0.0 - 1.0
    
    var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .leading) {
                RoundedRectangle(cornerRadius: 2)
                    .fill(Color.UseSense.border)
                    .frame(height: 4)
                RoundedRectangle(cornerRadius: 2)
                    .fill(Color.UseSense.primary)
                    .frame(width: geo.size.width * progress, height: 4)
                    .animation(.easeInOut(duration: 0.3), value: progress)
            }
        }
        .frame(height: 4)
    }
}
```

### 6.4 Loading Spinner

| Property | Value |
|----------|-------|
| Size | `48pt x 48pt` |
| Ring width | `4pt` |
| Track color | `#E5E7EB` |
| Active color | `#4F63F5` |
| Animation | `1000ms` linear infinite |
| Implementation | `ProgressView()` styled, or custom ring animation |

### 6.5 Phase Badge

All: padding 4pt vert / 12pt horiz, corner radius 20pt, font 12pt Semibold, tracking 0.5pt.

| Phase | Background | Text Color | Label |
|-------|-----------|-----------|-------|
| BASELINE | `Color.UseSense.qualityInfo.opacity(0.9)` | `.white` | `"BASELINE"` |
| CHALLENGE | `Color.UseSense.primaryDark.opacity(0.9)` | `.white` | `"CHALLENGE"` |
| COMPLETE | `Color.UseSense.qualityInfo.opacity(0.15)` | `Color.UseSense.primaryDark` | `"COMPLETE"` |

### 6.6 Quality Warning Banner

| Property | Poor Quality | Acceptable Quality |
|----------|-------------|-------------------|
| Background | `Color.UseSense.qualityCritical.opacity(0.1)` | `Color.UseSense.qualityWarning.opacity(0.1)` |
| Text color | `.criticalBannerText` | `.warningBannerText` |
| Border | `1pt, qualityCritical.opacity(0.2)` | `1pt, qualityWarning.opacity(0.2)` |
| Icon | Warning symbol | Lightbulb symbol |
| Padding | `8pt` vert / `12pt` horiz | Same |
| Corner radius | `8pt` | Same |
| Font | `12pt` Medium | Same |
| Layout | `HStack`: icon + message | Same |
| Top margin | `8pt` from video bottom | Same |
| Transition | `.transition(.opacity.combined(with: .move(edge: .top)))` | Same |

### 6.7 Video Border Quality Glow

| Quality Level | Border Effect | Transition |
|--------------|--------------|-----------|
| Good | None | N/A |
| Acceptable | `.overlay(RoundedRectangle(cornerRadius: 16).stroke(qualityWarning.opacity(0.5), lineWidth: 3))` | `400ms` ease |
| Poor | `.overlay(RoundedRectangle(cornerRadius: 16).stroke(qualityCritical.opacity(0.6), lineWidth: 3))` | `400ms` ease |

### 6.8 Face Guide Overlay

| Element | SwiftUI Implementation |
|---------|----------------------|
| Mask | `Canvas` drawing a filled rect, then clearing an ellipse with `EllipticalGradient` or `blendMode(.destinationOut)` |
| Oval dimensions | Width: `55%` of container, aspect ratio `3:4`, max height `80%` |
| Dashed border | `Ellipse().stroke(style: StrokeStyle(lineWidth: 3, dash: [8, 6]))` white 80% opacity |
| Pulse animation | `.scaleEffect(animating ? 1.1 : 1.0).opacity(animating ? 0.6 : 1.0)` with `Animation.easeInOut(duration: 1.0).repeatForever()` |
| Top label | Capsule with `.background(Color.black.opacity(0.6))`, white text 14pt Medium |
| Bottom button | `#4F46E5` fill, white text 16pt Bold, 16pt corner radius, shadow |

### 6.9 Countdown Overlay

| Element | SwiftUI Implementation |
|---------|----------------------|
| Background | `Color.black.opacity(0.4)` full overlay with `.ignoresSafeArea()` |
| Number circle | `112pt` diameter, `Color.white.opacity(0.95)`, shadow radius `12pt` |
| Number text | `60pt` Black weight, `Color.UseSense.primaryDark` |
| Label pill | Capsule, `Color.black.opacity(0.6)`, white text 14pt Semibold |
| Pop animation | See Section 8.2 |
| Layout | `VStack(spacing: 12)`: circle + pill, centered in `ZStack` |

### 6.10 Instructions Modal

| Element | SwiftUI Implementation |
|---------|----------------------|
| Backdrop | `Color.black.opacity(0.75)` in `ZStack`, full screen |
| Card | `VStack`, white bg, 16pt radius, padding 28pt top/bottom + 24pt sides, max width 320pt, shadow |
| Icon | `Circle().fill(Color.UseSense.instructionIconBg)` 48pt, emoji/`Image(systemName:)` centered |
| Title | 16pt Bold, `Color.UseSense.instructionTitle` |
| Body | 13pt Regular, `Color.UseSense.instructionBody`, line spacing 4pt |
| CTA | Full width, 12pt vert / 24pt horiz padding, 10pt radius, `#4F46E5`, white 14pt Semibold |
| Challenge icons (SF Symbols) | follow_dot: `"circle.fill"` (red tint), head_turn: `"arrow.triangle.2.circlepath"`, speak_phrase: `"mic.fill"` |

### 6.11 Challenge Dot (follow_dot)

| Property | Value |
|----------|-------|
| Size | Server `dot_size_px` (default `24pt`) |
| Fill | `Color.UseSense.challengeDot` (`#6366F1`) |
| Border | `2pt` white |
| Shadow | `Color.UseSense.challengeDot.opacity(0.5)`, radius `6pt` |
| Position | `.position(x: waypoint.x * containerWidth, y: waypoint.y * containerHeight)` |
| Movement | `.animation(.timingCurve(0.4, 0, 0.2, 1, duration: 0.4), value: dotPosition)` |

### 6.12 Direction Arrow (head_turn)

| Property | Value |
|----------|-------|
| Container | 96pt circle, centered in video |
| Background | `LinearGradient(colors: [.primaryDark, .primaryLight], startPoint: .topLeading, endPoint: .bottomTrailing)` |
| Arrow chars | left: `"\u{2190}"`, right: `"\u{2192}"`, up: `"\u{2191}"`, down: `"\u{2193}"`, center: `"\u{25CB}"` |
| Text | 48pt Bold, white |
| Shadow | `.shadow(color: challengeDot.opacity(0.5), radius: 15)` + `.shadow(color: .black.opacity(0.3), radius: 12, y: 8)` |
| Entry animation | `.transition(.scale(scale: 0.5).combined(with: .opacity))` with `350ms` spring |
| Re-trigger | Use `.id(currentDirection)` to force view re-creation on change |

### 6.13 Icon Sizes (Outcome Screens)

All icons use SF Symbols or custom `Path` shapes at `64pt`:

| Screen | SF Symbol or Path | Color |
|--------|------------------|-------|
| Success (APPROVE) | `checkmark.circle` or custom Path | `#10B981` stroke |
| Success (MANUAL_REVIEW) | `exclamationmark.circle` | `#F59E0B` stroke |
| Denied (REJECT) | `xmark.circle` | `#EF4444` stroke |
| Denied (MANUAL_REVIEW) | `exclamationmark.circle` | `#F59E0B` stroke |
| Failure | `exclamationmark.circle` | `#EF4444` stroke |
| Blocked | `nosign` | `#EF4444` stroke |
| Permission (camera) | `camera` | `#4F63F5` stroke |
| Permission (mic) | `mic` | `#4F63F5` stroke |

All: stroke width `2pt`, line cap `.round`, line join `.round`, no fill. Size `64pt` in a `64pt x 64pt` frame.

---

## 7. Screen Designs

### 7.1 IntroScreen

```
+----------------------------------+
|          [Logo 40pt]             |
|                                  |
|         [Spinner 48pt]           |
|                                  |
|    "Verifying your presence"     |  <-- 20pt Semibold
|     "Please wait a moment"       |  <-- 14pt Regular, textSecondary
+----------------------------------+
```

- Shows while session is being created via API
- Logo at `40pt` height if `branding.logoUrl` configured
- Use `AsyncImage` for remote logo URL

### 7.2 PermissionScreen

```
+----------------------------------+
|          [Logo 40pt]             |
|                                  |
|      [Camera Icon 64pt]         |  <-- SF Symbol "camera", #4F63F5
|                                  |
|    "Camera access needed"        |  <-- 20pt Semibold
|   "We need access to your       |  <-- 14pt Regular, textSecondary
|    camera to verify..."          |
|                                  |
|    [=== Continue Button ===]     |  <-- Primary button
+----------------------------------+
```

- Two variants: `camera` and `microphone`
- On iOS, trigger `AVCaptureDevice.requestAccess(for: .video)` or check `AVAuthorizationStatus`
- If denied, guide user to Settings via `UIApplication.shared.open(URL(string: UIApplication.openSettingsURLString)!)`

### 7.3 CaptureScreen

```
+----------------------------------+
|  [Logo 24pt]                     |
|                                  |
| +------------------------------+ |
| |                              | |
| |    [Camera Preview]          | |  <-- max 340pt, mirrored preview
| |       +----------+          | |
| |       | Oval     |          | |  <-- 70% w/h, 3pt border, 50% radius
| |       | Guide    |          | |      rgba(255,255,255,0.8)
| |       +----------+          | |
| |  [QualityIndicator overlay]  | |  <-- overlay at top
| +------------------------------+ |
|                                  |
|  "Position your face"            |  <-- 18pt Semibold
|  "Center your face in the frame" |  <-- 14pt or quality guidance
|                                  |
|  --- OR during capture: ---      |
|  "Hold still"                    |
|  "Stay still for a moment"      |
|  [====== Progress Bar ======]    |  <-- 2.5s linear fill
+----------------------------------+
```

### 7.4 ChallengeScreen — Instructions Phase

```
+--------- Full Screen -----------+
|  Color.black.opacity(0.75)      |
|                                  |
|   +----- Modal Card ------+     |
|   |                        |     |
|   |     [Icon 48pt]        |     |  <-- E0E7FF circle
|   |                        |     |
|   |  "Head Turn Challenge" |     |  <-- 16pt Bold, #1E293B
|   |                        |     |
|   |  "You will be asked    |     |  <-- 13pt Regular, #64748B
|   |   to turn your head    |     |
|   |   in specific          |     |
|   |   directions."         |     |
|   |                        |     |
|   | [Got it - start]       |     |  <-- #4F46E5, full width
|   +-----------------------+     |
+----------------------------------+
```

Challenge-specific instruction text:
- `follow_dot`: "A red dot will appear on screen. Follow it with your eyes while keeping your head still."
- `head_turn`: "You will be asked to turn your head in specific directions. Follow the arrows shown on screen."
- `speak_phrase`: "You will be shown a phrase to read aloud. Speak clearly and at a normal pace."

### 7.5 ChallengeScreen — Face Guide Phase

```
+--------- Video Container --------+
|  Masked overlay (transparent     |
|  ellipse center, dark surround)  |
|                                   |
|  "Position your face in the oval" |  <-- pill at top 4%
|                                   |
|       +--- Dashed Oval ---+       |  <-- 55% width, 3:4 AR
|       |                   |       |      3pt dashed, pulsing
|       |    (face area)    |       |
|       +-------------------+       |
|                                   |
|    [My face is ready]             |  <-- button at bottom 6%
+-----------------------------------+
```

### 7.6 ChallengeScreen — Baseline Phase

```
+--------- Video Container --------+
| [Phase Badge: "BASELINE"]        |
| [Camera Preview + subtle oval]   |  <-- 55% width, 2pt solid, 30% white
| [QualityIndicator]               |
+-----------------------------------+
| "Getting ready..."               |  <-- 18pt Semibold
| [==== Progress 0-25% ========]   |
```

Duration: 2000ms. Frame budget: `max(10, floor(max_frames * 0.30))`.

### 7.7 ChallengeScreen — Countdown Phase

```
+--------- Video Container --------+
|  Color.black.opacity(0.4)        |
|         +--- Circle ---+         |
|         |     3        |         |  <-- 112pt, white 95%, pop anim
|         +--------------+         |
|     "Get ready..."               |
+-----------------------------------+
```

Three steps: 3, 2, 1 at 1000ms each. Frame capture continues.

### 7.8 ChallengeScreen — Challenge Phase (head_turn)

```
+--------- Video Container --------+
| [Phase Badge: "CHALLENGE"]       |
| [Camera Preview]                  |
|      +--- Arrow Circle ---+      |
|      |       <---         |      |  <-- 96pt indigo gradient
|      +--------------------+      |
| [QualityIndicator compact]        |
+-----------------------------------+
| [Quality Warning Banner]         |
| [==== Progress 25-100% ======]   |
```

### 7.9 ChallengeScreen — Challenge Phase (follow_dot)

```
+--------- Video Container --------+
| [Phase Badge: "CHALLENGE"]       |
| [Camera Preview]                  |
|        *                          |  <-- Dot at (x%, y%)
|                                   |      400ms transition
| [QualityIndicator compact]        |
+-----------------------------------+
| [Quality Warning Banner]         |
| [==== Progress 25-100% ======]   |
```

### 7.10 ChallengeScreen — Challenge Phase (speak_phrase)

```
+--------- Video Container --------+
| [Camera Preview]                  |
+-----------------------------------+
| "Read the phrase below"          |
| +------------------------------+ |
| | "The sun rises in the east"  | |  <-- 15pt Semibold, border bg
| +------------------------------+ |
| [==== Progress Bar ============] |
```

### 7.11 UploadingScreen

```
+----------------------------------+
|          [Logo 40pt]             |
|         [Spinner 48pt]           |
|      "Finishing up..."           |  <-- 20pt Semibold
| "Please wait while we complete   |  <-- 14pt, textSecondary
|   your verification"             |
| [==== Progress (optional) ====]  |
+----------------------------------+
```

### 7.12 SuccessScreen (APPROVE)

```
+----------------------------------+
|          [Logo 40pt]             |
|   [checkmark.circle 64pt]       |  <-- #10B981 (SUCCESS GREEN)
|       "You're verified"          |
|  "Your identity has been         |
|   confirmed"                     |
|    [=== Continue ===]            |  <-- 24pt top margin
+----------------------------------+
```

### 7.13 SuccessScreen (MANUAL_REVIEW)

```
+----------------------------------+
|          [Logo 40pt]             |
|   [exclamationmark.circle 64pt] |  <-- #F59E0B (AMBER)
|       "Under Review"             |
|  "Your verification is pending   |
|   review."                       |
|    [=== Continue ===]            |
+----------------------------------+
```

### 7.14 DeniedScreen (REJECT)

```
+----------------------------------+
|          [Logo 40pt]             |
|   [xmark.circle 64pt]           |  <-- #EF4444 (RED)
|    "Verification Denied"         |
|  "We couldn't verify your       |
|   identity."                     |
|    [=== Continue ===]            |
| "If you believe this is an       |  <-- 12pt, #94A3B8
|  error, contact support."        |
+----------------------------------+
```

### 7.15 FailureScreen

```
+----------------------------------+
|          [Logo 40pt]             |
|   [exclamationmark.circle 64pt] |  <-- #EF4444 (RED)
|  "We couldn't verify you"       |
|  "{user-friendly error msg}"    |
|    [=== Try again ===]          |
+----------------------------------+
```

### 7.16 BlockedScreen

```
+----------------------------------+
|          [Logo 40pt]             |
|   [nosign 64pt]                  |  <-- #EF4444 (RED)
|  "Verification unavailable"      |
|  "Please try again later."      |
|    [=== Refresh ===]            |  <-- Secondary button
+----------------------------------+
```

---

## 8. Animations & Transitions

### 8.1 Animation Catalog

| Element | Duration | Easing (Web) | SwiftUI Equivalent |
|---------|----------|-------------|-------------------|
| Follow-dot position | `400ms` | `cubic-bezier(0.4, 0, 0.2, 1)` | `.timingCurve(0.4, 0, 0.2, 1, duration: 0.4)` |
| Challenge dot glow | Static | N/A | `.shadow(color:radius:)` |
| Countdown pop | `900ms` | `ease-out` | Custom `Animatable` (see 8.2) |
| Direction arrow enter | `350ms` | `ease-out` | `.transition(.scale.combined(with: .opacity)).animation(.easeOut(duration: 0.35))` |
| Face guide pulse | `2000ms` | `ease-in-out`, loop | `.repeatForever(autoreverses: true)` with `.easeInOut(duration: 1.0)` |
| Spinner rotation | `1000ms` | `linear`, loop | `.rotationEffect()` with `.linear(duration: 1).repeatForever(autoreverses: false)` |
| Progress bar fill | `300ms` | `ease` | `.animation(.easeInOut(duration: 0.3), value: progress)` |
| Quality banner | `300ms` | `ease` | `.transition(.opacity.combined(with: .move(edge: .top)))` |
| Quality border glow | `400ms` | `ease` | `.animation(.easeInOut(duration: 0.4), value: qualityLevel)` |
| Button press | `200ms` | `ease` | `ButtonStyle` with `.scaleEffect(isPressed ? 0.97 : 1)` |
| Screen transitions | instant | N/A | `.transition(.opacity)` with `.animation(.easeInOut(duration: 0.2))` |

### 8.2 Countdown Pop (Detailed)

```swift
struct CountdownNumberView: View {
    let number: Int
    @State private var scale: CGFloat = 0.3
    @State private var opacity: Double = 0
    
    var body: some View {
        Text("\(number)")
            .font(.system(size: 60, weight: .black))
            .foregroundStyle(Color.UseSense.primaryDark)
            .scaleEffect(scale)
            .opacity(opacity)
            .onAppear {
                // Phase 1: Scale up to 1.15, fade in (0-360ms)
                withAnimation(.easeOut(duration: 0.36)) {
                    scale = 1.15
                    opacity = 1
                }
                // Phase 2: Settle to 1.0 (360-900ms)
                withAnimation(.easeOut(duration: 0.54).delay(0.36)) {
                    scale = 1.0
                }
            }
    }
}
```

### 8.3 Direction Arrow Enter

```swift
// Use .id(currentDirection) to force re-creation, triggering transition:
Image(systemName: directionArrow)
    .font(.system(size: 48, weight: .bold))
    .foregroundStyle(.white)
    .frame(width: 96, height: 96)
    .background(
        LinearGradient(
            colors: [Color.UseSense.primaryDark, Color.UseSense.primaryLight],
            startPoint: .topLeading, endPoint: .bottomTrailing
        )
    )
    .clipShape(Circle())
    .shadow(color: Color.UseSense.challengeDot.opacity(0.5), radius: 15)
    .transition(.scale(scale: 0.5).combined(with: .opacity))
    .id(currentDirection)  // triggers re-animation on change
    .animation(.easeOut(duration: 0.35), value: currentDirection)
```

### 8.4 Face Guide Pulse

```swift
@State private var isPulsing = false

Ellipse()
    .stroke(style: StrokeStyle(lineWidth: 3, dash: [8, 6]))
    .foregroundStyle(Color.white.opacity(0.8))
    .frame(width: containerWidth * 0.55)
    .aspectRatio(3.0/4.0, contentMode: .fit)
    .scaleEffect(isPulsing ? 1.1 : 1.0)
    .opacity(isPulsing ? 0.6 : 1.0)
    .onAppear {
        withAnimation(.easeInOut(duration: 1.0).repeatForever(autoreverses: true)) {
            isPulsing = true
        }
    }
```

### 8.5 Follow-Dot Movement

```swift
@State private var dotPosition: CGPoint = .zero

Circle()
    .fill(Color.UseSense.challengeDot)
    .frame(width: dotSize, height: dotSize)
    .overlay(Circle().stroke(.white, lineWidth: 2))
    .shadow(color: Color.UseSense.challengeDot.opacity(0.5), radius: 6, x: 0, y: 0)
    .position(dotPosition)
    .animation(.timingCurve(0.4, 0, 0.2, 1, duration: 0.4), value: dotPosition)
```

---

## 9. Image Quality System

### 9.1 Analysis Pipeline

The quality analyzer runs at **4Hz** (~250ms intervals) on camera frames.

```
Input:  CVPixelBuffer from AVCaptureVideoDataOutput (kCVPixelFormatType_32BGRA)
        |
Step 1: Downsample to 160x120 grayscale
        - Use vImage or Accelerate framework for fast conversion
        - ITU-R BT.601: Y = 0.299R + 0.587G + 0.114B
        |
Step 2: Blur detection (Laplacian variance)
        - 4-connected kernel: [0,1,0; 1,-4,1; 0,1,0]
        - Use vDSP for convolution
        - Compute variance of Laplacian response
        |
Step 3: Lighting analysis
        - Mean brightness (0-255 range)
        - Standard deviation (contrast)
        - Under/over-exposure ratios
        |
Step 4: Build guidance messages
        - SUPPRESS blur guidance when lighting is bad
        - Sort by severity: critical > warning > info
        |
Output: ImageQualityReport
```

### 9.2 Quality Thresholds

| Metric | Poor | Acceptable | Good | Notes |
|--------|------|-----------|------|-------|
| Laplacian Variance | < 30 | 30 - 80 | >= 80 | **Suppressed when lighting is bad** |
| Mean Brightness | < 55 (too dark) | 55 - 80 | 80 - 180 | Scale 0-255 |
| Too Bright | > 210 | N/A | <= 210 | Mean brightness upper bound |
| Contrast (StdDev) | < 25 | 25 - 40 | >= 40 | Std deviation of pixel luminance |
| Under-exposed Ratio | > 0.45 | 0.25 - 0.45 | < 0.25 | Fraction of pixels below 40 |
| Over-exposed Ratio | > 0.45 | 0.25 - 0.45 | < 0.25 | Fraction of pixels above 215 |
| Overall Score | < 40 | 40 - 65 | >= 65 | Weighted: 45% blur + 55% lighting |

### 9.3 Blur Suppression When Lighting Is Bad

> **CRITICAL:** When the image is too dark or too bright, the Laplacian blur detector produces near-zero variance on uniformly dark/bright frames (no edges to detect). This gives a false "blurry" reading. The guidance builder MUST suppress all blur-related guidance when:
> - `isTooDark == true`
> - `isTooBright == true`
> - `underExposedRatio > 0.45`
> - `overExposedRatio > 0.45`
>
> Users should see "Turn on the lights" instead of "Clean your camera lens."

### 9.4 Guidance Messages

| Condition | Message | Severity |
|-----------|---------|----------|
| Blur: poor | "Clean your camera lens or hold your device steady" | critical |
| Blur: acceptable, score < 50 | "Image is slightly blurry -- hold still" | warning |
| Too dark | "Turn on the lights or move to a bright area" | critical |
| Too bright | "Too bright -- move away from direct light" | critical |
| Slightly dark | "A bit dark -- more light would help" | warning |
| Under-exposed > 0.45 | "Image is too dark -- add more lighting" | critical |
| Over-exposed > 0.45 | "Too much glare -- reduce backlighting" | critical |
| Low contrast < 20 | "Low contrast -- adjust your lighting" | warning |

### 9.5 Quality UI Active Phases

| Phase | QualityIndicator Active | Mode | Banner |
|-------|------------------------|------|--------|
| init | No | N/A | No |
| instructions | No | N/A | No |
| face-guide | **Yes** | Full overlay | Yes if issues |
| baseline | **Yes** | Full overlay | Yes if issues |
| countdown | **Yes** | Full overlay | Yes if issues |
| challenge | **Yes** | Compact pill | Yes if issues |
| done | No | N/A | No |

### 9.6 iOS Implementation Notes

```swift
// Use AVCaptureVideoDataOutput for real-time frame access:
let videoOutput = AVCaptureVideoDataOutput()
videoOutput.videoSettings = [
    kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA
]
videoOutput.setSampleBufferDelegate(self, queue: qualityAnalysisQueue)

// Throttle analysis to 4Hz:
private var lastAnalysisTime: CFAbsoluteTime = 0
func captureOutput(_ output: AVCaptureOutput, didOutput sampleBuffer: CMSampleBuffer, ...) {
    let now = CFAbsoluteTimeGetCurrent()
    guard now - lastAnalysisTime >= 0.25 else { return }  // 4Hz
    lastAnalysisTime = now
    
    guard let pixelBuffer = CMSampleBufferGetImageBuffer(sampleBuffer) else { return }
    let report = imageQualityAnalyzer.analyze(pixelBuffer)
    DispatchQueue.main.async { self.qualityReport = report }
}
```

---

## 10. Capture Pipeline

### 10.1 Frame Budget & Adaptive FPS

```swift
// Hard cap from server: upload.max_frames (default: 30)
let maxFrames = session.upload.maxFrames  // HARD_MAX = 30

// Baseline gets 30% of budget
let baselineBudget = max(10, Int(floor(Double(maxFrames) * 0.30)))

// Adaptive FPS: server's target_fps is AUTHORITATIVE (v1.17.6)
let captureFps = session.upload.targetFps
    ?? challengeSpec?.captureFpsHint
    ?? 10

// If not from server, compute:
let baselineMs: Double = 2000
let countdownMs: Double = 3000  // only if challenge
let totalCaptureMs = baselineMs + countdownMs + Double(challengeDurationMs)
let adaptiveFps = max(2, min(nominalFps, Int(floor(Double(hardMax) / (totalCaptureMs / 1000.0)))))

let frameIntervalMs: Int = 1000 / captureFps

// frames_per_step default: 2
let framesPerStep = challengeSpec?.framesPerStep ?? 2
```

### 10.2 Frame Capture Requirements

| Property | Value |
|----------|-------|
| Format | JPEG |
| Quality | 0.85 |
| Resolution | 720x1280 ideal (portrait) |
| Camera | `.front` (`AVCaptureDevice.Position.front`) |
| Session preset | `.hd1280x720` or `.photo` |
| Mirroring (preview) | `connection.isVideoMirrored = true` (default for front cam) |
| Mirroring (capture) | **NONE** — do NOT set `isVideoMirrored` on the data output connection |
| JPEG conversion | `UIImage(ciImage:).jpegData(compressionQuality: 0.85)` or `AVCapturePhotoOutput` |

> **CRITICAL: No Frame Mirroring on Capture**  
> `AVCaptureConnection.isVideoMirrored` on the `AVCaptureVideoDataOutput` connection MUST be `false` (or left as default, which is `false` for data output). Only the preview layer's connection should mirror. The backend expects raw, non-mirrored frames.

```swift
// Preview layer — mirrored (standard selfie view):
if let previewConnection = previewLayer.connection, previewConnection.isVideoMirroringSupported {
    previewConnection.automaticallyAdjustsVideoMirroring = false
    previewConnection.isVideoMirrored = true
}

// Data output — NOT mirrored (raw frames for backend):
if let dataConnection = videoDataOutput.connection(with: .video) {
    dataConnection.isVideoMirrored = false  // CRITICAL
}
```

### 10.3 Challenge Capture Data Structures

```swift
// Step-to-frame mapping
var stepFrames: [String: [Int]] = [:]      // head_turn
var waypointFrames: [String: [Int]] = [:]  // follow_dot
var frameTimestamps: [Int] = []            // ms offsets from capture start

struct FrameMetadata: Codable {
    let frameIndex: Int
    let captureTimestampMs: Int64
    let performanceTimestampMs: Double
    let frameBlobSizeBytes: Int
    let resolutionW: Int
    let resolutionH: Int
    let frameHash: String?
}
```

### 10.4 Backup Frame Loop

```swift
var framesThisStep = 0
// ... main capture during step duration ...

// Backup loop: ensure minimum frames per step
var backupAttempts = 0
let maxBackupAttempts = framesPerStep * 3
while framesThisStep < framesPerStep && backupAttempts < maxBackupAttempts {
    backupAttempts += 1
    if let frame = captureOneFrame() {
        stepFrames["\(stepIndex)"]?.append(globalFrameIndex - 1)
        framesThisStep += 1
    } else if budgetExhausted {
        break
    }
    try await Task.sleep(nanoseconds: UInt64(frameIntervalMs) * 1_000_000)
}
```

---

## 11. API & Auth Layer

### 11.1 Base URL & Environment

```
Base URL:  https://api.usesense.ai/functions/v1/make-server-fc4cf30d
Query:     ?env=sandbox|production

Endpoints:
  POST /v1/sessions                         → Create session
  POST /v1/sessions/{id}/signals?env=...    → Upload frames + metadata
  POST /v1/sessions/{id}/complete?env=...   → Get decision
  GET  /v1/sessions/{id}/status?env=...     → Poll status
```

### 11.2 Two-Layer Auth Model

**Layer 1: Supabase Gateway Headers** (ALL requests)

| Header | Value | Purpose |
|--------|-------|---------|
| `Authorization` | `Bearer {gatewayKey}` | Supabase Edge Function gateway |
| `apikey` | `{gatewayKey}` | Supabase gateway (duplicate) |

**Layer 2: Endpoint-Specific Auth**

| Header | Value | Used On | Purpose |
|--------|-------|---------|---------|
| `X-API-Key` | `{apiKey}` | Create Session | Organization API key |
| `X-Session-Token` | `{sessionToken}` | Upload, Complete, Status | Session auth |
| `X-Idempotency-Key` | `{unique_id}` | Upload, Complete | Dedup |
| `X-Nonce` | `{nonce}` | Upload, Complete | Crypto binding |

### 11.3 Nonce Dual-Delivery (v1.17.5)

> **CRITICAL:** The nonce MUST be sent BOTH as an `X-Nonce` header AND as a `nonce=` query parameter:

```swift
func buildURL(path: String, sessionNonce: String?) -> URL {
    var components = URLComponents(string: "\(apiBaseUrl)\(path)")!
    var queryItems = [URLQueryItem(name: "env", value: environment.rawValue)]
    if let nonce = sessionNonce {
        queryItems.append(URLQueryItem(name: "nonce", value: nonce))
    }
    components.queryItems = queryItems
    return components.url!
}

// Also set header:
request.setValue(nonce, forHTTPHeaderField: "X-Nonce")
```

### 11.4 Create Session Request

```swift
var request = URLRequest(url: buildURL(path: "/v1/sessions", sessionNonce: nil))
request.httpMethod = "POST"
request.setValue("application/json", forHTTPHeaderField: "Content-Type")
request.setValue("Bearer \(gatewayKey)", forHTTPHeaderField: "Authorization")
request.setValue(gatewayKey, forHTTPHeaderField: "apikey")
request.setValue(apiKey, forHTTPHeaderField: "X-API-Key")

let body = CreateSessionRequest(
    sessionType: "enrollment",
    platform: "ios",
    identityId: nil,
    externalUserId: "user-123",
    metadata: [
        "user_agent": "UseSense-iOS-SDK/1.17.7",
        "platform": "ios",
        "channel": "mobile",
        "device_model": UIDevice.current.model,
        "os_version": UIDevice.current.systemVersion
    ]
)
request.httpBody = try JSONEncoder().encode(body)
```

### 11.5 Upload Signals (multipart/form-data)

```swift
let boundary = "UseSense-\(UUID().uuidString)"
var request = URLRequest(url: buildURL(
    path: "/v1/sessions/\(sessionId)/signals",
    sessionNonce: nonce
))
request.httpMethod = "POST"
request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
request.setValue("Bearer \(gatewayKey)", forHTTPHeaderField: "Authorization")
request.setValue(gatewayKey, forHTTPHeaderField: "apikey")
request.setValue(sessionToken, forHTTPHeaderField: "X-Session-Token")
request.setValue("\(sessionId)_\(Date().timeIntervalSince1970)_\(UUID().uuidString.prefix(9))",
                 forHTTPHeaderField: "X-Idempotency-Key")
if let nonce = nonce {
    request.setValue(nonce, forHTTPHeaderField: "X-Nonce")
}

var body = Data()
// Frames
for (i, frame) in frames.enumerated() {
    body.appendMultipartField(boundary: boundary, name: "frames[]",
                              filename: "frame_\(i).jpg", mimeType: "image/jpeg", data: frame)
}
// Metadata JSON
let metadataJSON = try JSONEncoder().encode(metadata)
body.appendMultipartField(boundary: boundary, name: "metadata",
                          filename: "metadata.json", mimeType: "application/json", data: metadataJSON)
// Audio (optional)
if let audio = audioData {
    body.appendMultipartField(boundary: boundary, name: "audio",
                              filename: "audio.m4a", mimeType: "audio/mp4", data: audio)
}
body.append("--\(boundary)--\r\n".data(using: .utf8)!)
request.httpBody = body
```

### 11.6 Metadata Payload (metadata.json)

```json
{
    "web_integrity": null,
    "ios_integrity": {
        "is_simulator": false,
        "is_jailbroken": false,
        "is_debugger_attached": false,
        "app_attest_token": "...",
        "bundle_id": "com.example.app",
        "device_model": "iPhone15,3",
        "os_version": "18.3",
        "screen_resolution": "1290x2796",
        "timezone": "America/New_York",
        "locale": "en_US"
    },
    "challenge_response": {
        "type": "follow_dot",
        "seed": "seed_abc123",
        "completed": true,
        "waypoint_frames": {
            "0": [3, 4], "1": [5, 6], "2": [7, 8], "3": [9, 10], "4": [11, 12]
        },
        "started_at": "2026-03-07T12:00:05.000Z",
        "completed_at": "2026-03-07T12:00:12.500Z",
        "frame_timestamps": [0, 143, 287, 430, 573, 716, 860, 1003, 1147, 1290, 1434]
    },
    "webauthn_data": null
}
```

### 11.7 Error Handling

| HTTP Status | Error Code | User Message |
|-------------|-----------|--------------|
| 400 | `invalidRequest` | "Invalid request. Please check the parameters." |
| 401 (session_expired) | `sessionExpired` | "Your session has expired. Please start over." |
| 401 (invalid_token) | `invalidToken` | "Session token is invalid." |
| 401 (other) | `unauthorized` | "Authentication failed. Check API key." |
| 404 (identity_not_found) | `identityNotFound` | "Identity not found." |
| 429 | `quotaExceeded` | "Rate limit reached. Try again later." |
| 500 | `serverError` | "Server error. Please try again." |
| 503 | `serviceUnavailable` | "Service unavailable. Try again later." |
| `URLError` | `networkError` | "Connection issue. Check your internet." |
| Timeout | `timeout` | "Request timed out. Please try again." |

---

## 12. Security Requirements

### 12.1 Decision Redaction (MANDATORY)

**Only these fields are safe to expose to the host app:**

```swift
public struct RedactedDecisionObject: Codable, Sendable {
    public let sessionId: String
    public let sessionType: String?
    public let identityId: String?
    public let decision: String          // "APPROVE" | "REJECT" | "MANUAL_REVIEW"
    public let timestamp: String         // ISO 8601
}
```

**Stripped fields (NEVER exposed):**
- `channel_trust_score`, `liveness_score`, `dedupe_risk_score`
- `matrix_decision`, `rule_applied`
- `pillar_verdicts` (all three pillars)
- `verdict_metadata`, `reasons[]`, `debug`
- `integrity_flags[]`, `livesense_analysis`, `challenge_validation`
- `dedupe_analysis`, `signature`

```swift
func redactDecision(_ full: FinalDecisionObject) -> RedactedDecisionObject {
    RedactedDecisionObject(
        sessionId: full.sessionId,
        sessionType: full.sessionType,
        identityId: full.identityId,
        decision: full.decision,
        timestamp: full.timestamp
    )
}
```

### 12.2 No Score Exposure on UI

Outcome screens MUST NOT display scores, verdicts, reasons, or analysis data.

### 12.3 No Frame Mirroring on Capture

Reiterated: `AVCaptureConnection.isVideoMirrored = false` on the data output connection.

### 12.4 iOS Integrity Signals & Apple App Attest

> **Apple App Attest — iOS Equivalent of Google Play Integrity**
>
> On Android, the SDK uses the **Google Play Integrity API** to produce a `play_integrity_token` that the backend validates to confirm the request originates from a genuine, unmodified app on a real device. On iOS, the equivalent mechanism is **Apple App Attest** (`DCAppAttestService`), which serves the same purpose for the **DeepSense score** — the backend's composite device-trust pillar that factors hardware authenticity, environment integrity, and tamper-resistance into the final verification decision.
>
> **How App Attest feeds DeepSense:**
> The `appAttestToken` (an assertion) is uploaded alongside captured frames in the `/v1/sessions/{id}/signals` payload under `ios_integrity.app_attest_token`. The backend forwards this to Apple's attestation verification endpoint, and the resulting trust level directly influences the `deepsense_score` within the `pillar_verdicts`. A missing or invalid token degrades the channel trust score, potentially shifting an otherwise-APPROVE decision toward MANUAL_REVIEW.

#### 12.4.1 App Attest Lifecycle

App Attest follows a **two-phase** model — **attestation** (one-time key registration) and **assertion** (per-session proof):

```
Phase 1: ATTESTATION (one-time, on first launch or key rotation)
  ┌─────────────┐     generateKey()      ┌───────────────────┐
  │  SDK Client  │ ──────────────────────> │ DCAppAttestService │
  │              │ <────────────────────── │   (Secure Enclave) │
  │              │      keyId              └───────────────────┘
  │              │
  │              │  attestKey(keyId, clientDataHash)
  │              │ ──────────────────────> Apple Attest Server
  │              │ <──────────────────────
  │              │    attestationObject (CBOR)
  │              │
  │              │  POST /v1/devices/attest { keyId, attestationObject }
  │              │ ──────────────────────> UseSense Backend
  │              │ <──────────────────────   (validates with Apple,
  │              │    { registered: true }    stores public key)
  └─────────────┘

Phase 2: ASSERTION (every session, produces appAttestToken)
  ┌─────────────┐
  │  SDK Client  │  generateAssertion(keyId, clientDataHash)
  │              │ ──────────────────────> DCAppAttestService
  │              │ <──────────────────────
  │              │    assertionObject
  │              │
  │  Included in POST /v1/sessions/{id}/signals as:
  │  ios_integrity.app_attest_token = base64(assertionObject)
  └─────────────┘
```

#### 12.4.2 Implementation

```swift
import DeviceCheck
import CryptoKit

actor AppAttestManager {
    private let service = DCAppAttestService.shared
    private let keychain = KeychainHelper.shared
    private static let keychainKeyId = "com.usesense.sdk.appAttest.keyId"
    private static let keychainAttested = "com.usesense.sdk.appAttest.attested"
    
    /// Whether App Attest is available on this device.
    /// Returns false on simulators, older devices, and some enterprise configs.
    var isSupported: Bool {
        service.isSupported
    }
    
    // MARK: - Phase 1: Attestation (one-time key registration)
    
    /// Generates a new key pair in the Secure Enclave and attests it with Apple.
    /// The attestation object is sent to the UseSense backend for validation.
    /// The keyId is persisted in the Keychain for future assertions.
    func attestIfNeeded(apiClient: UseSenseAPIClient) async throws {
        guard isSupported else { return }
        
        // Check if we already have an attested key
        if let existingKeyId = keychain.string(forKey: Self.keychainKeyId),
           keychain.bool(forKey: Self.keychainAttested) == true {
            // Key already attested — nothing to do
            return
        }
        
        // Step 1: Generate a new cryptographic key pair in the Secure Enclave
        let keyId = try await service.generateKey()
        keychain.set(keyId, forKey: Self.keychainKeyId)
        
        // Step 2: Create a server-provided challenge hash for attestation
        // The nonce from session creation can be reused, or request a dedicated
        // attestation challenge from the backend
        let challenge = try await apiClient.requestAttestationChallenge()
        let clientDataHash = Data(SHA256.hash(data: challenge))
        
        // Step 3: Attest the key with Apple's servers
        // This proves the key was generated in a genuine Apple device's Secure Enclave
        let attestationObject = try await service.attestKey(keyId, clientDataHash: clientDataHash)
        
        // Step 4: Send attestation to UseSense backend for verification
        // Backend calls Apple's verification endpoint to validate the attestation,
        // extracts the public key, and stores it for future assertion verification
        try await apiClient.registerAttestation(
            keyId: keyId,
            attestationObject: attestationObject,
            challenge: challenge
        )
        
        keychain.set(true, forKey: Self.keychainAttested)
    }
    
    // MARK: - Phase 2: Assertion (per-session proof for DeepSense)
    
    /// Generates an assertion proving this request comes from the attested app
    /// on a genuine device. The assertion is bound to the session nonce,
    /// preventing replay attacks.
    ///
    /// - Parameter nonce: The session nonce from POST /v1/sessions response.
    ///   This binds the assertion to a specific verification session.
    /// - Returns: Base64-encoded assertion object, or nil if App Attest unavailable.
    func generateAssertion(nonce: String) async throws -> String? {
        guard isSupported,
              let keyId = keychain.string(forKey: Self.keychainKeyId),
              keychain.bool(forKey: Self.keychainAttested) == true else {
            return nil
        }
        
        // The clientDataHash MUST include the session nonce to bind the
        // assertion to this specific verification session. The backend will
        // verify this same hash when validating the assertion.
        let clientData = Data(nonce.utf8)
        let clientDataHash = Data(SHA256.hash(data: clientData))
        
        let assertionObject = try await service.generateAssertion(keyId, clientDataHash: clientDataHash)
        return assertionObject.base64EncodedString()
    }
    
    // MARK: - Key Rotation
    
    /// Invalidates the current key and forces re-attestation on next use.
    /// Call this if the backend rejects an assertion (e.g., counter mismatch).
    func rotateKey() {
        keychain.delete(forKey: Self.keychainKeyId)
        keychain.delete(forKey: Self.keychainAttested)
    }
}
```

#### 12.4.3 Integration with Capture Pipeline

The assertion token is generated **after** session creation (which provides the nonce) and **before** signal upload:

```swift
// In the session orchestrator:
func runVerification() async throws -> RedactedDecisionObject {
    // 1. CREATE session — get nonce
    let session = try await api.createSession(...)
    
    // 2. Generate App Attest assertion bound to session nonce
    //    This feeds the DeepSense device-trust pillar
    let appAttestToken = try await appAttestManager.generateAssertion(
        nonce: session.nonce
    )
    
    // 3. CAPTURE frames
    let frames = try await captureEngine.runTwoPhaseCapture(...)
    
    // 4. UPLOAD signals — include App Attest token in integrity signals
    let integritySignals = IOSIntegritySignals(
        isSimulator: EnvironmentChecks.isSimulator,
        isJailbroken: EnvironmentChecks.isJailbroken,
        isDebuggerAttached: EnvironmentChecks.isDebuggerAttached,
        appAttestToken: appAttestToken,  // <-- DeepSense device trust input
        bundleId: Bundle.main.bundleIdentifier ?? "",
        deviceModel: DeviceInfo.model,
        osVersion: UIDevice.current.systemVersion,
        screenResolution: DeviceInfo.screenResolution,
        processorCount: ProcessInfo.processInfo.processorCount,
        physicalMemoryMB: Int(ProcessInfo.processInfo.physicalMemory / 1_048_576),
        battery: BatteryInfo.current,
        connection: ConnectionInfo.current,
        timezone: TimeZone.current.identifier,
        locale: Locale.current.identifier
    )
    
    try await api.uploadSignals(
        sessionId: session.sessionId,
        sessionToken: session.sessionToken,
        frames: frames,
        integritySignals: integritySignals
    )
    
    // 5. COMPLETE
    return try await api.completeSession(...)
}
```

#### 12.4.4 iOS Integrity Signals Struct

```swift
public struct IOSIntegritySignals: Codable {
    let isSimulator: Bool              // TARGET_OS_SIMULATOR check
    let isJailbroken: Bool             // Check for Cydia, suspicious paths
    let isDebuggerAttached: Bool       // sysctl P_TRACED check
    let appAttestToken: String?        // DCAppAttestService assertion (base64-encoded)
    let bundleId: String               // Bundle.main.bundleIdentifier
    let deviceModel: String            // utsname().machine
    let osVersion: String              // UIDevice.current.systemVersion
    let screenResolution: String       // UIScreen.main.nativeBounds
    let processorCount: Int            // ProcessInfo.processInfo.processorCount
    let physicalMemoryMB: Int          // ProcessInfo.processInfo.physicalMemory
    let battery: BatteryInfo?
    let connection: ConnectionInfo?    // NWPathMonitor
    let timezone: String               // TimeZone.current.identifier
    let locale: String                 // Locale.current.identifier
}
```

#### 12.4.5 DeepSense Score: Platform Comparison

| Signal | iOS (App Attest) | Android (Play Integrity) | Impact on DeepSense |
|--------|-------------------|--------------------------|---------------------|
| **API** | `DCAppAttestService` (DeviceCheck framework) | Google Play Integrity API | Primary device-trust input |
| **Key storage** | Secure Enclave (hardware-backed) | Android Keystore (TEE/StrongBox) | Hardware root of trust |
| **Attestation** | One-time: `attestKey()` → CBOR object validated by Apple | One-time: Classic API request to Google servers | Registers device identity |
| **Per-session proof** | `generateAssertion()` bound to session nonce | `requestIntegrityToken()` bound to session nonce | Per-session freshness |
| **Replay prevention** | Monotonic counter + nonce binding | Nonce binding + token expiry | Anti-replay guarantee |
| **What it proves** | App is unmodified, running on genuine Apple hardware with Secure Enclave | App is unmodified, installed from Play Store, on certified device | Device + app authenticity |
| **Backend validation** | Apple attestation verification endpoint | Google Play Integrity decryption + verification | Server-side trust anchor |
| **Fallback if unavailable** | `isSupported = false` on simulator/old devices → token is `nil` | Not available on non-GMS devices → token is `nil` | Degrades `deepsense_score`; may shift APPROVE → MANUAL_REVIEW |
| **Payload field** | `ios_integrity.app_attest_token` | `android_integrity.play_integrity_token` | Unified backend processing |

#### 12.4.6 Error Handling & Graceful Degradation

```swift
extension AppAttestManager {
    /// Attempts to generate an assertion, falling back gracefully on failure.
    /// App Attest failures should NEVER block the verification flow —
    /// the backend will simply score the session with reduced device trust.
    func generateAssertionSafe(nonce: String) async -> String? {
        guard isSupported else {
            // Simulator, old device, or enterprise config — expected nil
            return nil
        }
        
        do {
            return try await generateAssertion(nonce: nonce)
        } catch DCError.invalidKey {
            // Key was invalidated (e.g., OS update, backup restore)
            // Rotate and re-attest on next session
            rotateKey()
            return nil
        } catch DCError.serverUnavailable {
            // Apple's attestation server temporarily unreachable
            // Proceed without token — backend degrades DeepSense accordingly
            return nil
        } catch {
            // Unknown error — log and proceed
            Logger.sdk.warning("App Attest assertion failed: \(error.localizedDescription)")
            return nil
        }
    }
}
```

> **CRITICAL: App Attest Must Not Block Verification**
> If `DCAppAttestService.isSupported` returns `false`, or if attestation/assertion fails for any reason, the SDK MUST still proceed with the verification flow. The `appAttestToken` field will be `nil`, and the backend's DeepSense scoring will account for the missing signal by reducing the `channel_trust_score` component. This mirrors the Android SDK's behavior when Play Integrity is unavailable on non-GMS devices.

### 12.5 API Key Security

- Store production API keys in the iOS Keychain (`kSecClassGenericPassword`)
- Do NOT embed production keys in the binary or `Info.plist`
- The `gatewayKey` (Supabase anon key) is public and CAN be bundled
- Use App Attest (`DCAppAttestService`) for device integrity — see §12.4 for full implementation

---

## 13. Type Definitions (Swift)

### 13.1 Configuration

```swift
public struct UseSenseConfig {
    public let apiBaseUrl: String
    public let apiKey: String
    public var gatewayKey: String? = nil
    public var environment: Environment? = nil
    public var branding: BrandingConfig? = nil
    public var options: SDKOptions? = nil
}

public struct BrandingConfig {
    public var logoUrl: String? = nil
    public var primaryColor: String = "#4F63F5"
    public var buttonRadius: CGFloat = 12
    public var fontFamily: String? = nil
}

public struct SDKOptions {
    public var audioEnabled: AudioMode = .riskBased
    public var stepUpPolicy: StepUpPolicy = .riskBased
    public var captureDurationMs: Int = 2500
    public var targetFps: Int = 15
    public var maxFrames: Int = 40
    public var maxUploadSizeMb: Int = 10
}

public enum AudioMode: String, Codable { case never, riskBased = "risk_based", always }
public enum StepUpPolicy: String, Codable { case riskBased = "risk_based", always, never }
public enum SessionType: String, Codable { case enrollment, authentication }
public enum Environment: String, Codable { case sandbox, production }
public enum Decision: String, Codable { case approve = "APPROVE", reject = "REJECT", manualReview = "MANUAL_REVIEW" }
```

### 13.2 Session Response Types

```swift
public struct CreateSessionResponse: Codable {
    public let sessionId: String
    public let sessionToken: String
    public let expiresAt: String
    public let nonce: String
    public let policy: SessionPolicy
    public let upload: UploadConfig
    
    enum CodingKeys: String, CodingKey {
        case sessionId = "session_id"
        case sessionToken = "session_token"
        case expiresAt = "expires_at"
        case nonce, policy, upload
    }
}

public struct SessionPolicy: Codable {
    public let requiresAudio: Bool
    public let requiresStepup: Bool
    public let challengeType: String
    public let challenge: ChallengeSpecWrapper?
    public let audioChallenge: SpeakPhraseChallenge?
    
    enum CodingKeys: String, CodingKey {
        case requiresAudio = "requires_audio"
        case requiresStepup = "requires_stepup"
        case challengeType = "challenge_type"
        case challenge
        case audioChallenge = "audio_challenge"
    }
}

public struct UploadConfig: Codable {
    public let maxFrames: Int
    public let targetFps: Int
    public let captureDurationMs: Int
    
    enum CodingKeys: String, CodingKey {
        case maxFrames = "max_frames"
        case targetFps = "target_fps"
        case captureDurationMs = "capture_duration_ms"
    }
}
```

### 13.3 Challenge Spec Types

```swift
public enum ChallengeSpecWrapper: Codable {
    case headTurn(HeadTurnChallenge)
    case followDot(FollowDotChallenge)
    
    // Custom decoding based on "type" discriminator
}

public struct HeadTurnChallenge: Codable {
    public let type: String  // "head_turn"
    public let seed: String
    public let sequence: [HeadTurnStep]
    public let totalDurationMs: Int
    public let framesPerStep: Int?
    public let captureFpsHint: Int?
    
    enum CodingKeys: String, CodingKey {
        case type, seed, sequence
        case totalDurationMs = "total_duration_ms"
        case framesPerStep = "frames_per_step"
        case captureFpsHint = "capture_fps_hint"
    }
}

public struct HeadTurnStep: Codable {
    public let direction: String  // "left"|"right"|"up"|"down"|"center"
    public let durationMs: Int
    public let index: Int
    
    enum CodingKeys: String, CodingKey {
        case direction
        case durationMs = "duration_ms"
        case index
    }
}

public struct FollowDotChallenge: Codable {
    public let type: String  // "follow_dot"
    public let seed: String
    public let waypoints: [FollowDotWaypoint]
    public let dotSizePx: Int
    public let totalDurationMs: Int
    public let framesPerStep: Int?
    public let captureFpsHint: Int?
    
    enum CodingKeys: String, CodingKey {
        case type, seed, waypoints
        case dotSizePx = "dot_size_px"
        case totalDurationMs = "total_duration_ms"
        case framesPerStep = "frames_per_step"
        case captureFpsHint = "capture_fps_hint"
    }
}

public struct FollowDotWaypoint: Codable {
    public let x: Float     // 0.0 - 1.0
    public let y: Float     // 0.0 - 1.0
    public let durationMs: Int
    public let index: Int
    
    enum CodingKeys: String, CodingKey {
        case x, y
        case durationMs = "duration_ms"
        case index
    }
}

public struct SpeakPhraseChallenge: Codable {
    public let type: String  // "speak_phrase"
    public let seed: String
    public let phrase: String
    public let phraseLanguage: String?
    public let totalDurationMs: Int
    
    enum CodingKeys: String, CodingKey {
        case type, seed, phrase
        case phraseLanguage = "phrase_language"
        case totalDurationMs = "total_duration_ms"
    }
}
```

### 13.4 Challenge Response Types (metadata.json)

```swift
public protocol ChallengeResponse: Codable {
    var type: String { get }
    var seed: String { get }
    var completed: Bool { get }
    var startedAt: String? { get }
    var completedAt: String? { get }
}

public struct FollowDotChallengeResponse: ChallengeResponse {
    public let type: String
    public let seed: String
    public let completed: Bool
    public let waypointFrames: [String: [Int]]
    public let startedAt: String?
    public let completedAt: String?
    public let frameTimestamps: [Int]
    
    enum CodingKeys: String, CodingKey {
        case type, seed, completed
        case waypointFrames = "waypoint_frames"
        case startedAt = "started_at"
        case completedAt = "completed_at"
        case frameTimestamps = "frame_timestamps"
    }
}

public struct HeadTurnChallengeResponse: ChallengeResponse {
    public let type: String
    public let seed: String
    public let completed: Bool
    public let stepFrames: [String: [Int]]
    public let startedAt: String?
    public let completedAt: String?
    public let frameTimestamps: [Int]
    
    enum CodingKeys: String, CodingKey {
        case type, seed, completed
        case stepFrames = "step_frames"
        case startedAt = "started_at"
        case completedAt = "completed_at"
        case frameTimestamps = "frame_timestamps"
    }
}

public struct SpeakPhraseChallengeResponse: ChallengeResponse {
    public let type: String
    public let seed: String
    public let completed: Bool
    public let startedAt: String?
    public let completedAt: String?
    
    enum CodingKeys: String, CodingKey {
        case type, seed, completed
        case startedAt = "started_at"
        case completedAt = "completed_at"
    }
}
```

### 13.5 Error Types

```swift
public enum UseSenseErrorCode: String, CaseIterable {
    case cameraPermissionDenied = "CAMERA_PERMISSION_DENIED"
    case micPermissionDenied = "MIC_PERMISSION_DENIED"
    case networkError = "NETWORK_ERROR"
    case sessionExpired = "SESSION_EXPIRED"
    case unauthorized = "UNAUTHORIZED"
    case invalidToken = "INVALID_TOKEN"
    case sessionNotFound = "SESSION_NOT_FOUND"
    case identityNotFound = "IDENTITY_NOT_FOUND"
    case invalidRequest = "INVALID_REQUEST"
    case quotaExceeded = "QUOTA_EXCEEDED"
    case userCancelled = "USER_CANCELLED"
    case faceNotDetected = "FACE_NOT_DETECTED"
    case lowLight = "LOW_LIGHT"
    case timeout = "TIMEOUT"
    case serverError = "SERVER_ERROR"
    case unknownError = "UNKNOWN_ERROR"
    
    public var userMessage: String {
        switch self {
        case .cameraPermissionDenied:
            return "We need camera access to verify your identity. Please allow camera access in Settings."
        case .micPermissionDenied:
            return "We need microphone access to complete verification. Please allow microphone access in Settings."
        case .networkError:
            return "Connection issue. Please check your internet and try again."
        case .sessionExpired:
            return "Your session has expired. Please start over."
        case .unauthorized:
            return "Authentication failed. Please check your API key."
        case .invalidToken:
            return "Session token is invalid. Please start a new session."
        case .sessionNotFound:
            return "Session not found. Please start a new session."
        case .identityNotFound:
            return "Identity not found. Please ensure the identity ID is correct."
        case .invalidRequest:
            return "Invalid request. Please check the parameters."
        case .quotaExceeded:
            return "Rate limit reached. Please try again later."
        case .userCancelled:
            return "Verification was cancelled."
        case .faceNotDetected:
            return "Please position your face in the frame and try again."
        case .lowLight:
            return "Lighting is too low. Please move to a brighter area."
        case .timeout:
            return "Verification took too long. Please try again."
        case .serverError:
            return "Server error. Please try again or contact support."
        case .unknownError:
            return "Something went wrong. Please try again."
        }
    }
}

public struct UseSenseError: Error, LocalizedError {
    public let code: UseSenseErrorCode
    public let message: String
    public let details: Any?
    
    public var errorDescription: String? { message }
}
```

### 13.6 Event Types

```swift
public enum UseSenseEventType: String, CaseIterable {
    case sessionCreated = "session_created"
    case permissionsRequested = "permissions_requested"
    case permissionsGranted = "permissions_granted"
    case permissionsDenied = "permissions_denied"
    case captureStarted = "capture_started"
    case frameCaptured = "frame_captured"
    case captureCompleted = "capture_completed"
    case audioRecordStarted = "audio_record_started"
    case audioRecordCompleted = "audio_record_completed"
    case challengeStarted = "challenge_started"
    case challengeCompleted = "challenge_completed"
    case uploadStarted = "upload_started"
    case uploadProgress = "upload_progress"
    case uploadCompleted = "upload_completed"
    case completeStarted = "complete_started"
    case decisionReceived = "decision_received"
    case imageQualityCheck = "image_quality_check"
    case error = "error"
}

public struct UseSenseEvent {
    public let type: UseSenseEventType
    public let timestamp: Date
    public let data: [String: Any]?
}

public typealias EventCallback = (UseSenseEvent) -> Void
```

### 13.7 Public API Interface

```swift
public protocol UseSenseClient {
    var config: UseSenseConfig { get }
    
    func startEnrollment(
        externalUserId: String?,
        metadata: [String: Any]?
    ) async throws -> CreateSessionResponse
    
    func startAuthentication(
        identityId: String,
        metadata: [String: Any]?
    ) async throws -> CreateSessionResponse
    
    func runVerificationSession(
        sessionId: String,
        sessionToken: String
    ) async throws -> RedactedDecisionObject
    
    func setMockScenario(_ scenario: String)
    func onEvent(_ callback: @escaping EventCallback) -> () -> Void
}

// Factory:
public func createUseSenseClient(config: UseSenseConfig) -> UseSenseClient

// SwiftUI View:
public struct UseSenseVerificationView: View {
    public init(
        client: UseSenseClient,
        sessionType: SessionType,
        identityId: String? = nil,
        externalUserId: String? = nil,
        metadata: [String: Any]? = nil,
        onEvent: EventCallback? = nil,
        onComplete: @escaping (RedactedDecisionObject) -> Void,
        onError: @escaping (UseSenseError) -> Void
    )
}
```

---

## 14. Demo App Specification

### 14.1 Demo App Features

| Feature | Description |
|---------|-------------|
| Mode Toggle | Segmented control: Mock Mode / Live Mode |
| API Key Input | `TextField` for `sk_`/`pk_`/`dk_` keys (Live mode) |
| Environment Badge | Auto-detected: `pk_` = production, `sk_`/`dk_` = sandbox |
| Mock Scenario Picker | `Picker` with wheel/menu: APPROVE, REJECT, MANUAL_REVIEW, Head Turn, Follow Dot, Speak Phrase, Random |
| Enrollment Flow | External User ID input + "Start Enrollment" button |
| Authentication Flow | Identity ID input + "Start Authentication" button |
| Result Display | Decision badge: APPROVE (green), REJECT (red), MANUAL_REVIEW (amber) |
| Identity ID Copy | Copy to pasteboard button for returned `identity_id` |
| Session ID Display | Read-only text showing `session_id` |
| Debug Log | Scrollable `List` showing timestamped SDK events |
| Branding Config | `ColorPicker` for primary color, `TextField` for logo URL |
| Advanced Settings | Collapsible section: audio mode toggle |

### 14.2 Demo App Color Palette

| Element | Color | Notes |
|---------|-------|-------|
| Mock mode (active) | `#9333EA` (purple) | Segmented control tint |
| Live mode (active) | `#16A34A` (green) | Segmented control tint |
| APPROVE badge | `#16A34A` (green) | Result badge |
| REJECT badge | `#DC2626` (red) | Result badge |
| MANUAL_REVIEW badge | `#CA8A04` (amber) | Result badge |
| API key card | `#BFDBFE` border (blue) | Configuration section |
| Mock scenario card | `#E9D5FF` border (purple) | Scenario picker section |
| Background | `Color(.systemGroupedBackground)` | Standard iOS grouped bg |

### 14.3 Demo App Structure

```
UseSenseDemo/
├── UseSenseDemoApp.swift           // @main entry point
├── ContentView.swift               // Root view with mode toggle
├── Views/
│   ├── MockConfigView.swift        // Scenario picker
│   ├── LiveConfigView.swift        // API key input
│   ├── EnrollmentView.swift        // Enrollment tab
│   ├── AuthenticationView.swift    // Authentication tab
│   ├── ResultView.swift            // Decision display
│   └── DebugLogView.swift          // Event log
├── ViewModels/
│   └── DemoViewModel.swift         // @Observable state management
└── Assets.xcassets/
    ├── AppIcon.appiconset/
    └── Colors/
```

### 14.4 Demo App Layout (SwiftUI)

```swift
struct ContentView: View {
    @State private var viewModel = DemoViewModel()
    
    var body: some View {
        NavigationStack {
            Form {
                // Mode Toggle
                Section {
                    Picker("Mode", selection: $viewModel.mode) {
                        Text("Mock").tag(DemoMode.mock)
                        Text("Live").tag(DemoMode.live)
                    }
                    .pickerStyle(.segmented)
                }
                
                // Config
                if viewModel.mode == .mock {
                    MockConfigView(scenario: $viewModel.mockScenario)
                } else {
                    LiveConfigView(apiKey: $viewModel.apiKey)
                }
                
                // Flows
                Section("Verification") {
                    TabView {
                        EnrollmentView(viewModel: viewModel).tabItem { Label("Enroll", systemImage: "person.badge.plus") }
                        AuthenticationView(viewModel: viewModel).tabItem { Label("Auth", systemImage: "faceid") }
                    }
                }
                
                // Results
                if let result = viewModel.sessionResult {
                    ResultView(result: result)
                }
                
                // Debug
                DebugLogView(logs: viewModel.debugLogs)
            }
            .navigationTitle("UseSense SDK")
            .fullScreenCover(isPresented: $viewModel.showVerification) {
                UseSenseVerificationView(
                    client: viewModel.client,
                    sessionType: viewModel.activeFlow!,
                    externalUserId: viewModel.externalUserId,
                    identityId: viewModel.identityId,
                    onEvent: viewModel.handleEvent,
                    onComplete: viewModel.handleComplete,
                    onError: viewModel.handleError
                )
            }
        }
    }
}
```

### 14.5 iOS-Specific Considerations

| Consideration | Implementation |
|--------------|---------------|
| Camera permission | Request via `AVCaptureDevice.requestAccess(for: .video)` before showing `CaptureScreen` |
| Microphone permission | Request via `AVCaptureDevice.requestAccess(for: .audio)` if `requires_audio` |
| Permission denied | Show alert with "Open Settings" button linking to `UIApplication.openSettingsURLString` |
| Background handling | Pause capture when app backgrounds (`UIApplication.willResignActiveNotification`) |
| Orientation lock | Lock to portrait during verification: `UIDevice.current.setValue(UIInterfaceOrientation.portrait.rawValue, forKey: "orientation")` |
| Memory pressure | Monitor `UIApplication.didReceiveMemoryWarningNotification`, reduce frame quality if needed |
| App Attest | Use `DCAppAttestService.shared` for device integrity token — see §12.4 for full attestation/assertion lifecycle and DeepSense integration |

---

## Appendix A: File Reference (Web SDK)

| File | Purpose |
|------|---------|
| `types.ts` | All TypeScript type definitions |
| `client.ts` | Client factory and implementation |
| `api.ts` | HTTP API layer with mock mode |
| `capture/video.ts` | Camera access and frame capture |
| `capture/audio.ts` | Microphone access and audio recording |
| `capture/image-quality.ts` | Real-time quality analysis (Laplacian + lighting) |
| `integrity/web-signals.ts` | Web integrity signal collection |
| `integrity/webauthn.ts` | WebAuthn credential creation |
| `utils/errors.ts` | Error code mapping and user messages |
| `utils/events.ts` | Event emitter system |
| `utils/redact.ts` | Decision redaction utility |
| `components/styles.ts` | CSS theme and style definitions |
| `components/UseSenseVerification.tsx` | Main orchestrator component |
| `components/QualityIndicator.tsx` | Real-time quality overlay |
| `components/screens/IntroScreen.tsx` | Loading/init screen |
| `components/screens/PermissionScreen.tsx` | Camera/mic permission request |
| `components/screens/CaptureScreen.tsx` | Camera preview with quality |
| `components/screens/ChallengeScreen.tsx` | Two-phase capture with challenges |
| `components/screens/UploadingScreen.tsx` | Upload progress screen |
| `components/screens/SuccessScreen.tsx` | Approval/review outcome |
| `components/screens/DeniedScreen.tsx` | Denial/review outcome |
| `components/screens/FailureScreen.tsx` | Error outcome |
| `components/screens/BlockedScreen.tsx` | Rate-limited outcome |

---

## Appendix B: Direction Labels and Arrows

| Direction | Label Text | Arrow Character | SF Symbol Alternative |
|-----------|-----------|----------------|----------------------|
| `left` | "Turn your head LEFT" | `\u{2190}` | `arrow.left` |
| `right` | "Turn your head RIGHT" | `\u{2192}` | `arrow.right` |
| `up` | "Tilt your head UP" | `\u{2191}` | `arrow.up` |
| `down` | "Tilt your head DOWN" | `\u{2193}` | `arrow.down` |
| `center` | "Look straight ahead" | `\u{25CB}` | `circle` |

---

## Appendix C: AVFoundation Camera Setup

```swift
class CaptureEngine: NSObject {
    private let session = AVCaptureSession()
    private let videoDataOutput = AVCaptureVideoDataOutput()
    private var previewLayer: AVCaptureVideoPreviewLayer?
    
    func configure() throws {
        session.beginConfiguration()
        session.sessionPreset = .hd1280x720
        
        // Front camera
        guard let device = AVCaptureDevice.default(.builtInWideAngleCamera,
                                                     for: .video,
                                                     position: .front) else {
            throw UseSenseError(code: .cameraPermissionDenied,
                              message: "No front camera available")
        }
        
        let input = try AVCaptureDeviceInput(device: device)
        session.addInput(input)
        
        // Video data output (for frame capture)
        videoDataOutput.videoSettings = [
            kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA
        ]
        videoDataOutput.alwaysDiscardsLateVideoFrames = true
        session.addOutput(videoDataOutput)
        
        // CRITICAL: Do NOT mirror the data output
        if let connection = videoDataOutput.connection(with: .video) {
            connection.isVideoMirrored = false  // RAW frames
            connection.videoOrientation = .portrait
        }
        
        session.commitConfiguration()
        
        // Preview layer — mirrored for selfie view
        previewLayer = AVCaptureVideoPreviewLayer(session: session)
        previewLayer?.videoGravity = .resizeAspectFill
        if let previewConnection = previewLayer?.connection,
           previewConnection.isVideoMirroringSupported {
            previewConnection.automaticallyAdjustsVideoMirroring = false
            previewConnection.isVideoMirrored = true  // Mirror preview only
        }
    }
    
    func captureFrame() -> Data? {
        // Grab latest CVPixelBuffer from delegate
        // Convert to JPEG at 0.85 quality
        // Return raw, non-mirrored JPEG data
    }
}
```

---

*End of specification.*
