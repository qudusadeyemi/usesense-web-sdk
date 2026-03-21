# ✅ API Key Authentication Migration Complete

## Overview

The UseSense Web SDK has been successfully migrated from **request body organization_id** to **API key-based authentication**. The backend now extracts `organization_id` from the API key, providing better security and simpler configuration.

---

## Changes Made

### 1. SDK Types (`/packages/web-sdk/src/types.ts`)

**Before:**
```typescript
export interface UseSenseConfig {
  apiBaseUrl: string;
  tenantKey: string;
  organizationId?: string;
  environment: Environment;
  branding?: BrandingConfig;
  options?: SDKOptions;
}

export interface CreateSessionRequest {
  session_type: SessionType;
  organization_id?: string; // ← Sent in request body
  identity_id?: string;
  external_user_id?: string;
  metadata?: Record<string, any>;
  platform: 'web';
}
```

**After:**
```typescript
export interface UseSenseConfig {
  apiBaseUrl: string;
  apiKey: string; // ← Replaced tenantKey with apiKey
  environment?: Environment; // ← Optional - auto-derived from API key prefix
  branding?: BrandingConfig;
  options?: SDKOptions;
}

export interface CreateSessionRequest {
  session_type: SessionType;
  // organization_id removed - extracted from API key by backend
  identity_id?: string;
  external_user_id?: string;
  metadata?: Record<string, any>;
  platform: 'web';
}
```

### 2. API Client (`/packages/web-sdk/src/api.ts`)

**Before:**
```typescript
constructor(
  private apiBaseUrl: string,
  private tenantKey: string,
  private environment: 'sandbox' | 'production' = 'sandbox'
) {}

async createSession(request: CreateSessionRequest): Promise<CreateSessionResponse> {
  const response = await fetch(this.buildUrl('/v1/sessions'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.tenantKey}`
    },
    body: JSON.stringify(request)
  });
}
```

**After:**
```typescript
constructor(
  private apiBaseUrl: string,
  private apiKey: string, // ← Changed parameter name
  private environment: 'sandbox' | 'production' = 'sandbox'
) {}

async createSession(request: CreateSessionRequest): Promise<CreateSessionResponse> {
  const response = await fetch(this.buildUrl('/v1/sessions'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': this.apiKey  // ← New header (backend extracts org_id)
    },
    body: JSON.stringify(request)
  });
}
```

### 3. SDK Client (`/packages/web-sdk/src/client.ts`)

**Before:**
```typescript
this.api = new UseSenseAPI(config.apiBaseUrl, config.tenantKey, config.environment);

async startEnrollment(params: StartEnrollmentParams): Promise<CreateSessionResponse> {
  const request: CreateSessionRequest = {
    session_type: 'enrollment',
    organization_id: this.config.organizationId, // ← Sent in body
    external_user_id: params.externalUserId,
    metadata: params.metadata,
    platform: 'web'
  };
}
```

**After:**
```typescript
constructor(config: UseSenseConfig) {
  this.config = {
    ...config,
    environment: config.environment || this.deriveEnvironmentFromApiKey(config.apiKey),
    // ...
  };

  this.api = new UseSenseAPI(
    config.apiBaseUrl, 
    config.apiKey, // ← Changed parameter
    this.config.environment!
  );
}

// Auto-derive environment from API key prefix
private deriveEnvironmentFromApiKey(apiKey: string): 'production' | 'sandbox' {
  return apiKey.startsWith('sk_prod_') || apiKey.startsWith('pk_live_') 
    ? 'production' 
    : 'sandbox';
}

async startEnrollment(params: StartEnrollmentParams): Promise<CreateSessionResponse> {
  const request: CreateSessionRequest = {
    session_type: 'enrollment',
    // organization_id removed - backend extracts from API key
    external_user_id: params.externalUserId,
    metadata: params.metadata,
    platform: 'web'
  };
}
```

### 4. Demo App (`/src/app/pages/DemoPageNew.tsx`)

**Before:**
```typescript
const [organizationId, setOrganizationId] = useState('demo-org-001');
const [environment, setEnvironment] = useState<'sandbox' | 'production'>('sandbox');

