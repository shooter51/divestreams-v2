/**
 * Certification Levels Settings Route
 *
 * CRUD management for certification levels (Open Water, Advanced, Rescue, etc.)
 * Part of the Training Module settings.
 */

import type { MetaFunction, LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, useActionData, useNavigation, Form, Link } from "react-router";
import { useState } from "react";
import { requireOrgContext } from "../../../../../lib/auth/org-context.server";
import {
  getCertificationAgencies,
  getAllCertificationLevels,
  createCertificationLevel,
  updateCertificationLevel,
  deleteCertificationLevel,
} from "../../../../../lib/db/training.server";

export const meta: MetaFunction = () => [
  { title: "Certification Levels - Training Settings - DiveStreams" },
];

export async function loader({ request }: LoaderFunctionArgs) {
  const ctx = await requireOrgContext(request);

  // Check freemium access - training is a premium feature
  if (!ctx.isPremium) {
    return {
      hasAccess: false,
      agencies: [],
      levels: [],
      levelsByAgency: {},
    };
  }

  const url = new URL(request.url);
  const filterAgencyId = url.searchParams.get("agencyId") || undefined;

  const [agencies, levels] = await Promise.all([
    getCertificationAgencies(ctx.org.id), // Only active agencies for dropdown
    getAllCertificationLevels(ctx.org.id, filterAgencyId), // All levels including inactive
  ]);

  // Group levels by agency
  const levelsByAgency: Record<string, typeof levels> = {};
  for (const item of levels) {
    const agencyId = item.agency?.id || "unknown";
    if (!levelsByAgency[agencyId]) {
      levelsByAgency[agencyId] = [];
    }
    levelsByAgency[agencyId].push(item);
  }

  return {
    hasAccess: true,
    agencies,
    levels,
    levelsByAgency,
    filterAgencyId,
  };
}

export async function action({ request }: ActionFunctionArgs) {
  const ctx = await requireOrgContext(request);

  if (!ctx.isPremium) {
    return { success: false, error: "Premium subscription required" };
  }

  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  try {
    if (intent === "create") {
      const agencyId = formData.get("agencyId") as string;
      const name = formData.get("name") as string;
      const code = formData.get("code") as string;
      const levelNumber = parseInt(formData.get("level") as string, 10);
      const description = (formData.get("description") as string) || undefined;
      const prerequisitesRaw = formData.get("prerequisites") as string;
      const prerequisites = prerequisitesRaw
        ? prerequisitesRaw.split(",").map((p) => p.trim()).filter(Boolean)
        : undefined;

      if (!agencyId || !name || !code || isNaN(levelNumber)) {
        return { success: false, error: "Agency, name, code, and level number are required" };
      }

      await createCertificationLevel(ctx.org.id, {
        agencyId,
        name,
        code: code.toUpperCase(),
        level: levelNumber,
        description,
        prerequisites,
      });

      return { success: true, message: "Level created successfully" };
    }

    if (intent === "update") {
      const levelId = formData.get("levelId") as string;
      const name = formData.get("name") as string;
      const code = formData.get("code") as string;
      const levelNumber = parseInt(formData.get("level") as string, 10);
      const description = (formData.get("description") as string) || undefined;
      const prerequisitesRaw = formData.get("prerequisites") as string;
      const prerequisites = prerequisitesRaw
        ? prerequisitesRaw.split(",").map((p) => p.trim()).filter(Boolean)
        : [];
      const isActive = formData.get("isActive") === "true";

      if (!levelId || !name || !code || isNaN(levelNumber)) {
        return { success: false, error: "Level ID, name, code, and level number are required" };
      }

      await updateCertificationLevel(ctx.org.id, levelId, {
        name,
        code: code.toUpperCase(),
        level: levelNumber,
        description,
        prerequisites,
        isActive,
      });

      return { success: true, message: "Level updated successfully" };
    }

    if (intent === "delete") {
      const levelId = formData.get("levelId") as string;

      if (!levelId) {
        return { success: false, error: "Level ID is required" };
      }

      // Soft delete by setting isActive to false
      await updateCertificationLevel(ctx.org.id, levelId, {
        isActive: false,
      });

      return { success: true, message: "Level deactivated successfully" };
    }

    if (intent === "hardDelete") {
      const levelId = formData.get("levelId") as string;

      if (!levelId) {
        return { success: false, error: "Level ID is required" };
      }

      await deleteCertificationLevel(ctx.org.id, levelId);

      return { success: true, message: "Level deleted permanently" };
    }

    return { success: false, error: "Invalid action" };
  } catch (error) {
    console.error("Level action error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "An error occurred",
    };
  }
}

