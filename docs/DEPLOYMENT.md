# Deployment Guide

## Render (Primary)

### First-time setup

1. Push code to GitHub
2. In Render Dashboard, click "New Blueprint"
3. Connect your GitHub repo
4. Render will detect `render.yaml` and create all services:
   - PostgreSQL database (production + staging)
   - Backend API (production + staging)
   - Frontend static site (production + staging)
5. Wait for all services to deploy

### Set manual environment variables

After the blueprint deploys, go to each backend service and set these in the Environment tab:

**Required for email:**
- `SMTP_HOST` - Your SMTP provider (e.g., smtp.sendgrid.net)
- `SMTP_USER` - SMTP username
- `SMTP_PASS` - SMTP password

**Required for file uploads:**
- `AWS_ACCESS_KEY_ID` - AWS IAM credentials
- `AWS_SECRET_ACCESS_KEY` - AWS IAM credentials
- `S3_BUCKET` - S3 bucket name

**Required for identity verification:**
- `STRIPE_SECRET_KEY` - From Stripe Dashboard
- `STRIPE_WEBHOOK_SECRET` - From Stripe webhook settings

**Required for error monitoring:**
- `SENTRY_DSN` - From Sentry project settings

**Optional (for data sync):**
- `OPEN_STATES_API_KEY` - https://openstates.org/accounts/login/
- `FEC_API_KEY` - https://api.open.fec.gov/developers/
- `CONGRESS_GOV_API_KEY` - https://api.congress.gov/sign-up/

### Initialize the database

The schema and migrations run automatically on first deploy via the `startCommand`.

### Set up Stripe webhook

1. In Stripe Dashboard > Developers > Webhooks
2. Add endpoint: `https://whosrunningusa-api.onrender.com/api/candidates/verify/webhook`
3. Listen for: `identity.verification_session.verified`
4. Copy the signing secret to `STRIPE_WEBHOOK_SECRET`

### Set up Plausible analytics

1. Sign up at https://plausible.io
2. Add site: `whosrunningusa.com`
3. Analytics script is already in index.html - no further config needed

### Set up Sentry

1. Create a project at https://sentry.io
2. Create two projects: one for React (frontend), one for Node (backend)
3. Set `VITE_SENTRY_DSN` in the frontend service env vars
4. Set `SENTRY_DSN` in the backend service env vars

## Docker

### Build and run locally

```bash
docker build -t whosrunningusa .
docker run -p 5000:5000 \
  -e DATABASE_URL=postgresql://user:pass@host:5432/whosrunningusa \
  -e JWT_SECRET=your-secret \
  -e NODE_ENV=production \
  whosrunningusa
```

### Docker Compose (with local PostgreSQL)

```yaml
version: '3.8'
services:
  db:
    image: postgres:16
    environment:
      POSTGRES_DB: whosrunningusa
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    volumes:
      - pgdata:/var/lib/postgresql/data

  app:
    build: .
    ports:
      - "5000:5000"
    environment:
      DATABASE_URL: postgresql://postgres:postgres@db:5432/whosrunningusa
      JWT_SECRET: dev-secret
      NODE_ENV: production
      FRONTEND_URL: http://localhost:5000
    depends_on:
      - db

volumes:
  pgdata:
```

## CI/CD

GitHub Actions runs automatically on push to `main`/`master` and on PRs:
- **Frontend job:** Builds the Vite app
- **Backend job:** Runs Jest test suite

Render auto-deploys on push to the connected branch.

## Environments

| Environment | Backend URL | Frontend URL |
|-------------|-------------|--------------|
| Production | whosrunningusa-api.onrender.com | whosrunningusa.onrender.com |
| Staging | whosrunningusa-staging-api.onrender.com | whosrunningusa-staging.onrender.com |
| Local | localhost:5000 | localhost:3000 |
