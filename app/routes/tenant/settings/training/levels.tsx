import type { MetaFunction, LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, useActionData, useNavigation, useFetcher, Link } from "react-router";
import { useState } from "react";
import { requireOrgContext } from "../../../../../lib/auth/org-context.server";
import { requireFeature } from "../../../../../lib/require-feature.server";
import { PLAN_FEATURES } from "../../../../../lib/plan-features";
import {
  getLevels,
  getAgencies,
  createLevel,
  updateLevel,
  deleteLevel,
} from "../../../../../lib/db/training.server";

export const meta: MetaFunction = () => [{ title: "Certification Levels - DiveStreams" }];

// Common certification levels for reference
const commonLevels = [
  { name: "Open Water Diver", code: "OW", levelNumber: 1, minAge: 10, minDives: 4 },
  { name: "Advanced Open Water Diver", code: "AOW", levelNumber: 2, minAge: 12, minDives: 9 },
  { name: "Rescue Diver", code: "RESCUE", levelNumber: 3, minAge: 12, minDives: 20 },
  { name: "Divemaster", code: "DM", levelNumber: 4, minAge: 18, minDives: 40 },
  { name: "Instructor", code: "INST", levelNumber: 5, minAge: 18, minDives: 100 },
];

export async function loader({ request }: LoaderFunctionArgs) {
  const ctx = await requireOrgContext(request);
  requireFeature(ctx.subscription?.planDetails?.features ?? {}, PLAN_FEATURES.HAS_TRAINING);
  const [levels, agencies] = await Promise.all([
    getLevels(ctx.org.id),
    getAgencies(ctx.org.id),
  ]);

  return {
    levels,
    agencies,
    commonLevels,
  };
}

export async function action({ request }: ActionFunctionArgs) {
  const ctx = await requireOrgContext(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "create") {
    const name = formData.get("name") as string;
    const code = formData.get("code") as string;
    const levelNumber = parseInt(formData.get("levelNumber") as string) || 0;
    const agencyId = (formData.get("agencyId") as string) || undefined;
    const description = (formData.get("description") as string) || undefined;
    const prerequisites = (formData.get("prerequisites") as string) || undefined;
    const minAge = formData.get("minAge") ? parseInt(formData.get("minAge") as string) : undefined;
    const minDives = formData.get("minDives") ? parseInt(formData.get("minDives") as string) : undefined;
    const isActive = formData.get("isActive") === "true";

    if (!name || !code) {
      return { error: "Name and code are required" };
    }

    await createLevel({
      organizationId: ctx.org.id,
      name,
      code,
      levelNumber,
      agencyId: agencyId || undefined,
      description,
      prerequisites,
      minAge,
      minDives,
      isActive,
    });

    return { success: true, message: `Level "${name}" created successfully` };
  }

  if (intent === "update") {
    const levelId = formData.get("levelId") as string;
    const name = formData.get("name") as string;
    const code = formData.get("code") as string;
    const levelNumber = parseInt(formData.get("levelNumber") as string) || 0;
    const agencyId = (formData.get("agencyId") as string) || null;
    const description = (formData.get("description") as string) || null;
    const prerequisites = (formData.get("prerequisites") as string) || null;
    const minAge = formData.get("minAge") ? parseInt(formData.get("minAge") as string) : null;
    const minDives = formData.get("minDives") ? parseInt(formData.get("minDives") as string) : null;
    const isActive = formData.get("isActive") === "true";

    if (!levelId || !name || !code) {
      return { error: "Level ID, name, and code are required" };
    }

    await updateLevel(ctx.org.id, levelId, {
      name,
      code,
      levelNumber,
      agencyId,
      description,
      prerequisites,
      minAge,
      minDives,
      isActive,
    });

    return { success: true, message: `Level "${name}" updated successfully` };
  }

  if (intent === "delete") {
    const levelId = formData.get("levelId") as string;

    if (!levelId) {
      return { error: "Level ID is required" };
    }

    await deleteLevel(ctx.org.id, levelId);

    return { success: true, message: "Level deleted successfully" };
  }

  return null;
}

