# Pact Can-I-Deploy Deployment Safety Guide

## Overview

The **can-i-deploy** feature is a critical safety gate in the DiveStreams CI/CD pipeline that prevents deploying incompatible versions of the API. It ensures all consumer contracts have been verified before allowing deployment to production.

## How It Works

```
┌──────────────────────────────────────────────────────────────┐
│                    Deployment Safety Flow                     │
└──────────────────────────────────────────────────────────────┘

1. Developer pushes to main branch
   ↓
2. Consumer tests run and generate contracts
   ↓
3. Contracts published to Pact Broker (version X)
   ↓
4. Provider verification tests run against contracts
   ↓
5. Verification results sent to Pact Broker
   ↓
6. Can-I-Deploy check queries Pact Broker:
   "Is version X safe to deploy to production?"

   Checks all consumers:
   ✓ DiveStreamsFrontend → verified?
   ✓ Zapier → verified?
   ✓ OAuthProvider → verified?
   ✓ Stripe → verified?

   ↓
   ┌─────────────────────────────────────┐
   │  ✅ All verified  │  ❌ Any failed  │
   └─────────┬─────────┴────────┬────────┘
            │                   │
            v                   v
   ┌──────────────┐    ┌─────────────────┐
   │ DEPLOY SAFE  │    │ BLOCK DEPLOYMENT│
   │ Proceed to   │    │ Fix contracts   │
   │ Production   │    │ and re-verify   │
   └──────────────┘    └─────────────────┘
```

## NPM Scripts

### Check Deployment Safety

```bash
# Check if current version is safe to deploy (auto-detects environment from branch)
npm run pact:can-deploy

# Check for specific environments
npm run pact:can-deploy:dev          # Check for dev environment
npm run pact:can-deploy:test         # Check for test environment
npm run pact:can-deploy:production   # Check for production environment
```

### Script Implementation

The can-i-deploy check is implemented in `/scripts/can-i-deploy.mjs`:

**Features:**
- Auto-detects target environment based on git branch
- Uses `pact-broker can-i-deploy` CLI
- Queries Pact Broker for verification status
- **Blocks production deployments** if verification fails
- **Warns but allows** dev/test deployments if verification fails

**Environment Detection:**
- `main` branch → `production` environment (BLOCKING)
- `staging` branch → `test` environment (WARNING)
- `develop` branch → `dev` environment (WARNING)
- Other branches → `dev` environment (WARNING)

## CI/CD Integration

### 1. Deployment Workflow (`.github/workflows/deploy.yml`)

**Before Production Deployment:**

```yaml
pact-can-i-deploy:
  if: github.ref == 'refs/heads/main'
  runs-on: [self-hosted, linux, divestreams]
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: '20'
        cache: 'npm'
    - name: Install dependencies
      run: npm ci --legacy-peer-deps
    - name: Check deployment safety
      run: npm run pact:can-deploy:production
      env:
        PACT_BROKER_BASE_URL: http://62.72.3.35:9292
        GITHUB_SHA: ${{ github.sha }}
        GITHUB_REF_NAME: ${{ github.ref_name }}

promote-to-production:
  needs: pact-can-i-deploy  # ← BLOCKS if can-i-deploy fails
  if: github.ref == 'refs/heads/main'
  steps:
    - name: Deploy to production
      # ... deployment steps
```

**After Each Deployment (Dev, Test, Production):**

```yaml
- name: Record deployment to [environment]
  run: |
    npx pact-broker record-deployment \
      --pacticipant DiveStreamsAPI \
      --version ${{ github.sha }} \
      --environment [dev|test|production] \
      --broker-base-url http://62.72.3.35:9292
  continue-on-error: true
```

This records the deployed version in the Pact Broker so future can-i-deploy checks know what's running in each environment.

### 2. Pact Tests Workflow (`.github/workflows/pact-tests.yml`)

```yaml
can-i-deploy:
  name: Check Can I Deploy
  needs: [consumer-tests, provider-verification]
  if: github.ref == 'refs/heads/main'
  steps:
    - name: Check can-i-deploy to production
      run: npm run pact:can-deploy:production
      env:
        PACT_BROKER_BASE_URL: http://62.72.3.35:9292
        GITHUB_SHA: ${{ github.sha }}
```

## Environment Strategy