const client = createUseSenseClient({
  apiBaseUrl: 'https://api.usesense.ai/functions/v1/make-server-fc4cf30d',
  tenantKey: 'eyJhbGci...',
  organizationId: organizationId,
  environment: environment,
  // ...
});
```

**After:**
```typescript
const [apiKey, setApiKey] = useState('sk_demo_test_key_sandbox');

// Derive organization and environment from API key
const organizationId = apiKey.includes('_') ? apiKey.split('_')[2] || 'demo' : 'demo';
const environment = apiKey.startsWith('sk_prod_') || apiKey.startsWith('pk_live_') 
  ? 'production' 
  : 'sandbox';

const client = createUseSenseClient({
  apiBaseUrl: 'https://api.usesense.ai/functions/v1/make-server-fc4cf30d',
  apiKey: apiKey,
  // environment is auto-derived from API key prefix
  // ...
});
```

---

## API Key Format

### Sandbox Keys
```
sk_test_<org_name>_<random>
```

Example: `sk_test_acme_abc123xyz789`

### Production Keys
```
sk_prod_<org_name>_<random>
pk_live_<org_name>_<random>
```

Example: `sk_prod_acme_def456uvw012`

---

## How It Works

### Request Flow

**1. Client Configuration:**
```typescript
const client = createUseSenseClient({
  apiBaseUrl: 'https://api.usesense.ai',
  apiKey: 'sk_test_acme_abc123xyz789'
});
```

**2. SDK Auto-Derives Environment:**
```typescript
// SDK checks API key prefix
environment = apiKey.startsWith('sk_prod_') ? 'production' : 'sandbox';
```

**3. SDK Creates Session:**
```typescript
POST /v1/sessions?env=sandbox
Headers:
  Content-Type: application/json
  X-API-Key: sk_test_acme_abc123xyz789

Body:
{
  "session_type": "enrollment",
  "external_user_id": "user_123",
  "platform": "web"
}
```

**4. Backend Extracts Organization:**
```typescript
// Backend middleware
const apiKey = request.headers.get('X-API-Key');
const keyData = await lookupApiKey(apiKey);
const organizationId = keyData.organization_id;  // ← Extracted from key

// All subsequent operations use this organization_id
await storeSession(`${env}:usesense_session:${organizationId}:${sessionId}`, data);
```

---

## Benefits

### Security
- ✅ **Can't spoof organization ID** - Controlled by API key, not request body
- ✅ **API keys are revocable** - Compromised keys can be revoked instantly
- ✅ **Rate limiting per key** - Backend can track usage per API key

### Simplicity
- ✅ **One parameter instead of two** - Just `apiKey`, not `apiKey + organizationId`
- ✅ **Auto-derived environment** - `sk_test_*` = sandbox, `sk_prod_*` = production
- ✅ **Less configuration** - SDK handles environment detection

### Maintainability
- ✅ **Server-side control** - Organization mapping controlled by backend
- ✅ **Easier debugging** - API key identifies both org and environment
- ✅ **Better logging** - Each API key has unique identifier

---

## Migration Guide for Existing Users

### Step 1: Generate API Key

1. Log into UseSense dashboard
2. Go to **Settings → API Keys**
3. Click **"Generate New API Key"**
4. Choose environment:
   - Sandbox → `sk_test_*`
   - Production → `sk_prod_*`
5. Copy the key (shown only once!)

### Step 2: Update SDK Configuration

**Before:**
```typescript
const client = createUseSenseClient({
  apiBaseUrl: 'https://api.usesense.ai',
  tenantKey: 'YOUR_OLD_TENANT_KEY',
  organizationId: 'org_abc123xyz',
  environment: 'sandbox'
});
```

**After:**
```typescript
const client = createUseSenseClient({
  apiBaseUrl: 'https://api.usesense.ai',
  apiKey: 'sk_test_abc123_your_new_key'
  // environment is auto-derived from key prefix
});
```

### Step 3: Remove Organization ID from Code

**Before:**
```typescript
// Manually tracking organization
const orgId = getUserOrganization();
const client = createUseSenseClient({ organizationId: orgId, ... });
```

**After:**
```typescript
// Organization embedded in API key
const apiKey = getApiKeyFromEnv();  // e.g., sk_test_acme_xyz
const client = createUseSenseClient({ apiKey });
```

### Step 4: Test

```typescript
// Test enrollment
const session = await client.startEnrollment({
  externalUserId: 'test_user_001'
});

