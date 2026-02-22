# Staging Environment Secrets

**Last Updated:** 2026-01-27

All staging environment variables have been backed up to GitHub Secrets with the `STAGING_` prefix.

## Location of Original .env File
**VPS:** 76.13.28.28 (Staging VPS ID: 1271895)
**Path:** `/docker/divestreams-staging/.env`

## GitHub Secrets (shooter51/divestreams-v2)

All secrets are stored with the `STAGING_` prefix:

| GitHub Secret Name | Description | Value Location |
|-------------------|-------------|----------------|
| `STAGING_AUTH_SECRET` | Better Auth session secret | VPS .env file |
| `STAGING_DB_PASSWORD` | PostgreSQL database password | VPS .env file |
| `STAGING_ADMIN_PASSWORD` | Admin panel password | VPS .env file |
| `STAGING_SMTP_HOST` | SMTP server hostname | VPS .env file |
| `STAGING_SMTP_PORT` | SMTP server port | VPS .env file |
| `STAGING_SMTP_USER` | SMTP username | VPS .env file |
| `STAGING_SMTP_PASS` | SMTP password (Zoho app-specific) | VPS .env file |
| `STAGING_SMTP_FROM` | Email from address | VPS .env file |
| `STAGING_BETTER_AUTH_SECRET` | Better Auth secret | VPS .env file |
| `STAGING_STRIPE_SECRET_KEY` | Stripe test secret key | VPS .env file |
| `STAGING_STRIPE_PUBLISHABLE_KEY` | Stripe test publishable key | VPS .env file |
| `STAGING_NODE_ENV` | Node environment (production) | VPS .env file |

## .env File Structure

The .env file on the staging VPS contains 12 environment variables. All actual values are stored securely in:
- **Primary:** VPS at `/docker/divestreams-staging/.env`
- **Backup:** GitHub Secrets (with `STAGING_` prefix)

```bash
AUTH_SECRET=<stored in GitHub Secrets: STAGING_AUTH_SECRET>
DB_PASSWORD=<stored in GitHub Secrets: STAGING_DB_PASSWORD>
NODE_ENV=<stored in GitHub Secrets: STAGING_NODE_ENV>
ADMIN_PASSWORD=<stored in GitHub Secrets: STAGING_ADMIN_PASSWORD>
SMTP_HOST=<stored in GitHub Secrets: STAGING_SMTP_HOST>
SMTP_PORT=<stored in GitHub Secrets: STAGING_SMTP_PORT>
SMTP_USER=<stored in GitHub Secrets: STAGING_SMTP_USER>
SMTP_PASS=<stored in GitHub Secrets: STAGING_SMTP_PASS>
SMTP_FROM=<stored in GitHub Secrets: STAGING_SMTP_FROM>
BETTER_AUTH_SECRET=<stored in GitHub Secrets: STAGING_BETTER_AUTH_SECRET>
STRIPE_SECRET_KEY=<stored in GitHub Secrets: STAGING_STRIPE_SECRET_KEY>
STRIPE_PUBLISHABLE_KEY=<stored in GitHub Secrets: STAGING_STRIPE_PUBLISHABLE_KEY>
```

## Recovery Process

If the .env file is lost or corrupted on the VPS:

1. SSH to staging VPS: `ssh root@76.13.28.28`
2. Navigate to project: `cd /docker/divestreams-staging`
3. Recreate .env file using the values documented above
4. Restart services: `docker compose restart`

Alternatively, retrieve values from GitHub Secrets:
```bash
gh secret list -R shooter51/divestreams-v2 | grep STAGING
```

## Notes

- All secrets were added on 2026-01-27 after an incident where the .env file was wiped during VPS project recreation
- SMTP credentials are Zoho app-specific passwords
- Stripe keys are test mode keys (prefix: `sk_test_` and `pk_test_`)
- AUTH_SECRET and BETTER_AUTH_SECRET use the same value for staging