| Environment | Deployment Gate | Behavior |
|-------------|----------------|----------|
| **dev** | WARNING | Can-i-deploy failures show warnings but don't block deployment |
| **test** | WARNING | Can-i-deploy failures show warnings but don't block deployment |
| **production** | **BLOCKING** | Can-i-deploy failures **BLOCK deployment** |

**Rationale:**
- **Dev/Test:** Fast iteration, allow deployment even with verification failures
- **Production:** Safety-first, never deploy incompatible versions

## Complete CI/CD Pipeline Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                   COMPLETE DEPLOYMENT PIPELINE                   │
└─────────────────────────────────────────────────────────────────┘

BRANCH: develop (Dev VPS)
────────────────────────────
1. Push to develop
2. Run tests (unit)
3. Build Docker image (:dev)
4. Deploy to Dev VPS
5. Record deployment to 'dev' environment  ← Track version

BRANCH: staging (Test VPS)
──────────────────────────
1. Push to staging
2. Run tests (unit + E2E)
3. Publish Pact contracts
4. Run provider verification
5. Build Docker image (:test)
6. Deploy to Test VPS
7. Record deployment to 'test' environment  ← Track version
8. Run smoke tests

BRANCH: main (Production VPS)
──────────────────────────────
1. Push to main
2. Publish Pact contracts
3. Run provider verification
4. ⚠️  CAN-I-DEPLOY CHECK  ← DEPLOYMENT GATE
   - Query Pact Broker
   - Check all verifications passed
   - BLOCK if any failures
5. Retag :test → :latest
6. Deploy to Production VPS
7. Record deployment to 'production' environment  ← Track version
```

## Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `PACT_BROKER_BASE_URL` | Pact Broker URL | ✅ Yes | http://62.72.3.35:9292 |
| `GITHUB_SHA` | Git commit SHA | ✅ Yes | Current HEAD |
| `GITHUB_REF_NAME` | Git branch name | ✅ Yes | Current branch |
| `PACT_ENVIRONMENT` | Target environment | For recording only | Auto-detected |

## Pact Broker Configuration

**Self-Hosted Broker:** http://62.72.3.35:9292

- **Location:** Dev VPS (62.72.3.35)
- **Port:** 9292
- **Authentication:** None (self-hosted)
- **Access:** Available to all CI/CD workflows

## Troubleshooting

### ❌ Can-I-Deploy Fails

**Error Message:**
```
❌ NOT SAFE TO DEPLOY!

One or more contract verifications have not passed.
This means consumers are expecting contracts that this
version of the provider has not verified.

🛑 BLOCKING PRODUCTION DEPLOYMENT
```

**Causes:**
1. **Provider verification failed** - API doesn't match consumer expectations
2. **Contracts not verified** - Provider verification tests didn't run
3. **New consumer added** - Consumer contract exists but provider hasn't verified it

**Solutions:**

#### 1. Check Verification Status in Pact Broker

Visit http://62.72.3.35:9292:
- Find **DiveStreamsAPI** provider
- Check which consumer verifications failed
- Review failure details

#### 2. Run Provider Verification Locally

```bash
# Run provider verification tests
npm run pact:provider

# This will:
# - Start the API server
# - Load contracts from Pact Broker
# - Verify API matches contracts
# - Show which interactions failed
```

#### 3. Fix Incompatibilities

**Option A: Update Provider (API)**
```bash
# If API is missing expected endpoints or fields
# Update the API code to match consumer expectations
# Then re-run provider verification
npm run pact:provider
```

**Option B: Update Consumer Contracts**
```bash
# If consumer expectations are wrong
# Update consumer tests
npm run pact:consumer

# Publish updated contracts
npm run pact:publish

# Re-run provider verification
npm run pact:provider
```

#### 4. Re-run CI/CD Pipeline

After fixes, push to trigger the pipeline again:
```bash
git add .
git commit -m "fix: resolve Pact contract verification failures"
git push origin main
```

### ⚠️ Pact Broker Unreachable

**Error:**
```
❌ PACT_BROKER_BASE_URL environment variable is not set
```

**Solution:**
Set the environment variable:
```bash
export PACT_BROKER_BASE_URL=http://62.72.3.35:9292
```

### 🔄 Deployment Recording Fails

**Warning:**
```
⚠️ Failed to record deployment
   This is non-critical - contracts were published successfully
