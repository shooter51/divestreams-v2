# DIVE-031: Remove API Keys and Webhooks - Removal Plan

## Summary
Remove deprecated API keys and webhooks functionality while preserving:
- Stripe webhooks (different feature - for payment processing)
- OAuth integration callbacks (Xero, Google, QuickBooks, Mailchimp)
- Zapier integration (uses its own webhook mechanism)

## Database Changes

### Migration File Created
- `/drizzle/0009_remove_api_keys_webhooks.sql` - Drops 3 tables:
  - `webhook_deliveries`
  - `webhooks`
  - `api_keys`

## Files to DELETE

### Schema Files
- `/lib/db/schema/api-keys.ts` - API keys table schema
- `/lib/db/schema/webhooks.ts` - Webhooks table schema

### Library Files
- `/lib/api-keys/index.server.ts` - API key CRUD operations
- `/lib/api-keys/middleware.server.ts` - API key authentication middleware
- `/lib/webhooks/index.server.ts` - Webhook CRUD operations
- `/lib/webhooks/deliver.server.ts` - Webhook delivery service

### Test Files
- `/tests/unit/lib/api-keys/api-keys.test.ts`
- `/tests/unit/lib/api-keys/index.test.ts`
- `/tests/unit/lib/api-keys/middleware.test.ts`
- `/tests/unit/lib/db/schema/api-keys.test.ts`
- `/tests/unit/lib/webhooks/webhooks.test.ts`
- `/tests/unit/lib/webhooks/index.test.ts`
- `/tests/unit/lib/webhooks/deliver.test.ts`
- `/tests/unit/lib/db/schema/webhooks.test.ts`

## Files to MODIFY

### Schema Export
- `/lib/db/schema.ts` - ✅ DONE
  - Commented out exports for api-keys and webhooks

### Settings Page
- `/app/routes/tenant/settings/integrations.tsx` - NEEDS WORK
  - Remove imports for api-keys and webhooks
  - Remove API key action handlers (lines ~374-412)
  - Remove webhook action handlers (lines ~803-920)
  - Remove API keys UI section (lines ~1451-1515)
  - Remove webhooks UI section (lines ~1516-1650)
  - Remove from loader return data
  - Remove from component props

### Integration Tests
- `/tests/integration/routes/tenant/settings/integrations.test.ts`
  - Remove API key and webhook test cases

## Files to PRESERVE (NOT webhooks - different feature)

### Stripe Webhooks (Payment Processing)
- `/app/routes/api/stripe-webhook.tsx` - KEEP (Stripe payments)
- `/lib/stripe/webhook.server.ts` - KEEP (Stripe payments)
- `/tests/integration/routes/api/stripe-webhook.test.ts` - KEEP
- `/tests/unit/lib/stripe/webhook.test.ts` - KEEP

### OAuth Callbacks (NOT deprecated)
- `/app/routes/api/integrations/xero/callback.tsx` - KEEP
- `/app/routes/api/integrations/google/callback.tsx` - KEEP
- `/app/routes/api/integrations/mailchimp/callback.tsx` - KEEP
- `/app/routes/api/integrations/quickbooks/callback.tsx` - KEEP

### Other API Routes
- `/app/routes/api/health.tsx` - KEEP (health check)
- `/app/routes/api/auth.$.tsx` - KEEP (authentication)
- `/app/routes/api/debug-orgs.tsx` - KEEP (debugging)

## Execution Order

1. ✅ Create migration file
2. ✅ Update schema.ts exports
3. Remove library files (api-keys/*, webhooks/*)
4. Update integrations.tsx (remove UI and handlers)
5. Remove test files
6. Run migration
7. Test application
8. Commit changes

## Verification Steps

1. Application starts without errors
2. Settings > Integrations page loads
3. No references to API keys or webhooks in UI
4. Stripe webhooks still work
5. OAuth integrations still work
6. All tests pass

## Git Commit Message

```
Remove deprecated API access and webhooks (DIVE-031)

- Drop api_keys, webhooks, and webhook_deliveries tables
- Remove /lib/api-keys and /lib/webhooks directories
- Update settings/integrations page to remove API keys and webhooks UI
- Remove related test files
- Preserve Stripe webhooks (payment processing)
- Preserve OAuth integration callbacks

The API keys and webhooks features were deprecated in favor of
direct OAuth integrations (Zapier, etc.) and Stripe's webhook system.
```

## Rollback Plan

If needed, restore from backup:
```bash
git revert <commit-hash>
# OR restore from pre-removal state
git checkout <previous-commit> -- lib/api-keys lib/webhooks
```
