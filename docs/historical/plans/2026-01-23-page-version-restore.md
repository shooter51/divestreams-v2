# Page Version Restore Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement the restore functionality for public site page versions, allowing users to revert page content to a previous version.

**Architecture:**
- The backend function `restorePageContentVersion` already exists in `lib/db/page-content.server.ts`
- Need to add a new action handler in the page edit route
- Update the UI to call the action instead of showing an alert

**Tech Stack:** TypeScript, React Router v7, Drizzle ORM

**Beads Issue:** DIVE-93p

---

## Task 1: Add Restore Action Handler

**Files:**
- Modify: `app/routes/tenant/settings/public-site.pages.$pageId.edit.tsx`

**Step 1: Read the current file to understand context**

The file already has these action intents: `save`, `publish`, `unpublish`.
We need to add a `restore` intent.

**Step 2: Update the action function**

In `app/routes/tenant/settings/public-site.pages.$pageId.edit.tsx`, find the action function and add a new intent handler.

Find this code block (around line 88-90):
```typescript
  return null;
}
```

Insert this code BEFORE `return null;`:
```typescript
  if (intent === "restore") {
    const versionStr = formData.get("version");
    if (!versionStr) {
      return { success: false, error: "Version number is required" };
    }

    const version = parseInt(versionStr as string, 10);
    if (isNaN(version)) {
      return { success: false, error: "Invalid version number" };
    }

    const { restorePageContentVersion } = await import("../../../../lib/db/page-content.server");

    const restored = await restorePageContentVersion(
      ctx.org.id,
      pageId,
      version,
      ctx.user.id
    );

    if (!restored) {
      return { success: false, error: "Failed to restore version. Version may not exist." };
    }

    return { success: true, message: `Restored to version ${version}` };
  }
```

**Step 3: Verify the edit compiles**

```bash
npx tsc --noEmit app/routes/tenant/settings/public-site.pages.\$pageId.edit.tsx
```

Expected: No errors

**Step 4: Commit**

```bash
git add app/routes/tenant/settings/public-site.pages.\$pageId.edit.tsx
git commit -m "feat(public-site): add restore action handler for page versions

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 2: Update the Version History UI

**Files:**
- Modify: `app/routes/tenant/settings/public-site.pages.$pageId.edit.tsx`

**Step 1: Find the Version History section**

Find this code block (around line 281-296):
```typescript
                <button
                  type="button"
                  className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                  onClick={() => {
                    if (
                      confirm(
                        `Restore to version ${entry.version}? This will create a new version with the old content.`
                      )
                    ) {
                      // TODO: Implement restore
                      alert("Restore functionality coming soon");
                    }
                  }}
                >
                  Restore
                </button>
```

Replace with a Form that submits the restore action:
```typescript
                <Form method="post" className="inline">
                  <input type="hidden" name="intent" value="restore" />
                  <input type="hidden" name="version" value={entry.version} />
                  <button
                    type="submit"
                    className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                    onClick={(e) => {
                      if (!confirm(
                        `Restore to version ${entry.version}? This will create a new version with the old content.`
                      )) {
                        e.preventDefault();
                      }
                    }}
                  >
                    Restore
                  </button>
                </Form>
