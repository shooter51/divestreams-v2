# Bug Fix: 403 Error on public-site.data Request

## Issue
When navigating to `/tenant/settings/public-site`, the browser console showed:
```
public-site.data:1 Failed to load resource: the server responded with a status of 403 ()
Uncaught (in promise) AbortError: BodyStreamBuffer was aborted
```

## Root Cause
The `requireOrgContext` function in `lib/auth/org-context.server.ts` checks if a tenant is deactivated and throws a 403 Response with HTML content. However, when React Router v7 uses **Single Fetch** (indicated by the `.data` suffix in the URL), it expects JSON responses for data requests, not HTML pages.

When React Router receives an HTML response for a data fetch request, it aborts the stream, causing the "BodyStreamBuffer was aborted" error.

## Solution
Modified `lib/auth/org-context.server.ts` (lines 414-430) to:
1. Detect Single Fetch requests by checking for `.data` suffix in the URL or `Accept: application/json` header
2. Return a JSON error response for data fetch requests
3. Continue returning HTML responses for regular page navigations

## Changes Made
- **File:** `lib/auth/org-context.server.ts`
- **Function:** `requireOrgContext()`
- **Change:** Added logic to differentiate between data fetch requests and page requests
- **Test:** Added `tests/unit/lib/auth/org-context-deactivated-tenant.test.ts` with 3 test cases

## Verification
```bash
npm test -- tests/unit/lib/auth/org-context-deactivated-tenant.test.ts --run
# ✓ 3 tests passed

npm run build
# ✓ Build succeeded

npm test -- lib/auth/org-context --run
# ✓ 51 tests passed
```

## References
- [Single Fetch Data Loading | DeepWiki](https://deepwiki.com/vercel/remix/5.1-single-fetch-data-loading)
- [Data Loading | React Router](https://reactrouter.com/start/framework/data-loading)

## Impact
This fix ensures that deactivated tenant checks work correctly with React Router v7's Single Fetch feature, preventing console errors and improving the user experience when accessing public site settings or any other tenant route when the account is deactivated.
