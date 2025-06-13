# Production Deployment Guide (Simplified)

This guide provides the **simplified** configuration for deploying your Plain Chat application.

## Required Environment Variables (Simplified)

After cleanup, you only need these variables:

### Frontend (Cloudflare Pages & Local)

- `VITE_CONVEX_URL`: Your Convex backend URL
- `VITE_CONVEX_HTTP_URL`: Your Convex HTTP Actions URL
- `VITE_CLERK_PUBLISHABLE_KEY`: Clerk authentication key
- `VITE_PRODUCTION_DOMAIN`: Custom domain (optional)

### Backend (Convex Dashboard)

- `CLERK_JWT_ISSUER_DOMAIN`: Clerk domain for JWT validation
- `NODE_ENV`: Environment indicator

## Step-by-Step Setup

### 1. Convex Configuration

#### Deploy to Production

```bash
npx convex deploy --prod
# Note the URL: https://your-deployment.convex.site
```

#### Set Environment Variables in Convex Dashboard

Go to [Convex Dashboard](https://dashboard.convex.dev) → Your Project → Settings → Environment Variables:

```bash
CLERK_JWT_ISSUER_DOMAIN=your-clerk-issuer-domain
NODE_ENV=production
```

_Optional: Add if using custom domain_

```bash
VITE_PRODUCTION_DOMAIN=https://your-custom-domain.com
```

### 2. Clerk Configuration

#### Create Production Application

1. Go to [Clerk Dashboard](https://dashboard.clerk.com)
2. Click **"Create application"** (separate from dev app)
3. Choose authentication methods
4. Select **"Production"** environment

#### Configure Production Settings

1. **Domains** → Add allowed domains:

   - `plain-chat.pages.dev`
   - Your custom domain (if applicable)

2. **JWT Templates** → Create new template:

   - **Name**: `convex`
   - **Audience**: `https://your-deployment.convex.site`

3. **API Keys** → Copy the **Publishable key** (starts with `pk_live_`)

### 3. Cloudflare Pages Configuration

#### Environment Variables

Go to Cloudflare Pages → Your Project → Settings → Environment Variables → **Production**:

```bash
# Required
VITE_CONVEX_URL=https://your-deployment.convex.site
VITE_CONVEX_HTTP_URL=https://your-deployment.convex.site
VITE_CLERK_PUBLISHABLE_KEY=pk_live_your_production_key

# Optional (only if using custom domain)
VITE_PRODUCTION_DOMAIN=https://your-custom-domain.com
```

#### Build Settings

- **Build command**: `npm run build`
- **Build output directory**: `dist`
- **Node.js version**: `18` or higher

#### Custom Domain (Optional)

1. Cloudflare Pages → Custom domains → **Set up a custom domain**
2. Follow DNS configuration instructions
3. Add domain to environment variables (see above)

## Simplified Variable Reference

### 🎯 **What Goes Where**

| Variable                     | Local Dev     | Cloudflare Pages | Convex Dashboard |
| ---------------------------- | ------------- | ---------------- | ---------------- |
| `VITE_CONVEX_URL`            | ✅            | ✅               | ❌               |
| `VITE_CONVEX_HTTP_URL`       | ✅            | ✅               | ❌               |
| `VITE_CLERK_PUBLISHABLE_KEY` | ✅ (pk*test*) | ✅ (pk*live*)    | ❌               |
| `CLERK_JWT_ISSUER_DOMAIN`    | ❌            | ❌               | ✅               |
| `NODE_ENV`                   | ❌            | ❌               | ✅               |
| `VITE_PRODUCTION_DOMAIN`     | ❌            | ✅\*             | ✅\*             |

_\*Only needed if using custom domain_

### 🗑️ **Removed Variables**

These were duplicates or unused:

- ~~`VITE_CLERK_FRONTEND_API_URL`~~ → Replaced by `CLERK_JWT_ISSUER_DOMAIN`
- ~~`VITE_CLERK_SECRET_KEY`~~ → Should never be in frontend
- ~~`VITE_CONVEX_DEPLOYMENT`~~ → Use `CONVEX_DEPLOYMENT`

## Quick Deployment Checklist

### ✅ Convex

- [ ] `npx convex deploy --prod`
- [ ] Set `CLERK_JWT_ISSUER_DOMAIN=grown-perch-47.clerk.accounts.dev`
- [ ] Set `NODE_ENV=production`

### ✅ Clerk

- [ ] Create production application
- [ ] Add `plain-chat.pages.dev` to domains
- [ ] Create `convex` JWT template with Convex URL
- [ ] Copy production publishable key (`pk_live_...`)

### ✅ Cloudflare Pages

- [ ] Set `VITE_CONVEX_URL=https://your-deployment.convex.site`
- [ ] Set `VITE_CLERK_PUBLISHABLE_KEY=pk_live_...`
- [ ] Deploy application

### ✅ Test

- [ ] App loads without errors
- [ ] Authentication works
- [ ] Chat functionality works
- [ ] No CORS errors in console

## Your Current Configuration

Based on your `.env.local`, you'll need to set:

### Convex Dashboard Environment Variables:

```bash
CLERK_JWT_ISSUER_DOMAIN=grown-perch-47.clerk.accounts.dev
NODE_ENV=production
```

### Cloudflare Pages Environment Variables:

```bash
VITE_CONVEX_URL=convex-cloud-url
VITE_CONVEX_HTTP_URL=convex-site-url
VITE_CLERK_PUBLISHABLE_KEY=pk_live_your_production_key_here
```

## Troubleshooting

### Authentication Issues

- Verify production Clerk key starts with `pk_live_`
- Check domains are configured in Clerk
- Ensure JWT template audience matches Convex URL

### CORS Issues

- Confirm `NODE_ENV=production` in Convex
- Verify domain configuration in CORS settings
- Check browser network tab for specific errors
- **Security Note**: CORS configuration now uses secure fallbacks (no wildcard `*` in production)

### Build Issues

- Ensure all required environment variables are set
- Check build logs in Cloudflare Pages
- Verify Node.js version compatibility
