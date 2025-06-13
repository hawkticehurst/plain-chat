# Quick Deployment Fix Checklist

## Immediate Steps to Fix CORS Issues

### 1. Deploy Updated Code to Convex

```bash
# Deploy the CORS fixes to your Convex backend
npx convex deploy --prod
```

### 2. Set Environment Variables in Convex Dashboard

Go to your Convex dashboard → Settings → Environment Variables and add:

- `NODE_ENV`: `production`
- `CLERK_JWT_ISSUER_DOMAIN`: Your Clerk domain (e.g., `grown-perch-47.clerk.accounts.dev`)

### 3. Update Cloudflare Pages Environment Variables

In Cloudflare Pages → Settings → Environment Variables, ensure you have:

- `VITE_CONVEX_URL`: Your production Convex URL (e.g., `https://giant-camel-264.convex.site`)
- `VITE_CLERK_PUBLISHABLE_KEY`: Your **production** Clerk key (starts with `pk_live_`)

### 4. Create Production Clerk Application

1. Go to Clerk Dashboard
2. Create a new application for production (if you haven't already)
3. Copy the **production** publishable key (pk*live*...)
4. In Domains settings, add: `plain-chat.pages.dev`
5. Create JWT template named `convex` with audience: your Convex production URL

### 5. Redeploy Frontend

After updating environment variables in Cloudflare Pages, trigger a new deployment:

- Either push a new commit to your repository
- Or manually trigger a deployment in Cloudflare Pages

## Verification Steps

After deploying:

1. ✅ Check that the app loads without CORS errors
2. ✅ Verify authentication works (no development key warnings)
3. ✅ Test chat creation and messaging
4. ✅ Confirm AI responses stream properly
5. ✅ Check browser console for any remaining errors

## Common Issues and Solutions

### Still seeing CORS errors?

- Double-check that `NODE_ENV=production` is set in Convex
- Verify your domain is exactly `plain-chat.pages.dev` in CORS config
- Make sure you deployed the latest code with `npx convex deploy --prod`

### Authentication not working?

- Confirm you're using the production Clerk key (pk*live*...)
- Check that your domain is added to Clerk's allowed domains
- Verify JWT template is configured with correct Convex URL

### Build errors?

- Ensure all environment variables are set in Cloudflare Pages
- Check that the Convex URL format is correct (.convex.site ending)
- Review build logs for specific error messages

## Emergency Rollback

If you need to quickly rollback to development mode:

1. Change `VITE_CLERK_PUBLISHABLE_KEY` back to your test key (pk*test*...)
2. Set `NODE_ENV` to `development` in Convex
3. Redeploy

## Support

If you continue to have issues:

1. Check the browser's Network tab for failed requests
2. Review Convex logs in the dashboard
3. Check Clerk authentication logs
4. Verify all environment variables are correctly set
