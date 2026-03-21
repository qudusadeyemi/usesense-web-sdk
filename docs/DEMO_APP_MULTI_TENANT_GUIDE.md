# Demo App Multi-Tenant Configuration Guide

## 🎉 Overview

The UseSense Web SDK demo app now supports full multi-tenant configuration, allowing users to test the end-to-end flow with their own organization credentials and view sessions in their dashboard.

---

## ✨ New Features

### 1. **Organization ID Input**
- Users can enter their own organization identifier
- Default: `demo-org-001`
- Located in the "API Configuration" card (top of right sidebar)

### 2. **Environment Selection**
- Choose between **Sandbox** (test) and **Production** (live)
- Sandbox: 7-day data retention, relaxed limits
- Production: Live data, requires proper authorization
- Visual indicators:
  - 🔵 Sandbox mode (blue)
  - 🟢 Production mode (green with warning)

### 3. **Dynamic Configuration Display**
- "Active Configuration" card shows current settings:
  - Organization ID
  - Environment
  - SDK version
  - Audio mode
  - WebAuthn status
  - Test scenario

### 4. **Session Tracking**
- Sessions are scoped by organization ID and environment
- Results display which organization processed the session
- Debug logs show organization and environment at the start

### 5. **Dashboard Integration Guide**
- New card explaining how to view sessions in the UseSense dashboard
- Shows current organization ID and environment
- Helpful tips for filtering sessions

---

## 🔧 How It Works

### API Request Flow

**1. User configures:**
```
Organization ID: org_abc123xyz
Environment: sandbox
```

**2. SDK creates session:**
```bash
POST https://api.usesense.ai/.../v1/sessions?env=sandbox
Authorization: Bearer SUPABASE_ANON_KEY

{
  "session_type": "enrollment",
  "organization_id": "org_abc123xyz",  ← Scopes session to this org
  "external_user_id": "user_123",
  "platform": "web"
}
```

**3. Backend processes:**
- Validates `organization_id`
- Stores session: `sandbox:usesense_session:org_abc123xyz:sess_123`
- Stores identity: `sandbox:usesense_identity:org_abc123xyz:ident_456`
- S3 path: `signals/org_abc123xyz/sandbox/sess_123/frame_0.jpg`
- Rekognition: `org_abc123xyz::sandbox::ident_123`

**4. User views in dashboard:**
- Filter by organization ID: `org_abc123xyz`
- Filter by environment: `sandbox`
- See all sessions, identities, and analytics

---

## 📋 User Instructions

### For Testing with Your Organization

1. **Get Your Organization ID:**
   - Log into your UseSense dashboard
   - Navigate to Settings → Organization
   - Copy your Organization ID (e.g., `org_abc123xyz`)

2. **Configure the Demo:**
   - Open the demo app
   - Find "API Configuration" in the right sidebar
   - Paste your Organization ID
   - Select environment (start with Sandbox)

3. **Run a Test:**
   - Choose Enrollment or Authentication
   - Complete the verification flow
   - Note the Session ID from the results

4. **View in Dashboard:**
   - Open your UseSense dashboard
   - Go to Sessions tab
   - Filter by your organization ID
   - Find the session by Session ID
   - View detailed results, frames, and analytics

### For Production Testing

⚠️ **Warning:** Production mode uses live data and may incur charges.

1. **Prerequisites:**
   - Ensure you have production access
   - Verify your organization has production credits
   - Confirm you have proper authorization

2. **Switch to Production:**
   - Change environment to "Production"
   - Review the warning alert
   - Proceed with verification flow

3. **Best Practices:**
   - Test in Sandbox first
   - Use production sparingly
   - Monitor your usage in the dashboard

---

## 🔒 Multi-Tenant Isolation

### What's Isolated:

✅ **Sessions** - Each organization has separate sessions  
✅ **Identities** - Face templates are org-specific  
✅ **Storage** - S3 files are in org-specific folders  
✅ **Rekognition** - Face matching only within same org  
✅ **Analytics** - Dashboard shows only your org's data

### Isolation Guarantees:

- ❌ Organization A cannot access Organization B's sessions
- ❌ Organization A cannot authenticate against Organization B's identities
- ❌ Rekognition will never match faces across organizations
- ❌ Dashboard only shows data for your organization
- ❌ No data leakage between sandbox and production within same org

---

## 🎨 UI Components

### API Configuration Card
**Location:** Top of right sidebar  
**Purpose:** Configure organization and environment  
**Features:**
- Organization ID input (required)
- Environment selector (Sandbox/Production)
- Production warning alert
- Current configuration display

### Active Configuration Card
**Location:** Middle of right sidebar  
**Purpose:** Show current SDK settings  
**Features:**
- Organization ID badge
- Environment badge with color coding
- SDK version
- Audio mode
- WebAuthn status
- Test scenario

### View Sessions Card
**Location:** Below main demo area  
**Purpose:** Guide users to dashboard  
**Features:**
- Organization and environment display
- Dashboard access instructions
- Helpful filtering tips

### Backend Connection Notice
**Location:** Below demo area  
**Purpose:** Confirm active connection  
**Features:**
- Dynamic color based on environment
- Shows current organization and environment
- Explains multi-tenant isolation

### Session Results
**Purpose:** Display verification outcome  
**Features:**
- Shows which organization processed the session
- Environment indicator
- Session ID for dashboard lookup
- Trust and liveness scores
- Identity ID for authentication

---

## 🧪 Testing Scenarios

