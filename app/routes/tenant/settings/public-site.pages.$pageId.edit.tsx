/**
 * Page Content Editor
 *
 * Edit page content with rich text editor and block-based content.
 * Supports publishing, version history, and SEO metadata.
 */

import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";
import { Form, useLoaderData, useNavigation, useActionData } from "react-router";
import { useState } from "react";
import { requireOrgContext } from "../../../../lib/auth/org-context.server";
import {
  getPageContent,
  updatePageContent,
  publishPageContent,
  unpublishPageContent,
  getPageContentHistory,
  restorePageContentVersion,
} from "../../../../lib/db/page-content.server";
import type { PageContent, ContentBlock } from "../../../../lib/db/schema/page-content";

export async function loader({ request, params }: LoaderFunctionArgs) {
  const ctx = await requireOrgContext(request);
  const { pageId } = params;

  if (!pageId) {
    throw new Response("Page ID is required", { status: 400 });
  }

  const page = await getPageContent(ctx.org.id, pageId);

  if (!page) {
    throw new Response("Page not found", { status: 404 });
  }

  const history = await getPageContentHistory(ctx.org.id, pageId);

  return {
    page,
    history,
    orgSlug: ctx.org.slug,
    userId: ctx.user.id,
  };
}

export async function action({ request, params }: ActionFunctionArgs) {
  const ctx = await requireOrgContext(request);
  const { pageId } = params;

  if (!pageId) {
    throw new Response("Page ID is required", { status: 400 });
  }

  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "save") {
    // Parse content blocks from form data
    const blocksJson = formData.get("contentBlocks");
    const content: PageContent = blocksJson
      ? JSON.parse(blocksJson as string)
      : { blocks: [] };

    const metaTitle = (formData.get("metaTitle") as string) || undefined;
    const metaDescription = (formData.get("metaDescription") as string) || undefined;
    const changeDescription = (formData.get("changeDescription") as string) || undefined;

    await updatePageContent(ctx.org.id, pageId, {
      content,
      metaTitle,
      metaDescription,
      changeDescription,
      userId: ctx.user.id,
    });

    return { success: true, message: "Page saved successfully" };
  }

  if (intent === "publish") {
    await publishPageContent(ctx.org.id, pageId, ctx.user.id);
    return { success: true, message: "Page published successfully" };
  }

  if (intent === "unpublish") {
    await unpublishPageContent(ctx.org.id, pageId, ctx.user.id);
    return { success: true, message: "Page unpublished successfully" };
  }

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

  return null;
}

