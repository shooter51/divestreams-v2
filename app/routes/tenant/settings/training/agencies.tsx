import type { MetaFunction, LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, useActionData, useNavigation, useFetcher, Link } from "react-router";
import { useState } from "react";
import { requireOrgContext } from "../../../../../lib/auth/org-context.server";
import { requireFeature } from "../../../../../lib/require-feature.server";
import { PLAN_FEATURES } from "../../../../../lib/plan-features";
import {
  getAgencies,
  createAgency,
  updateAgency,
  deleteAgency,
} from "../../../../../lib/db/training.server";
import { CsrfInput } from "../../../../components/CsrfInput";

export const meta: MetaFunction = () => [{ title: "Certification Agencies - DiveStreams" }];

// Common diving certification agencies for quick add
const commonAgencies = [
  { name: "PADI", code: "PADI", description: "Professional Association of Diving Instructors", website: "https://www.padi.com" },
  { name: "SSI", code: "SSI", description: "Scuba Schools International", website: "https://www.divessi.com" },
  { name: "NAUI", code: "NAUI", description: "National Association of Underwater Instructors", website: "https://www.naui.org" },
  { name: "SDI/TDI", code: "SDI", description: "Scuba Diving International / Technical Diving International", website: "https://www.tdisdi.com" },
  { name: "RAID", code: "RAID", description: "Rebreather Association of International Divers", website: "https://www.diveraid.com" },
];

export async function loader({ request }: LoaderFunctionArgs) {
  const ctx = await requireOrgContext(request);
  requireFeature(ctx.subscription?.planDetails?.features ?? {}, PLAN_FEATURES.HAS_TRAINING);
  const agencies = await getAgencies(ctx.org.id);

  return {
    agencies,
    commonAgencies,
  };
}

export async function action({ request }: ActionFunctionArgs) {
  const ctx = await requireOrgContext(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "create") {
    const name = formData.get("name") as string;
    const code = formData.get("code") as string;
    const description = (formData.get("description") as string) || undefined;
    const website = (formData.get("website") as string) || undefined;
    const isActive = formData.get("isActive") === "true";

    if (!name || !code) {
      return { error: "Name and code are required" };
    }

    await createAgency({
      organizationId: ctx.org.id,
      name,
      code,
      description,
      website,
      isActive,
    });

    return { success: true, message: `Agency "${name}" created successfully` };
  }

  if (intent === "update") {
    const agencyId = formData.get("agencyId") as string;
    const name = formData.get("name") as string;
    const code = formData.get("code") as string;
    const description = (formData.get("description") as string) || null;
    const website = (formData.get("website") as string) || null;
    const isActive = formData.get("isActive") === "true";

    if (!agencyId || !name || !code) {
      return { error: "Agency ID, name, and code are required" };
    }

    await updateAgency(ctx.org.id, agencyId, {
      name,
      code,
      description,
      website,
      isActive,
    });

    return { success: true, message: `Agency "${name}" updated successfully` };
  }

  if (intent === "delete") {
    const agencyId = formData.get("agencyId") as string;

    if (!agencyId) {
      return { error: "Agency ID is required" };
    }

    await deleteAgency(ctx.org.id, agencyId);

    return { success: true, message: "Agency deleted successfully" };
  }

  if (intent === "quick-add") {
    const agencyCode = formData.get("agencyCode") as string;
    const commonAgency = commonAgencies.find((a) => a.code === agencyCode);

    if (!commonAgency) {
      return { error: "Invalid agency code" };
    }

    await createAgency({
      organizationId: ctx.org.id,
      name: commonAgency.name,
      code: commonAgency.code,
      description: commonAgency.description,
      website: commonAgency.website,
      isActive: true,
    });

    return { success: true, message: `Agency "${commonAgency.name}" added successfully` };
  }

  return null;
}