### Scenario 1: Single Organization, Both Environments

**Setup:**
- Organization: `org_test_001`
- Environment: Sandbox

**Actions:**
1. Enroll a user → Get `identity_id_sandbox`
2. Authenticate with `identity_id_sandbox` → ✅ Success
3. Switch to Production environment
4. Try to authenticate with `identity_id_sandbox` → ❌ Fail (different environment)
5. Enroll same user in Production → Get `identity_id_production`
6. Authenticate with `identity_id_production` → ✅ Success

**Expected:**
- Sandbox and Production identities are isolated
- Same physical person has different identity IDs in each environment

### Scenario 2: Multiple Organizations

**Setup:**
- Organization A: `org_company_alpha`
- Organization B: `org_company_beta`
- Environment: Sandbox (for both)

**Actions:**
1. Set Organization A, enroll User 1 → Get `identity_A_1`
2. Authenticate User 1 with `identity_A_1` → ✅ Success
3. Switch to Organization B
4. Try to authenticate User 1 with `identity_A_1` → ❌ Fail (different org)
5. Enroll User 1 in Organization B → Get `identity_B_1`
6. Authenticate User 1 with `identity_B_1` → ✅ Success

**Expected:**
- Organization A and B identities are completely isolated
- Same physical person has different identity IDs per organization
- No cross-organization face matching

### Scenario 3: Dashboard Verification

**Actions:**
1. Complete enrollment in demo → Note Session ID
2. Open UseSense dashboard
3. Filter by organization ID
4. Find session by Session ID
5. Verify:
   - Session exists in dashboard
   - Organization ID matches
   - Environment matches
   - All frames are visible
   - Decision matches demo result

**Expected:**
- Session appears in dashboard within seconds
- All data is accurate and matches demo results

---

## 🐛 Troubleshooting

### Issue: Sessions Not Appearing in Dashboard

**Possible Causes:**
- Wrong organization ID entered
- Wrong environment selected
- Dashboard filter not set correctly

**Solution:**
1. Double-check organization ID in demo matches dashboard
2. Verify environment (sandbox vs production)
3. Clear dashboard filters and re-apply
4. Wait 10-15 seconds for backend sync

### Issue: Authentication Fails with Valid Identity ID

**Possible Causes:**
- Identity was enrolled in different organization
- Identity was enrolled in different environment
- Identity ID typo

**Solution:**
1. Verify organization ID matches enrollment
2. Verify environment matches enrollment
3. Copy identity ID directly from enrollment results
4. Re-enroll if needed

### Issue: Production Mode Warning

**Possible Causes:**
- Switching to production environment
- This is expected behavior

**Solution:**
- This is a safety warning, not an error
- Only proceed if you have proper authorization
- Use sandbox for testing

---

## 📊 Dashboard Integration

### Viewing Sessions

**Steps:**
1. Log into UseSense dashboard
2. Navigate to "Sessions" tab
3. Apply filters:
   - Organization: Your organization ID
   - Environment: Sandbox or Production
   - Date range: Last 24 hours
4. Find your session by Session ID
5. Click to view details

### What You'll See:

- **Session Overview:**
  - Session ID
  - Session type (enrollment/authentication)
  - Status (completed/failed)
  - Decision (APPROVE/DENY/CHALLENGE)
  - Timestamp

- **Scores:**
  - Channel trust score (0-100)
  - Liveness score (0-100)
  - Dedupe risk score (0-100)

- **Media:**
  - All captured frames (viewable)
  - Audio snippet (if captured)
  - Face detection boxes

- **Metadata:**
  - Device information
  - Browser details
  - Web integrity signals
  - Rekognition results

- **Identity:**
  - Identity ID (if enrollment)
  - Face ID in Rekognition
  - Enrollment timestamp

### Analytics

**Dashboard provides:**
- Session success rate by organization
- Average liveness scores
- Challenge frequency
- Geographic distribution
- Browser/device breakdown
- Fraud attempt indicators

---

## 🚀 Production Deployment

### For SDK Customers

When deploying to production, customers should:

1. **Obtain Production Credentials:**
   ```typescript
   const client = createUseSenseClient({
     apiBaseUrl: 'https://api.usesense.ai',
     tenantKey: 'YOUR_PRODUCTION_KEY',
     organizationId: 'org_your_company',  // From dashboard
     environment: 'production'
   });
   ```

2. **Get Organization ID:**
   - From UseSense dashboard → Settings → Organization
   - Each customer organization has a unique ID
   - Format: `org_<company_name>_<random>`

3. **Configure Environment:**
   - Development: `environment: 'sandbox'`
   - Staging: `environment: 'sandbox'`
   - Production: `environment: 'production'`

4. **Store Credentials Securely:**
   - Use environment variables
   - Never commit credentials to code
   - Rotate keys regularly

---

## 🎯 Summary

**Key Benefits:**
- ✅ Demo users can test with their own organization
- ✅ End-to-end flow from demo to dashboard
- ✅ Complete multi-tenant isolation
- ✅ Separate sandbox and production environments
- ✅ Real-time session viewing in dashboard
- ✅ Production-ready configuration

**User Experience:**
1. Enter organization ID
2. Select environment
3. Run verification flow
4. View results in dashboard
5. Test isolation and security

**Next Steps:**
- Test with your organization ID
- View sessions in your dashboard
- Try both sandbox and production
- Verify data isolation
- Integrate into your app

---

**Questions?** Contact: support@usesense.ai
