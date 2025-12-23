# GitCraft Deployment Guide

## Overview

GitCraft is deployed using:
- **Frontend**: Vercel (Next.js)
- **Backend**: Railway (Node.js + PostgreSQL)
- **Database**: Railway PostgreSQL

## Prerequisites

1. GitHub account with OAuth app configured
2. Vercel account
3. Railway account
4. Google API key (for Gemini) or Anthropic API key (for Claude)

---

## Backend Deployment (Railway)

### 1. Create Railway Project

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login to Railway
railway login

# Initialize project
cd backend
railway init
```

### 2. Add PostgreSQL Database

1. Go to Railway dashboard
2. Click "New" → "Database" → "PostgreSQL"
3. Railway will automatically set `DATABASE_URL` environment variable

### 3. Set Environment Variables

In Railway dashboard, add these variables:

```
GITHUB_CLIENT_ID=<your_github_oauth_client_id>
GITHUB_CLIENT_SECRET=<your_github_oauth_client_secret>
FRONTEND_URL=https://your-app.vercel.app
NODE_ENV=production
LOG_LEVEL=info
LLM_PROVIDER=google
GOOGLE_API_KEY=<your_google_api_key>
```

### 4. Deploy

```bash
# Deploy to Railway
railway up

# Or connect to GitHub for auto-deploy
# Go to Railway dashboard → Settings → Connect to GitHub
```

### 5. Initialize Database

After first deployment, run migrations:

```bash
# Connect to Railway shell
railway run npm run migrate
```

---

## Frontend Deployment (Vercel)

### 1. Install Vercel CLI

```bash
npm install -g vercel
```

### 2. Deploy Frontend

```bash
cd frontend
vercel

# Follow prompts:
# - Link to existing project or create new
# - Set build command: npm run build
# - Set output directory: .next
```

### 3. Set Environment Variables

In Vercel dashboard → Settings → Environment Variables:

```
NEXT_PUBLIC_API_URL=https://your-backend.railway.app
```

### 4. Configure Domain (Optional)

1. Go to Vercel dashboard → Settings → Domains
2. Add your custom domain
3. Update DNS records as instructed

---

## GitHub OAuth Configuration

### 1. Create OAuth App

1. Go to GitHub → Settings → Developer settings → OAuth Apps
2. Click "New OAuth App"
3. Fill in:
   - **Application name**: GitCraft
   - **Homepage URL**: `https://your-app.vercel.app`
   - **Authorization callback URL**: `https://your-backend.railway.app/auth/github/callback`
4. Save Client ID and Client Secret

### 2. Update Environment Variables

Update both Railway and Vercel with the new OAuth credentials.

---

## Post-Deployment

### 1. Test Authentication

1. Visit your frontend URL
2. Click "Connect with GitHub"
3. Verify OAuth flow works
4. Check Railway logs for any errors

### 2. Test Repository Connection

1. Connect a test repository
2. Verify documentation is created in Craft
3. Check webhook processing

### 3. Set Up Monitoring

**Railway**:
- Enable metrics in Railway dashboard
- Set up log drains if needed

**Vercel**:
- Monitor deployment logs
- Set up error tracking (Sentry, etc.)

---

## Environment-Specific Configuration

### Development
```bash
# backend/.env.local
DATABASE_URL=postgresql://localhost:5432/gitcraft_dev
FRONTEND_URL=http://localhost:3000
NODE_ENV=development
```

### Production
```bash
# Set in Railway dashboard
DATABASE_URL=<railway_postgres_url>
FRONTEND_URL=https://your-app.vercel.app
NODE_ENV=production
```

---

## Troubleshooting

### Database Connection Issues

```bash
# Test database connection
railway run node -e "require('./src/db/index.js').testConnection()"
```

### OAuth Redirect Mismatch

- Verify callback URL in GitHub OAuth app matches Railway backend URL
- Check FRONTEND_URL environment variable

### CORS Errors

- Ensure FRONTEND_URL is set correctly in Railway
- Check that frontend is using correct API_URL

---

## Scaling

### Backend (Railway)

1. Go to Railway dashboard → Settings
2. Adjust resources:
   - Memory: 512MB - 8GB
   - CPU: Shared - Dedicated
3. Enable auto-scaling if needed

### Database (Railway)

1. Monitor database size in Railway dashboard
2. Upgrade plan if needed
3. Consider read replicas for high traffic

### Frontend (Vercel)

- Vercel auto-scales
- Monitor bandwidth usage
- Upgrade plan if needed

---

## Maintenance

### Database Backups

Railway automatically backs up PostgreSQL databases. To create manual backup:

```bash
railway run pg_dump $DATABASE_URL > backup.sql
```

### Log Rotation

Logs are automatically rotated by Winston (14 days for app logs, 30 days for errors).

### Session Cleanup

Sessions are automatically cleaned up on server startup and expire after 24 hours.

---

## Security Checklist

- [ ] GitHub OAuth credentials are set as environment variables
- [ ] DATABASE_URL is not exposed in logs
- [ ] CORS is configured for production domain only
- [ ] Rate limiting is enabled
- [ ] Helmet security headers are active
- [ ] Webhook signature verification is enabled
- [ ] SSL/TLS is enforced (automatic on Railway/Vercel)

---

## Support

For issues:
1. Check Railway logs: `railway logs`
2. Check Vercel logs in dashboard
3. Review database connection status
4. Verify environment variables are set correctly