export default function AgenciesPage() {
  const { agencies, commonAgencies } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const fetcher = useFetcher();
  const isSubmitting = navigation.state === "submitting";

  const [showForm, setShowForm] = useState(false);
  const [editingAgency, setEditingAgency] = useState<typeof agencies[0] | null>(null);

  // Find which common agencies haven't been added yet
  const existingCodes = agencies.map((a) => a.code.toUpperCase());
  const availableCommonAgencies = commonAgencies.filter(
    (a) => !existingCodes.includes(a.code.toUpperCase())
  );

  const handleEdit = (agency: typeof agencies[0]) => {
    setEditingAgency(agency);
    setShowForm(true);
  };

  const handleCancel = () => {
    setEditingAgency(null);
    setShowForm(false);
  };

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <Link to="/tenant/settings" className="text-brand hover:underline text-sm">
          &larr; Back to Settings
        </Link>
        <h1 className="text-2xl font-bold mt-2">Certification Agencies</h1>
        <p className="text-foreground-muted">
          Manage diving certification agencies (PADI, SSI, NAUI, etc.)
        </p>
      </div>

      {/* Success/Error Messages */}
      {actionData?.success && (
        <div className="bg-success-muted border border-success text-success px-4 py-3 rounded-lg max-w-4xl break-words mb-6">
          {actionData.message}
        </div>
      )}
      {actionData?.error && (
        <div className="bg-danger-muted border border-danger text-danger px-4 py-3 rounded-lg max-w-4xl break-words mb-6">
          {actionData.error}
        </div>
      )}

      {/* Quick Add Common Agencies */}
      {availableCommonAgencies.length > 0 && (
        <div className="bg-brand-muted border border-brand rounded-xl p-4 mb-6">
          <h3 className="font-medium text-brand mb-2">Quick Add Common Agencies</h3>
          <div className="flex flex-wrap gap-2">
            {availableCommonAgencies.map((agency) => (
              <fetcher.Form key={agency.code} method="post" className="inline">
                <input type="hidden" name="intent" value="quick-add" />
                <input type="hidden" name="agencyCode" value={agency.code} />
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-surface-raised border border-brand text-brand rounded-lg text-sm hover:bg-brand-muted transition-colors"
                >
                  + {agency.name}
                </button>
              </fetcher.Form>
            ))}
          </div>
        </div>
      )}

      {/* Add/Edit Form */}
      {showForm && (
        <div className="bg-surface-raised rounded-xl shadow-sm p-6 mb-6">
          <h2 className="font-semibold mb-4">
            {editingAgency ? "Edit Agency" : "Add New Agency"}
          </h2>
          <form method="post" onSubmit={() =>
            handleCancel()}>
            <CsrfInput />
            <input type="hidden" name="intent" value={editingAgency ? "update" : "create"} />
            {editingAgency && (
              <input type="hidden" name="agencyId" value={editingAgency.id} />
            )}

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium mb-1">
                    Agency Name *
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    required
                    defaultValue={editingAgency?.name || ""}
                    placeholder="e.g., PADI"
                    className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
                  />
                </div>
                <div>
                  <label htmlFor="code" className="block text-sm font-medium mb-1">
                    Code *
                  </label>
                  <input
                    type="text"
                    id="code"
                    name="code"
                    required
                    defaultValue={editingAgency?.code || ""}
                    placeholder="e.g., PADI"
                    className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
                  />
                  <p className="text-xs text-foreground-muted mt-1">Short identifier for the agency</p>
                </div>
              </div>

              <div>
                <label htmlFor="description" className="block text-sm font-medium mb-1">
                  Description
                </label>
                <textarea
                  id="description"
                  name="description"
                  rows={2}
                  defaultValue={editingAgency?.description || ""}
                  placeholder="Full name or description of the agency"
                  className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
                />
              </div>

              <div>
                <label htmlFor="website" className="block text-sm font-medium mb-1">
                  Website
                </label>
                <input
                  type="url"
                  id="website"
                  name="website"
                  defaultValue={editingAgency?.website || ""}
                  placeholder="https://www.example.com"
                  className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
                />
              </div>

              <div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="isActive"
                    value="true"
                    defaultChecked={editingAgency?.isActive ?? true}
                    className="rounded"
                  />
                  <span className="text-sm font-medium">Active</span>
                </label>
                <p className="text-xs text-foreground-muted ml-6">
                  Inactive agencies won&apos;t appear in dropdowns
                </p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                type="submit"
                disabled={isSubmitting}
                className="bg-brand text-white px-4 py-2 rounded-lg hover:bg-brand-hover disabled:bg-brand-disabled"
              >
                {isSubmitting ? "Saving..." : editingAgency ? "Update Agency" : "Add Agency"}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="border px-4 py-2 rounded-lg hover:bg-surface-inset"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Add Button */}
      {!showForm && (
        <div className="flex justify-end mb-4">
          <button
            onClick={() => setShowForm(true)}
            className="bg-brand text-white px-4 py-2 rounded-lg hover:bg-brand-hover"
          >
            Add Agency
          </button>
        </div>
      )}

      {/* Agencies List */}
      <div className="bg-surface-raised rounded-xl shadow-sm overflow-hidden">
        {agencies.length === 0 ? (
          <div className="p-8 text-center text-foreground-muted">
            <p className="mb-2">No certification agencies configured yet.</p>
            <p className="text-sm">
              Add agencies like PADI, SSI, or NAUI to organize your courses.
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {agencies.map((agency) => (
              <div key={agency.id} className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div
                    className={`w-12 h-12 rounded-lg flex items-center justify-center font-bold text-sm ${
                      agency.isActive
                        ? "bg-brand-muted text-brand"
                        : "bg-surface-inset text-foreground-muted"
                    }`}
                  >
                    {agency.code.substring(0, 4)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{agency.name}</p>
                      {!agency.isActive && (
                        <span className="text-xs px-2 py-0.5 bg-surface-inset text-foreground-muted rounded">
                          Inactive
                        </span>
                      )}
                    </div>
                    {agency.description && (
                      <p className="text-sm text-foreground-muted">{agency.description}</p>
                    )}
                    {agency.website && (
                      <a
                        href={agency.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-brand hover:underline"
                      >
                        {agency.website}
                      </a>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleEdit(agency)}
                    className="px-3 py-1.5 text-sm text-foreground-muted hover:bg-surface-overlay rounded-lg"
                  >
                    Edit
                  </button>
                  <fetcher.Form
                    method="post"
                    onSubmit={(e) => {
                      if (
                        !confirm(
                          `Are you sure you want to delete "${agency.name}"? This may affect courses using this agency.`
                        )
                      ) {
                        e.preventDefault();
                      }
                    }}
                  >
                    <CsrfInput />
                    <input type="hidden" name="intent" value="delete" />
                    <input type="hidden" name="agencyId" value={agency.id} />
                    <button
                      type="submit"
                      className="px-3 py-1.5 text-sm text-danger hover:bg-danger-muted rounded-lg"
                    >
                      Delete
                    </button>
                  </fetcher.Form>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
