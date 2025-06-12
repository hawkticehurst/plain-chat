# Convex Migration Plan: Remove server.js → Pure Convex HTTP Actions

**Date:** June 12, 2025  
**Goal:** Completely remove the 864-line `server.js` Hono server and migrate all functionality to Convex HTTP Actions

## Current State Analysis

- **server.js**: 864 lines with extensive API endpoints
- **convex/http.ts**: Basic setup with only one route implemented
- **Frontend API calls**: 16 different `/api/*` endpoints used across components
- **Authentication**: Clerk integration throughout
- **Key insight**: No fallback OpenRouter API key - users must provide their own ✅

## Environment Variables Setup

Set in Convex Dashboard → Settings → Environment Variables:

1. **`ENCRYPTION_KEY`** - Generate with: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

   - Used for encrypting user API keys in database
   - Critical for security - without this, stored API keys can't be decrypted

2. **`SITE_URL`** - Your deployed app URL (e.g., `https://your-app.com`)

   - Used in OpenRouter API HTTP-Referer header

3. **~~`OPENROUTER_API_KEY`~~** - ❌ NOT NEEDED
   - System already requires user-provided keys only
   - No fallback inference costs

## Migration Phases

### Phase 1: Create HTTP Actions Structure

Create organized HTTP action files:

```
convex/httpActions/
├── auth.ts           # Auth status endpoint
├── aiSettings.ts     # AI key management & preferences
├── chats.ts          # Chat CRUD operations
├── messages.ts       # Message operations
├── streaming.ts      # SSE streaming endpoint
└── usage.ts          # Usage analytics
```

### Phase 2: Port All Endpoints (16 total)

#### Auth Endpoints (1)

- `GET /api/auth/status`

#### AI Settings Endpoints (6)

- `GET /api/ai/has-valid-key`
- `GET /api/ai/key-status`
- `GET /api/ai/preferences`
- `POST /api/ai/preferences`
- `POST /api/ai/test-key`
- `POST /api/ai/set-key`

#### Usage Endpoints (3)

- `GET /api/usage/recent`
- `GET /api/usage/daily`
- `GET /api/usage/monthly`

#### Critical Streaming Endpoint (1)

- `POST /api/ai/chat/stream` (SSE with ReadableStream)

#### Chat Endpoints (7)

- `GET /api/chats`
- `POST /api/chats`
- `GET /api/chats/:chatId/messages`
- `POST /api/chats/:chatId/messages`
- `PATCH /api/chats/:chatId/title`
- `POST /api/chats/:chatId/generate-title`
- `DELETE /api/chats/:chatId`

### Phase 3: Update Frontend Configuration

1. **Modify `lib/config.ts`** - Use Convex HTTP URL instead of localhost:3000
2. **Update API calls in components** (16 locations):
   - `src/components/ChatMain.ts` (6 calls)
   - `src/components/UsageDashboard.ts` (3 calls)
   - `src/components/AISettings.ts` (6 calls)
   - `src/components/ChatSidebar.ts` (1 call)

### Phase 4: Clean Up & Testing

1. **Remove `server.js`** entirely (864 lines deleted!)
2. **Update build scripts** in `package.json`
3. **Test all functionality** for parity

## Key Technical Considerations

### Authentication Migration

```javascript
// Before (Hono)
const auth = getAuth(c);
if (!auth?.userId) {
  return c.json({ error: "Unauthorized" }, 401);
}

// After (Convex)
const identity = await ctx.auth.getUserIdentity();
if (!identity) {
  return new Response("Unauthorized", { status: 401 });
}
```

### Database Calls Migration

```javascript
// Before (Hono)
const convexClient = await getConvexClient(auth);
const chats = await convexClient.query(api.chats.getUserChats);

// After (Convex)
const chats = await ctx.runQuery(api.chats.getUserChats);
```

### Response Format Migration

```javascript
// Before (Hono)
return c.json({ chats });

// After (Convex)
return new Response(JSON.stringify({ chats }), {
  headers: { "Content-Type": "application/json" },
  status: 200,
});
```

### Path Parameters

```javascript
// Before (Hono)
const chatId = c.req.param("chatId");

// After (Convex)
const url = new URL(request.url);
const pathParts = url.pathname.split("/");
const chatId = pathParts[pathParts.length - 2]; // Extract from URL path
```

### Streaming Endpoint (Most Complex)

- The SSE streaming logic with `ReadableStream` transfers almost directly
- Replace `convexClient.mutation` with `ctx.runMutation`
- Keep all fetch logic to OpenRouter API identical
- Maintain the same SSE event format for frontend compatibility

## Frontend URL Migration

```javascript
// Before
`${config.apiBaseUrl}/api/chats`// After
`${config.convexHttpUrl}/chats`; // Remove /api prefix
```

## Benefits After Migration

- ✅ **Delete 864 lines** of server code
- ✅ **Simplified deployment** (only `npx convex deploy`)
- ✅ **Better performance** (direct Convex calls, no proxy)
- ✅ **Unified auth** (Clerk integration built into Convex)
- ✅ **Reduced complexity** (no more middle-layer server)
- ✅ **Better error handling** (Convex's built-in error management)
- ✅ **Automatic scaling** (Convex handles all infrastructure)

## Estimated Impact

- **Files to create:** ~6 new HTTP action files
- **Files to modify:** ~6 frontend components + config
- **Files to delete:** `server.js` (entire 864-line file)
- **Total effort:** Medium complexity, high value

## Migration Order (Recommended)

1. **Start simple:** Auth endpoint
2. **Build momentum:** Chat CRUD endpoints
3. **Handle complexity:** AI settings endpoints
4. **Most critical:** Streaming endpoint (SSE)
5. **Finish strong:** Usage analytics endpoints

## Testing Checklist

After each endpoint migration:

- [ ] Authentication works correctly
- [ ] Data flows match original behavior
- [ ] Error handling maintains user experience
- [ ] Performance is equal or better

## Rollback Plan

If issues arise:

- Keep `server.js` until all endpoints verified
- Use feature flags to switch between old/new endpoints
- Test in development thoroughly before production migration

---

**Status:** Ready to execute ✅  
**Next Step:** Generate encryption key and start with Phase 1
