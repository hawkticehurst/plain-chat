# Clerk Production Setup Guide

## 1. Clerk Dashboard Configuration

### Create Production Application

1. Go to [Clerk Dashboard](https://dashboard.clerk.com)
2. Create a **new application** for production (separate from development)
3. Choose your authentication methods (GitHub, Google, etc.)
4. Select **"Production"** environment

### Configure Redirect URLs

In your Clerk production app dashboard:

1. **Navigate to**: Paths → Sign-in/Sign-up pages
2. **Add these redirect URLs**:

   - Sign-in URL: `https://your-domain.com/sign-in`
   - Sign-up URL: `https://your-domain.com/sign-in`
   - After sign-in URL: `https://your-domain.com/`
   - After sign-up URL: `https://your-domain.com/`

3. **Navigate to**: Paths → Home URL
   - Set Home URL: `https://your-domain.com/`

### OAuth Provider Configuration

1. **Navigate to**: User & Authentication → Social providers
2. **For GitHub OAuth**:
   - Add allowed redirect URLs:
     - `https://your-domain.com/sign-in`
     - `https://your-domain.com/`
   - The OAuth callback URL should be handled automatically by Clerk

### Domain Configuration

1. **Navigate to**: Configure → Domains
2. **Add your production domains**:
   - `your-domain.com`
   - `www.your-domain.com` (if applicable)

### JWT Template Configuration

1. **Navigate to**: Configure → JWT Templates
2. **Create/Edit template**:
   - Name: `convex`
   - Audience: (your Convex HTTP Actions URL)

## 2. Environment Variables

Update your `.env.local` file:

```bash
# ===========================================
# CLERK CONFIGURATION
# ===========================================

# Clerk publishable key (production)
VITE_CLERK_PUBLISHABLE_KEY=pk_live_YOUR_ACTUAL_PRODUCTION_KEY_HERE
```

**Important**: Replace `YOUR_ACTUAL_PRODUCTION_KEY_HERE` with your actual production key from the Clerk dashboard.

## 3. Code Changes Made

The following changes have been implemented to fix OAuth redirects:

### AuthService (`lib/auth/auth.ts`)

- Added redirect URL configuration in `clerk.load()`
- Added `handleRedirectCallback()` method for OAuth flow handling
- Added public method to access Clerk instance

### App Component (`src/App.ts`)

- Early Clerk initialization in constructor
- Automatic OAuth redirect handling
- Proper auth status checking after initialization

## 4. Testing the Setup

1. **Deploy your app** with the updated code
2. **Update your Clerk dashboard** with the production URLs
3. **Test the OAuth flow**:
   - Visit your production site
   - Click sign in with GitHub
   - Should redirect to GitHub
   - After authorization, should redirect back to your site at `/`

## 5. Common Issues and Solutions

### Issue: Redirect loop after OAuth

**Solution**: Ensure your redirect URLs in Clerk dashboard exactly match your domain

### Issue: "Invalid redirect URL" error

**Solution**: Add all possible redirect URLs to your Clerk dashboard, including both with and without `www`

### Issue: User gets stuck on Clerk domain

**Solution**: Check that your `signInForceRedirectUrl` and `signUpForceRedirectUrl` are correctly set to your domain

## 6. Security Considerations

- Always use HTTPS in production
- Keep your Clerk secret key secure (never expose in frontend)
- Regularly rotate your API keys
- Monitor your Clerk dashboard for unusual activity

## 7. Deployment Checklist

- [ ] Updated `.env.local` with production Clerk key
- [ ] Configured redirect URLs in Clerk dashboard
- [ ] Set up JWT template for Convex
- [ ] Added production domains to Clerk
- [ ] Tested OAuth flow end-to-end
- [ ] Verified user can access protected routes after sign-in
