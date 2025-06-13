# Production Clerk Setup Checklist

## 1. Clerk Dashboard Configuration

### OAuth Providers Setup

- [ ] Go to Clerk Dashboard → User & Authentication → Social Connections
- [ ] For **GitHub**:
  - [ ] Create OAuth app at https://github.com/settings/applications/new
  - [ ] Set redirect URI: `https://clerk.hawkticehurst.com/v1/oauth_callback`
  - [ ] Copy Client ID and Client Secret to Clerk Dashboard
- [ ] For **Google**:
  - [ ] Create OAuth app in Google Cloud Console
  - [ ] Set redirect URI: `https://clerk.hawkticehurst.com/v1/oauth_callback`
  - [ ] Copy Client ID and Client Secret to Clerk Dashboard

### Domain Configuration

- [ ] Go to Clerk Dashboard → Domains
- [ ] Configure DNS records as shown (may take up to 24 hours)
- [ ] Verify domain is properly configured

## 2. Content Security Policy (CSP) Headers

Add these directives to your hosting provider's CSP configuration:

```
script-src 'self' 'unsafe-inline' 'unsafe-eval' https://clerk.hawkticehurst.com https://challenges.cloudflare.com;
connect-src 'self' https://clerk.hawkticehurst.com;
img-src 'self' https://img.clerk.com;
worker-src 'self' blob:;
style-src 'self' 'unsafe-inline';
frame-src 'self' https://challenges.cloudflare.com;
```

### Key CSP Requirements

- **'unsafe-eval'** - Required for Clerk's JavaScript execution
- **'unsafe-inline'** - Required for Clerk's runtime CSS-in-JS styling
- **https://clerk.hawkticehurst.com** - Your Clerk FAPI hostname
- **https://challenges.cloudflare.com** - For Cloudflare Turnstile
- **https://img.clerk.com** - For Clerk profile images

## 3. Environment Variables

Ensure production environment variables are correct:

```bash
# Production Clerk keys (pk_live_ and sk_live_)
VITE_CLERK_PUBLISHABLE_KEY=pk_live_...

# Hash-based redirect URLs
VITE_CLERK_SIGN_IN_URL=/#/sign-in
VITE_CLERK_SIGN_UP_URL=/#/sign-in
VITE_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/#/
VITE_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/#/
VITE_CLERK_SIGN_IN_FORCE_REDIRECT_URL=/#/
VITE_CLERK_SIGN_UP_FORCE_REDIRECT_URL=/#/
```

## 4. Security Considerations

- [x] Added `authorizedParties` configuration for production (done in code)
- [ ] Verify all environment variables use production keys
- [ ] Test OAuth flows in production after provider setup
- [ ] Monitor for any remaining CSP violations

## 5. Testing Checklist

After completing the above:

- [ ] Test GitHub OAuth sign-in flow
- [ ] Test Google OAuth sign-in flow
- [ ] Verify no CSP violations in browser console
- [ ] Confirm proper redirect flow back to chat app
- [ ] Test sign-out functionality
- [ ] Verify chat history loads after sign-in

## Common Issues

### Missing Client ID

- **Problem**: OAuth provider shows empty `client_id`
- **Solution**: Configure OAuth credentials in Clerk Dashboard

### CSP Violations

- **Problem**: Inline scripts blocked
- **Solution**: Add required CSP directives above

### DNS Issues

- **Problem**: Clerk domain not resolving
- **Solution**: Wait up to 24 hours for DNS propagation

### Authorization Errors

- **Problem**: OAuth providers reject requests
- **Solution**: Verify redirect URIs match exactly in provider settings