console.log('Session created:', session.session_id);
// Backend automatically scoped to organization from API key
```

---

## Demo App Updates

### Configuration UI

**Before:**
- Separate input for Organization ID
- Separate dropdown for Environment

**After:**
- Single input for API Key
- Organization and environment auto-derived and displayed

### Status Bar

Displays derived values:
```
Org: acme | Environment: 🔵 sandbox
```

---

## Error Handling

### Missing API Key

```json
{
  "error": "Missing API key. Provide via X-API-Key header",
  "code": 401
}
```

**Fix:** Include `apiKey` in SDK configuration.

### Invalid API Key

```json
{
  "error": "API key not found",
  "code": 401
}
```

**Causes:**
- Key doesn't exist
- Key is revoked
- Key is expired

**Fix:** Generate new API key in dashboard.

### Organization Not Determined

```json
{
  "error": {
    "code": "unauthorized",
    "message": "Invalid or missing API key. Organization could not be determined."
  }
}
```

**Cause:** API key is valid but missing `organization_id` field.

**Fix:** Re-create API key (older keys may not have this field).

---

## Testing

### Test 1: Auto-Derived Environment

```typescript
// Sandbox key
const client1 = createUseSenseClient({
  apiKey: 'sk_test_acme_xyz'
});
console.log(client1.config.environment); // 'sandbox'

// Production key
const client2 = createUseSenseClient({
  apiKey: 'sk_prod_acme_xyz'
});
console.log(client2.config.environment); // 'production'
```

### Test 2: Multi-Tenant Isolation

```typescript
// Organization A
const clientA = createUseSenseClient({
  apiKey: 'sk_test_orgA_key123'
});
const sessionA = await clientA.startEnrollment({externalUserId: 'user_001'});

// Organization B
const clientB = createUseSenseClient({
  apiKey: 'sk_test_orgB_key456'
});
const sessionB = await clientB.startAuthentication({
  identityId: sessionA.identity_id  // ← From Org A
});

// Expected: 404 identity_not_found (different organizations)
```

---

## Files Modified

1. ✅ `/packages/web-sdk/src/types.ts` - Updated config and request types
2. ✅ `/packages/web-sdk/src/api.ts` - Changed to X-API-Key header
3. ✅ `/packages/web-sdk/src/client.ts` - Added environment auto-detection
4. ✅ `/src/app/pages/DemoPageNew.tsx` - Updated to use API key input

---

## Documentation Updated

- ✅ SDK types reflect new API key model
- ✅ Demo app shows how to use API keys
- ✅ Error messages reference API keys, not organization IDs
- ✅ Migration guide provided above

---

## Backwards Compatibility

⚠️ **BREAKING CHANGE**: This is a breaking change. Existing code using `organizationId` in SDK configuration will fail.

**Migration Required:**
1. Generate API keys for each organization
2. Update SDK configuration to use `apiKey` instead of `tenantKey + organizationId`
3. Remove manual `organizationId` and `environment` parameters

---

## Next Steps

### For SDK Users:
1. ✅ Generate API keys in UseSense dashboard
2. ✅ Update SDK configuration
3. ✅ Remove organization ID logic from code
4. ✅ Test enrollment and authentication flows
5. ✅ Deploy updated SDK

### For Backend:
1. ✅ Validate X-API-Key header is present
2. ✅ Extract organization_id from API key
3. ✅ Scope all operations by organization
4. ✅ Return descriptive errors for invalid keys

---

**Migration Status:** ✅ Complete  
**Breaking Change:** Yes  
**Requires Action:** Yes (generate API keys, update SDK config)  
**Documentation:** Updated  
**Testing:** Required

---

**Questions?** Contact: support@usesense.ai
