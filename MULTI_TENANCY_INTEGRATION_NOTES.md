# Multi-Tenancy Integration Notes

## Issue Identified

**Current Problem:** The backend API currently uses the Supabase anonymous key for authentication, but this doesn't provide tenant/organization isolation. All sessions, identities, and data would be mixed across different organizations.

---

## Required Backend Changes

### **Option 1: Add `tenant_id` to Request Body** (✅ Recommended - Quick Fix)

The SDK has been updated to send an optional `tenant_id` field in all session creation requests. The backend should:

#### 1. Update Session Creation Endpoint

**Before:**
```json
POST /v1/sessions
{
  "session_type": "enrollment",
  "external_user_id": "user_123",
  "platform": "web"
}
```

**After:**
```json
POST /v1/sessions
{
  "session_type": "enrollment",
  "external_user_id": "user_123",
  "platform": "web",
  "tenant_id": "org_abc123xyz"  // ← NEW FIELD
}
```

#### 2. Backend Implementation

```typescript
// In your session creation handler
export async function createSession(req: Request): Promise<Response> {
  const { session_type, tenant_id, identity_id, external_user_id, platform } = await req.json();
  
  // Validate tenant_id (required for multi-tenancy)
  if (!tenant_id) {
    return new Response(
      JSON.stringify({ error: 'tenant_id is required' }), 
      { status: 400 }
    );
  }
  
  // Store session with tenant_id
  const sessionData = {
    session_id: generateSessionId(),
    tenant_id: tenant_id,  // ← Store this!
    session_type,
    identity_id,
    external_user_id,
    platform,
    status: 'created',
    created_at: new Date().toISOString()
  };
  
  // Save to KV or database
  await kv.set(`usesense_session:${sessionData.session_id}`, sessionData);
  
  return new Response(JSON.stringify({ session_id: sessionData.session_id, ... }));
}
```

#### 3. Scope All Operations by Tenant ID

**When uploading signals:**
```typescript
// Verify session belongs to tenant
const session = await kv.get(`usesense_session:${session_id}`);
if (session.tenant_id !== expected_tenant_id) {
  throw new Error('Unauthorized');
}
```

**When creating identities:**
```typescript
const identityData = {
  identity_id: generateIdentityId(),
  tenant_id: session.tenant_id,  // ← From session
  face_id: rekognitionFaceId,
  enrolled_at: new Date().toISOString()
};
```

**When searching faces (authentication):**
```typescript
// Only search within tenant's Rekognition collection
// You may need separate collections per tenant, or add metadata filtering
const searchResult = await rekognition.searchFacesByImage({
  CollectionId: `usesense-faces-${tenant_id}`,  // ← Tenant-specific collection
  Image: { Bytes: imageBuffer },
  MaxFaces: 1
});
```

#### 4. Database Schema Updates

If using a database (recommended for production), add `tenant_id` columns:

```sql
-- Sessions table
ALTER TABLE sessions ADD COLUMN tenant_id VARCHAR(255) NOT NULL;
CREATE INDEX idx_sessions_tenant_id ON sessions(tenant_id);

-- Identities table
ALTER TABLE identities ADD COLUMN tenant_id VARCHAR(255) NOT NULL;
CREATE INDEX idx_identities_tenant_id ON identities(tenant_id);

-- Ensure no cross-tenant data access
CREATE POLICY tenant_isolation_sessions ON sessions
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id'));
```

---

### **Option 2: Proper Tenant API Keys** (🎯 Production-Ready)

This is the approach from your original spec (`BACKEND_API_SPECIFICATION.md`):

#### 1. Create Tenant Keys Table

```sql
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(64) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  api_key_hash VARCHAR(128) NOT NULL,  -- bcrypt hash of API key
  environment VARCHAR(20) NOT NULL CHECK (environment IN ('sandbox', 'production')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tenants_tenant_id ON tenants(tenant_id);
```

#### 2. Generate Tenant API Keys

```typescript
// Generate tenant API keys
function generateTenantApiKey(environment: 'sandbox' | 'production'): string {
  const prefix = environment === 'sandbox' ? 'sk_test_' : 'sk_live_';
  const random = generateSecureRandomString(40); // Use crypto.randomBytes
  return `${prefix}${random}`;
}

// Example keys:
// sk_test_8f7a2c1e9d3b5a4f6e8c7d2a1b9f3e5c4d6a8b7e
// sk_live_3a5e7c9b2d4f6a8e1c3b5d7f9e1a3c5b7d9f2e4a
```

#### 3. Middleware to Extract Tenant from API Key

```typescript
// Middleware for API authentication
export async function authenticateTenant(req: Request): Promise<string> {
  const authHeader = req.headers.get('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Missing or invalid Authorization header');
  }
  
  const apiKey = authHeader.replace('Bearer ', '');
  
  // Look up tenant by API key hash
  const tenant = await db.query(
    'SELECT tenant_id FROM tenants WHERE api_key_hash = $1',
    [await hashApiKey(apiKey)]
  );
  
  if (!tenant) {
    throw new Error('Invalid API key');
  }
  
  return tenant.tenant_id;  // Return tenant_id for scoping
}
```

#### 4. Use in Session Creation

```typescript
export async function createSession(req: Request): Promise<Response> {
  // Authenticate and get tenant_id from API key
  const tenant_id = await authenticateTenant(req);
  
  const { session_type, identity_id, external_user_id, platform } = await req.json();
  
  // Create session scoped to this tenant
  const sessionData = {
    session_id: generateSessionId(),
    tenant_id: tenant_id,  // ← From API key authentication
    session_type,
    identity_id,
    external_user_id,
    platform,
    status: 'created',
    created_at: new Date().toISOString()
  };
  
  await kv.set(`usesense_session:${sessionData.session_id}`, sessionData);
  
  return new Response(JSON.stringify({ session_id: sessionData.session_id, ... }));
}
```

