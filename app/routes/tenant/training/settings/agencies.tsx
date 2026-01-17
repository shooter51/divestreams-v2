/**
 * Certification Agencies Settings Route
 *
 * CRUD management for certification agencies (PADI, SSI, NAUI, etc.)
 * Part of the Training Module settings.
 */

import type { MetaFunction, LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, useActionData, useNavigation, Form, Link } from "react-router";
import { useState } from "react";
import { requireOrgContext } from "../../../../../lib/auth/org-context.server";
import {
  getAllCertificationAgencies,
  createCertificationAgency,
  updateCertificationAgency,
  deleteCertificationAgency,
} from "../../../../../lib/db/training.server";

export const meta: MetaFunction = () => [
  { title: "Certification Agencies - Training Settings - DiveStreams" },
];

export async function loader({ request }: LoaderFunctionArgs) {
  const ctx = await requireOrgContext(request);

  // Check freemium access - training is a premium feature
  if (!ctx.isPremium) {
    return {
      hasAccess: false,
      agencies: [],
    };
  }

  const agencies = await getAllCertificationAgencies(ctx.org.id);

  return {
    hasAccess: true,
    agencies,
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
      const name = formData.get("name") as string;
      const code = formData.get("code") as string;
      const website = (formData.get("website") as string) || undefined;
      const logoUrl = (formData.get("logoUrl") as string) || undefined;

      if (!name || !code) {
        return { success: false, error: "Name and code are required" };
      }

      await createCertificationAgency(ctx.org.id, {
        name,
        code: code.toUpperCase(),
        website,
        logoUrl,
      });

      return { success: true, message: "Agency created successfully" };
    }

    if (intent === "update") {
      const agencyId = formData.get("agencyId") as string;
      const name = formData.get("name") as string;
      const code = formData.get("code") as string;
      const website = (formData.get("website") as string) || undefined;
      const logoUrl = (formData.get("logoUrl") as string) || undefined;
      const isActive = formData.get("isActive") === "true";

      if (!agencyId || !name || !code) {
        return { success: false, error: "Agency ID, name, and code are required" };
      }

      await updateCertificationAgency(ctx.org.id, agencyId, {
        name,
        code: code.toUpperCase(),
        website,
        logoUrl,
        isActive,
      });

      return { success: true, message: "Agency updated successfully" };
    }

    if (intent === "delete") {
      const agencyId = formData.get("agencyId") as string;

      if (!agencyId) {
        return { success: false, error: "Agency ID is required" };
      }

      // Soft delete by setting isActive to false
      await updateCertificationAgency(ctx.org.id, agencyId, {
        isActive: false,
      });

      return { success: true, message: "Agency deactivated successfully" };
    }

    if (intent === "hardDelete") {
      const agencyId = formData.get("agencyId") as string;

      if (!agencyId) {
        return { success: false, error: "Agency ID is required" };
      }

      await deleteCertificationAgency(ctx.org.id, agencyId);

      return { success: true, message: "Agency deleted permanently" };
    }

    return { success: false, error: "Invalid action" };
  } catch (error) {
    console.error("Agency action error:", error);
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
  createdAt: Date;
  updatedAt: Date;
}

