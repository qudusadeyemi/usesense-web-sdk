# UseSense Android SDK — Technical Design Specification

**Version:** 1.17.7  
**Date:** March 7, 2026  
**Platform:** Android (Kotlin / Jetpack Compose)  
**Min SDK:** API 26 (Android 8.0)  
**Target SDK:** API 35  
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
13. [Type Definitions (Kotlin)](#13-type-definitions-kotlin)
14. [Demo App Specification](#14-demo-app-specification)

---

## 1. Overview & Architecture

### 1.1 Session Lifecycle

The SDK follows a four-step session lifecycle against the UseSense backend:

```
1. CREATE  ──  POST /v1/sessions
2. CAPTURE ──  Two-phase: baseline + per-step challenge
3. UPLOAD  ──  POST /v1/sessions/{id}/signals (multipart/form-data)
4. COMPLETE ── POST /v1/sessions/{id}/complete → RedactedDecisionObject
```

```kotlin
// 1. CREATE — POST /v1/sessions
val session = api.createSession(type = "enrollment", platform = "android")
// Returns: session_id, session_token, nonce, policy, upload config

// 2. CAPTURE — Two-phase: baseline + challenge
val frames = captureEngine.runTwoPhaseCapture(
    uploadConfig = session.upload,
    challengeSpec = session.policy.challenge
)

// 3. UPLOAD — POST /v1/sessions/{id}/signals
api.uploadSignals(session.sessionId, session.sessionToken, frames, metadata)

// 4. COMPLETE — POST /v1/sessions/{id}/complete
val decision = api.completeSession(session.sessionId, session.sessionToken)
// Returns: RedactedDecisionObject (APPROVE | REJECT | MANUAL_REVIEW)
```

### 1.2 Screen Flow (State Machine)

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

### 1.3 Two-Phase Capture Pattern

| Phase | Duration | Frame Budget | UI Overlay |
|-------|----------|-------------|------------|
| Instructions | User-gated (tap to dismiss) | 0 frames | Modal with challenge type explanation |
| Face Guide | User-gated (tap to dismiss) | 0 frames | Oval cutout with dashed border + pulse animation |
| Baseline | 2000ms | ~30% of max_frames | Subtle oval border, "Keep still" text |
| Countdown | 3000ms (3 x 1000ms) | Continues capturing | 3-2-1 pop animation with indigo text |
| Challenge | Server-spec-driven | ~70% of max_frames | Challenge-specific overlay (dot/arrow/phrase) |

> **CRITICAL: No Frame Mirroring**  
> Captured frames MUST be raw, non-mirrored. The camera preview CAN be mirrored (standard Android selfie behavior), but the actual JPEG frames sent to the backend MUST NOT have any horizontal flip. The backend's pose analysis (AWS Rekognition) expects raw camera orientation.

---

## 2. Logo & Brand Assets

### 2.1 Logo Construction

The UseSense logo is a rounded-rectangle icon containing a shield with a biometric eye scanner and a green checkmark badge.

**SVG source (export for Android VectorDrawable):**

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
| Logo icon base | 64x64dp, corner radius 16dp | Gradient: `#4F63F5` to `#4F46E5` at 135 degrees |
| Shield outline | 2dp stroke, white | Path centered in icon |
| Biometric eye outer | 8dp radius circle, 2dp stroke | White stroke, no fill, centered at ~47% height |
| Biometric eye inner | 3dp radius circle | White fill (iris dot) |
| Scan crosshair lines | 1.5dp stroke, white, 60% opacity | 4 lines extending from eye ring outward |
| Success badge | 8dp radius green circle | `#10B981` fill, 2dp white stroke, bottom-right |
| Checkmark path | 2dp stroke, white | Inside badge circle |
| Clear space | Minimum 8dp on all sides | No other elements within clear space |
| Minimum display size | 24dp (icon-only), 32dp (with text) | Below this, legibility degrades |

### 2.3 Logo Text Lockup

When displayed with text, the layout is horizontal:

```
[Icon 36-64dp]  [14dp gap]  UseSense        (22sp, W700, #1A1A1A or #FFFFFF)
                            ANDROID SDK      (12sp, W500, #6B7280 or rgba(255,255,255,0.7))
```

- Light background: text `#1A1A1A`, subtitle `#6B7280`
- Dark background: text `#FFFFFF`, subtitle `rgba(255,255,255,0.7)`

---

## 3. Color System

### CRITICAL COLOR RULE

> The **indigo guidance theme** applies ONLY to quality indicators, capture-screen warnings, challenge dots, and challenge-screen quality banners. **Outcome screens MUST use their original semantic colors:**  
> - Red (`#EF4444`) for failure/error  
> - Emerald green (`#10B981`) for success  
> - Amber (`#F59E0B`) for manual review  

### 3.1 Brand & Primary Colors

| Name | Hex | Usage |
|------|-----|-------|
| Primary | `#4F63F5` | Buttons, progress bars, links, primary actions |
| Primary Dark | `#4F46E5` | Pressed states, countdown text, instruction CTA, "My face is ready" button |
| Primary Light | `#6366F1` | Challenge dot fill, phase badges, indigo UI accents |

### 3.2 Indigo Guidance Theme (Quality + Challenge UI ONLY)

| Name | Value | Usage |
|------|-------|-------|
| Critical | `rgba(124, 58, 237, 0.9)` / `#7C3AED` @ 90% | Critical quality warnings (blur, very dark) |
| Warning | `rgba(167, 139, 250, 0.9)` / `#A78BFA` @ 90% | Moderate quality issues (slightly dark/blurry) |
| Info | `rgba(99, 102, 241, 0.9)` / `#6366F1` @ 90% | Quality-good state indicator |
| Critical Banner BG | `rgba(124, 58, 237, 0.1)` | Quality warning banner background (poor) |
| Warning Banner BG | `rgba(167, 139, 250, 0.1)` | Quality warning banner background (acceptable) |
| Critical Banner Text | `#6D28D9` | Quality warning text when quality is poor |
| Warning Banner Text | `#7C3AED` | Quality warning text when quality is acceptable |
| Critical Banner Border | `rgba(124, 58, 237, 0.2)` | Border for poor-quality banner |
| Warning Banner Border | `rgba(167, 139, 250, 0.2)` | Border for acceptable-quality banner |
| Critical Glow | `rgba(124, 58, 237, 0.6)` | Video container border glow when quality is poor |
| Acceptable Glow | `rgba(167, 139, 250, 0.5)` | Video container border glow when quality is acceptable |

### 3.3 Semantic Outcome Colors (Outcome Screens ONLY)

| Name | Hex | Usage |
|------|-----|-------|
| Success / Approve | `#10B981` | SuccessScreen icon, checkmark circle |
| Error / Reject | `#EF4444` | FailureScreen icon, DeniedScreen icon, error text |
| Manual Review / Amber | `#F59E0B` | Under Review icon (info circle with amber) |

### 3.4 Neutral Palette

| Name | Hex | Usage |
|------|-----|-------|
| Background | `#F8F9FA` | Full-screen container background |
| Surface | `#FFFFFF` | Card / screen background |
| Text Primary | `#1A1A1A` | Titles, primary body text |
| Text Secondary | `#6B7280` | Subtitles, descriptions, captions |
| Border | `#E5E7EB` | Dividers, input borders, progress bar track, secondary button border |
| Video BG | `#000000` | Camera preview container background |

### 3.5 Challenge-Specific Colors

| Element | Value | Notes |
|---------|-------|-------|
| Challenge dot fill | `#6366F1` | Indigo, matches primary light |
| Challenge dot border | `#FFFFFF`, 2dp | White ring around dot |
| Challenge dot glow | `rgba(99, 102, 241, 0.5)` | `box-shadow: 0 0 12dp 4dp` equivalent |
| Direction arrow circle | `linear-gradient(135deg, #4F46E5, #6366F1)` | Indigo gradient for head_turn |
| Direction arrow circle (center) | `linear-gradient(135deg, #6366F1, #8B5CF6)` | Slightly lighter for "center" direction |
| Direction arrow glow | `rgba(99, 102, 241, 0.5)` | Shadow: `0 0 30dp` equivalent |
| Countdown overlay | `rgba(0, 0, 0, 0.4)` | Semi-transparent dark overlay |
| Countdown circle | `rgba(255, 255, 255, 0.95)` | White circle behind number |
| Countdown number | `#4F46E5` | Indigo number text |
| Countdown label BG | `rgba(0, 0, 0, 0.6)` | "Get ready..." pill background |
| Face guide overlay | `radial-gradient(ellipse 55% 42% at 50% 50%, transparent 98%, rgba(0,0,0,0.6) 100%)` | Oval cutout mask |
| Face guide dashed border | `rgba(255, 255, 255, 0.8)`, 3dp dashed | Animated pulsing oval |
| Face guide label BG | `rgba(0, 0, 0, 0.6)` | "Position your face" pill |
| Face guide button | `#4F46E5` fill, white text, 16dp radius | "My face is ready" CTA |
| Instructions modal overlay | `rgba(0, 0, 0, 0.75)` | Full-screen backdrop |
| Instructions modal BG | `#FFFFFF`, 16dp radius | Centered card |
| Instructions icon circle | `#E0E7FF` background, `#4F46E5` icon color | 48dp circle |
| Instructions title | `#1E293B` | 16sp Bold |
| Instructions body | `#64748B` | 13sp Regular |
| Instructions CTA | `#4F46E5` fill, white text, 10dp radius | "Got it -- start challenge" |

---

## 4. Typography

### 4.1 Font Family

The Web SDK uses the system font stack: `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto`. On Android, this maps directly to the default **Roboto** font family. Use `FontFamily.Default` in Compose or `sans-serif` in XML layouts.

### 4.2 Type Scale

| Element | Web CSS | Android Equivalent | Size / Weight |
|---------|---------|-------------------|---------------|
| Screen Title | `font-size: 20px; font-weight: 600` | `MaterialTheme.typography.titleLarge` | 20sp / SemiBold (W600) |
| Screen Title (compact) | `font-size: 18px; font-weight: 600` | `MaterialTheme.typography.titleMedium` | 18sp / SemiBold (W600) |
| Screen Subtitle | `font-size: 14px; font-weight: 400; line-height: 1.5` | `MaterialTheme.typography.bodyMedium` | 14sp / Regular (W400) |
| Button Text | `font-size: 16px; font-weight: 500` | `MaterialTheme.typography.labelLarge` | 16sp / Medium (W500) |
| Phase Badge | `font-size: 12px; font-weight: 600; letter-spacing: 0.5px` | `MaterialTheme.typography.labelSmall` | 12sp / SemiBold (W600) |
| Quality Banner Text | `font-size: 12px; font-weight: 500` | `MaterialTheme.typography.bodySmall` | 12sp / Medium (W500) |
| Quality Overlay Text | `font-size: 13px; font-weight: 600` | `MaterialTheme.typography.labelMedium` | 13sp / SemiBold (W600) |
| Countdown Number | `font-size: 60px; font-weight: 900` | `MaterialTheme.typography.displayLarge` | 60sp / Black (W900) |
| Countdown Label | `font-size: 14px; font-weight: 600` | `MaterialTheme.typography.labelMedium` | 14sp / SemiBold (W600) |
| Instructions Title | `font-size: 16px; font-weight: 700` | `MaterialTheme.typography.titleMedium` | 16sp / Bold (W700) |
| Instructions Body | `font-size: 13px; font-weight: 400; line-height: 1.5` | `MaterialTheme.typography.bodySmall` | 13sp / Regular (W400) |
| Direction Arrow | `font-size: 48px; font-weight: bold` | `MaterialTheme.typography.displayMedium` | 48sp / Bold |
| Capture Guidance Banner | `font-size: 14px; font-weight: 500` | `MaterialTheme.typography.bodyMedium` | 14sp / Medium (W500) |
| Footer Caption | `font-size: 12px; font-weight: 400` | `MaterialTheme.typography.bodySmall` | 12sp / Regular (W400) |
| Error Info Caption | `font-size: 12px; color: #94A3B8; line-height: 1.5` | `MaterialTheme.typography.bodySmall` | 12sp / Regular, color `#94A3B8` |

---

## 5. Layout & Responsive

### 5.1 Screen Card Container

The SDK renders each screen inside a centered card. On phones, this card fills the available width.

| Property | Web Value | Android dp | Notes |
|----------|-----------|-----------|-------|
| Max width | `480px` | `480dp` | On phones, fills screen width minus horizontal padding |
| Max height | `95vh` | `95%` of screen height | Scrollable if content overflows |
| Padding | `24px` all sides | `24dp` | Internal padding |
| Border radius | `16px` | `16dp` | Card corners |
| Background | `#FFFFFF` | `Color.White` | Surface color |
| Shadow | `0 4px 6px rgba(0,0,0,0.1)` | `elevation = 4dp` | Material elevation |
| Text alignment | `text-align: center` | `Alignment.CenterHorizontally` | All text centered within card |

### 5.2 Video Preview Container

| Property | Web Value | Android dp | Notes |
|----------|-----------|-----------|-------|
| Max width | `340px` | `340dp` | On phones narrower than 340dp, fills card minus padding |
| Max height | `50vh` | `50%` of screen height | Prevents oversized preview on tablets |
| Border radius | `16px` | `16dp` | Clips camera preview and overlays |
| Overflow | `hidden` | `Modifier.clip(RoundedCornerShape(16.dp))` | Clips all overlay elements to container |
| Background | `#000000` | `Color.Black` | Visible while camera initializes |
| Aspect ratio | Natural from video | Maintain source aspect ratio | Typically 9:16 or 3:4 on mobile |
| Mirror transform (PREVIEW) | `CSS transform: scaleX(-1)` | `Matrix.setScale(-1f, 1f)` on TextureView | **Preview only** |
| Mirror transform (CAPTURE) | **NONE** | **NONE** | Frames must be raw orientation |
| Bottom margin (capture screen) | `12px` | `12dp` | Below video container |
| Bottom margin (challenge screen) | `0px` | `0dp` | Flush with quality banner below |

### 5.3 Responsive Breakpoints

| Screen Width | Category | Card Behavior | Video Max Width |
|-------------|----------|--------------|----------------|
| < 360dp | Small phone | Full width, padding reduced to `16dp` | Full card width |
| 360-411dp | Standard phone | Full width, padding `24dp` | `340dp` |
| 412-599dp | Large phone | Max `480dp`, centered | `340dp` |
| 600-839dp | Small tablet | Max `480dp`, centered | `400dp` |
| 840dp+ | Large tablet | Max `480dp`, centered | `400dp` |

### 5.4 Safe Area Handling

- Account for system bars (status bar, navigation bar) and display cutouts (notch, punch-hole cameras).
- Use `WindowInsetsCompat` (Jetpack) for proper padding.
- The camera preview MAY extend behind the status bar when in full-screen verification mode.
- Use `WindowCompat.setDecorFitsSystemWindows(window, false)` for edge-to-edge layout.

### 5.5 Full-Screen Container

The entire verification flow renders in a full-screen container:

| Property | Value |
|----------|-------|
| Background | `#F8F9FA` (Background color) |
| Layout | Vertical center + horizontal center |
| Minimum height | `100%` of screen |
| Padding | `16dp` on all sides (around the card) |

---

## 6. Component Specifications

### 6.1 Primary Button (`.usesense-button`)

| Property | Value |
|----------|-------|
| Background | `#4F63F5` (Primary) — overridden by `branding.primaryColor` if set |
| Text color | `#FFFFFF` |
| Font | 16sp Medium (W500) |
| Min height | `48dp` |
| Padding | `14dp` vertical, `32dp` horizontal |
| Corner radius | `12dp` (overridden by `branding.buttonRadius` if set) |
| Width | Match parent (full width of card) |
| Pressed state | Opacity `0.9` + Material ripple |
| Disabled state | Opacity `0.5`, non-clickable |

### 6.2 Secondary Button (`.usesense-button-secondary`)

| Property | Value |
|----------|-------|
| Background | Transparent |
| Text color | `#1A1A1A` (Text Primary) |
| Border | `1dp` solid `#E5E7EB` |
| All other properties | Same as Primary Button |

### 6.3 Progress Bar

| Property | Value |
|----------|-------|
| Track height | `4dp` |
| Track color | `#E5E7EB` |
| Track corner radius | `2dp` |
| Fill color | `#4F63F5` (Primary) |
| Fill animation | `300ms` ease transition on width |
| Width | Match parent |
| Margin | `24dp` top and bottom (default), can be overridden per screen |

### 6.4 Loading Spinner

| Property | Value |
|----------|-------|
| Size | `48dp x 48dp` |
| Ring width | `4dp` |
| Track color | `#E5E7EB` |
| Active segment color | `#4F63F5` (Primary) |
| Animation | `1000ms` linear infinite rotation |
| Implementation | `CircularProgressIndicator` in Compose |

### 6.5 Phase Badge (Challenge Screen)

All badges share: padding `4dp` vertical / `12dp` horizontal, corner radius `20dp`, font `12sp` SemiBold (W600), letter-spacing `0.5sp`.

| Phase | Background | Text Color | Label |
|-------|-----------|-----------|-------|
| BASELINE | `rgba(99, 102, 241, 0.9)` | `#FFFFFF` | `"BASELINE"` |
| CHALLENGE | `rgba(79, 70, 229, 0.9)` | `#FFFFFF` | `"CHALLENGE"` |
| COMPLETE | `rgba(99, 102, 241, 0.15)` | `#4F46E5` | `"COMPLETE"` |

### 6.6 Quality Warning Banner

Displayed below the video container when quality issues are detected.

| Property | Poor Quality | Acceptable Quality |
|----------|-------------|-------------------|
| Background | `rgba(124, 58, 237, 0.1)` | `rgba(167, 139, 250, 0.1)` |
| Text color | `#6D28D9` | `#7C3AED` |
| Border | `1dp solid rgba(124, 58, 237, 0.2)` | `1dp solid rgba(167, 139, 250, 0.2)` |
| Icon (leading) | Warning emoji | Lightbulb emoji |
| Padding | `8dp` vertical / `12dp` horizontal | Same |
| Corner radius | `8dp` | Same |
| Font | `12sp` Medium (W500) | Same |
| Layout | `Row`: icon (14sp) + gap (6dp) + message text | Same |
| Margin-top | `8dp` (from video container bottom) | Same |
| Transition | `300ms` ease (all properties) | Same |

### 6.7 Video Border Quality Glow

When image quality degrades, the video container gets a colored border/glow:

| Quality Level | Border Effect | Transition |
|--------------|--------------|-----------|
| Good | None (transparent) | N/A |
| Acceptable | `3dp` solid `rgba(167, 139, 250, 0.5)` | `400ms` ease |
| Poor | `3dp` solid `rgba(124, 58, 237, 0.6)` | `400ms` ease |

Implementation: Use `Modifier.border()` with animated color in Compose, or a `GradientDrawable` stroke in Views.

### 6.8 Face Guide Overlay (v1.17.5)

| Element | Spec |
|---------|------|
| Mask | Radial gradient: `ellipse 55% 42% at 50% 50%`, transparent center fading to `rgba(0,0,0,0.6)` |
| Dashed oval | Width `55%` of container, aspect ratio `3:4`, border `3dp dashed rgba(255,255,255,0.8)`, border-radius `50%`, pulsing animation |
| Top label | Pill with `rgba(0,0,0,0.6)` background, white text, `14sp` W500, `9999dp` radius |
| Bottom button | `#4F46E5` background, white text, `16sp` W700, `16dp` radius, `12dp` vert / `32dp` horiz padding, elevation shadow |

### 6.9 Countdown Overlay (v1.17.5)

| Element | Spec |
|---------|------|
| Background | `rgba(0, 0, 0, 0.4)` full overlay |
| Number circle | `112dp` diameter (scaled down for small screens), `rgba(255,255,255,0.95)` fill, shadow `elevation 12dp` |
| Number text | `60sp` W900 (Black weight), color `#4F46E5` |
| Label pill | `rgba(0,0,0,0.6)` background, white text `14sp` W600, `9999dp` radius |
| Pop animation | `900ms` ease-out: scale `0.3 -> 1.15 -> 1.0`, opacity `0 -> 1` |
| Layout | Centered column: number circle + `12dp` gap + label pill |

### 6.10 Instructions Modal Overlay

| Element | Spec |
|---------|------|
| Backdrop | `rgba(0, 0, 0, 0.75)`, full screen, centered content |
| Modal card | `#FFFFFF`, `16dp` radius, `28dp` top/bottom + `24dp` left/right padding, max width `320dp`, width `90%` of screen, shadow `elevation 12dp` |
| Icon circle | `48dp`, `#E0E7FF` background, `24sp` emoji/icon, centered |
| Title | `16sp` W700, `#1E293B`, `8dp` bottom margin |
| Body text | `13sp` W400, `#64748B`, line-height `1.5`, `20dp` bottom margin |
| CTA button | Full width, `12dp` vert / `24dp` horiz padding, `10dp` radius, `#4F46E5` fill, white text `14sp` W600 |
| Challenge icons | follow_dot: red circle emoji, head_turn: arrows emoji, speak_phrase: microphone emoji |

### 6.11 Challenge Dot (follow_dot)

| Property | Value |
|----------|-------|
| Size | Server-driven `dot_size_px` (default `24dp`) |
| Fill | `#6366F1` (indigo) |
| Border | `2dp` solid white |
| Glow | Shadow equivalent of `0 0 12dp 4dp rgba(99, 102, 241, 0.5)` |
| Position | `left` and `top` as percentage of video container (from `waypoint.x * 100%`, `waypoint.y * 100%`) |
| Transform | Centered on position point (`translate(-50%, -50%)`) |
| Movement | `400ms cubic-bezier(0.4, 0, 0.2, 1)` transition on position |

### 6.12 Direction Arrow (head_turn)

| Property | Value |
|----------|-------|
| Container | `96dp` circle, centered in video |
| Background | Gradient `135deg: #4F46E5 -> #6366F1` (or `#6366F1 -> #8B5CF6` for "center") |
| Arrow character | `48sp` bold white: left=`\u2190`, right=`\u2192`, up=`\u2191`, down=`\u2193`, center=`\u25CB` |
| Shadow | `0 0 30dp rgba(99, 102, 241, 0.5)` + `0 8dp 25dp rgba(0,0,0,0.3)` |
| Entry animation | `350ms` ease-out: scale `0.5 -> 1.1 -> 1.0`, opacity `0 -> 1` |
| Key | Re-trigger animation when `currentDirection` changes |

### 6.13 Icon Sizes (Outcome Screens)

| Screen | Icon | Size | Color |
|--------|------|------|-------|
| SuccessScreen (APPROVE) | Circle + checkmark | `64dp` | `#10B981` stroke |
| SuccessScreen (MANUAL_REVIEW) | Circle + exclamation | `64dp` | `#F59E0B` stroke |
| DeniedScreen (REJECT) | Circle + X | `64dp` | `#EF4444` stroke |
| DeniedScreen (MANUAL_REVIEW) | Circle + exclamation | `64dp` | `#F59E0B` stroke |
| FailureScreen | Circle + exclamation | `64dp` | `#EF4444` stroke |
| BlockedScreen | Circle + slash | `64dp` | `#EF4444` stroke |
| PermissionScreen | Camera or Microphone | `64dp` | `#4F63F5` stroke |

All icons: `stroke-width="2"`, `stroke-linecap="round"`, `stroke-linejoin="round"`, `fill="none"`.

---

## 7. Screen Designs

### 7.1 IntroScreen

```
+----------------------------------+
|          [Logo 40dp]             |
|                                  |
|         [Spinner 48dp]           |
|                                  |
|    "Verifying your presence"     |  <-- 20sp W600
|     "Please wait a moment"       |  <-- 14sp W400, #6B7280
+----------------------------------+
```

- Shows while session is being created via API
- Logo displayed at `40dp` height if `branding.logoUrl` is configured
- Spinner is centered between logo and text

### 7.2 PermissionScreen

```
+----------------------------------+
|          [Logo 40dp]             |
|                                  |
|      [Camera Icon 64dp]         |  <-- #4F63F5 stroke
|                                  |
|    "Camera access needed"        |  <-- 20sp W600
|   "We need access to your       |  <-- 14sp W400, #6B7280
|    camera to verify..."          |
|                                  |
|    [=== Continue Button ===]     |  <-- Primary button
+----------------------------------+
```

- Two variants: `camera` and `microphone` (different icon and text)
- Microphone variant only shown if `policy.requires_audio == true`
- On Android, trigger `ActivityResultContracts.RequestPermission` for `Manifest.permission.CAMERA`

### 7.3 CaptureScreen

```
+----------------------------------+
|  [Logo 24dp]                     |
|                                  |
| +------------------------------+ |
| |                              | |
| |    [Camera Preview]          | |  <-- max 340dp wide, scaleX(-1) mirror
| |       +----------+          | |
| |       | Oval     |          | |  <-- 70% width/height, 3dp border
| |       | Guide    |          | |      rgba(255,255,255,0.8), 50% radius
| |       +----------+          | |
| |  [QualityIndicator overlay]  | |  <-- z-index 20, positioned at top
| +------------------------------+ |
|                                  |
|  "Position your face"            |  <-- 18sp W600 (pre-capture)
|  "Center your face in the frame" |  <-- 14sp W400 (or quality guidance)
|                                  |
|  --- OR during capture: ---      |
|  "Hold still"                    |  <-- 18sp W600
|  "Stay still for a moment"      |  <-- 14sp W400
|  [====== Progress Bar ======]    |  <-- 100% width, 2.5s linear fill
+----------------------------------+
```

- Pre-capture: shows quality guidance banner if issues detected
- Quality guidance replaces static subtitle when active
- During capture: progress bar fills over `capture_duration_ms`
- `onReady` fires after 1.5s delay, then auto-advances to challenge or upload

### 7.4 ChallengeScreen — Instructions Phase

Full-screen modal overlay over the camera preview:

```
+--------- Full Screen -----------+
|  rgba(0,0,0,0.75) backdrop     |
|                                  |
|   +----- Modal Card ------+     |
|   |                        |     |
|   |     [Icon 48dp]        |     |  <-- #E0E7FF circle, emoji inside
|   |                        |     |
|   |  "Head Turn Challenge" |     |  <-- 16sp W700, #1E293B
|   |                        |     |
|   |  "You will be asked    |     |  <-- 13sp W400, #64748B
|   |   to turn your head    |     |
|   |   in specific          |     |
|   |   directions."         |     |
|   |                        |     |
|   | [Got it - start]       |     |  <-- Full-width, #4F46E5
|   +-----------------------+     |
+----------------------------------+
```

- Blocks until user taps button (Promise-based in web, callback-based in Android)
- Different text per challenge type:
  - `follow_dot`: "A red dot will appear on screen. Follow it with your eyes while keeping your head still."
  - `head_turn`: "You will be asked to turn your head in specific directions. Follow the arrows shown on screen."
  - `speak_phrase`: "You will be shown a phrase to read aloud. Speak clearly and at a normal pace."

### 7.5 ChallengeScreen — Face Guide Phase

```
+--------- Video Container --------+
|  rgba(0,0,0,0.6) surround       |
|                                   |
|  "Position your face in the oval" |  <-- pill label at top 4%
|                                   |
|       +--- Dashed Oval ---+       |  <-- 55% width, 3:4 aspect
|       |                   |       |      3dp dashed white @ 80%
|       |    (transparent)  |       |      PULSING animation
|       |                   |       |
|       +-------------------+       |
|                                   |
|    [My face is ready]             |  <-- button at bottom 6%
+-----------------------------------+
```

- Oval cutout is created with a radial gradient mask
- Oval dimensions: `55%` width of container, `3:4` aspect ratio, max `80%` height
- Dashed border pulses: scale `1 -> 1.1 -> 1`, opacity `1 -> 0.6 -> 1`, `2000ms` ease-in-out infinite
- Blocks until user taps "My face is ready"

### 7.6 ChallengeScreen — Baseline Phase

```
+--------- Video Container --------+
| [Phase Badge: "BASELINE"]        |
|                                   |
| [Camera Preview with             |
|  subtle oval overlay]             |  <-- 55% width, 3:4 AR, 2dp solid
|                                   |      rgba(255,255,255,0.3), 50% radius
| [QualityIndicator overlay]        |  <-- Active, full mode
+-----------------------------------+
| "Getting ready..."               |  <-- 18sp W600
| [==== Progress Bar (0-25%) ====] |
```

- Duration: `2000ms`
- Frame budget: `max(10, floor(max_frames * 0.30))`
- "Keep still -- look at the camera" status text
- Progress bar fills from 0% to 25%

### 7.7 ChallengeScreen — Countdown Phase

```
+--------- Video Container --------+
|  rgba(0,0,0,0.4) overlay        |
|                                   |
|         +--- Circle ---+         |
|         |              |         |  <-- 112dp, white 95% fill
|         |     3        |         |  <-- 60sp W900, #4F46E5
|         |              |         |
|         +--------------+         |
|     "Get ready..."               |  <-- pill, rgba(0,0,0,0.6) bg
+-----------------------------------+
```

- Three steps: 3, 2, 1 — each displayed for `1000ms`
- Each number triggers the `countdown-pop` animation (see Section 8)
- Frame capture continues during countdown (baseline-budget overflow goes to global pool)

### 7.8 ChallengeScreen — Challenge Phase (head_turn)

```
+--------- Video Container --------+
| [Phase Badge: "CHALLENGE"]       |
|                                   |
| [Camera Preview]                  |
|                                   |
|      +--- Arrow Circle ---+      |
|      |                    |      |  <-- 96dp, indigo gradient
|      |       <---         |      |  <-- 48sp bold white arrow
|      |                    |      |
|      +--------------------+      |
|                                   |
| [QualityIndicator compact]        |
+-----------------------------------+
| [Quality Warning Banner]         |  <-- if quality issues
| [==== Progress Bar (25-100%) ==] |
```

- Direction sequence is server-driven (`policy.challenge.sequence`)
- Arrow re-animates on each direction change (`direction-enter`, 350ms)
- Status text: "Turn your head LEFT" / "Turn your head RIGHT" / etc.

### 7.9 ChallengeScreen — Challenge Phase (follow_dot)

```
+--------- Video Container --------+
| [Phase Badge: "CHALLENGE"]       |
|                                   |
| [Camera Preview]                  |
|        *                          |  <-- Challenge dot at (x%, y%)
|                                   |      400ms cubic-bezier transition
|                                   |
| [QualityIndicator compact]        |
+-----------------------------------+
| [Quality Warning Banner]         |
| [==== Progress Bar (25-100%) ==] |
```

- Dot position: `x * 100%` left, `y * 100%` top (normalized 0.0-1.0 from server)
- Dot moves with `400ms cubic-bezier(0.4, 0, 0.2, 1)` on both X and Y
- Status text: "Follow the dot with your eyes"

### 7.10 ChallengeScreen — Challenge Phase (speak_phrase)

```
+--------- Video Container --------+
| [Camera Preview]                  |
+-----------------------------------+
| "Read the phrase below"          |
|                                   |
| +------------------------------+ |
| | "The sun rises in the east"  | |  <-- 15sp W600, #E5E7EB bg, 8dp radius
| +------------------------------+ |
|                                   |
| [==== Progress Bar ============] |
```

- Phrase comes from `policy.audio_challenge.phrase`
- Progress bar fills over `total_duration_ms`
- Audio recording must be active during this phase

### 7.11 UploadingScreen

```
+----------------------------------+
|          [Logo 40dp]             |
|                                  |
|         [Spinner 48dp]           |
|                                  |
|      "Finishing up..."           |  <-- 20sp W600
| "Please wait while we complete   |  <-- 14sp W400, #6B7280
|   your verification"             |
|                                  |
| [==== Progress Bar (optional) =] |
+----------------------------------+
```

- Progress bar only shown if progress percentage is provided

### 7.12 SuccessScreen (APPROVE)

```
+----------------------------------+
|          [Logo 40dp]             |
|                                  |
|     [Checkmark Circle 64dp]     |  <-- #10B981 stroke (SUCCESS GREEN)
|                                  |
|       "You're verified"          |  <-- 20sp W600
|  "Your identity has been         |  <-- 14sp W400, #6B7280
|   confirmed"                     |
|                                  |
|    [=== Continue Button ===]     |  <-- Primary button, 24dp top margin
+----------------------------------+
```

### 7.13 SuccessScreen (MANUAL_REVIEW)

```
+----------------------------------+
|          [Logo 40dp]             |
|                                  |
|    [Info Circle 64dp]            |  <-- #F59E0B stroke (AMBER)
|                                  |
|       "Under Review"             |  <-- 20sp W600
|  "Your verification is pending   |  <-- 14sp W400, #6B7280
|   review."                       |
|                                  |
|    [=== Continue Button ===]     |
+----------------------------------+
```

### 7.14 DeniedScreen (REJECT)

```
+----------------------------------+
|          [Logo 40dp]             |
|                                  |
|      [X Circle 64dp]            |  <-- #EF4444 stroke (ERROR RED)
|                                  |
|    "Verification Denied"         |  <-- 20sp W600
|  "We couldn't verify your       |  <-- 14sp W400, #6B7280
|   identity."                     |
|                                  |
|    [=== Continue Button ===]     |
|                                  |
| "If you believe this is an       |  <-- 12sp, #94A3B8, 16dp top margin
|  error, please contact support." |
+----------------------------------+
```

### 7.15 FailureScreen (Error)

```
+----------------------------------+
|          [Logo 40dp]             |
|                                  |
|    [Info Circle 64dp]            |  <-- #EF4444 stroke (ERROR RED)
|                                  |
|  "We couldn't verify you"       |  <-- 20sp W600
|  "{user-friendly error message}" |  <-- 14sp W400, #6B7280
|                                  |
|    [=== Try again Button ===]    |  <-- Primary button
+----------------------------------+
```

- Error message comes from `getUserMessage(error)` mapping (see Section 13)

### 7.16 BlockedScreen

```
+----------------------------------+
|          [Logo 40dp]             |
|                                  |
|    [Slash Circle 64dp]           |  <-- #EF4444 stroke
|                                  |
|  "Verification unavailable"      |  <-- 20sp W600
|  "Please try again later or      |  <-- 14sp W400, #6B7280
|   contact support."              |
|                                  |
|    [=== Refresh Button ===]      |  <-- Secondary button (outline)
+----------------------------------+
```

- Shown when `QUOTA_EXCEEDED` error occurs
- "Refresh page" button on web; on Android, trigger retry/close

---

## 8. Animations & Transitions

### 8.1 Animation Catalog

| Element | Duration | Easing (Web CSS) | Android Equivalent |
|---------|----------|-----------------|-------------------|
| Follow-dot position | `400ms` | `cubic-bezier(0.4, 0, 0.2, 1)` | `FastOutSlowInInterpolator` or `DecelerateInterpolator` |
| Challenge dot glow | Static | N/A | Static shadow/elevation |
| Countdown pop | `900ms` | `ease-out` | Custom `Animatable` (see below) |
| Direction arrow enter | `350ms` | `ease-out` | `OvershootInterpolator` with scale animation |
| Face guide oval pulse | `2000ms` | `ease-in-out`, infinite loop | `InfiniteTransition` with `RepeatMode.Reverse` |
| Spinner rotation | `1000ms` | `linear`, infinite | `CircularProgressIndicator` (built-in) |
| Progress bar fill | `300ms` | `ease` | `animateFloatAsState` with `tween(300)` |
| Quality banner appear | `300ms` | `ease` | `AnimatedVisibility` with `fadeIn` / `slideIn` |
| Quality border glow | `400ms` | `ease` | `animateColorAsState` on `Modifier.border()` |
| Button press | `200ms` | `ease` | Material ripple (built-in) |

### 8.2 Countdown Pop (Detailed Keyframes)

Web CSS:
```css
@keyframes countdown-pop {
    0%   { transform: scale(0.3); opacity: 0; }
    40%  { transform: scale(1.15); opacity: 1; }
    100% { transform: scale(1.0);  opacity: 1; }
}
```

Android Compose equivalent:
```kotlin
val scale = remember { Animatable(0.3f) }
val alpha = remember { Animatable(0f) }

LaunchedEffect(countdownNumber) {
    // Reset for new number
    scale.snapTo(0.3f)
    alpha.snapTo(0f)
    
    // Animate in parallel
    launch {
        alpha.animateTo(1f, tween(360, easing = LinearEasing))
    }
    launch {
        scale.animateTo(1.15f, tween(360, easing = FastOutSlowInEasing))
        scale.animateTo(1.0f, tween(540, easing = FastOutSlowInEasing))
    }
}
```

### 8.3 Direction Arrow Enter

Web CSS:
```css
@keyframes direction-enter {
    0%   { transform: translate(-50%, -50%) scale(0.5); opacity: 0; }
    60%  { transform: translate(-50%, -50%) scale(1.1); }
    100% { transform: translate(-50%, -50%) scale(1);   opacity: 1; }
}
```

Duration: `350ms`, easing: `ease-out`. Re-triggered on each `currentDirection` change by using the direction as the `key`.

### 8.4 Face Guide Pulse

Web CSS:
```css
@keyframes pulse {
    0%, 100% { opacity: 1; transform: translate(-50%, -50%) scale(1);   }
    50%      { opacity: 0.6; transform: translate(-50%, -50%) scale(1.1); }
}
```

Duration: `2000ms`, easing: `ease-in-out`, loops infinitely.

### 8.5 Follow-Dot Dwell Timing

Each follow-dot waypoint has a server-driven `duration_ms` (typically `1500ms`). The dot transitions to its new position over `400ms` (using the cubic-bezier curve), then dwells at that position for the remaining ~`1100ms`. During the dwell, the capture loop grabs a minimum of `frames_per_step` (default: `2`) frames.

---

## 9. Image Quality System

### 9.1 Analysis Pipeline

The quality analyzer runs at **4Hz** (every ~250ms) on a downsampled grayscale frame.

```
Input:  Camera frame (YUV_420_888 from CameraX ImageAnalysis)
        ↓
Step 1: Downsample to 160x120 grayscale (ITU-R BT.601 luminance)
        ↓
Step 2: Blur detection (Laplacian variance)
        - 4-connected kernel: [0,1,0; 1,-4,1; 0,1,0]
        - Compute variance of Laplacian response
        ↓
Step 3: Lighting analysis
        - Mean brightness (0-255)
        - Standard deviation (contrast)
        - Under/over-exposure ratios
        ↓
Step 4: Build guidance messages
        - SUPPRESS blur guidance when lighting is bad
        - Sort by severity: critical > warning > info
        ↓
Output: ImageQualityReport
```

### 9.2 Quality Thresholds

| Metric | Poor | Acceptable | Good | Notes |
|--------|------|-----------|------|-------|
| Laplacian Variance | < 30 | 30 - 80 | >= 80 | **Suppressed when lighting is bad** |
| Mean Brightness | < 55 (too dark) | 55 - 80 | 80 - 180 | Scale 0-255 |
| Too Bright | > 210 | N/A | <= 210 | Mean brightness upper bound |
| Contrast (StdDev) | < 25 | 25 - 40 | >= 40 | Std deviation of pixel luminance |
| Under-exposed Ratio | > 0.45 | 0.25 - 0.45 | < 0.25 | Fraction of pixels below value 40 |
| Over-exposed Ratio | > 0.45 | 0.25 - 0.45 | < 0.25 | Fraction of pixels above value 215 |
| Overall Score | < 40 | 40 - 65 | >= 65 | Weighted: 45% blur + 55% lighting |
| Acceptable threshold | < 35 = not acceptable | >= 35 = acceptable | | |

### 9.3 Blur Suppression When Lighting Is Bad

> **CRITICAL:** When the image is too dark or too bright, Laplacian variance is unreliable (uniformly dark/bright frames have near-zero edge content, producing falsely low variance). The guidance builder MUST suppress all blur-related guidance when any of these conditions are true:
> - `isTooDark == true`
> - `isTooBright == true`  
> - `underExposedRatio > 0.45`
> - `overExposedRatio > 0.45`

This prevents showing "Clean your camera lens" when the actual problem is "Turn on the lights."

### 9.4 Guidance Messages

| Condition | Message | Severity | Icon |
|-----------|---------|----------|------|
| Blur: poor | "Clean your camera lens or hold your device steady" | critical | blur |
| Blur: acceptable, score < 50 | "Image is slightly blurry -- hold still" | warning | blur |
| Too dark | "Turn on the lights or move to a bright area" | critical | dark |
| Too bright | "Too bright -- move away from direct light" | critical | bright |
| Slightly dark (brightness < 80, score < 50) | "A bit dark -- more light would help" | warning | dark |
| Under-exposed > 0.45 | "Image is too dark -- add more lighting" | critical | dark |
| Over-exposed > 0.45 | "Too much glare -- reduce backlighting" | critical | bright |
| Low contrast < 20 | "Low contrast -- adjust your lighting" | warning | contrast |

### 9.5 Quality UI Active Phases

| Capture Phase | QualityIndicator Mounted | Mode | Banner Below Video |
|--------------|------------------------|------|-------------------|
| init | No | N/A | No |
| instructions | No | N/A | No |
| face-guide | **Yes** | Full (top overlay), z-index 20 | Yes if issues |
| baseline | **Yes** | Full (top overlay) | Yes if issues |
| countdown | **Yes** | Full (top overlay) | Yes if issues |
| challenge | **Yes** | Compact (bottom pill) | Yes if issues |
| done | No | N/A | No |

On the CaptureScreen (pre-challenge):
- Pre-capture: Full quality overlay at `4Hz`, auto-hide when good
- During capture: Compact quality dots at `2Hz`, always visible

---

## 10. Capture Pipeline

### 10.1 Frame Budget & Adaptive FPS

```kotlin
// Hard cap from server: upload.max_frames (default: 30)
val maxFrames = session.upload.maxFrames  // HARD_MAX = 30

// Baseline gets 30% of budget
val baselineBudget = max(10, floor(maxFrames * 0.30f).toInt())

// Adaptive FPS: server's target_fps is AUTHORITATIVE (v1.17.6 priority fix)
// Falls back to capture_fps_hint, then 10
val captureFps = session.upload.targetFps
    ?: challengeSpec.captureFpsHint
    ?: 10

// If not provided by server, compute adaptive FPS:
val BASELINE_MS = 2000
val COUNTDOWN_MS = 3000  // only if challenge exists
val totalCaptureMs = BASELINE_MS + COUNTDOWN_MS + challengeDurationMs
val adaptiveFps = max(2, min(nominalFps, floor(HARD_MAX / (totalCaptureMs / 1000f)).toInt()))

val frameIntervalMs = 1000L / captureFps

// frames_per_step default: 2 (minimum frames per challenge step/waypoint)
val framesPerStep = challengeSpec.framesPerStep ?: 2
```

### 10.2 Frame Capture Requirements

| Property | Value |
|----------|-------|
| Format | JPEG |
| Quality | 85% (0.85f) |
| Resolution | 720x1280 ideal (portrait mode) |
| Camera | Front-facing (`LENS_FACING_FRONT`) |
| Mirroring | **NONE** on captured frames |
| Frame rate | Server-driven `target_fps` (adaptive, typically 2-15 fps) |
| Max frames | Server-driven `max_frames` (hard cap: 30) |
| Baseline duration | 2000ms |
| Countdown duration | 3000ms (3 x 1000ms) |
| JPEG quality | 0.85f |

> **CRITICAL: No Frame Mirroring**  
> The camera preview (SurfaceView/TextureView/PreviewView) is typically mirrored by default for the front camera on Android, which is correct for user comfort. However, the actual captured JPEG frames from `ImageCapture` or `ImageAnalysis` MUST remain in their raw, non-mirrored orientation. Do NOT apply any `Matrix.setScale(-1f, 1f)` or similar horizontal flip to the capture output. The backend expects raw camera frames for pose analysis.

### 10.3 Challenge Capture Data Structures

```kotlin
// For head_turn challenges:
// step_frames maps step index to array of global frame indices
val stepFrames: MutableMap<String, MutableList<Int>> = mutableMapOf()
// e.g., { "0": [3,4,5], "1": [6,7,8], "2": [9,10] }

// For follow_dot challenges:
// waypoint_frames maps waypoint index to array of global frame indices
val waypointFrames: MutableMap<String, MutableList<Int>> = mutableMapOf()
// e.g., { "0": [3,4], "1": [5,6], "2": [7,8], "3": [9,10], "4": [11,12] }

// Frame timestamps: ms offset from capture start
val frameTimestamps: MutableList<Long> = mutableListOf()
// e.g., [0, 143, 287, 430, 573, ...]

// Per-frame metadata
data class FrameMetadata(
    val frame_index: Int,
    val capture_timestamp_ms: Long,        // System.currentTimeMillis()
    val performance_timestamp_ms: Double,   // ms since capture start
    val frame_blob_size_bytes: Int,
    val resolution_w: Int,
    val resolution_h: Int,
    val frame_hash: String? = null
)
```

### 10.4 Backup Frame Loop

If a challenge step/waypoint finishes its `duration_ms` window with fewer than `framesPerStep` frames captured, a backup loop runs:
- Attempts up to `framesPerStep * 3` additional grabs
- Exits early if the global frame budget is exhausted
- Logs a warning if still below minimum

```kotlin
var framesThisStep = 0
// ... main capture loop during step duration ...

// Backup loop
var backupAttempts = 0
val maxBackupAttempts = framesPerStep * 3
while (framesThisStep < framesPerStep && backupAttempts < maxBackupAttempts) {
    backupAttempts++
    val captured = grabFrame()
    if (captured) {
        stepFrames[stepIndex]!!.add(globalFrameIndex - 1)
        framesThisStep++
    } else if (budgetExhausted) {
        break
    }
    delay(frameIntervalMs)
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
  GET  /v1/sessions/{id}/status?env=...     → Poll status (optional)
```

### 11.2 Two-Layer Auth Model

Every request requires TWO layers of authentication:

**Layer 1: Supabase Gateway Headers** (on ALL requests)

| Header | Value | Purpose |
|--------|-------|---------|
| `Authorization` | `Bearer {gatewayKey}` | Supabase Edge Function gateway auth |
| `apikey` | `{gatewayKey}` | Supabase gateway (duplicate header required) |

The `gatewayKey` is a public Supabase anonymous key (not secret). A default key is hardcoded in the SDK but can be overridden via `config.gatewayKey`.

**Layer 2: Endpoint-Specific Auth**

| Header | Value | Used On | Purpose |
|--------|-------|---------|---------|
| `X-API-Key` | `{apiKey}` | Create Session only | Organization API key |
| `X-Session-Token` | `{sessionToken}` | Upload, Complete, Status | Session-scoped auth token |
| `X-Idempotency-Key` | `{unique_id}` | Upload, Complete | Prevent duplicate processing |
| `X-Nonce` | `{nonce}` | Upload, Complete | Cryptographic binding (header delivery) |

### 11.3 Nonce Dual-Delivery (v1.17.5)

> **CRITICAL:** The session nonce (received in the `CreateSession` response `nonce` field) MUST be sent in **TWO** ways on Upload and Complete requests:
> 1. As the `X-Nonce` HTTP header
> 2. As a `nonce={value}` query parameter appended to the URL
>
> This dual-delivery prevents header-stripping proxies from bypassing nonce validation.

```kotlin
// Example URL construction:
val baseUrl = "${apiBaseUrl}/v1/sessions/${sessionId}/signals"
val url = "${baseUrl}?env=${environment}&nonce=${URLEncoder.encode(nonce, "UTF-8")}"

// Headers include:
headers["X-Nonce"] = nonce
headers["X-Session-Token"] = sessionToken
headers["X-Idempotency-Key"] = "${sessionId}_${System.currentTimeMillis()}_${UUID.randomUUID()}"
```

### 11.4 Create Session Request

```
POST /v1/sessions?env=sandbox
Content-Type: application/json
Authorization: Bearer {gatewayKey}
apikey: {gatewayKey}
X-API-Key: {apiKey}
```

```json
{
    "session_type": "enrollment",
    "platform": "android",
    "identity_id": null,
    "external_user_id": "user-123",
    "metadata": {
        "user_agent": "UseSense-Android-SDK/1.17.7",
        "platform": "android",
        "channel": "mobile",
        "device_model": "Pixel 8",
        "os_version": "Android 15"
    }
}
```

**Response** (same as web): `CreateSessionResponse` with `session_id`, `session_token`, `nonce`, `policy`, `upload` config.

### 11.5 Upload Signals Request

```
POST /v1/sessions/{id}/signals?env=sandbox&nonce={nonce}
Content-Type: multipart/form-data
Authorization: Bearer {gatewayKey}
apikey: {gatewayKey}
X-Session-Token: {sessionToken}
X-Idempotency-Key: {unique_id}
X-Nonce: {nonce}
```

**Multipart body:**

| Part Name | Filename | MIME Type | Content |
|-----------|----------|-----------|---------|
| `frames[]` | `frame_0.jpg` | `image/jpeg` | JPEG blob for frame 0 |
| `frames[]` | `frame_1.jpg` | `image/jpeg` | JPEG blob for frame 1 |
| ... | ... | ... | ... |
| `metadata` | `metadata.json` | `application/json` | MetadataPayload JSON |
| `audio` (optional) | `audio.m4a` | `audio/mp4` | Audio recording blob |

### 11.6 Metadata Payload (metadata.json)

```json
{
    "web_integrity": null,
    "android_integrity": {
        "is_emulator": false,
        "is_rooted": false,
        "is_debuggable": false,
        "play_integrity_token": "...",
        "package_name": "com.example.app",
        "signing_certificate_hash": "...",
        "device_model": "Pixel 8",
        "os_version": "35",
        "screen_resolution": "1080x2400",
        "timezone": "America/New_York",
        "locale": "en_US"
    },
    "challenge_response": {
        "type": "head_turn",
        "seed": "seed_abc123def456",
        "completed": true,
        "step_frames": {
            "0": [3, 4, 5],
            "1": [6, 7, 8],
            "2": [9, 10]
        },
        "started_at": "2026-03-07T12:00:05.000Z",
        "completed_at": "2026-03-07T12:00:12.500Z",
        "frame_timestamps": [0, 143, 287, 430, 573, 716, 860, 1003, 1147, 1290, 1434]
    },
    "webauthn_data": null
}
```

### 11.7 Complete Session Request

```
POST /v1/sessions/{id}/complete?env=sandbox&nonce={nonce}
Authorization: Bearer {gatewayKey}
apikey: {gatewayKey}
X-Session-Token: {sessionToken}
X-Idempotency-Key: {sessionId}_complete_{timestamp}
X-Nonce: {nonce}
```

No request body. Returns `FinalDecisionObject` (which MUST be redacted before exposing to host app).

### 11.8 Error Handling

| HTTP Status | Error Code | User Message |
|-------------|-----------|--------------|
| 400 | `INVALID_REQUEST` | "Invalid request. Please check the parameters." |
| 401 (session_expired) | `SESSION_EXPIRED` | "Your session has expired. Please start over." |
| 401 (invalid_token) | `INVALID_TOKEN` | "Session token is invalid." |
| 401 (other) | `UNAUTHORIZED` | "Authentication failed. Check API key." |
| 404 (identity_not_found) | `IDENTITY_NOT_FOUND` | "Identity not found." |
| 404 (other) | `UNKNOWN_ERROR` | "Endpoint not found. Verify Backend URL." |
| 429 | `QUOTA_EXCEEDED` | "Rate limit reached. Try again later." |
| 500 | `SERVER_ERROR` | "Server error. Please try again." |
| 503 | `SERVICE_UNAVAILABLE` | "Service unavailable. Try again later." |
| Network error | `NETWORK_ERROR` | "Connection issue. Check your internet." |
| Timeout | `TIMEOUT` | "Request timed out. Please try again." |

---

## 12. Security Requirements

### 12.1 Decision Redaction (MANDATORY)

The SDK **MUST** never expose internal scoring details to the host application. The `FinalDecisionObject` from the server contains scores, pillar verdicts, reason strings, analysis details, and integrity flags that could be reverse-engineered by attackers.

**Only these fields are safe to expose:**

```kotlin
data class RedactedDecisionObject(
    val session_id: String,
    val session_type: String?,       // "enrollment" | "authentication"
    val identity_id: String?,
    val decision: String,            // "APPROVE" | "REJECT" | "MANUAL_REVIEW"
    val timestamp: String            // ISO 8601
)
```

**Fields that MUST be stripped (never exposed to host app):**

- `channel_trust_score`
- `liveness_score`
- `dedupe_risk_score`
- `matrix_decision`
- `rule_applied`
- `pillar_verdicts` (deepsense, livesense, dedupe scores and verdicts)
- `verdict_metadata` (logic, thresholds, rule overrides)
- `reasons[]`
- `debug`
- `integrity_flags[]`
- `livesense_analysis`
- `challenge_validation`
- `dedupe_analysis`
- `webgl_analysis`, `network_analysis`, `device_velocity`
- `signature`

```kotlin
fun redactDecision(full: FinalDecisionObject): RedactedDecisionObject {
    return RedactedDecisionObject(
        session_id = full.session_id,
        session_type = full.session_type,
        identity_id = full.identity_id,
        decision = full.decision,
        timestamp = full.timestamp
    )
}
```

### 12.2 No Score Exposure on UI

Outcome screens (Success, Denied, Failure) MUST NOT display any scores, pillar verdicts, reason strings, or analysis details. The web SDK explicitly has comments:

```
/* Security-sensitive check details removed -- do not expose reasons/scores to the client */
```

### 12.3 No Frame Mirroring on Capture

Reiterated for emphasis: captured frames MUST be raw, non-mirrored. Only the preview can be mirrored.

### 12.4 Android Integrity Signals

Replace the web SDK's `WebIntegritySignals` with Android-specific signals:

```kotlin
data class AndroidIntegritySignals(
    val is_emulator: Boolean,           // Check Build.FINGERPRINT, etc.
    val is_rooted: Boolean,             // Check for su binary, root apps
    val is_debuggable: Boolean,         // ApplicationInfo.FLAG_DEBUGGABLE
    val play_integrity_token: String?,  // Google Play Integrity API token
    val package_name: String,           // BuildConfig.APPLICATION_ID
    val signing_certificate_hash: String,
    val device_model: String,           // Build.MODEL
    val os_version: String,             // Build.VERSION.SDK_INT
    val screen_resolution: String,      // "{width}x{height}"
    val hardware_concurrency: Int,      // Runtime.getRuntime().availableProcessors()
    val total_memory_mb: Long,          // ActivityManager.MemoryInfo
    val battery: BatteryInfo?,
    val connection: ConnectionInfo?,
    val timezone: String,               // TimeZone.getDefault().id
    val locale: String                  // Locale.getDefault().toString()
)
```

### 12.5 API Key Security

- API keys should be stored in the Android Keystore or fetched from the host app's secure backend
- Do not hardcode production API keys in the APK/AAB
- The `gatewayKey` (Supabase anon key) is public and CAN be bundled

---

## 13. Type Definitions (Kotlin)

### 13.1 Configuration Types

```kotlin
data class UseSenseConfig(
    val apiBaseUrl: String,
    val apiKey: String,
    val gatewayKey: String? = null,     // Defaults to built-in Supabase anon key
    val environment: Environment? = null, // Auto-derived from apiKey prefix
    val branding: BrandingConfig? = null,
    val options: SDKOptions? = null
)

data class BrandingConfig(
    val logoUrl: String? = null,
    val primaryColor: String = "#4F63F5",
    val buttonRadius: Int = 12,         // dp
    val fontFamily: String? = null
)

data class SDKOptions(
    val audioEnabled: AudioMode = AudioMode.RISK_BASED,
    val stepUpPolicy: StepUpPolicy = StepUpPolicy.RISK_BASED,
    val captureDurationMs: Long = 2500,
    val targetFps: Int = 15,
    val maxFrames: Int = 40,
    val maxUploadSizeMb: Int = 10,
    val webAuthnEnabled: Boolean = false  // Not applicable on Android
)

enum class AudioMode { NEVER, RISK_BASED, ALWAYS }
enum class StepUpPolicy { RISK_BASED, ALWAYS, NEVER }
enum class SessionType { ENROLLMENT, AUTHENTICATION }
enum class Environment { SANDBOX, PRODUCTION }
enum class Decision { APPROVE, REJECT, MANUAL_REVIEW }
```

### 13.2 Session Response Types

```kotlin
data class CreateSessionResponse(
    val session_id: String,
    val session_token: String,
    val expires_at: String,
    val nonce: String,
    val policy: SessionPolicy,
    val upload: UploadConfig
)

data class SessionPolicy(
    val requires_audio: Boolean,
    val requires_stepup: Boolean,
    val challenge_type: String,            // "none"|"head_turn"|"follow_dot"|"speak_phrase"
    val challenge: ChallengeSpec?,         // null if no visual challenge
    val audio_challenge: SpeakPhraseChallenge?,
    val policy_source: String? = null
)

data class UploadConfig(
    val max_frames: Int,        // Hard cap (typically 30)
    val target_fps: Int,        // AUTHORITATIVE -- overrides capture_fps_hint
    val capture_duration_ms: Long
)
```

### 13.3 Challenge Spec Types

```kotlin
// Sealed interface for type-safe challenge handling
sealed interface ChallengeSpec {
    val type: String
    val seed: String
    val frames_per_step: Int
    val capture_fps_hint: Int
}

data class HeadTurnChallenge(
    override val type: String = "head_turn",
    override val seed: String,
    val sequence: List<HeadTurnStep>,
    val total_duration_ms: Long,
    override val frames_per_step: Int = 2,
    override val capture_fps_hint: Int = 10
) : ChallengeSpec

data class HeadTurnStep(
    val direction: String,       // "left"|"right"|"up"|"down"|"center"
    val duration_ms: Long,
    val index: Int
)

data class FollowDotChallenge(
    override val type: String = "follow_dot",
    override val seed: String,
    val waypoints: List<FollowDotWaypoint>,
    val dot_size_px: Int = 24,
    val total_duration_ms: Long,
    override val frames_per_step: Int = 2,
    override val capture_fps_hint: Int = 10
) : ChallengeSpec

data class FollowDotWaypoint(
    val x: Float,                // 0.0 - 1.0 normalized
    val y: Float,                // 0.0 - 1.0 normalized
    val duration_ms: Long,
    val index: Int
)

data class SpeakPhraseChallenge(
    val type: String = "speak_phrase",
    val seed: String,
    val phrase: String,
    val phrase_language: String? = "en",
    val total_duration_ms: Long
)
```

### 13.4 Challenge Response Types (for metadata.json)

```kotlin
sealed interface ChallengeResponse {
    val type: String
    val seed: String
    val completed: Boolean
    val started_at: String?
    val completed_at: String?
}

data class FollowDotChallengeResponse(
    override val type: String = "follow_dot",
    override val seed: String,
    override val completed: Boolean,
    val waypoint_frames: Map<String, List<Int>>,   // key = waypoint index
    override val started_at: String?,
    override val completed_at: String?,
    val frame_timestamps: List<Long>
) : ChallengeResponse

data class HeadTurnChallengeResponse(
    override val type: String = "head_turn",
    override val seed: String,
    override val completed: Boolean,
    val step_frames: Map<String, List<Int>>,        // key = step index
    override val started_at: String?,
    override val completed_at: String?,
    val frame_timestamps: List<Long>
) : ChallengeResponse

data class SpeakPhraseChallengeResponse(
    override val type: String = "speak_phrase",
    override val seed: String,
    override val completed: Boolean,
    override val started_at: String?,
    override val completed_at: String?
) : ChallengeResponse
```

### 13.5 Error Types

```kotlin
enum class ErrorCode(val userMessage: String) {
    CAMERA_PERMISSION_DENIED(
        "We need camera access to verify your identity. Please allow camera access in Settings."
    ),
    MIC_PERMISSION_DENIED(
        "We need microphone access to complete verification. Please allow microphone access in Settings."
    ),
    NETWORK_ERROR("Connection issue. Please check your internet and try again."),
    SESSION_EXPIRED("Your session has expired. Please start over."),
    UNAUTHORIZED("Authentication failed. Please check your API key."),
    INVALID_TOKEN("Session token is invalid. Please start a new session."),
    SESSION_NOT_FOUND("Session not found. Please start a new session."),
    IDENTITY_NOT_FOUND("Identity not found. Please ensure the identity ID is correct."),
    INVALID_REQUEST("Invalid request. Please check the parameters."),
    QUOTA_EXCEEDED("Rate limit reached. Please try again later."),
    USER_CANCELLED("Verification was cancelled."),
    FACE_NOT_DETECTED("Please position your face in the frame and try again."),
    LOW_LIGHT("Lighting is too low. Please move to a brighter area."),
    TIMEOUT("Verification took too long. Please try again."),
    SERVER_ERROR("Server error. Please try again or contact support."),
    UNKNOWN_ERROR("Something went wrong. Please try again.")
}

class UseSenseException(
    val code: ErrorCode,
    override val message: String,
    val details: Any? = null
) : Exception(message)
```

### 13.6 Event Types

```kotlin
enum class EventType {
    SESSION_CREATED,
    PERMISSIONS_REQUESTED,
    PERMISSIONS_GRANTED,
    PERMISSIONS_DENIED,
    CAPTURE_STARTED,
    FRAME_CAPTURED,
    CAPTURE_COMPLETED,
    AUDIO_RECORD_STARTED,
    AUDIO_RECORD_COMPLETED,
    CHALLENGE_STARTED,
    CHALLENGE_COMPLETED,
    UPLOAD_STARTED,
    UPLOAD_PROGRESS,
    UPLOAD_COMPLETED,
    COMPLETE_STARTED,
    DECISION_RECEIVED,
    IMAGE_QUALITY_CHECK,
    ERROR
}

data class UseSenseEvent(
    val type: EventType,
    val timestamp: Long = System.currentTimeMillis(),
    val data: Map<String, Any?>? = null
)

typealias EventCallback = (UseSenseEvent) -> Unit
```

### 13.7 Public API Interface

```kotlin
interface UseSenseClient {
    val config: UseSenseConfig

    suspend fun startEnrollment(
        externalUserId: String? = null,
        metadata: Map<String, Any>? = null
    ): CreateSessionResponse

    suspend fun startAuthentication(
        identityId: String,
        metadata: Map<String, Any>? = null
    ): CreateSessionResponse

    suspend fun runVerificationSession(
        sessionId: String,
        sessionToken: String
    ): RedactedDecisionObject

    fun setMockScenario(scenario: String)
    fun onEvent(callback: EventCallback): () -> Unit   // Returns unsubscribe function
}

// Factory function
fun createUseSenseClient(config: UseSenseConfig): UseSenseClient
```

---

## 14. Demo App Specification

### 14.1 Demo App Features

| Feature | Description |
|---------|-------------|
| Mode Toggle | Mock Mode (instant, no backend) vs Live Mode (real API) |
| API Key Input | Text field for entering `sk_`/`pk_`/`dk_` prefixed keys |
| Environment Badge | Auto-detected from key prefix: `pk_` = production, `sk_`/`dk_` = sandbox |
| Mock Scenario Picker | Dropdown: APPROVE, REJECT, MANUAL_REVIEW, Head Turn, Follow Dot, Speak Phrase, Random |
| Enrollment Flow | External User ID input + "Start Enrollment" button |
| Authentication Flow | Identity ID input + "Start Authentication" button |
| Result Display | Decision badge: APPROVE (green), REJECT (red), MANUAL_REVIEW (amber) |
| Identity ID Copy | Copy button for the returned `identity_id` (for authentication testing) |
| Session ID Display | Read-only field showing the `session_id` |
| Debug Log | Scrollable log showing SDK events in real time |
| Branding Config | Primary color picker + logo URL input |
| Advanced Settings | Audio mode toggle (collapsed by default) |

### 14.2 Demo App Color Palette

| Element | Color | Notes |
|---------|-------|-------|
| Mock mode button (active) | `#9333EA` (purple-600) | Selected state |
| Live mode button (active) | `#16A34A` (green-600) | Selected state |
| APPROVE result badge | `#16A34A` (green-600) | Success |
| REJECT result badge | `#DC2626` (red-600) | Failure |
| MANUAL_REVIEW result badge | `#CA8A04` (yellow-600) | Pending review |
| API key card border | `#BFDBFE` (blue-200) | Configuration card |
| Mock card border | `#E9D5FF` (purple-200) | Scenario selector card |
| Background gradient | `slate-50 -> blue-50 -> slate-50` | Full-screen background |

### 14.3 Demo App Layout

The demo app should be a single-Activity app with:

1. **Header**: UseSense logo + "Android SDK" title + version badge
2. **Mode toggle**: Segmented control (Mock / Live)
3. **Configuration card**: API key input (Live mode) or scenario picker (Mock mode)
4. **Flow card**: Tabbed enrollment/authentication with Start buttons
5. **Result card**: Appears after verification with decision badge and IDs
6. **Debug log**: Expandable section with timestamped event log

The verification flow launches as a full-screen overlay (new Activity or Dialog fragment) that renders the SDK screens.

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

| Direction | Label Text | Arrow Character |
|-----------|-----------|----------------|
| `left` | "Turn your head LEFT" | `\u2190` (leftwards arrow) |
| `right` | "Turn your head RIGHT" | `\u2192` (rightwards arrow) |
| `up` | "Tilt your head UP" | `\u2191` (upwards arrow) |
| `down` | "Tilt your head DOWN" | `\u2193` (downwards arrow) |
| `center` | "Look straight ahead" | `\u25CB` (white circle) |

---

*End of specification.*
