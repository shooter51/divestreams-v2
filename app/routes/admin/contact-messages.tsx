/**
 * Admin Contact Messages Page (Platform Admin)
 *
 * View and manage contact form submissions across all organizations.
 * This is for the platform admin panel, not tenant admin.
 */

import { useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { db } from "../../../lib/db";
import { contactMessages } from "../../../lib/db/schema/public-site";
import { organization } from "../../../lib/db/schema/auth";
import { desc, eq } from "drizzle-orm";
import { requirePlatformContext } from "../../../lib/auth/platform-context.server";

// ============================================================================
// TYPES
// ============================================================================

interface LoaderData {
  messages: Array<{
    id: string;
    organizationId: string;
    organizationName: string | null;
    name: string;
    email: string;
    phone: string | null;
    subject: string | null;
    message: string;
    status: string;
    createdAt: Date;
    referrerPage: string | null;
  }>;
  stats: {
    total: number;
    new: number;
    read: number;
    replied: number;
  };
}

// ============================================================================
// LOADER
// ============================================================================

export async function loader({ request }: LoaderFunctionArgs) {
  // Require platform admin access
  await requirePlatformContext(request);

  // Get all contact messages across all organizations with organization names
  const allMessages = await db
    .select({
      id: contactMessages.id,
      organizationId: contactMessages.organizationId,
      organizationName: organization.name,
      name: contactMessages.name,
      email: contactMessages.email,
      phone: contactMessages.phone,
      subject: contactMessages.subject,
      message: contactMessages.message,
      status: contactMessages.status,
      createdAt: contactMessages.createdAt,
      referrerPage: contactMessages.referrerPage,
    })
    .from(contactMessages)
    .leftJoin(organization, eq(contactMessages.organizationId, organization.id))
    .orderBy(desc(contactMessages.createdAt))
    .limit(100);

  // Calculate stats
  const stats = {
    total: allMessages.length,
    new: allMessages.filter((m: any) => m.status === "new").length,
    read: allMessages.filter((m: any) => m.status === "read").length,
    replied: allMessages.filter((m: any) => m.status === "replied").length,
  };

  return {
    messages: allMessages,
    stats,
  } satisfies LoaderData;
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function AdminContactMessagesPage() {
  const { messages, stats } = useLoaderData<typeof loader>();

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "new":
        return "bg-brand-muted text-brand";
      case "read":
        return "bg-surface-inset text-foreground";
      case "replied":
        return "bg-success-muted text-success";
      case "archived":
        return "bg-warning-muted text-warning";
      case "spam":
        return "bg-danger-muted text-danger";
      default:
        return "bg-surface-inset text-foreground";
    }
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground">Contact Messages</h1>
        <p className="mt-2 text-foreground-muted">
          Messages submitted through your public website contact form
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-surface-raised rounded-lg shadow p-5">
          <div className="text-sm font-medium text-foreground-muted">Total</div>
          <div className="mt-1 text-3xl font-semibold text-foreground">
            {stats.total}
          </div>
        </div>
        <div className="bg-surface-raised rounded-lg shadow p-5">
          <div className="text-sm font-medium text-foreground-muted">New</div>
          <div className="mt-1 text-3xl font-semibold text-brand">
            {stats.new}
          </div>
        </div>
        <div className="bg-surface-raised rounded-lg shadow p-5">
          <div className="text-sm font-medium text-foreground-muted">Read</div>
          <div className="mt-1 text-3xl font-semibold text-foreground-muted">
            {stats.read}
          </div>
        </div>
        <div className="bg-surface-raised rounded-lg shadow p-5">
          <div className="text-sm font-medium text-foreground-muted">Replied</div>
          <div className="mt-1 text-3xl font-semibold text-success">
            {stats.replied}
          </div>
        </div>
      </div>

      {/* Messages List */}
      <div className="bg-surface-raised shadow rounded-lg overflow-hidden">
        {messages.length === 0 ? (
          <div className="text-center py-12">
            <svg
              className="mx-auto h-12 w-12 text-foreground-subtle"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-foreground">
              No messages yet
            </h3>
            <p className="mt-1 text-sm text-foreground-muted">
              Contact form submissions will appear here.
            </p>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-surface-inset">
              <tr>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-foreground-muted uppercase tracking-wider"
                >
                  From
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-foreground-muted uppercase tracking-wider"
                >
                  Message
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-foreground-muted uppercase tracking-wider"
                >
                  Status
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-foreground-muted uppercase tracking-wider"
                >
                  Date
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-right text-xs font-medium text-foreground-muted uppercase tracking-wider"
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-surface-raised divide-y divide-border">
              {messages.map((msg: any) => (
                <tr
                  key={msg.id}
                  className={msg.status === "new" ? "bg-brand-muted" : ""}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex flex-col">
                      <div className="text-sm font-medium text-foreground">
                        {msg.name}
                      </div>
                      <div className="text-sm text-foreground-muted">
                        <a
                          href={`mailto:${msg.email}`}
                          className="hover:text-brand"
                        >
                          {msg.email}
                        </a>
                      </div>
                      {msg.phone && (
                        <div className="text-sm text-foreground-muted">
                          <a
                            href={`tel:${msg.phone}`}
                            className="hover:text-brand"
                          >
                            {msg.phone}
                          </a>
                        </div>
                      )}
                      <div className="text-xs text-foreground-subtle mt-1">
                        {msg.organizationName}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-foreground">
                      {msg.subject && (
                        <div className="font-medium mb-1">{msg.subject}</div>
                      )}
                      <div className="line-clamp-2 text-foreground-muted">
                        {msg.message}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadgeColor(
                        msg.status
                      )}`}
                    >
                      {msg.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground-muted">
                    {formatDate(msg.createdAt)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <a
                      href={`mailto:${msg.email}?subject=Re: ${msg.subject || "Your message"}`}
                      className="text-brand hover:text-brand"
                    >
                      Reply
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Help Text */}
      <div className="mt-6 bg-brand-muted border border-brand rounded-lg p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg
              className="h-5 w-5 text-brand"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-brand">
              About Contact Messages
            </h3>
            <div className="mt-2 text-sm text-brand">
              <p>
                Messages are automatically saved when customers submit the contact
                form on your public website. Email notifications are sent to your
                contact email address, and customers receive an auto-reply
                confirmation.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
