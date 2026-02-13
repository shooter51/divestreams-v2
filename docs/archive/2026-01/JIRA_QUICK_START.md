# Jira Integration Quick Start Guide

## ⚡ 5-Minute Setup

### Step 1: Get Your Jira API Token (2 minutes)

1. Go to https://id.atlassian.com/manage-profile/security/api-tokens
2. Click **"Create API token"**
3. Name it: `DiveStreams E2E Reporter`
4. Click **"Create"**
5. **Copy the token** (you won't see it again!)

### Step 2: Configure Local Environment (1 minute)

Edit your `.env` file (create from `.env.example` if needed):

```bash
# Jira QAlity Integration
JIRA_HOST=https://your-domain.atlassian.net
JIRA_USER_EMAIL=your-email@example.com
JIRA_API_TOKEN=paste-your-token-here
JIRA_PROJECT_KEY=KAN
JIRA_TEST_ISSUE_KEY=KAN-1
```

**Replace:**
- `your-domain` with your Jira workspace name
- `your-email@example.com` with your Jira login email
- `paste-your-token-here` with the API token from Step 1
- `KAN` with your project key (if different)
- `KAN-1` with any existing issue key for testing

### Step 3: Test Connection (1 minute)

```bash
tsx scripts/test-jira-connection.ts
```

**Expected output:**
```
✅ Success! Logged in as: Your Name
✅ Success! Server info retrieved
✅ Success! Found N project(s)
✅ Success! Retrieved issue KAN-1
✅ All tests passed! Your Jira connection is working.
```

If you see errors, check:
- JIRA_HOST includes `https://`
- JIRA_USER_EMAIL is correct
- JIRA_API_TOKEN is valid
- You have access to the Jira instance

### Step 4: Run Test with Jira Reporting (1 minute)

```bash
npm run test:e2e:jira
```

This will:
1. Run all E2E tests
2. Generate JSON results
3. Post results to Jira for tagged tests

### Step 5: Verify in Jira

1. Go to https://your-domain.atlassian.net
2. Open issue **KAN-2** (or whichever test ran)
3. Check the **Comments** section
4. You should see a comment with test results!

---

## 🎯 How to Tag Tests

Add `[JIRA-KEY]` to your test title:

```typescript
test('[KAN-2] Admin can create tenant', async ({ page }) => {
  // Your test code here
});
```

**Multiple issues:**
```typescript
test('[KAN-2] [KAN-10] Complex workflow', async ({ page }) => {
  // Result posted to both issues
});
```

---

## 🚀 CI/CD Setup (GitHub Actions)

### Add GitHub Secrets

1. Go to your repository on GitHub
2. Settings → Secrets and variables → Actions
3. Click **"New repository secret"**
4. Add these 3 secrets:

| Name | Value |
|------|-------|
| `JIRA_HOST` | `https://your-domain.atlassian.net` |
| `JIRA_USER_EMAIL` | `your-email@example.com` |
| `JIRA_API_TOKEN` | Your API token from Step 1 |

### That's it!

The CI/CD pipeline is already configured. On your next push to `main`, `develop`, or `staging`:

1. Tests run automatically
2. Results post to Jira automatically
3. Check your Jira issues for comments!

---

## 🔧 Useful Commands

```bash
# Test Jira connection
tsx scripts/test-jira-connection.ts

# Run E2E with Jira reporting
npm run test:e2e:jira

# Run reporter only (after tests)
tsx scripts/jira-test-reporter.ts

# See what would be posted (dry run)
tsx scripts/jira-test-reporter.ts --dry-run --verbose

# Custom results file
tsx scripts/jira-test-reporter.ts --results-file path/to/results.json
```

---

## 📊 Current Tagged Tests

3 pilot tests are already tagged:

| Test | Jira Key | File |
|------|----------|------|
| Create tenant via signup | [KAN-2] | `tests/e2e/workflow/full-workflow.spec.ts` |
| Tenant dashboard navigation | [KAN-10] | `tests/e2e/workflow/full-workflow.spec.ts` |
| Create new customer | [KAN-11] | `tests/e2e/workflow/full-workflow.spec.ts` |

---

## ❓ Troubleshooting

### ❌ 401 Unauthorized

**Problem:** Can't authenticate with Jira

**Solution:**
1. Verify `JIRA_USER_EMAIL` matches your Jira account
2. Regenerate API token
3. Check token isn't expired
4. Run: `tsx scripts/test-jira-connection.ts`

### ❌ 404 Not Found

**Problem:** Jira issue doesn't exist

**Solution:**
1. Verify issue key exists in Jira (e.g., KAN-2)
2. Check you have access to the project
3. Ensure issue isn't deleted

### ℹ️ No tests reported

**Problem:** Reporter says "No tests with Jira issue tags found"

**Solution:**
1. Verify test titles have `[KAN-X]` format (with brackets)
2. Run tests to generate `test-results/results.json`
3. Check JSON file contains test results

### 🔒 Permission denied

**Problem:** Can't post comments to issues

**Solution:**
1. Verify you have "Add Comments" permission
2. Check issue isn't locked/resolved
3. Contact Jira admin to grant permissions

---

## 📚 Full Documentation

- **[TESTING_GUIDE.md](./TESTING_GUIDE.md)** - Complete testing guide
- **[test-jira-mapping.md](./test-jira-mapping.md)** - Test mapping documentation
- **[JIRA_INTEGRATION_SUMMARY.md](./JIRA_INTEGRATION_SUMMARY.md)** - Implementation details

---

## 🎉 You're Ready!

The integration is set up and ready to use. Start tagging your tests with Jira issue keys and watch the results appear automatically in Jira!

**Next Steps:**
1. ✅ Complete 5-minute setup above
2. ✅ Tag a few more tests with Jira keys
3. ✅ Run `npm run test:e2e:jira`
4. ✅ Check results in Jira
5. 🚀 Gradually tag all 80 E2E tests

---

**Questions?** Check the troubleshooting section above or the full documentation.
