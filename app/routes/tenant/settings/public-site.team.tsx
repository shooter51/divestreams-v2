import type { MetaFunction, LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, useFetcher } from "react-router";
import { useState } from "react";
import { requireOrgContext } from "../../../../lib/auth/org-context.server";
import {
  getAllTeamMembers,
  createTeamMember,
  updateTeamMember,
  deleteTeamMember,
  reorderTeamMembers,
} from "../../../../lib/db/team.server";
import { CsrfInput } from "../../../components/CsrfInput";

export const meta: MetaFunction = () => [{ title: "Team Profiles - Public Site Settings" }];

// ============================================================================
// LOADER
// ============================================================================

export async function loader({ request }: LoaderFunctionArgs) {
  const ctx = await requireOrgContext(request);
  const teamMembers = await getAllTeamMembers(ctx.org.id);

  return {
    teamMembers,
  };
}

// ============================================================================
// ACTION
// ============================================================================

export async function action({ request }: ActionFunctionArgs) {
  const ctx = await requireOrgContext(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "create") {
    const name = formData.get("name") as string;
    const role = formData.get("role") as string;
    const bio = formData.get("bio") as string || null;
    const email = formData.get("email") as string || null;
    const phone = formData.get("phone") as string || null;
    const imageUrl = formData.get("imageUrl") as string || null;
    const certificationsStr = formData.get("certifications") as string;
    const specialtiesStr = formData.get("specialties") as string;
    const yearsExperience = formData.get("yearsExperience") as string;

    const certifications = certificationsStr
      ? certificationsStr.split(",").map(c => c.trim()).filter(Boolean)
      : [];
    const specialties = specialtiesStr
      ? specialtiesStr.split(",").map(s => s.trim()).filter(Boolean)
      : [];

    await createTeamMember(ctx.org.id, {
      name,
      role,
      bio,
      email,
      phone,
      imageUrl,
      certifications,
      specialties,
      yearsExperience: yearsExperience ? parseInt(yearsExperience, 10) : null,
      isPublic: true,
      status: "active",
      displayOrder: 0,
    });

    return { success: true, message: "Team member added successfully" };
  }

  if (intent === "update") {
    const memberId = formData.get("memberId") as string;
    const name = formData.get("name") as string;
    const role = formData.get("role") as string;
    const bio = formData.get("bio") as string || null;
    const email = formData.get("email") as string || null;
    const phone = formData.get("phone") as string || null;
    const imageUrl = formData.get("imageUrl") as string || null;
    const certificationsStr = formData.get("certifications") as string;
    const specialtiesStr = formData.get("specialties") as string;
    const yearsExperience = formData.get("yearsExperience") as string;
    const isPublic = formData.get("isPublic") === "true";

    const certifications = certificationsStr
      ? certificationsStr.split(",").map(c => c.trim()).filter(Boolean)
      : [];
    const specialties = specialtiesStr
      ? specialtiesStr.split(",").map(s => s.trim()).filter(Boolean)
      : [];

    await updateTeamMember(ctx.org.id, memberId, {
      name,
      role,
      bio,
      email,
      phone,
      imageUrl,
      certifications,
      specialties,
      yearsExperience: yearsExperience ? parseInt(yearsExperience, 10) : null,
      isPublic,
    });

    return { success: true, message: "Team member updated successfully" };
  }

  if (intent === "delete") {
    const memberId = formData.get("memberId") as string;
    await deleteTeamMember(ctx.org.id, memberId);
    return { success: true, message: "Team member deleted successfully" };
  }

  if (intent === "reorder") {
    const orderStr = formData.get("order") as string;
    const memberIds = orderStr.split(",").filter(Boolean);
    await reorderTeamMembers(ctx.org.id, memberIds);
    return { success: true, message: "Team members reordered successfully" };
  }

  return null;
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function PublicSiteTeamPage() {
  const { teamMembers } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  const [showModal, setShowModal] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [editingMember, setEditingMember] = useState<any>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleEdit = (member: any) => {
    setEditingMember(member);
    setShowModal(true);
  };

  const handleNew = () => {
    setEditingMember(null);
    setShowModal(true);
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleDelete = (member: any) => {
    if (confirm(`Are you sure you want to delete ${member.name}?`)) {
      const formData = new FormData();
      formData.append("intent", "delete");
      formData.append("memberId", member.id);
      fetcher.submit(formData, { method: "post" });
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-2">Team Member Profiles</h2>
        <p className="text-sm text-foreground-muted">
          Manage team member profiles that appear on your public About page
        </p>
      </div>

      {/* Add New Button */}
      <div className="flex justify-end mb-4">
        <button
          onClick={handleNew}
          className="bg-brand text-white px-4 py-2 rounded-lg hover:bg-brand-hover"
        >
          Add Team Member
        </button>
      </div>

      {/* Team Members List */}
      {teamMembers.length === 0 ? (
        <div className="bg-surface-inset border border-border rounded-lg p-8 text-center">
          <p className="text-foreground-muted mb-4">No team members yet</p>
          <button
            onClick={handleNew}
            className="bg-brand text-white px-4 py-2 rounded-lg hover:bg-brand-hover"
          >
            Add Your First Team Member
          </button>
        </div>
      ) : (
        <div className="bg-surface-raised rounded-lg shadow overflow-hidden">
          <div className="divide-y">
            {teamMembers.map((member) => (
              <div key={member.id} className="p-4 flex items-center justify-between hover:bg-surface-inset">
                <div className="flex items-center gap-4">
                  {/* Avatar */}
                  {member.imageUrl ? (
                    <img
                      src={member.imageUrl}
                      alt={member.name}
                      className="w-12 h-12 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 bg-brand-muted text-brand rounded-full flex items-center justify-center font-medium">
                      {member.name
                        .split(" ")
                        .map((n: string) => n[0])
                        .join("")}
                    </div>
                  )}

                  {/* Info */}
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{member.name}</p>
                      {!member.isPublic && (
                        <span className="text-xs bg-surface-overlay text-foreground px-2 py-0.5 rounded">
                          Hidden
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-foreground-muted">{member.role}</p>
                    {member.certifications && member.certifications.length > 0 && (
                      <p className="text-xs text-foreground-muted">
                        {member.certifications.slice(0, 2).join(", ")}
                        {member.certifications.length > 2 && ` +${member.certifications.length - 2} more`}
                      </p>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleEdit(member)}
                    className="text-brand hover:bg-brand-muted px-3 py-1 rounded"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(member)}
                    className="text-danger hover:bg-danger-muted px-3 py-1 rounded"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-surface-raised rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold mb-4">
              {editingMember ? "Edit Team Member" : "Add Team Member"}
            </h2>
            <fetcher.Form
              method="post"
              onSubmit={() =>
              setShowModal(false)}
            >
              <CsrfInput />
              <input type="hidden" name="intent" value={editingMember ? "update" : "create"} />
              {editingMember && <input type="hidden" name="memberId" value={editingMember.id} />}

              <div className="space-y-4">
                {/* Name */}
                <div>
                  <label htmlFor="name" className="block text-sm font-medium mb-1">
                    Name *
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    required
                    defaultValue={editingMember?.name}
                    placeholder="John Smith"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
                  />
                </div>

                {/* Role */}
                <div>
                  <label htmlFor="role" className="block text-sm font-medium mb-1">
                    Role/Title *
                  </label>
                  <input
                    type="text"
                    id="role"
                    name="role"
                    required
                    defaultValue={editingMember?.role}
                    placeholder="Owner & Lead Instructor"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
                  />
                </div>

                {/* Bio */}
                <div>
                  <label htmlFor="bio" className="block text-sm font-medium mb-1">
                    Bio
                  </label>
                  <textarea
                    id="bio"
                    name="bio"
                    rows={3}
                    defaultValue={editingMember?.bio || ""}
                    placeholder="Brief description about this team member..."
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
                  />
                </div>

                {/* Image URL */}
                <div>
                  <label htmlFor="imageUrl" className="block text-sm font-medium mb-1">
                    Image URL
                  </label>
                  <input
                    type="url"
                    id="imageUrl"
                    name="imageUrl"
                    defaultValue={editingMember?.imageUrl || ""}
                    placeholder="https://example.com/photo.jpg"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
                  />
                </div>

                {/* Contact Info Row */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      defaultValue={editingMember?.email || ""}
                      placeholder="john@example.com"
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
                    />
                  </div>

                  <div>
                    <label htmlFor="phone" className="block text-sm font-medium mb-1">
                      Phone
                    </label>
                    <input
                      type="tel"
                      id="phone"
                      name="phone"
                      defaultValue={editingMember?.phone || ""}
                      placeholder="+1 555-1234"
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
                    />
                  </div>
                </div>

                {/* Years of Experience */}
                <div>
                  <label htmlFor="yearsExperience" className="block text-sm font-medium mb-1">
                    Years of Experience
                  </label>
                  <input
                    type="number"
                    id="yearsExperience"
                    name="yearsExperience"
                    min="0"
                    max="99"
                    defaultValue={editingMember?.yearsExperience || ""}
                    placeholder="10"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
                  />
                </div>

                {/* Certifications */}
                <div>
                  <label htmlFor="certifications" className="block text-sm font-medium mb-1">
                    Certifications (comma-separated)
                  </label>
                  <input
                    type="text"
                    id="certifications"
                    name="certifications"
                    defaultValue={editingMember?.certifications?.join(", ") || ""}
                    placeholder="PADI Course Director, TDI Advanced Trimix"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
                  />
                  <p className="text-xs text-foreground-muted mt-1">
                    Separate multiple certifications with commas
                  </p>
                </div>

                {/* Specialties */}
                <div>
                  <label htmlFor="specialties" className="block text-sm font-medium mb-1">
                    Specialties (comma-separated)
                  </label>
                  <input
                    type="text"
                    id="specialties"
                    name="specialties"
                    defaultValue={editingMember?.specialties?.join(", ") || ""}
                    placeholder="Technical Diving, Underwater Photography"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
                  />
                  <p className="text-xs text-foreground-muted mt-1">
                    Separate multiple specialties with commas
                  </p>
                </div>

                {/* Public Visibility */}
                {editingMember && (
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="isPublic"
                      name="isPublic"
                      value="true"
                      defaultChecked={editingMember?.isPublic !== false}
                      className="w-4 h-4 text-brand rounded focus:ring-2 focus:ring-brand"
                    />
                    <label htmlFor="isPublic" className="text-sm font-medium">
                      Show on public About page
                    </label>
                  </div>
                )}
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  type="submit"
                  className="flex-1 bg-brand text-white py-2 rounded-lg hover:bg-brand-hover"
                >
                  {editingMember ? "Update" : "Add"} Team Member
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 border py-2 rounded-lg hover:bg-surface-inset"
                >
                  Cancel
                </button>
              </div>
            </fetcher.Form>
          </div>
        </div>
      )}
    </div>
  );
}