```

**Impact:**
- Non-blocking warning
- Deployment proceeds normally
- Future can-i-deploy checks may not have accurate environment data

**Solution:**
Check Pact Broker connectivity and re-run deployment if needed.

## Best Practices

### 1. Always Run Can-I-Deploy Before Production

**❌ DON'T:**
```bash
# Force deploy without checking
git push origin main --force
```

**✅ DO:**
```bash
# Let CI/CD pipeline run can-i-deploy check
git push origin main
# Wait for can-i-deploy gate to pass
```

### 2. Fix Verification Failures Immediately

**❌ DON'T:**
- Ignore verification failures
- Deploy to production anyway
- Skip can-i-deploy checks

**✅ DO:**
- Investigate failures in Pact Broker
- Fix incompatibilities
- Re-run verification
- Only deploy when all verifications pass

### 3. Record Deployments After Each Deploy

**Why:**
- Tracks what version is running in each environment
- Enables accurate can-i-deploy checks
- Provides deployment history

**How:**
Deployment recording is automatic in CI/CD workflows.

### 4. Use Environment Tags Correctly

**Branch → Environment Mapping:**
```
develop  → dev         (warning only)
staging  → test        (warning only)
main     → production  (BLOCKING)
```

### 5. Test Locally Before Pushing

```bash
# Before pushing to main:
npm run pact:consumer     # Generate contracts
npm run pact:provider     # Verify locally
npm run pact:can-deploy   # Check deployment safety

# Only push if all pass
git push origin main
```

## Command Reference

### Check Deployment Safety

```bash
# Auto-detect environment from branch
npm run pact:can-deploy

# Specific environments
npm run pact:can-deploy:dev
npm run pact:can-deploy:test
npm run pact:can-deploy:production
```

### Manual Deployment Recording

```bash
# Record deployment manually (if needed)
npx pact-broker record-deployment \
  --pacticipant DiveStreamsAPI \
  --version $(git rev-parse HEAD) \
  --environment production \
  --broker-base-url http://62.72.3.35:9292
```

### Query Pact Broker

```bash
# List all pacticipants
npx pact-broker list-pacticipants \
  --broker-base-url http://62.72.3.35:9292

# Show deployment status
npx pact-broker describe-version \
  --pacticipant DiveStreamsAPI \
  --version $(git rev-parse HEAD) \
  --broker-base-url http://62.72.3.35:9292
```

## Example Scenarios

### Scenario 1: Successful Deployment

```
✅ Push to main
✅ Consumer tests pass
✅ Contracts published
✅ Provider verification passes
✅ Can-i-deploy check passes
✅ Deploy to production
✅ Deployment recorded
```

### Scenario 2: Blocked Deployment

```
✅ Push to main
✅ Consumer tests pass
✅ Contracts published
❌ Provider verification FAILS (API missing field)
❌ Can-i-deploy check FAILS
🛑 DEPLOYMENT BLOCKED

Fix:
1. Add missing field to API
2. Re-run provider verification
3. Push fix to main
4. Pipeline re-runs
5. ✅ Can-i-deploy passes
6. ✅ Deploy to production
```

### Scenario 3: New Consumer Added

```
New Zapier integration added:
1. Create Zapier consumer contract
2. Publish to Pact Broker
3. Provider verification runs
4. ❌ Can-i-deploy FAILS (new consumer not verified)

Fix:
1. Run provider verification locally
2. Verify API meets Zapier contract
3. Publish verification results
4. ✅ Can-i-deploy passes
5. ✅ Deploy to production
```

## Summary

**Can-I-Deploy deployment safety checks:**

✅ Prevent breaking changes in production
✅ Ensure all consumers are compatible
✅ Block deployments when verification fails
✅ Provide clear error messages and fix guidance
✅ Record deployment history for each environment
✅ Integrate seamlessly with CI/CD pipeline

**Key Points:**
- **Production deployments are BLOCKED** if can-i-deploy fails
- **Dev/Test deployments show warnings** but proceed anyway
- **Deployment recording tracks** what version is running where
- **Fix verification failures immediately** to unblock deployments
- **Never skip can-i-deploy checks** in production

---

**Status:** Can-I-Deploy deployment safety fully implemented ✅
**Date:** 2026-02-15
