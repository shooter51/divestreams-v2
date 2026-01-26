/**
 * Public Site Pages Management
 *
 * List and manage all editable pages for the public site.
 * Allows creating, editing, publishing, and archiving pages.
 */

import type { LoaderFunctionArgs } from "react-router";
import { Link, useLoaderData } from "react-router";
import { requireOrgContext } from "../../../../lib/auth/org-context.server";
import { listPageContent } from "../../../../lib/db/page-content.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const ctx = await requireOrgContext(request);

  // Get all pages for this organization
  const pages = await listPageContent(ctx.org.id);

  return {
    pages,
    orgSlug: ctx.org.slug,
  };
}

export default function PublicSitePagesPage() {
  const { pages, orgSlug } = useLoaderData<typeof loader>();

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      published: {
        label: "Published",
        className: "bg-success-muted text-success",
      },
      draft: {
        label: "Draft",
        className: "bg-warning-muted text-warning",
      },
      archived: {
        label: "Archived",
        className: "bg-surface-inset text-foreground",
      },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.draft;

    return (
      <span className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${config.className}`}>
        {config.label}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Page Content</h1>
          <p className="text-sm text-foreground-muted mt-1">
            Manage your public site pages and content
          </p>
        </div>
        <Link
          to={`/tenant/${orgSlug}/settings/public-site/pages/new`}
          className="bg-brand text-white px-4 py-2 rounded-lg hover:bg-brand-hover"
        >
          Create New Page
        </Link>
      </div>

      {/* Pages List */}
      {pages.length === 0 ? (
        <div className="bg-surface-raised rounded-xl p-12 text-center shadow-sm">
          <svg
            className="w-16 h-16 mx-auto text-foreground-subtle mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <h3 className="text-lg font-semibold mb-2">No pages yet</h3>
          <p className="text-foreground-muted mb-6">
            Get started by creating your first page
          </p>
          <Link
            to={`/tenant/${orgSlug}/settings/public-site/pages/new`}
            className="inline-block bg-brand text-white px-6 py-2 rounded-lg hover:bg-brand-hover"
          >
            Create Page
          </Link>
        </div>
      ) : (
        <div className="bg-surface-raised rounded-xl shadow-sm overflow-hidden">
          <table className="w-full">
            <thead className="bg-surface-inset border-b">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-foreground-muted uppercase tracking-wider">
                  Page
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-foreground-muted uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-foreground-muted uppercase tracking-wider">
                  Last Updated
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-foreground-muted uppercase tracking-wider">
                  Version
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-foreground-muted uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {pages.map((page) => (
                <tr key={page.id} className="hover:bg-surface-inset">
                  <td className="px-6 py-4">
                    <div>
                      <div className="font-medium text-foreground">
                        {page.pageName}
                      </div>
                      <div className="text-sm text-foreground-muted">/{page.pageId}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4">{getStatusBadge(page.status)}</td>
                  <td className="px-6 py-4 text-sm text-foreground-muted">
                    {new Date(page.updatedAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-sm text-foreground-muted">
                    v{page.version}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <Link
                        to={`/tenant/${orgSlug}/settings/public-site/pages/${page.pageId}/edit`}
                        className="text-brand hover:text-brand text-sm font-medium"
                      >
                        Edit
                      </Link>
                      {page.status === "published" && (
                        <a
                          href={`/${page.pageId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-foreground-muted hover:text-foreground text-sm font-medium"
                        >
                          View
                        </a>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Quick Links */}
      <div className="bg-brand-muted rounded-xl p-6 border border-brand">
        <h3 className="font-semibold mb-3">Tips for Managing Pages</h3>
        <ul className="space-y-2 text-sm text-foreground">
          <li className="flex items-start gap-2">
            <span className="text-brand mt-0.5">•</span>
            <span>
              <strong>Draft</strong> pages are only visible to admins - use this for
              preparing content
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-brand mt-0.5">•</span>
            <span>
              <strong>Publish</strong> pages when ready to make them visible to
              customers
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-brand mt-0.5">•</span>
            <span>
              All changes are version-controlled - you can restore previous versions
              if needed
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-brand mt-0.5">•</span>
            <span>
              Start with the <strong>About</strong> and <strong>Home</strong> pages
              to customize your public site
            </span>
          </li>
        </ul>
      </div>
    </div>
  );
}