export default function PageEditPage() {
  const { page, history, orgSlug } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const actionData = useActionData<typeof action>();
  const isSubmitting = navigation.state === "submitting";

  // Simple editor for now - just allow editing blocks as JSON
  // In the future, this can be enhanced with a visual block editor
  const [contentBlocks, setContentBlocks] = useState(
    JSON.stringify(page.content, null, 2)
  );

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Restore Feedback */}
      {navigation.state === "idle" && actionData?.message && (
        <div
          className={`p-4 rounded-lg ${
            actionData.success
              ? "bg-green-50 border border-green-200 text-green-800"
              : "bg-red-50 border border-red-200 text-red-800"
          }`}
        >
          {actionData.message || actionData.error}
        </div>
      )}
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">{page.pageName}</h1>
          <p className="text-sm text-gray-600 mt-1">
            /{page.pageId} • Version {page.version} •{" "}
            <span className="capitalize">{page.status}</span>
          </p>
        </div>
        <a
          href={`/tenant/${orgSlug}/settings/public-site/pages`}
          className="text-gray-600 hover:text-gray-900"
        >
          ← Back to Pages
        </a>
      </div>

      {/* Editor Form */}
      <Form method="post" className="space-y-6">
        <input type="hidden" name="intent" value="save" />
        <input type="hidden" name="contentBlocks" value={contentBlocks} />

        {/* SEO Metadata */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">SEO Metadata</h2>
          <div className="space-y-4">
            <div>
              <label htmlFor="metaTitle" className="block text-sm font-medium mb-1">
                Meta Title
              </label>
              <input
                type="text"
                id="metaTitle"
                name="metaTitle"
                defaultValue={page.metaTitle || ""}
                placeholder="Page title for search engines"
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Recommended: 50-60 characters
              </p>
            </div>

            <div>
              <label
                htmlFor="metaDescription"
                className="block text-sm font-medium mb-1"
              >
                Meta Description
              </label>
              <textarea
                id="metaDescription"
                name="metaDescription"
                rows={3}
                defaultValue={page.metaDescription || ""}
                placeholder="Brief description for search engines"
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 resize-y"
              />
              <p className="text-xs text-gray-500 mt-1">
                Recommended: 150-160 characters
              </p>
            </div>
          </div>
        </div>

        {/* Content Editor */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">Page Content</h2>
          <p className="text-sm text-gray-600 mb-4">
            Edit the page content as JSON. A visual block editor will be added in a
            future update.
          </p>

          <div>
            <label htmlFor="content" className="block text-sm font-medium mb-2">
              Content Blocks (JSON)
            </label>
            <textarea
              id="content"
              value={contentBlocks}
              onChange={(e) => setContentBlocks(e.target.value)}
              rows={20}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-sm resize-y"
              spellCheck={false}
            />
            <p className="text-xs text-gray-500 mt-2">
              Format:{" "}
              <code className="bg-gray-100 px-1 py-0.5 rounded">
                {`{ "blocks": [...] }`}
              </code>
            </p>
          </div>
        </div>

        {/* Change Description */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <label htmlFor="changeDescription" className="block text-sm font-medium mb-2">
            Change Description (Optional)
          </label>
          <input
            type="text"
            id="changeDescription"
            name="changeDescription"
            placeholder="Describe what you changed..."
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Actions */}
        <div className="flex justify-between items-center bg-white rounded-xl p-6 shadow-sm">
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:bg-blue-400"
            >
              {isSubmitting ? "Saving..." : "Save Draft"}
            </button>

            {page.status !== "published" && (
              <button
                type="submit"
                name="intent"
                value="publish"
                disabled={isSubmitting}
                className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 disabled:bg-green-400"
              >
                Publish
              </button>
            )}

            {page.status === "published" && (
              <button
                type="submit"
                name="intent"
                value="unpublish"
                disabled={isSubmitting}
                className="bg-yellow-600 text-white px-6 py-2 rounded-lg hover:bg-yellow-700 disabled:bg-yellow-400"
              >
                Unpublish
              </button>
            )}
          </div>

          {page.status === "published" && (
            <a
              href={`/site/${page.pageId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 font-medium"
            >
              Preview Live Page →
            </a>
          )}
        </div>
      </Form>

      {/* Version History */}
      {history.length > 0 && (
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">Version History</h2>
          <div className="space-y-3">
            {history.slice(0, 5).map((entry: any) => (
              <div
                key={entry.id}
                className="flex justify-between items-center p-3 bg-gray-50 rounded-lg"
              >
                <div>
                  <div className="font-medium">Version {entry.version}</div>
                  <div className="text-sm text-gray-600">
                    {entry.changeDescription || "No description"}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {new Date(entry.createdAt).toLocaleString()}
                  </div>
                </div>
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
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Help */}
      <div className="bg-blue-50 rounded-xl p-6 border border-blue-200">
        <h3 className="font-semibold mb-3">Content Block Types</h3>
        <div className="space-y-2 text-sm text-gray-700">
          <p>
            <code className="bg-white px-2 py-0.5 rounded">heading</code> - Text
            heading with level (1-6)
          </p>
          <p>
            <code className="bg-white px-2 py-0.5 rounded">paragraph</code> - Rich
            text paragraph
          </p>
          <p>
            <code className="bg-white px-2 py-0.5 rounded">image</code> - Single image
            with caption
          </p>
          <p>
            <code className="bg-white px-2 py-0.5 rounded">values-grid</code> - Grid
            of values/features
          </p>
          <p>
            <code className="bg-white px-2 py-0.5 rounded">team-section</code> - Team
            members display
          </p>
          <p className="mt-3 text-xs">
            See schema definition in{" "}
            <code className="bg-white px-2 py-0.5 rounded">
              lib/db/schema/page-content.ts
            </code>{" "}
            for full documentation
          </p>
        </div>
      </div>
    </div>
  );
}