---

## Rekognition Multi-Tenancy

### Challenge: AWS Rekognition Collection Isolation

AWS Rekognition doesn't natively support multi-tenancy within a single collection. You have three options:

### **Option A: Separate Collections per Tenant**

```typescript
const collectionId = `usesense-faces-${tenant_id}`;

// Enrollment: Index face in tenant-specific collection
await rekognition.indexFaces({
  CollectionId: collectionId,
  Image: { Bytes: imageBuffer },
  ExternalImageId: external_user_id
});

// Authentication: Search in tenant-specific collection
await rekognition.searchFacesByImage({
  CollectionId: collectionId,
  Image: { Bytes: imageBuffer },
  MaxFaces: 1
});
```

**Pros:**
- ✅ Complete isolation
- ✅ Simple to implement
- ✅ Easy to delete tenant data

**Cons:**
- ⚠️ AWS limit: 100 collections per region (can request increase)
- ⚠️ Must create collections dynamically

### **Option B: Single Collection with Metadata Filtering**

```typescript
// Enrollment: Add tenant_id to ExternalImageId
await rekognition.indexFaces({
  CollectionId: 'usesense-faces',
  Image: { Bytes: imageBuffer },
  ExternalImageId: `${tenant_id}::${identity_id}`  // Format: tenant::identity
});

// Authentication: Search and filter results
const searchResult = await rekognition.searchFacesByImage({
  CollectionId: 'usesense-faces',
  Image: { Bytes: imageBuffer },
  MaxFaces: 10  // Get more results to filter
});

// Filter to only this tenant's faces
const tenantFaces = searchResult.FaceMatches?.filter(match => 
  match.Face.ExternalImageId?.startsWith(`${tenant_id}::`)
);
```

**Pros:**
- ✅ No collection limit issues
- ✅ Centralized management

**Cons:**
- ⚠️ Requires post-filtering (slight perf hit)
- ⚠️ More complex deletion logic

### **Option C: Hybrid (Recommended)**

- Use **separate collections** for large tenants (e.g., > 10,000 identities)
- Use **single collection with metadata** for smaller tenants
- Track collection strategy in `tenants` table

---

## SDK Configuration Examples

### For Customers Using the SDK

#### Development/Testing (Option 1):
```typescript
const client = createUseSenseClient({
  apiBaseUrl: 'https://api.usesense.ai/functions/v1/make-server-fc4cf30d',
  tenantKey: 'YOUR_SUPABASE_ANON_KEY',
  tenantId: 'org_abc123',  // ← Customer's organization ID
  environment: 'sandbox'
});
```

#### Production (Option 2 - Recommended):
```typescript
const client = createUseSenseClient({
  apiBaseUrl: 'https://api.usesense.ai',
  tenantKey: 'sk_live_3a5e7c9b2d4f6a8e1c3b5d7f9e1a3c5b7d9f2e4a',  // ← Unique API key per org
  environment: 'production'
});
```

---

## Action Items for Backend Engineer

### Immediate (Option 1):
- [ ] Add `tenant_id` field validation to `POST /v1/sessions`
- [ ] Store `tenant_id` with session data
- [ ] Scope identity lookups by `tenant_id`
- [ ] Add `tenant_id` to Rekognition `ExternalImageId` (format: `{tenant_id}::{identity_id}`)
- [ ] Filter search results by `tenant_id` prefix

### Production-Ready (Option 2):
- [ ] Create `tenants` table in database
- [ ] Implement tenant API key generation endpoint
- [ ] Add authentication middleware to extract `tenant_id` from API key
- [ ] Decide on Rekognition multi-tenancy strategy (separate collections vs metadata filtering)
- [ ] Add tenant-level rate limiting
- [ ] Add tenant-level audit logs

---

## Testing Multi-Tenancy

### Test Case 1: Data Isolation
```bash
# Tenant A enrolls
curl -X POST https://api.usesense.ai/v1/sessions \
  -H "Authorization: Bearer sk_test_tenant_a_key" \
  -d '{"session_type":"enrollment","tenant_id":"tenant_a","external_user_id":"user_001","platform":"web"}'

# Get identity_id_a from response

# Tenant B tries to authenticate with Tenant A's identity (should fail)
curl -X POST https://api.usesense.ai/v1/sessions \
  -H "Authorization: Bearer sk_test_tenant_b_key" \
  -d '{"session_type":"authentication","tenant_id":"tenant_b","identity_id":"identity_id_a","platform":"web"}'

# Expected: 404 identity_not_found (because identity belongs to tenant_a)
```

### Test Case 2: Face Matching Isolation
- Enroll same person in Tenant A and Tenant B
- Authenticate in Tenant A → should only match Tenant A's template
- Authenticate in Tenant B → should only match Tenant B's template

---

## Summary

**Quick Fix (Recommended for MVP):**
1. SDK now sends `tenant_id` in requests
2. Backend should validate and store `tenant_id` with sessions
3. Scope all Rekognition operations by `tenant_id` using prefixed `ExternalImageId`

**Production Solution:**
1. Implement proper tenant API key system (`sk_test_*` / `sk_live_*`)
2. Extract `tenant_id` from API key authentication
3. Use separate Rekognition collections per tenant (if < 100 tenants)

---

**Questions for Backend Engineer:**
1. Which option do you prefer for MVP: Option 1 (request body) or Option 2 (API keys)?
2. How many tenants do you expect? (Impacts Rekognition collection strategy)
3. Do you have a database or only using Supabase KV?
4. Should we support both `tenant_id` (request body) AND tenant API keys for backward compatibility?