export default function LevelsPage() {
  const { levels, agencies, commonLevels } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const fetcher = useFetcher();
  const isSubmitting = navigation.state === "submitting";

  const [showForm, setShowForm] = useState(false);
  const [editingLevel, setEditingLevel] = useState<typeof levels[0] | null>(null);
  const [filterAgencyId, setFilterAgencyId] = useState<string>("");

  // Group levels by agency for display
  const filteredLevels = filterAgencyId
    ? levels.filter((l) => l.agencyId === filterAgencyId)
    : levels;

  const handleEdit = (level: typeof levels[0]) => {
    setEditingLevel(level);
    setShowForm(true);
  };

  const handleCancel = () => {
    setEditingLevel(null);
    setShowForm(false);
  };

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <Link to="/tenant/settings" className="text-brand hover:underline text-sm">
          &larr; Back to Settings
        </Link>
        <h1 className="text-2xl font-bold mt-2">Certification Levels</h1>
        <p className="text-foreground-muted">
          Manage certification levels (Open Water, Advanced, Rescue, Divemaster, etc.)
        </p>
      </div>

      {/* Success/Error Messages */}
      {actionData?.success && (
        <div className="bg-success-muted border border-success text-success px-4 py-3 rounded-lg mb-6">
          {actionData.message}
        </div>
      )}
      {actionData?.error && (
        <div className="bg-danger-muted border border-danger text-danger px-4 py-3 rounded-lg mb-6">
          {actionData.error}
        </div>
      )}

      {/* No Agencies Warning */}
      {agencies.length === 0 && (
        <div className="bg-warning-muted border border-warning text-warning px-4 py-3 rounded-lg mb-6">
          <p className="font-medium">No certification agencies configured</p>
          <p className="text-sm">
            <Link to="/tenant/settings/training/agencies" className="underline">
              Add certification agencies
            </Link>{" "}
            first to associate levels with them.
          </p>
        </div>
      )}

      {/* Common Levels Reference */}
      <div className="bg-surface-inset border border-border rounded-xl p-4 mb-6">
        <h3 className="font-medium text-foreground mb-2">Common Certification Levels</h3>
        <div className="grid grid-cols-5 gap-2 text-sm">
          {commonLevels.map((level) => (
            <div key={level.code} className="text-center p-2 bg-surface-raised rounded border">
              <div className="font-medium">{level.code}</div>
              <div className="text-xs text-foreground-muted">{level.name}</div>
            </div>
          ))}
        </div>
        <p className="text-xs text-foreground-muted mt-2">
          These are common levels across agencies. Add your own based on the agencies you work with.
        </p>
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <div className="bg-surface-raised rounded-xl shadow-sm p-6 mb-6">
          <h2 className="font-semibold mb-4">
            {editingLevel ? "Edit Level" : "Add New Level"}
          </h2>
          <form method="post" onSubmit={() => handleCancel()}>
            <input type="hidden" name="intent" value={editingLevel ? "update" : "create"} />
            {editingLevel && (
              <input type="hidden" name="levelId" value={editingLevel.id} />
            )}

            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium mb-1">
                    Level Name *
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    required
                    defaultValue={editingLevel?.name || ""}
                    placeholder="e.g., Open Water Diver"
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
                    defaultValue={editingLevel?.code || ""}
                    placeholder="e.g., OW"
                    className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
                  />
                </div>
                <div>
                  <label htmlFor="levelNumber" className="block text-sm font-medium mb-1">
                    Level Order
                  </label>
                  <input
                    type="number"
                    id="levelNumber"
                    name="levelNumber"
                    min="0"
                    defaultValue={editingLevel?.levelNumber || 0}
                    placeholder="1"
                    className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
                  />
                  <p className="text-xs text-foreground-muted mt-1">For sorting (1=beginner)</p>
                </div>
              </div>

              <div>
                <label htmlFor="agencyId" className="block text-sm font-medium mb-1">
                  Certification Agency
                </label>
                <select
                  id="agencyId"
                  name="agencyId"
                  defaultValue={editingLevel?.agencyId || ""}
                  className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
                >
                  <option value="">-- Select Agency (optional) --</option>
                  {agencies.map((agency) => (
                    <option key={agency.id} value={agency.id}>
                      {agency.name} ({agency.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="description" className="block text-sm font-medium mb-1">
                  Description
                </label>
                <textarea
                  id="description"
                  name="description"
                  rows={2}
                  defaultValue={editingLevel?.description || ""}
                  placeholder="Brief description of this certification level"
                  className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
                />
              </div>

              <div>
                <label htmlFor="prerequisites" className="block text-sm font-medium mb-1">
                  Prerequisites
                </label>
                <textarea
                  id="prerequisites"
                  name="prerequisites"
                  rows={2}
                  defaultValue={editingLevel?.prerequisites || ""}
                  placeholder="e.g., Open Water certification required"
                  className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="minAge" className="block text-sm font-medium mb-1">
                    Minimum Age
                  </label>
                  <input
                    type="number"
                    id="minAge"
                    name="minAge"
                    min="0"
                    defaultValue={editingLevel?.minAge || ""}
                    placeholder="e.g., 10"
                    className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
                  />
                </div>
                <div>
                  <label htmlFor="minDives" className="block text-sm font-medium mb-1">
                    Minimum Logged Dives
                  </label>
                  <input
                    type="number"
                    id="minDives"
                    name="minDives"
                    min="0"
                    defaultValue={editingLevel?.minDives || ""}
                    placeholder="e.g., 4"
                    className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
                  />
                </div>
              </div>

              <div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="isActive"
                    value="true"
                    defaultChecked={editingLevel?.isActive ?? true}
                    className="rounded"
                  />
                  <span className="text-sm font-medium">Active</span>
                </label>
                <p className="text-xs text-foreground-muted ml-6">
                  Inactive levels won&apos;t appear in dropdowns
                </p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                type="submit"
                disabled={isSubmitting}
                className="bg-brand text-white px-4 py-2 rounded-lg hover:bg-brand-hover disabled:bg-brand-disabled"
              >
                {isSubmitting ? "Saving..." : editingLevel ? "Update Level" : "Add Level"}
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

      {/* Filter and Add Button */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <label htmlFor="filterAgency" className="text-sm text-foreground-muted">
            Filter by Agency:
          </label>
          <select
            id="filterAgency"
            value={filterAgencyId}
            onChange={(e) => setFilterAgencyId(e.target.value)}
            className="px-3 py-1.5 border rounded-lg text-sm focus:ring-2 focus:ring-brand"
          >
            <option value="">All Agencies</option>
            {agencies.map((agency) => (
              <option key={agency.id} value={agency.id}>
                {agency.name}
              </option>
            ))}
          </select>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="bg-brand text-white px-4 py-2 rounded-lg hover:bg-brand-hover"
          >
            Add Level
          </button>
        )}
      </div>

      {/* Levels List */}
      <div className="bg-surface-raised rounded-xl shadow-sm overflow-hidden">
        {filteredLevels.length === 0 ? (
          <div className="p-8 text-center text-foreground-muted">
            <p className="mb-2">
              {filterAgencyId
                ? "No certification levels found for this agency."
                : "No certification levels configured yet."}
            </p>
            <p className="text-sm">
              Add levels like Open Water, Advanced, Rescue Diver, etc.
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {filteredLevels.map((level) => (
              <div key={level.id} className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm ${
                      level.isActive
                        ? "bg-success-muted text-success"
                        : "bg-surface-inset text-foreground-muted"
                    }`}
                  >
                    {level.levelNumber || "-"}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{level.name}</p>
                      <span className="text-xs px-2 py-0.5 bg-surface-inset text-foreground-muted rounded">
                        {level.code}
                      </span>
                      {!level.isActive && (
                        <span className="text-xs px-2 py-0.5 bg-surface-inset text-foreground-muted rounded">
                          Inactive
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-sm text-foreground-muted">
                      {level.agencyName && (
                        <span className="text-brand">{level.agencyName}</span>
                      )}
                      {level.minAge && <span>Min Age: {level.minAge}</span>}
                      {level.minDives && <span>Min Dives: {level.minDives}</span>}
                    </div>
                    {level.description && (
                      <p className="text-sm text-foreground-muted mt-1">{level.description}</p>
                    )}
                    {level.prerequisites && (
                      <p className="text-xs text-foreground-subtle mt-1">
                        Prerequisites: {level.prerequisites}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleEdit(level)}
                    className="px-3 py-1.5 text-sm text-foreground-muted hover:bg-surface-overlay rounded-lg"
                  >
                    Edit
                  </button>
                  <fetcher.Form
                    method="post"
                    onSubmit={(e) => {
                      if (
                        !confirm(
                          `Are you sure you want to delete "${level.name}"? This may affect courses using this level.`
                        )
                      ) {
                        e.preventDefault();
                      }
                    }}
                  >
                    <input type="hidden" name="intent" value="delete" />
                    <input type="hidden" name="levelId" value={level.id} />
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

      {/* Level Descriptions */}
      <div className="bg-surface-raised rounded-xl p-6 shadow-sm mt-6">
        <h3 className="font-semibold mb-4">Level Order Explanation</h3>
        <p className="text-sm text-foreground-muted mb-4">
          The level order number helps organize certifications from beginner to advanced.
          Lower numbers represent entry-level certifications.
        </p>
        <div className="text-sm text-foreground-muted space-y-1">
          <p><strong>1</strong> - Entry Level (e.g., Open Water)</p>
          <p><strong>2</strong> - Intermediate (e.g., Advanced Open Water)</p>
          <p><strong>3</strong> - Advanced (e.g., Rescue Diver)</p>
          <p><strong>4</strong> - Professional (e.g., Divemaster)</p>
          <p><strong>5</strong> - Instructor Level</p>
        </div>
      </div>
    </div>
  );
}
