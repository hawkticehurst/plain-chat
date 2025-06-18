# Production CORS Fix Guide

## Issues Fixed

### 1. External CDN Dependencies
- **Problem**: `shiki` was imported from `https://esm.sh/shiki@3.6.0` which was blocked by CSP
- **Solution**: Installed `shiki` as a local dependency via `npm install shiki`
- **Files Changed**: 
  - `src/components/ChatMessage.ts` - Updated import statement
  - `package.json` - Added shiki dependency

### 2. Content Security Policy (CSP) Updated
- **Problem**: CSP was too restrictive and blocking external resources
- **Solution**: Cleaned up CSP to only allow necessary external domains
- **Files Changed**: 
  - `public/_headers` - Simplified CSP directives

## Updated CSP Headers

```
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://clerk.hawkticehurst.com https://challenges.cloudflare.com https://static.cloudflareinsights.com; connect-src 'self' https://clerk.hawkticehurst.com https://blessed-shark-458.convex.site https://blessed-shark-458.convex.cloud; img-src 'self' https://img.clerk.com; worker-src 'self' blob:; style-src 'self' 'unsafe-inline'; frame-src 'self' https://challenges.cloudflare.com;
```

### Explanation of CSP Directives:
- `script-src`: Allows scripts from your site, Clerk auth, and Cloudflare (for analytics/protection)
- `connect-src`: Allows API calls to your backend (Convex) and auth services
- `img-src`: Allows images from your site and Clerk profile images
- `worker-src`: Allows web workers for your app functionality
- `style-src`: Allows inline styles needed for your components
- `frame-src`: Allows Cloudflare challenge frames

## Deployment Steps

### 1. Deploy Backend Changes
```bash
cd /var/home/hawkticehurst/Documents/programming/projects/plain-chat
npx convex deploy --prod
```

### 2. Build and Verify Local Changes
```bash
npm run build
# Check that build completes without errors
```

### 3. Deploy to Cloudflare Pages
- Push changes to your repository
- Cloudflare Pages will automatically deploy the new build
- The updated `_headers` file will be deployed with the new CSP

### 4. Verify in Production
After deployment, check:
- [ ] No CSP errors in browser console
- [ ] No CORS errors for esm.sh (should be eliminated)
- [ ] Shiki syntax highlighting still works
- [ ] All app functionality works normally

## Troubleshooting

### If you still see Cloudflare Insights errors:
These are usually not critical and don't affect app functionality. They're related to Cloudflare's analytics and can be ignored or:
1. Disable Cloudflare Analytics in your Cloudflare dashboard
2. Or add integrity attribute exceptions in your CSP

### If syntax highlighting doesn't work:
Check that the shiki import is working:
```typescript
import { codeToHtml } from "shiki";
```

### If you see new CSP violations:
Add the blocked domains to the appropriate CSP directive in `public/_headers`

## Benefits of This Fix

1. **Better Performance**: Local shiki dependency loads faster than CDN
2. **Better Reliability**: No dependency on external CDN availability
3. **Better Security**: Stricter CSP with only necessary external domains
4. **Better Caching**: Shiki code is bundled and cached with your app
5. **No Build-time Network Dependencies**: Build process doesn't depend on external CDNs

## File Changes Summary

### Modified Files:
- `src/components/ChatMessage.ts` - Updated shiki import
- `public/_headers` - Cleaned up CSP policy
- `package.json` - Added shiki dependency

### No Changes Required:
- Convex backend code (CORS already properly configured)
- Environment variables
- Clerk configuration