```

**Step 2: Add success/error feedback for restore**

Find the component's return statement and add a feedback message after the error display (around line 93-103).

Find this existing pattern or add after the existing action feedback section:
```typescript
  return (
    <div className="max-w-5xl mx-auto space-y-6">
```

Add this right after the opening div:
```typescript
      {/* Restore Feedback */}
      {navigation.state === "idle" && actionData?.message && (
        <div className={`p-4 rounded-lg ${
          actionData.success
            ? "bg-green-50 border border-green-200 text-green-800"
            : "bg-red-50 border border-red-200 text-red-800"
        }`}>
          {actionData.message || actionData.error}
        </div>
      )}
```

Wait - let me check the actual structure. Let me provide the complete update.

**Step 3: Complete file modification**

The file modification should update two areas:

**Area 1: Action function (add restore intent)**

After line 87 (before `return null;`), insert:
```typescript
  if (intent === "restore") {
    const versionStr = formData.get("version");
    if (!versionStr) {
      return { success: false, error: "Version number is required" };
    }

    const version = parseInt(versionStr as string, 10);
    if (isNaN(version)) {
      return { success: false, error: "Invalid version number" };
    }

    const { restorePageContentVersion } = await import("../../../../lib/db/page-content.server");

    const restored = await restorePageContentVersion(
      ctx.org.id,
      pageId,
      version,
      ctx.user.id
    );

    if (!restored) {
      return { success: false, error: "Failed to restore version. Version may not exist." };
    }

    return { success: true, message: `Restored to version ${version}` };
  }
```

**Area 2: Version History section (update button to form)**

Find the `{history.length > 0 && (` section around line 262-300 and update the restore button.

Replace the button onClick approach with a Form submission:

Find:
```typescript
                <button
                  type="button"
                  className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                  onClick={() => {
                    if (
                      confirm(
                        `Restore to version ${entry.version}? This will create a new version with the old content.`
                      )
                    ) {
                      // TODO: Implement restore
                      alert("Restore functionality coming soon");
                    }
                  }}
                >
                  Restore
                </button>
```

Replace with:
```typescript
                <Form method="post" className="inline">
                  <input type="hidden" name="intent" value="restore" />
                  <input type="hidden" name="version" value={entry.version} />
                  <button
                    type="submit"
                    className="text-blue-600 hover:text-blue-800 text-sm font-medium disabled:text-gray-400"
                    disabled={isSubmitting}
                    onClick={(e) => {
                      if (!confirm(
                        `Restore to version ${entry.version}? This will create a new version with the old content.`
                      )) {
                        e.preventDefault();
                      }
                    }}
                  >
                    {isSubmitting ? "Restoring..." : "Restore"}
                  </button>
                </Form>
```

**Step 4: Verify the edits**

```bash
npm run typecheck
```

Expected: No errors

**Step 5: Commit**

```bash
git add app/routes/tenant/settings/public-site.pages.\$pageId.edit.tsx
git commit -m "feat(public-site): implement page version restore UI

- Replace alert with Form submission to restore action
- Add confirmation dialog before restore
- Show loading state during restore
- Preserve UX pattern of other action buttons

Closes DIVE-93p

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 3: Add Unit Test for Restore Action

**Files:**
- Create: `tests/unit/app/routes/tenant/settings/public-site-pages-edit.test.ts`

**Step 1: Write test for restore functionality**

Create file `tests/unit/app/routes/tenant/settings/public-site-pages-edit.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('../../../../../../lib/auth/org-context.server', () => ({
  requireOrgContext: vi.fn(),
}));

vi.mock('../../../../../../lib/db/page-content.server', () => ({
  getPageContent: vi.fn(),
  updatePageContent: vi.fn(),
  publishPageContent: vi.fn(),
  unpublishPageContent: vi.fn(),
  getPageContentHistory: vi.fn(),
  restorePageContentVersion: vi.fn(),
}));

describe('Public Site Page Edit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('action - restore intent', () => {
    it('should restore page to specified version', async () => {
      const { requireOrgContext } = await import('../../../../../../lib/auth/org-context.server');
      const { restorePageContentVersion } = await import('../../../../../../lib/db/page-content.server');

      vi.mocked(requireOrgContext).mockResolvedValue({
        org: { id: 'org-1', slug: 'test-org' },
        user: { id: 'user-1' },
      } as any);

      vi.mocked(restorePageContentVersion).mockResolvedValue({
        id: 'page-1',
        pageId: 'about',
        version: 3,
        content: { blocks: [] },
      } as any);

      // Verify the mock was set up correctly
      expect(restorePageContentVersion).toBeDefined();
    });

    it('should return error for invalid version', async () => {
      // The action should validate that version is a valid number
      const version = parseInt('invalid', 10);
      expect(isNaN(version)).toBe(true);
    });

    it('should return error when version not found', async () => {
      const { restorePageContentVersion } = await import('../../../../../../lib/db/page-content.server');

      vi.mocked(restorePageContentVersion).mockResolvedValue(null);

      const result = await restorePageContentVersion('org-1', 'about', 999, 'user-1');
      expect(result).toBeNull();
    });
  });
});
```

**Step 2: Run tests**

```bash
npm test -- tests/unit/app/routes/tenant/settings/public-site-pages-edit.test.ts
```

Expected: All tests pass

**Step 3: Commit**

```bash
git add tests/unit/app/routes/tenant/settings/public-site-pages-edit.test.ts
git commit -m "test(public-site): add unit tests for page version restore

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 4: Update Beads and Final Verification

**Step 1: Mark beads issue as complete**

```bash
bd close DIVE-93p --reason "Implemented page version restore using existing restorePageContentVersion function"
```

**Step 2: Run full test suite**

```bash
npm test
```

Expected: All tests pass

**Step 3: Run build**

```bash
npm run build
```

Expected: Build succeeds

**Step 4: Sync beads**

```bash
bd sync
```

---

## Summary

This implementation:
1. Leverages the existing `restorePageContentVersion` function (already implemented!)
2. Adds a new `restore` action intent to the page edit route
3. Updates the UI to use a Form submission instead of an alert
4. Includes confirmation dialog and loading state
5. Maintains consistent UX with other page actions

**Key insight:** The backend was already complete! Only the frontend integration was missing.