export default function AgenciesSettingsPage() {
  const { hasAccess, agencies } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const [showAddForm, setShowAddForm] = useState(false);
  const [editingAgency, setEditingAgency] = useState<Agency | null>(null);

  // Premium gate
  if (!hasAccess) {
    return (
      <div className="max-w-2xl mx-auto text-center py-12">
        <div className="text-6xl mb-4">🏛️</div>
        <h1 className="text-2xl font-bold mb-4">Certification Agencies</h1>
        <p className="text-gray-600 mb-6">
          Manage certification agencies like PADI, SSI, and NAUI.
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
        <h1 className="text-2xl font-bold mt-2">Certification Agencies</h1>
        <p className="text-gray-500">
          Manage dive certification agencies for your training courses
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

      {/* Add Agency Button */}
      {!showAddForm && !editingAgency && (
        <button
          onClick={() => setShowAddForm(true)}
          className="mb-6 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          + Add Agency
        </button>
      )}

      {/* Add Agency Form */}
      {showAddForm && (
        <div className="bg-white rounded-xl p-6 shadow-sm mb-6 border">
          <h2 className="font-semibold mb-4">Add New Agency</h2>
          <Form method="post" className="space-y-4">
            <input type="hidden" name="intent" value="create" />

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
                  placeholder="e.g., PADI"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label htmlFor="code" className="block text-sm font-medium mb-1">
                  Agency Code *
                </label>
                <input
                  type="text"
                  id="code"
                  name="code"
                  required
                  placeholder="e.g., PADI"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 uppercase"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Short identifier (will be converted to uppercase)
                </p>
              </div>
            </div>

            <div>
              <label htmlFor="website" className="block text-sm font-medium mb-1">
                Website
              </label>
              <input
                type="url"
                id="website"
                name="website"
                placeholder="https://www.padi.com"
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="logoUrl" className="block text-sm font-medium mb-1">
                Logo URL
              </label>
              <input
                type="url"
                id="logoUrl"
                name="logoUrl"
                placeholder="https://example.com/logo.png"
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400"
              >
                {isSubmitting ? "Creating..." : "Create Agency"}
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

      {/* Edit Agency Form */}
      {editingAgency && (
        <div className="bg-white rounded-xl p-6 shadow-sm mb-6 border">
          <h2 className="font-semibold mb-4">Edit Agency</h2>
          <Form method="post" className="space-y-4">
            <input type="hidden" name="intent" value="update" />
            <input type="hidden" name="agencyId" value={editingAgency.id} />

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="edit-name" className="block text-sm font-medium mb-1">
                  Agency Name *
                </label>
                <input
                  type="text"
                  id="edit-name"
                  name="name"
                  required
                  defaultValue={editingAgency.name}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label htmlFor="edit-code" className="block text-sm font-medium mb-1">
                  Agency Code *
                </label>
                <input
                  type="text"
                  id="edit-code"
                  name="code"
                  required
                  defaultValue={editingAgency.code}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 uppercase"
                />
              </div>
            </div>

            <div>
              <label htmlFor="edit-website" className="block text-sm font-medium mb-1">
                Website
              </label>
              <input
                type="url"
                id="edit-website"
                name="website"
                defaultValue={editingAgency.website || ""}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="edit-logoUrl" className="block text-sm font-medium mb-1">
                Logo URL
              </label>
              <input
                type="url"
                id="edit-logoUrl"
                name="logoUrl"
                defaultValue={editingAgency.logoUrl || ""}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="isActive"
                  value="true"
                  defaultChecked={editingAgency.isActive}
                  className="rounded"
                />
                <span className="text-sm font-medium">Active</span>
              </label>
              <p className="text-xs text-gray-500 mt-1">
                Inactive agencies won't appear when creating courses
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
                onClick={() => setEditingAgency(null)}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </Form>
        </div>
      )}

      {/* Agencies List */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">
                Agency
              </th>
              <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">
                Code
              </th>
              <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">
                Website
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
            {agencies.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                  No certification agencies configured yet.
                  <br />
                  <button
                    onClick={() => setShowAddForm(true)}
                    className="text-blue-600 hover:underline mt-2"
                  >
                    Add your first agency
                  </button>
                </td>
              </tr>
            ) : (
              agencies.map((agency) => (
                <tr
                  key={agency.id}
                  className={`hover:bg-gray-50 ${!agency.isActive ? "opacity-60" : ""}`}
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      {agency.logoUrl ? (
                        <img
                          src={agency.logoUrl}
                          alt={agency.name}
                          className="w-8 h-8 object-contain rounded"
                        />
                      ) : (
                        <div className="w-8 h-8 bg-gray-100 rounded flex items-center justify-center text-gray-400 text-xs font-bold">
                          {agency.code.slice(0, 2)}
                        </div>
                      )}
                      <span className="font-medium">{agency.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">
                      {agency.code}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {agency.website ? (
                      <a
                        href={agency.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline text-sm"
                      >
                        {agency.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                      </a>
                    ) : (
                      <span className="text-gray-400 text-sm">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex px-2 py-1 text-xs rounded-full ${
                        agency.isActive
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {agency.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => setEditingAgency(agency as Agency)}
                        className="text-blue-600 hover:underline text-sm"
                      >
                        Edit
                      </button>
                      {agency.isActive ? (
                        <Form method="post" className="inline">
                          <input type="hidden" name="intent" value="delete" />
                          <input type="hidden" name="agencyId" value={agency.id} />
                          <button
                            type="submit"
                            className="text-red-600 hover:underline text-sm"
                            onClick={(e) => {
                              if (!confirm("Deactivate this agency?")) {
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
                          <input type="hidden" name="agencyId" value={agency.id} />
                          <input type="hidden" name="name" value={agency.name} />
                          <input type="hidden" name="code" value={agency.code} />
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
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Help Text */}
      <div className="mt-6 p-4 bg-blue-50 rounded-lg">
        <h3 className="font-medium text-blue-900 mb-2">About Certification Agencies</h3>
        <p className="text-sm text-blue-800">
          Certification agencies (like PADI, SSI, NAUI, etc.) are the organizations that
          establish training standards and issue dive certifications. Add the agencies
          you work with to organize your courses by certification body.
        </p>
      </div>
    </div>
  );
}
