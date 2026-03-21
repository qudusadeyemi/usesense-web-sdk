# UseSense Mobile SDK - Verification Flow

## Overview
A minimal, calm, and trustworthy verification flow with modern fintech aesthetic. Designed to complete in under 5 seconds with clear guidance and smooth transitions.

## Screen Flow

### 1. **IntroScreen** (`/`)
- **Purpose**: Welcome and explain the verification process
- **Key Elements**:
  - Shield icon with UseSense branding
  - Brief explanation: "Quick verification to confirm you're present"
  - "Begin verification" CTA
  - Privacy text about data handling
- **Duration**: ~3 seconds
- **Next**: Camera Request

### 2. **CameraRequestScreen** (`/camera-request`)
- **Purpose**: Request camera permission with helpful guidance
- **States**:
  - **Initial**: Permission request with animated phone illustration
  - **Denied**: Step-by-step instructions to enable camera in settings
- **Key Elements**:
  - Animated camera icon
  - Clear microcopy explaining why camera is needed
  - "Allow camera" / "Not now" options
  - Settings guidance for denied state
- **Next**: Face Alignment

### 3. **FaceAlignmentScreen** (`/face-alignment`)
- **Purpose**: Guide user to position face correctly
- **Key Elements**:
  - Live camera preview (simulated)
  - Circular face guide with animated borders
  - Real-time feedback states:
    - "Too dark"
    - "Move closer"
    - "Hold steady"
    - "Face detected"
  - Auto-capture countdown (3-2-1)
  - Accessibility note
- **Duration**: 2-4 seconds
- **Next**: Micro Challenge or Processing

### 4. **MicroChallengeScreen** (`/micro-challenge`)
- **Purpose**: Liveness detection through simple actions
- **Challenge Types**:
  - Turn head slightly right
  - Turn head slightly left
  - Follow moving dot with eyes
  - Smile naturally
- **Key Elements**:
  - Animated visual guides
  - Progress bar
  - Timeout handling (5-6 seconds)
  - Calm retry state if timeout
- **Duration**: 4-6 seconds
- **Next**: Audio Prompt (optional) or Processing

### 5. **AudioPromptScreen** (`/audio-prompt`)
- **Purpose**: Voice verification (optional step)
- **Key Elements**:
  - Dynamically generated phrase in a card
  - Large microphone button with pulsing animation
  - Live audio visualization (animated bars)
  - Processing state
  - Privacy reassurance: "Your audio is not stored"
- **Duration**: 3-5 seconds
- **Next**: Processing

### 6. **ProcessingScreen** (`/processing`)
- **Purpose**: Show verification is being processed
- **Key Elements**:
  - Animated loading indicator
  - "Verifying your identity" message
  - Brief duration to feel secure but not slow
- **Duration**: 1-2 seconds
- **Next**: Success / Failure / Blocked

### 7. **Final States**

#### **SuccessScreen** (`/success`)
- Large checkmark with expanding rings animation
- "You're verified" + "Thank you."
- "Continue" CTA
- Green success indicator dot
- Celebration feel but calm

#### **FailureScreen** (`/failure`)
- Neutral amber warning icon (not harsh red)
- "We couldn't verify you"
- "Please try again in good lighting"
- Helpful tips card
- "Try again" CTA + "Contact support" option
- Encouraging, non-accusatory tone

#### **BlockedScreen** (`/blocked`)
- Gray info icon (neutral)
- "Verification unavailable"
- "Please contact support"
- No technical details or fraud language
- Support card explaining alternative methods
- "Contact support" CTA + "Close" option

### 8. **LoadingScreen** (`/loading`)
- **Purpose**: Multi-state loading/error handler
- **States**:
  - **Loading**: Animated ring progress
  - **Permission**: Camera permission guidance
  - **Error**: Retry with helpful suggestions
- Can be used at any point in the flow

## Design Principles

### Visual Design
- **Colors**: Soft neutral backgrounds, configurable primary (default: #4F63F5)
- **Buttons**: 12px border radius, large touch targets (56px height)
- **Typography**: Clean, readable, no technical jargon
- **Spacing**: Generous padding (24px standard)
- **Animations**: Smooth, purposeful, not distracting

### UX Guidelines
- ✅ **Target**: Under 5 seconds completion
- ✅ **Microcopy**: Clear, reassuring, human
- ✅ **Feedback**: Real-time, visual, encouraging
- ✅ **Transitions**: Smooth, spring-based animations
- ✅ **Accessibility**: ARIA labels, keyboard navigation, contrast

### Tone & Voice
- ✅ **DO**: Calm, reassuring, helpful, human
- ✅ **DO**: "We need to verify you're present"
- ❌ **DON'T**: Technical language, AI terminology
- ❌ **DON'T**: "Fraud detection", "Deepfake prevention"
- ❌ **DON'T**: Scary or aggressive language

## Theme Support

### Light & Dark Mode
All screens automatically adapt based on `ThemeContext`:
- Light: Gradient from gray-50 to white
- Dark: Gradient from gray-900 to black
- Maintains accessible contrast ratios

### Configurable Primary Color
Default: #4F63F5 (UseSense Blue)
- Used for CTAs, indicators, progress bars
- Can be configured per integration

## Navigation

### Demo Navigation
A floating menu button (bottom-right) provides quick access to all screens for testing and demonstration purposes.

### Production Flow
In production, screens would navigate automatically based on:
- Permission states
- Verification results
- Error conditions
- User actions

## File Structure

```
/src/app/screens/
├── IntroScreen.tsx              # Welcome screen
├── CameraRequestScreen.tsx      # Camera permission
├── FaceAlignmentScreen.tsx      # Face positioning
├── MicroChallengeScreen.tsx     # Liveness challenges
├── AudioPromptScreen.tsx        # Voice verification
├── ProcessingScreen.tsx         # Processing state
├── SuccessScreen.tsx            # Success state
├── FailureScreen.tsx            # Failure with retry
├── BlockedScreen.tsx            # Blocked state
└── LoadingScreen.tsx            # Multi-state loader

/src/app/components/
├── DemoControls.tsx             # Theme/color switcher
└── ScreenNavigator.tsx          # Demo navigation menu

/src/app/context/
└── ThemeContext.tsx             # Theme & color management
```

## Usage Examples

### Basic Flow
1. User clicks "Begin verification" on Intro
2. Camera permission requested and granted
3. User positions face → auto-capture
4. User completes one micro challenge
5. Processing → Success

### With Retry
1. Face alignment timeout or poor lighting
2. Friendly error message with tips
3. "Try again" button
4. Return to face alignment

### With Denial
1. Camera permission denied
2. Show settings instructions
3. User enables camera
4. Continue with verification

## Best Practices

### Performance
- Animations: Use GPU-accelerated transforms
- Images: Optimize and lazy load
- Video: Use appropriate resolution
- Debounce: User interactions appropriately

### Accessibility
- Screen reader support
- Keyboard navigation
- High contrast mode support
- Clear focus indicators

### Error Handling
- Always provide helpful guidance
- Never blame the user
- Offer alternative solutions
- Keep tone calm and supportive

---

**Built with**: React, Motion (Framer Motion), Tailwind CSS v4, TypeScript
**Design System**: UseSense Security Infrastructure Platform
