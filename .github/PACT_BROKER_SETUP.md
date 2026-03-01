# Pact Broker Setup Instructions

This document provides instructions for setting up a Pact Broker to share and verify contracts between DiveStreams services.

## Option 1: Pactflow (Recommended for Quick Start)

Pactflow is a managed Pact Broker service with a free tier.

### Steps

1. **Sign up for Pactflow**
   - Go to https://pactflow.io/
   - Click "Start Free Trial"
   - Sign up with GitHub or email

2. **Create a new account**
   - Choose "Starter" (free tier)
   - Name your organization (e.g., "divestreams")

3. **Get your credentials**
   - Go to Settings → API Tokens
   - Copy your Pact Broker URL (e.g., `https://your-org.pactflow.io`)
   - Create a new API token with read/write permissions
   - Copy the token

4. **Configure GitHub Secrets**
   - Go to your GitHub repository → Settings → Secrets and variables → Actions
   - Add two repository secrets:
     - `PACT_BROKER_BASE_URL` = `https://your-org.pactflow.io`
     - `PACT_BROKER_TOKEN` = `your-api-token-here`

5. **Configure local environment**
   ```bash
   # Add to your .env file (don't commit this!)
   PACT_BROKER_BASE_URL=https://your-org.pactflow.io
   PACT_BROKER_TOKEN=your-api-token-here
   ```

6. **Test the connection**
   ```bash
   npm run pact:consumer  # Generate contracts
   npm run pact:publish   # Publish to broker
   ```

7. **Verify in Pactflow**
   - Go to your Pactflow dashboard
   - You should see 4 contracts:
     - DiveStreamsFrontend → DiveStreamsAPI
     - Zapier → DiveStreamsAPI
     - OAuthProvider → DiveStreamsAPI
     - Stripe → DiveStreamsAPI

### Pactflow Features (Free Tier)

✅ Unlimited contracts
✅ Contract versioning
✅ Can-I-Deploy checks
✅ Webhooks
✅ Network diagram
✅ 3 team members
✅ 30-day contract retention

---

## Option 2: Self-Hosted Pact Broker

For full control and unlimited retention, you can host your own Pact Broker.

### Option 2a: Docker Compose (Local Development)

1. **Start the Pact Broker**
   ```bash
   docker-compose -f pacts/docker-compose.pact-broker.yml up -d
   ```

2. **Access the broker**
   - URL: http://localhost:9292
   - Username: `admin`
   - Password: `admin`

3. **Configure local environment**
   ```bash
   # Add to your .env file
   PACT_BROKER_BASE_URL=http://localhost:9292
   PACT_BROKER_TOKEN=  # Leave empty for basic auth
   ```

4. **Publish contracts**
   ```bash
   npm run pact:consumer
   npm run pact:publish
   ```

5. **Stop the broker**
   ```bash
   docker-compose -f pacts/docker-compose.pact-broker.yml down
   ```

### Option 2b: Deploy to Production VPS

You can deploy the Pact Broker to your Dev, Test, or a dedicated VPS.

1. **Copy files to VPS**
   ```bash
   scp pacts/docker-compose.pact-broker.yml root@your-vps-ip:/opt/pact-broker/
   ```

2. **SSH to VPS and start**
   ```bash
   ssh root@your-vps-ip
   cd /opt/pact-broker
   docker-compose -f docker-compose.pact-broker.yml up -d
   ```

3. **Configure Caddy reverse proxy** (optional)
   Add to your Caddyfile:
   ```
   pact.divestreams.com {
       reverse_proxy localhost:9292
   }
   ```

4. **Set GitHub Secrets**
   ```
   PACT_BROKER_BASE_URL=https://pact.divestreams.com
   PACT_BROKER_TOKEN=  # Use basic auth or add token auth
   ```

### Option 2c: Hostinger VPS with Docker