interface Agency {
  id: string;
  name: string;
  code: string;
  website: string | null;
  logoUrl: string | null;
  isActive: boolean;
}

interface Level {
  id: string;
  agencyId: string;
  name: string;
  code: string;
  level: number;
  description: string | null;
  prerequisites: string[] | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface LevelWithAgency {
  level: Level;
  agency: Agency | null;
}

export default function LevelsSettingsPage() {
  const { hasAccess, agencies, levels, levelsByAgency, filterAgencyId } =
    useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const [showAddForm, setShowAddForm] = useState(false);
  const [editingLevel, setEditingLevel] = useState<LevelWithAgency | null>(null);

  // Premium gate
  if (!hasAccess) {
    return (
      <div className="max-w-2xl mx-auto text-center py-12">
        <div className="text-6xl mb-4">📊</div>
        <h1 className="text-2xl font-bold mb-4">Certification Levels</h1>
        <p className="text-gray-600 mb-6">
          Manage certification levels like Open Water, Advanced, Rescue, and more.
          Available on Premium plans.
        </p>
        <Link
          to="/app/settings/billing"
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Upgrade to Premium
        </Link>
      </div>
    );
  }

  const agencyList = agencies as Agency[];
  const allLevels = levels as LevelWithAgency[];

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="mb-6">
        <Link
          to="/app/training"
          className="text-blue-600 hover:underline text-sm"
        >
          &larr; Back to Training
        </Link>
        <h1 className="text-2xl font-bold mt-2">Certification Levels</h1>
        <p className="text-gray-500">
          Manage certification levels for each agency
        </p>
      </div>

      {/* Status Messages */}
      {actionData?.success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-6">
          {actionData.message}
        </div>
      )}
      {actionData?.error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
          {actionData.error}
        </div>
      )}

      {/* Filter by Agency */}
      <div className="mb-6 flex items-center gap-4">
        <Form method="get" className="flex items-center gap-2">
          <label htmlFor="agencyFilter" className="text-sm font-medium">
            Filter by Agency:
          </label>
          <select
            id="agencyFilter"
            name="agencyId"
            defaultValue={filterAgencyId || ""}
            onChange={(e) => e.currentTarget.form?.submit()}
            className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Agencies</option>
            {agencyList.map((agency) => (
              <option key={agency.id} value={agency.id}>
                {agency.name}
              </option>
            ))}
          </select>
        </Form>

        {!showAddForm && !editingLevel && (
          <button
            onClick={() => setShowAddForm(true)}
            className="ml-auto px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            + Add Level
          </button>
        )}
      </div>

      {/* No agencies warning */}
      {agencyList.length === 0 && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-lg mb-6">
          <p>
            You need to{" "}
            <Link to="/app/training/settings/agencies" className="underline font-medium">
              add at least one certification agency
            </Link>{" "}
            before you can create certification levels.
          </p>
        </div>
      )}

      {/* Add Level Form */}
      {showAddForm && agencyList.length > 0 && (
        <div className="bg-white rounded-xl p-6 shadow-sm mb-6 border">
          <h2 className="font-semibold mb-4">Add New Level</h2>
          <Form method="post" className="space-y-4">
            <input type="hidden" name="intent" value="create" />

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="agencyId" className="block text-sm font-medium mb-1">
                  Agency *
                </label>
                <select
                  id="agencyId"
                  name="agencyId"
                  required
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Agency</option>
                  {agencyList.map((agency) => (
                    <option key={agency.id} value={agency.id}>
                      {agency.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="level" className="block text-sm font-medium mb-1">
                  Level Number *
                </label>
                <input
                  type="number"
                  id="level"
                  name="level"
                  required
                  min="1"
                  placeholder="e.g., 1"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Order/rank of this level (1=beginner, higher=more advanced)
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium mb-1">
                  Level Name *
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  required
                  placeholder="e.g., Open Water Diver"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label htmlFor="code" className="block text-sm font-medium mb-1">
                  Level Code *
                </label>
                <input
                  type="text"
                  id="code"
                  name="code"
                  required
                  placeholder="e.g., OW"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 uppercase"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Short identifier (will be converted to uppercase)
                </p>
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
                placeholder="Brief description of this certification level..."
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="prerequisites" className="block text-sm font-medium mb-1">
                Prerequisites (Level IDs)
              </label>
              <input
                type="text"
                id="prerequisites"
                name="prerequisites"
                placeholder="e.g., level-id-1, level-id-2"
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Comma-separated list of prerequisite level IDs (leave blank for entry-level)
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400"
              >
                {isSubmitting ? "Creating..." : "Create Level"}
              </button>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </Form>
        </div>
      )}

      {/* Edit Level Form */}
      {editingLevel && (
        <div className="bg-white rounded-xl p-6 shadow-sm mb-6 border">
          <h2 className="font-semibold mb-4">Edit Level</h2>
          <Form method="post" className="space-y-4">
            <input type="hidden" name="intent" value="update" />
            <input type="hidden" name="levelId" value={editingLevel.level.id} />

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Agency
                </label>
                <div className="px-3 py-2 bg-gray-100 border rounded-lg text-gray-600">
                  {editingLevel.agency?.name || "Unknown"}
                </div>
              </div>
              <div>
                <label htmlFor="edit-level" className="block text-sm font-medium mb-1">
                  Level Number *
                </label>
                <input
                  type="number"
                  id="edit-level"
                  name="level"
                  required
                  min="1"
                  defaultValue={editingLevel.level.level}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="edit-name" className="block text-sm font-medium mb-1">
                  Level Name *
                </label>
                <input
                  type="text"
                  id="edit-name"
                  name="name"
                  required
                  defaultValue={editingLevel.level.name}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label htmlFor="edit-code" className="block text-sm font-medium mb-1">
                  Level Code *
                </label>
                <input
                  type="text"
                  id="edit-code"
                  name="code"
                  required
                  defaultValue={editingLevel.level.code}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 uppercase"
                />
              </div>
            </div>

            <div>
              <label htmlFor="edit-description" className="block text-sm font-medium mb-1">
                Description
              </label>
              <textarea
                id="edit-description"
                name="description"
                rows={2}
                defaultValue={editingLevel.level.description || ""}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="edit-prerequisites" className="block text-sm font-medium mb-1">
                Prerequisites (Level IDs)
              </label>
              <input
                type="text"
                id="edit-prerequisites"
                name="prerequisites"
                defaultValue={(editingLevel.level.prerequisites || []).join(", ")}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Comma-separated list of prerequisite level IDs
              </p>
            </div>

            <div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="isActive"
                  value="true"
                  defaultChecked={editingLevel.level.isActive}
                  className="rounded"
                />
                <span className="text-sm font-medium">Active</span>
              </label>
              <p className="text-xs text-gray-500 mt-1">
                Inactive levels won't appear when creating courses
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400"
              >
                {isSubmitting ? "Saving..." : "Save Changes"}
              </button>
              <button
                type="button"
                onClick={() => setEditingLevel(null)}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </Form>
        </div>
      )}

      {/* Levels List by Agency */}
      {Object.keys(levelsByAgency).length > 0 ? (
        Object.entries(levelsByAgency as Record<string, LevelWithAgency[]>).map(
          ([agencyId, agencyLevels]) => {
            const agency = agencyLevels[0]?.agency;
            return (
              <div key={agencyId} className="bg-white rounded-xl shadow-sm overflow-hidden mb-6">
                <div className="bg-gray-50 px-6 py-3 border-b">
                  <h3 className="font-semibold">
                    {agency?.name || "Unknown Agency"}
                    <span className="ml-2 text-sm font-normal text-gray-500">
                      ({agency?.code})
                    </span>
                  </h3>
                </div>
                <table className="w-full">
                  <thead className="border-b">
                    <tr>
                      <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">
                        Level
                      </th>
                      <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">
                        Name
                      </th>
                      <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">
                        Code
                      </th>
                      <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">
                        Description
                      </th>
                      <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">
                        Status
                      </th>
                      <th className="px-6 py-3 text-sm font-medium text-gray-500">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {agencyLevels.map((item) => (
                      <tr
                        key={item.level.id}
                        className={`hover:bg-gray-50 ${
                          !item.level.isActive ? "opacity-60" : ""
                        }`}
                      >
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center justify-center w-8 h-8 bg-blue-100 text-blue-700 rounded-full font-semibold text-sm">
                            {item.level.level}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-medium">
                          {item.level.name}
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">
                            {item.level.code}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm text-gray-600 line-clamp-1">
                            {item.level.description || "-"}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex px-2 py-1 text-xs rounded-full ${
                              item.level.isActive
                                ? "bg-green-100 text-green-800"
                                : "bg-gray-100 text-gray-600"
                            }`}
                          >
                            {item.level.isActive ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => setEditingLevel(item as LevelWithAgency)}
                              className="text-blue-600 hover:underline text-sm"
                            >
                              Edit
                            </button>
                            {item.level.isActive ? (
                              <Form method="post" className="inline">
                                <input type="hidden" name="intent" value="delete" />
                                <input type="hidden" name="levelId" value={item.level.id} />
                                <button
                                  type="submit"
                                  className="text-red-600 hover:underline text-sm"
                                  onClick={(e) => {
                                    if (!confirm("Deactivate this level?")) {
                                      e.preventDefault();
                                    }
                                  }}
                                >
                                  Deactivate
                                </button>
                              </Form>
                            ) : (
                              <Form method="post" className="inline">
                                <input type="hidden" name="intent" value="update" />
                                <input type="hidden" name="levelId" value={item.level.id} />
                                <input type="hidden" name="name" value={item.level.name} />
                                <input type="hidden" name="code" value={item.level.code} />
                                <input type="hidden" name="level" value={item.level.level} />
                                <input type="hidden" name="isActive" value="true" />
                                <button
                                  type="submit"
                                  className="text-green-600 hover:underline text-sm"
                                >
                                  Reactivate
                                </button>
                              </Form>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          }
        )
      ) : (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center">
          <p className="text-gray-500">
            No certification levels configured yet.
            {agencyList.length > 0 ? (
              <>
                <br />
                <button
                  onClick={() => setShowAddForm(true)}
                  className="text-blue-600 hover:underline mt-2"
                >
                  Add your first level
                </button>
              </>
            ) : (
              <>
                <br />
                <Link
                  to="/app/training/settings/agencies"
                  className="text-blue-600 hover:underline mt-2"
                >
                  First, add a certification agency
                </Link>
              </>
            )}
          </p>
        </div>
      )}

      {/* Help Text */}
      <div className="mt-6 p-4 bg-blue-50 rounded-lg">
        <h3 className="font-medium text-blue-900 mb-2">About Certification Levels</h3>
        <p className="text-sm text-blue-800">
          Certification levels define the progression path for divers within each agency.
          Common levels include Open Water, Advanced Open Water, Rescue Diver, and Divemaster.
          Each level has a number indicating its position in the progression (1 being entry-level).
          You can set prerequisites to ensure students complete required certifications first.
        </p>
      </div>

      {/* Navigation Links */}
      <div className="mt-6 flex items-center gap-4 text-sm">
        <Link
          to="/app/training/settings/agencies"
          className="text-blue-600 hover:underline"
        >
          Manage Agencies
        </Link>
        <span className="text-gray-300">|</span>
        <Link
          to="/app/training/courses"
          className="text-blue-600 hover:underline"
        >
          View Courses
        </Link>
      </div>
    </div>
  );
}
