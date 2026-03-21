# UseSense Web SDK - Quick Start Guide

**Get the demo running in 2 minutes!** 🚀

---

## 🎯 What You're About to Run

You've built a complete **Next.js demo application** that showcases:
- ✅ **Enrollment Flow** - First-time user biometric registration
- ✅ **Authentication Flow** - Returning user verification  
- ✅ **Live Customization** - Change colors, logos, and settings in real-time
- ✅ **Debug Console** - See all SDK events and web integrity signals
- ✅ **Mock Backend** - Works without a real backend (sandbox mode)

---

## 📋 Prerequisites

Before starting, make sure you have:

- **Node.js 18+** installed ([Download here](https://nodejs.org/))
- **A modern web browser** (Chrome, Safari, Firefox, Edge)
- **Webcam access** for testing

To check your Node.js version:
```bash
node --version
# Should show v18.0.0 or higher
```

---

## 🚀 Installation & Setup

### Step 1: Install Dependencies

Open your terminal in the project root directory and run:

```bash
npm install
```

This will install all dependencies for:
- The demo app (`/examples/web-demo`)
- The SDK package (`/packages/web-sdk`)
- The root project

**Expected time:** ~2 minutes

---

### Step 2: Start the Demo

Navigate to the demo directory and start the development server:

```bash
cd examples/web-demo
npm run dev
```

You should see output like:

```
▲ Next.js 14.0.0
- Local:        http://localhost:3000
- Ready in 1.2s
```

---

### Step 3: Open in Browser

Open your web browser and navigate to:

```
http://localhost:3000
```

**🎉 You're done!** The demo app should now be running.

---

## 🎮 How to Use the Demo

### Testing Enrollment (First-time User)

1. **Navigate to the "Enrollment" tab** (should be selected by default)

2. **Enter a test user ID**:
   ```
   External User ID: test-user-123
   ```

3. **Customize branding** (optional):
   - Change primary color (try `#4F63F5` for UseSense blue)
   - Upload a logo URL (or leave default)
   - Select audio mode (`never`, `risk_based`, or `always`)

4. **Click "Start Enrollment"**

5. **Grant camera permission** when prompted by your browser

6. **Follow the on-screen instructions**:
   - Position your face in the frame
   - Keep still for a few seconds
   - Wait for capture to complete

7. **View the results**:
   - ✅ **Decision**: APPROVE, REJECT, MANUAL_REVIEW, or STEP_UP_REQUIRED
   - 📊 **Scores**: Trust score, liveness score, dedupe risk
   - 🆔 **Identity ID**: Save this for authentication testing!

---

### Testing Authentication (Returning User)

1. **Navigate to the "Authentication" tab**

2. **Enter the Identity ID from your enrollment**:
   ```
   Identity ID: ident_1234567890_abc123def
   ```
   *(This was shown in the enrollment results)*

3. **Click "Start Authentication"**

4. **Complete the verification flow** (same as enrollment)

5. **View match results**:
   - Match quality score
   - Decision (APPROVE/REJECT)
   - Trust and liveness scores

---

### Using the Debug Console

1. **Click "Show Debug"** at the top of the page

2. **View real-time events**:
   - Session created
   - Capture started
   - Frame captured
   - Upload started
   - Decision received

3. **Inspect web integrity signals**:
   - User agent and browser details
   - Hardware information (CPU cores, memory)
   - WebGL fingerprint
   - Timing signals (event loop lag)
   - Feature support flags

---

## 🔧 Configuration Options

### Audio Mode

- **never**: No audio capture (silent verification)
- **risk_based**: Audio only when backend policy requires it
- **always**: Always capture audio snippet

### WebAuthn

Enable platform authenticator binding (Touch ID, Face ID, Windows Hello) for enhanced security.

---

## ⚠️ Common Issues & Solutions

### Issue: "Camera not found"

**Solution:**
- Make sure your device has a webcam
- Check browser permissions: Settings → Privacy → Camera
- Try refreshing the page
- On macOS Safari: System Preferences → Security & Privacy → Camera

---

### Issue: "Permission denied"

**Solution:**
- Click the camera icon in your browser's address bar
- Select "Always allow" for localhost
- Refresh the page and try again

---

### Issue: "Module not found" errors

**Solution:**
```bash
# From project root
npm install

# Install demo dependencies
cd examples/web-demo
npm install

# Go back to root
cd ../..
```

---

### Issue: Port 3000 already in use

**Solution:**
```bash
# Kill the process on port 3000
# macOS/Linux:
lsof -ti:3000 | xargs kill -9

# Windows:
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Or use a different port:
PORT=3001 npm run dev
```

---

### Issue: Demo won't start after installation

**Solution:**
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
rm -rf examples/web-demo/node_modules
rm -rf packages/web-sdk/node_modules

npm install
cd examples/web-demo
npm install
npm run dev
```

---

## 🧪 Testing Tips

### Test Different Scenarios

**Good Quality Capture:**
- Well-lit environment (bright but not harsh)
- Face centered and straight
- Steady camera position

**Poor Quality (should be rejected):**
- Very dark room
- Face at extreme angle
- Multiple people in frame
- Moving too much

### Test Policy Behaviors

The demo shows how the SDK responds to different backend policies:

1. **Basic enrollment** - Just video capture
2. **Audio required** - Set audio mode to "always"
3. **WebAuthn binding** - Enable WebAuthn option
4. **Step-up challenges** - Backend can request head turns, dot following, etc.

---

## 📱 Testing on Mobile

To test on your phone/tablet:

1. **Find your computer's local IP address**:
   ```bash
   # macOS/Linux
   ifconfig | grep "inet "
   
   # Windows
   ipconfig
   ```

2. **Start the demo** (as usual):
   ```bash
   cd examples/web-demo
   npm run dev
   ```

3. **Access from mobile device**:
   ```
   http://YOUR_IP_ADDRESS:3000
   ```
   Example: `http://192.168.1.100:3000`

4. **Ensure both devices are on the same WiFi network**

**Note:** Some browsers require HTTPS for camera access. If you get permission errors on mobile, you may need to set up local HTTPS (see Next.js docs).

---

## 🏗️ Project Structure

Understanding what you're running:

```
/
├── examples/web-demo/              # ← The Next.js demo app
│   ├── src/
│   │   ├── app/
│   │   │   └── page.tsx            # Main demo UI
│   │   └── components/
│   │       ├── EnrollmentDemo.tsx  # Enrollment flow
│   │       ├── AuthenticationDemo.tsx # Auth flow
│   │       └── DebugView.tsx       # Debug console
│   ├── package.json
│   └── README.md
│
├── packages/web-sdk/               # ← The actual SDK
│   ├── src/
│   │   ├── client.ts               # SDK client
│   │   ├── components/             # React components
│   │   ├── capture/                # Video/audio capture
│   │   └── integrity/              # Web signals collection
│   └── package.json
│
└── BACKEND_*.md                    # ← Backend documentation
```

---

## 🎨 Customization Examples

### Change Primary Color

In the demo UI, try these colors:

- **UseSense Blue**: `#4F63F5` (default)
- **Fintech Green**: `#10B981`
- **Banking Dark Blue**: `#1E3A8A`
- **Healthcare Teal**: `#14B8A6`
- **Enterprise Purple**: `#7C3AED`

### Add Your Logo

1. Host your logo image online (or use a data URI)
2. Paste the URL in the "Logo URL" field
3. Click "Start Enrollment" to see your branding

---

## 📊 Understanding the Scores

### Trust Score (0-100)
**What it measures:** Device and channel integrity

- **90-100**: Clean browser, no automation detected, good hardware
- **60-89**: Minor concerns (older browser, suspicious extensions)
- **0-59**: Red flags detected (WebDriver, automation tools, emulators)

### Liveness Score (0-100)  
**What it measures:** Confidence that a real person is present

- **90-100**: High confidence - clear face, good quality, movement detected
- **70-89**: Moderate confidence - some quality issues
- **0-69**: Low confidence - poor quality, possible spoof attempt

### Dedupe Risk Score (0-100)

**For Enrollment:**
- **0-20**: No similar faces found (good!)
- **21-80**: Some similarity to existing identities
- **81-100**: High similarity - likely duplicate

**For Authentication:**
- **0-20**: Poor match - different person
- **21-80**: Moderate match - uncertain
- **81-100**: Strong match - same person

---

## 🔍 What Happens Under the Hood

When you click "Start Enrollment":

1. **SDK creates a session** → `POST /api/v1/sessions`
2. **Backend returns policy** → SDK knows what to collect
3. **User grants permissions** → Camera (and maybe mic) access
4. **SDK captures signals**:
   - 38 video frames (JPEG, 15 FPS)
   - Optional audio snippet (WebM)
   - Web integrity data (browser fingerprint)
   - Optional WebAuthn attestation
5. **SDK uploads data** → `POST /api/v1/sessions/{id}/upload`
6. **SDK polls for result** → `GET /api/v1/sessions/{id}`
7. **Backend evaluates**:
   - LiveSense (liveness detection)
   - DeepSense-Web (device trust)
   - Deduplication check
   - Risk scoring
8. **Decision returned** → APPROVE/REJECT/MANUAL_REVIEW/STEP_UP

In **sandbox mode** (no real backend), the SDK simulates this flow with mock responses.

---

## 🚧 Next Steps

### Build a Real Backend

The demo currently uses mock responses. To build a production backend:

1. **Read the documentation**:
   - `BACKEND_DOCUMENTATION_INDEX.md` - Start here
   - `BACKEND_API_SPECIFICATION.md` - Complete API reference
   - `AMAZON_REKOGNITION_INTEGRATION_GUIDE.md` - ML processing with AWS
   - `BACKEND_IMPLEMENTATION_GUIDE.md` - Step-by-step guide

2. **Implement 4 core endpoints**:
   - `POST /api/v1/sessions` - Create session
   - `POST /api/v1/sessions/{id}/upload` - Upload signals
   - `POST /api/v1/sessions/{id}/complete` - Complete session
   - `GET /api/v1/sessions/{id}` - Get status

3. **Set up infrastructure**:
   - PostgreSQL database (store sessions, identities)
   - S3 storage (store video frames, audio)
   - Amazon Rekognition (face detection, matching)
   - Redis (caching, rate limiting)

4. **Point the demo to your backend**:
   ```bash
   # In examples/web-demo/.env.local
   NEXT_PUBLIC_API_BASE_URL=https://your-backend.com
   NEXT_PUBLIC_TENANT_KEY=your-tenant-key
   ```

### Integrate into Your App

See `INTEGRATION_GUIDE.md` for how to integrate the SDK into your own application.

---

## 📚 Additional Resources

- **SDK Documentation**: `/packages/web-sdk/README.md`
- **Integration Guide**: `/INTEGRATION_GUIDE.md`
- **Backend Docs**: `/BACKEND_DOCUMENTATION_INDEX.md`
- **Project Summary**: `/PROJECT_SUMMARY.md`

---

## 🆘 Need Help?

### Check the Logs

**Browser Console** (F12 or Cmd+Option+I):
```
Look for errors from:
- @usesense/web-sdk
- MediaDevices API
- Network requests
```

**Demo Debug View**:
- Click "Show Debug" to see real-time events
- Check "Web Integrity Signals" for device data

### Common Questions

**Q: Does this work without a backend?**  
A: Yes! The demo includes mock responses. Great for testing UI/UX.

**Q: Can I test step-up challenges?**  
A: Yes, but you need a backend that returns `STEP_UP_REQUIRED` with challenge details.

**Q: Is the SDK production-ready?**  
A: The frontend SDK is complete. You need to build the backend (see documentation).

**Q: What browsers are supported?**  
A: Chrome 80+, Safari 14+, Firefox 75+, Edge 80+

**Q: Does it work on mobile?**  
A: Yes! Responsive design, works on iOS and Android.

---

## ✅ Verification Checklist

Make sure everything is working:

- [ ] Demo starts without errors (`npm run dev`)
- [ ] Page loads at `http://localhost:3000`
- [ ] Camera permission dialog appears
- [ ] Can capture video frames
- [ ] Enrollment completes with decision
- [ ] Debug view shows events
- [ ] Web integrity signals displayed
- [ ] Can change primary color and see updates
- [ ] Authentication tab works with identity_id

---

**🎉 You're all set! Start exploring the demo and see the power of UseSense Web SDK in action.**

For production deployment, proceed to the backend documentation:
- Start with: `BACKEND_DOCUMENTATION_INDEX.md`
- Then: `AMAZON_REKOGNITION_INTEGRATION_GUIDE.md`
- Finally: `BACKEND_IMPLEMENTATION_GUIDE.md`

Happy building! 🚀