1. **Create new project on VPS**
   Use the MCP tool to create a new Docker project:
   ```typescript
   mcp__hostinger-mcp__VPS_createNewProjectV1({
     virtualMachineId: 1296511,  // Dev VPS
     projectName: "pact-broker",
     composeYml: <contents of pacts/docker-compose.pact-broker.yml>
   })
   ```

2. **Configure DNS**
   - Add A record: `pact.divestreams.com` → VPS IP
   - Wait for DNS propagation

3. **Update Caddy**
   Add reverse proxy to Caddyfile on Dev VPS

4. **Set GitHub Secrets**
   ```
   PACT_BROKER_BASE_URL=https://pact.divestreams.com
   ```

---

## Verification

After setup, verify the Pact Broker is working:

### 1. Publish Contracts

```bash
npm run pact:consumer
npm run pact:publish
```

Expected output:
```
📦 Publishing Pact contracts to Pact Broker...
   Version: 1234567
   Branch: develop
   Broker: https://your-org.pactflow.io
✅ Pact contracts published successfully!
```

### 2. Check Broker UI

Visit your Pact Broker URL and verify:
- ✅ 4 contracts are visible
- ✅ DiveStreamsAPI provider shows 4 consumers
- ✅ Latest version matches your git SHA
- ✅ Branch tag is correct (develop/staging/main)

### 3. Test Can-I-Deploy

```bash
npm run pact:can-deploy
```

This checks if it's safe to deploy based on contract verification status.

---

## CI/CD Integration

The Pact tests workflow (`.github/workflows/pact-tests.yml`) will automatically:

1. **On every push:**
   - ✅ Run consumer tests
   - ✅ Generate contracts
   - ✅ Upload as artifacts

2. **On push to develop/staging/main:**
   - ✅ Publish contracts to broker
   - ✅ Run provider verification
   - ✅ Tag with branch name

3. **On push to main:**
   - ✅ Check can-i-deploy status
   - ⚠️ Warn if deployment is unsafe

---

## Troubleshooting

### Publishing fails with "Connection refused"

**Problem:** Can't connect to Pact Broker

**Solutions:**
1. Check `PACT_BROKER_BASE_URL` is correct
2. Verify broker is running (for self-hosted)
3. Check firewall/network access
4. Verify GitHub secrets are set correctly

### Publishing fails with "Unauthorized"

**Problem:** Authentication failed

**Solutions:**
1. Verify `PACT_BROKER_TOKEN` is set correctly
2. Check token hasn't expired (Pactflow)
3. For self-hosted, check basic auth credentials

### Can't see contracts in broker

**Problem:** Contracts published but not visible

**Solutions:**
1. Check broker logs: `docker-compose logs pact-broker`
2. Verify contract files were generated: `ls pacts/contracts/`
3. Check publish script ran successfully
4. Verify broker database is healthy

### Provider verification fails

**Problem:** Verification can't connect to provider

**Solutions:**
1. Ensure provider is running during verification
2. Check `providerBaseUrl` in provider test
3. Verify database/Redis are available
4. Check state handlers are implemented

---

## Best Practices

### Branch Strategy

- **develop** → Tag contracts with `development`
- **staging** → Tag contracts with `staging`
- **main** → Tag contracts with `production`

### Versioning

- Use git SHA as contract version
- Tag with branch name for environment tracking
- Use semantic versioning for breaking changes

### Retention

- **Pactflow:** 30-day retention (free tier)
- **Self-hosted:** Configure retention in broker settings
- Keep production contracts indefinitely

### Security

- ✅ Never commit `PACT_BROKER_TOKEN` to git
- ✅ Use GitHub Secrets for CI/CD
- ✅ Use environment variables locally
- ✅ Enable HTTPS for production broker
- ✅ Use authentication tokens (not basic auth)

---

## Support

- [Pactflow Documentation](https://docs.pactflow.io/)
- [Pact Broker GitHub](https://github.com/pact-foundation/pact_broker)
- [Pact Slack Community](https://slack.pact.io/)
- [DiveStreams Pact Docs](../PACT_TESTING.md)
