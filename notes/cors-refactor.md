# CORS Configuration Refactoring Summary

## Overview

Centralized CORS configuration to eliminate code duplication across HTTP action files.

## Changes Made

### 1. Created Centralized Configuration (`convex/lib/corsConfig.ts`)

- **Development Origins**: All localhost and 127.0.0.1 variants on common ports
- **Production Origins**: `plain-chat.pages.dev` with optional custom domain support
- **Shared Methods & Headers**: Consistent across all endpoints
- **Helper Functions**:
  - `getAllowedOrigins(isDev)`: Get origins based on environment
  - `getCorsHeaders(isDev)`: Standard CORS headers for JSON responses
  - `getStreamingCorsHeaders(isDev)`: Specialized headers for streaming responses
  - `isDevelopment()`: Environment detection utility

### 2. Updated Files

#### `convex/http.ts`

- Import centralized config
- Use `getAllowedOrigins()` and `CORS_CONFIG` constants
- Removed duplicate origin definitions

#### `convex/httpActions/auth.ts`

- Import `getCorsHeaders` and `isDevelopment` from config
- Removed local CORS function
- Use centralized environment detection

#### `convex/httpActions/chats.ts`

- Import centralized CORS utilities
- Replaced local getCorsHeaders function
- Use `isDevelopment()` instead of manual env check

#### `convex/httpActions/messages.ts`

- Import centralized CORS utilities
- Removed duplicate CORS configuration
- Standardized environment detection

#### `convex/httpActions/streaming.ts`

- Import `getStreamingCorsHeaders` for streaming-specific headers
- Replaced `setCorsHeaders()` with `getStreamingCorsHeaders(isDev)`
- Consistent environment detection

#### `convex/httpActions/usage.ts`

- Import centralized CORS utilities
- Removed local CORS function
- Use `isDevelopment()` helper

#### `convex/httpActions/aiSettings.ts`

- Import centralized CORS utilities
- Removed duplicate CORS configuration
- Standardized environment detection

## Benefits

### 1. **DRY Principle**: Single source of truth for CORS configuration

### 2. **Maintainability**: Update origins in one place affects all endpoints

### 3. **Consistency**: All endpoints use identical CORS policies

### 4. **Type Safety**: Centralized TypeScript definitions

### 5. **Environment Management**: Unified development/production detection

## Configuration Points

### Development Origins

```typescript
"http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:3000",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174";
```

### Production Origins

```typescript
"https://plain-chat.pages.dev";
// + process.env.VITE_PRODUCTION_DOMAIN (if set)
```

### CORS Methods

```typescript
["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"];
```

### CORS Headers

```typescript
["Content-Type", "Authorization"];
```

## Future Additions

To add a new origin or modify CORS policy:

1. Update `convex/lib/corsConfig.ts`
2. Changes automatically apply to all endpoints
3. No need to modify individual HTTP action files

## Deployment Notes

- **Development**: Uses wildcard origin (`*`) for flexibility
- **Production**: Restricts to specific domains for security
- **Custom Domains**: Automatically included via `VITE_PRODUCTION_DOMAIN` env var
- **Streaming**: Special headers for Server-Sent Events compatibility
