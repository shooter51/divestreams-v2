import type { MetaFunction, LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, Link, useFetcher, useNavigate } from "react-router";
import { useState } from "react";
import { requireOrgContext } from "../../../../../lib/auth/org-context.server";
import {
  getEnrollmentById,
  updateEnrollment,
  deleteEnrollment,
} from "../../../../../lib/db/training.server";

export const meta: MetaFunction = () => [
  { title: "Enrollment Details - DiveStreams" },
];

export async function loader({ request, params }: LoaderFunctionArgs) {
  const ctx = await requireOrgContext(request);
  const enrollmentId = params.id;

  if (!enrollmentId) {
    throw new Response("Enrollment ID is required", { status: 400 });
  }

  const enrollment = await getEnrollmentById(ctx.org.id, enrollmentId);

  if (!enrollment) {
    throw new Response("Enrollment not found", { status: 404 });
  }

  // Format dates as strings
  const formatDate = (date: Date | string | null | undefined): string | null => {
    if (!date) return null;
    if (date instanceof Date) {
      return date.toISOString().split("T")[0];
    }
    return String(date);
  };

  const formattedEnrollment = {
    ...enrollment,
    enrolledAt: formatDate(enrollment.enrolledAt),
    completedAt: formatDate(enrollment.completedAt),
    certificationDate: formatDate(enrollment.certificationDate),
    sessionStartDate: formatDate(enrollment.sessionStartDate),
    sessionEndDate: formatDate(enrollment.sessionEndDate),
    createdAt: formatDate(enrollment.createdAt),
    updatedAt: formatDate(enrollment.updatedAt),
    // Parse JSON fields
    progress: enrollment.progress as {
      classroomComplete?: boolean;
      poolComplete?: boolean;
      openWaterDivesCompleted?: number;
      quizScore?: number;
      finalExamScore?: number;
    } | null,
    skillCheckoffs: enrollment.skillCheckoffs as {
      skill: string;
      completedAt: string;
      signedOffBy: string;
    }[] | null,
  };

  return { enrollment: formattedEnrollment };
}

export async function action({ request, params }: ActionFunctionArgs) {
  const ctx = await requireOrgContext(request);
  const formData = await request.formData();
  const intent = formData.get("intent");
  const enrollmentId = params.id!;

  if (intent === "update-status") {
    const status = formData.get("status") as string;
    const completedAt =
      status === "completed" ? new Date() : null;

    await updateEnrollment(ctx.org.id, enrollmentId, {
      status,
      completedAt,
    });
    return { success: true, message: "Status updated successfully" };
  }

  if (intent === "update-payment") {
    const paymentStatus = formData.get("paymentStatus") as string;
    const amountPaid = formData.get("amountPaid") as string;

    await updateEnrollment(ctx.org.id, enrollmentId, {
      paymentStatus,
      amountPaid,
    });
    return { success: true, message: "Payment updated successfully" };
  }

  if (intent === "update-progress") {
    const classroomComplete = formData.get("classroomComplete") === "true";
    const poolComplete = formData.get("poolComplete") === "true";
    const openWaterDivesCompleted = parseInt(
      formData.get("openWaterDivesCompleted") as string
    ) || 0;
    const quizScore = formData.get("quizScore")
      ? parseInt(formData.get("quizScore") as string)
      : undefined;
    const finalExamScore = formData.get("finalExamScore")
      ? parseInt(formData.get("finalExamScore") as string)
      : undefined;

    await updateEnrollment(ctx.org.id, enrollmentId, {
      progress: {
        classroomComplete,
        poolComplete,
        openWaterDivesCompleted,
        quizScore,
        finalExamScore,
      },
    });
    return { success: true, message: "Progress updated successfully" };
  }

  if (intent === "add-skill-checkoff") {
    const skill = formData.get("skill") as string;
    const signedOffBy = formData.get("signedOffBy") as string;

    if (!skill || !signedOffBy) {
      return { error: "Skill name and instructor are required" };
    }

    // Get current skill checkoffs
    const enrollment = await getEnrollmentById(ctx.org.id, enrollmentId);
    const existingCheckoffs = (enrollment?.skillCheckoffs as {
      skill: string;
      completedAt: string;
      signedOffBy: string;
    }[]) || [];

    const newCheckoff = {
      skill,
      completedAt: new Date().toISOString(),
      signedOffBy,
    };

    await updateEnrollment(ctx.org.id, enrollmentId, {
      skillCheckoffs: [...existingCheckoffs, newCheckoff],
    });
    return { success: true, message: "Skill checkoff added successfully" };
  }

  if (intent === "issue-certification") {
    const certificationNumber = formData.get("certificationNumber") as string;

    if (!certificationNumber) {
      return { error: "Certification number is required" };
    }

    await updateEnrollment(ctx.org.id, enrollmentId, {
      status: "completed",
      completedAt: new Date(),
      certificationNumber,
      certificationDate: new Date().toISOString().split("T")[0],
    });
    return { success: true, message: "Certification issued successfully" };
  }

  if (intent === "update-notes") {
    const notes = formData.get("notes") as string;
    await updateEnrollment(ctx.org.id, enrollmentId, { notes });
    return { success: true, message: "Notes updated successfully" };
  }

  if (intent === "delete") {
    await deleteEnrollment(ctx.org.id, enrollmentId);
    return { deleted: true };
  }

  return null;
}

const statusColors: Record<string, string> = {
  enrolled: "bg-brand-muted text-brand",
  in_progress: "bg-warning-muted text-warning",
  completed: "bg-success-muted text-success",
  dropped: "bg-surface-inset text-foreground-muted",
  failed: "bg-danger-muted text-danger",
};

const paymentStatusColors: Record<string, string> = {
  pending: "bg-warning-muted text-warning",
  partial: "bg-warning-muted text-warning",
  paid: "bg-success-muted text-success",
  refunded: "bg-surface-inset text-foreground-muted",
};

export default function EnrollmentDetailPage() {
  const { enrollment } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<{
    error?: string;
    message?: string;
    success?: boolean;
    deleted?: boolean;
  }>();
  const navigate = useNavigate();
  const [showSkillModal, setShowSkillModal] = useState(false);
  const [showCertModal, setShowCertModal] = useState(false);

  // Handle redirect after delete
  if (fetcher.data?.deleted) {
    navigate("/tenant/training/enrollments");
    return null;
  }

  const handleDelete = () => {
    if (
      confirm(
        "Are you sure you want to delete this enrollment? This action cannot be undone."
      )
    ) {
      fetcher.submit({ intent: "delete" }, { method: "post" });
    }
  };

  const handleAddSkillCheckoff = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.append("intent", "add-skill-checkoff");
    fetcher.submit(formData, { method: "post" });
    setShowSkillModal(false);
  };

  const handleIssueCertification = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.append("intent", "issue-certification");
    fetcher.submit(formData, { method: "post" });
    setShowCertModal(false);
  };

  const progress = enrollment.progress || {};
  const skillCheckoffs = enrollment.skillCheckoffs || [];

  return (
    <div>
      <div className="mb-6">
        <Link
          to="/tenant/training/enrollments"
          className="text-brand hover:underline text-sm"
        >
          &larr; Back to Enrollments
        </Link>
      </div>

      <div className="flex justify-between items-start mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">
              {enrollment.customerFirstName} {enrollment.customerLastName}
            </h1>
            <span
              className={`text-sm px-3 py-1 rounded-full ${
                statusColors[enrollment.status] || "bg-surface-inset text-foreground"
              }`}
            >
              {enrollment.status.replace("_", " ")}
            </span>
          </div>
          <p className="text-foreground-muted">
            {enrollment.courseName} - Enrolled {enrollment.enrolledAt}
          </p>
        </div>
        <div className="flex gap-2">
          {enrollment.status !== "completed" && !enrollment.certificationNumber && (
            <button
              onClick={() => setShowCertModal(true)}
              className="bg-success text-white px-4 py-2 rounded-lg hover:bg-success-hover"
            >
              Issue Certification
            </button>
          )}
          <button
            onClick={handleDelete}
            className="px-4 py-2 text-danger border border-danger rounded-lg hover:bg-danger-muted"
          >
            Delete
          </button>
        </div>
      </div>

      {/* Success/Error Messages */}
      {fetcher.data?.message && (
        <div className="bg-success-muted border border-success text-success px-4 py-3 rounded-lg mb-6">
          {fetcher.data.message}
        </div>
      )}
      {fetcher.data?.error && (
        <div className="bg-danger-muted border border-danger text-danger px-4 py-3 rounded-lg mb-6">
          {fetcher.data.error}
        </div>
      )}

      <div className="grid grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="col-span-2 space-y-6">
          {/* Student Info */}
          <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold mb-4">Student Information</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-foreground-muted">Name</p>
                <Link
                  to={`/tenant/customers/${enrollment.customerId}`}
                  className="font-medium text-brand hover:underline"
                >
                  {enrollment.customerFirstName} {enrollment.customerLastName}
                </Link>
              </div>
              <div>
                <p className="text-sm text-foreground-muted">Email</p>
                <p>{enrollment.customerEmail}</p>
              </div>
              <div>
                <p className="text-sm text-foreground-muted">Phone</p>
                <p>{enrollment.customerPhone || "Not provided"}</p>
              </div>
            </div>
          </div>

          {/* Course & Session Info */}
          <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold mb-4">Course & Session</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-foreground-muted">Course</p>
                <Link
                  to={`/tenant/training/courses/${enrollment.courseId}`}
                  className="font-medium text-brand hover:underline"
                >
                  {enrollment.courseName}
                </Link>
              </div>
              <div>
                <p className="text-sm text-foreground-muted">Agency / Level</p>
                <p>
                  {enrollment.agencyName}{" "}
                  {enrollment.levelName && `- ${enrollment.levelName}`}
                </p>
              </div>
              <div>
                <p className="text-sm text-foreground-muted">Session Dates</p>
                <p>
                  {enrollment.sessionStartDate}
                  {enrollment.sessionEndDate &&
                    ` - ${enrollment.sessionEndDate}`}
                </p>
              </div>
              <div>
                <p className="text-sm text-foreground-muted">Location</p>
                <p>{enrollment.sessionLocation || "TBD"}</p>
              </div>
              <div>
                <p className="text-sm text-foreground-muted">Instructor</p>
                <p>{enrollment.sessionInstructor || "TBD"}</p>
              </div>
            </div>
          </div>

          {/* Progress Tracking */}
          <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-semibold">Progress Tracking</h2>
            </div>
            <fetcher.Form method="post" className="space-y-4">
              <input type="hidden" name="intent" value="update-progress" />
              <div className="grid grid-cols-2 gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="classroomComplete"
                    value="true"
                    defaultChecked={progress.classroomComplete}
                    className="rounded border-border-strong"
                  />
                  <span>Classroom Training Complete</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="poolComplete"
                    value="true"
                    defaultChecked={progress.poolComplete}
                    className="rounded border-border-strong"
                  />
                  <span>Pool/Confined Water Complete</span>
                </label>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Open Water Dives Completed
                  </label>
                  <input
                    type="number"
                    name="openWaterDivesCompleted"
                    min="0"
                    defaultValue={progress.openWaterDivesCompleted || 0}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Quiz Score (%)
                  </label>
                  <input
                    type="number"
                    name="quizScore"
                    min="0"
                    max="100"
                    defaultValue={progress.quizScore || ""}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Final Exam Score (%)
                  </label>
                  <input
                    type="number"
                    name="finalExamScore"
                    min="0"
                    max="100"
                    defaultValue={progress.finalExamScore || ""}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={fetcher.state === "submitting"}
                className="px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand-hover disabled:bg-brand-disabled"
              >
                {fetcher.state === "submitting"
                  ? "Saving..."
                  : "Update Progress"}
              </button>
            </fetcher.Form>
          </div>

          {/* Skill Checkoffs */}
          <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-semibold">Skill Checkoffs</h2>
              <button
                onClick={() => setShowSkillModal(true)}
                className="text-sm text-brand hover:underline"
              >
                + Add Skill Checkoff
              </button>
            </div>
            {skillCheckoffs.length === 0 ? (
              <p className="text-foreground-muted text-sm">No skill checkoffs recorded yet.</p>
            ) : (
              <div className="space-y-2">
                {skillCheckoffs.map((checkoff, index) => (
                  <div
                    key={index}
                    className="flex justify-between items-center p-3 bg-surface-inset rounded-lg"
                  >
                    <div>
                      <p className="font-medium">{checkoff.skill}</p>
                      <p className="text-sm text-foreground-muted">
                        Signed off by: {checkoff.signedOffBy}
                      </p>
                    </div>
                    <span className="text-sm text-foreground-subtle">
                      {new Date(checkoff.completedAt).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold mb-4">Notes</h2>
            <fetcher.Form method="post">
              <input type="hidden" name="intent" value="update-notes" />
              <textarea
                name="notes"
                rows={4}
                defaultValue={enrollment.notes || ""}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand mb-3"
                placeholder="Add notes about this enrollment..."
              />
              <button
                type="submit"
                disabled={fetcher.state === "submitting"}
                className="px-4 py-2 bg-surface-inset rounded-lg hover:bg-surface-overlay"
              >
                Save Notes
              </button>
            </fetcher.Form>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Status Update */}
          <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold mb-4">Update Status</h2>
            <fetcher.Form method="post">
              <input type="hidden" name="intent" value="update-status" />
              <select
                name="status"
                defaultValue={enrollment.status}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand mb-3"
              >
                <option value="enrolled">Enrolled</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="dropped">Dropped</option>
                <option value="failed">Failed</option>
              </select>
              <button
                type="submit"
                disabled={fetcher.state === "submitting"}
                className="w-full px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand-hover"
              >
                Update Status
              </button>
            </fetcher.Form>
          </div>

          {/* Payment */}
          <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold mb-4">Payment</h2>
            <fetcher.Form method="post" className="space-y-3">
              <input type="hidden" name="intent" value="update-payment" />
              <div>
                <label className="block text-sm font-medium mb-1">Status</label>
                <select
                  name="paymentStatus"
                  defaultValue={enrollment.paymentStatus || "pending"}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
                >
                  <option value="pending">Pending</option>
                  <option value="partial">Partial</option>
                  <option value="paid">Paid</option>
                  <option value="refunded">Refunded</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Amount Paid
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-foreground-muted">$</span>
                  <input
                    type="number"
                    name="amountPaid"
                    step="0.01"
                    min="0"
                    defaultValue={enrollment.amountPaid || "0.00"}
                    className="w-full pl-7 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
                  />
                </div>
              </div>
              <div className="text-sm text-foreground-muted">
                Course Price: ${enrollment.coursePrice || "0.00"}
              </div>
              <button
                type="submit"
                disabled={fetcher.state === "submitting"}
                className="w-full px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand-hover"
              >
                Update Payment
              </button>
            </fetcher.Form>
          </div>

          {/* Certification */}
          <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold mb-4">Certification</h2>
            {enrollment.certificationNumber ? (
              <div className="space-y-2">
                <div className="p-4 bg-success-muted rounded-lg border border-success">
                  <p className="text-sm text-foreground-muted">Certification Number</p>
                  <p className="font-bold text-success">
                    {enrollment.certificationNumber}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-foreground-muted">Issue Date</p>
                  <p>{enrollment.certificationDate}</p>
                </div>
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-foreground-muted text-sm mb-3">
                  No certification issued yet
                </p>
                <button
                  onClick={() => setShowCertModal(true)}
                  className="px-4 py-2 bg-success text-white rounded-lg hover:bg-success-hover"
                >
                  Issue Certification
                </button>
              </div>
            )}
          </div>

          {/* Meta */}
          <div className="text-xs text-foreground-subtle space-y-1">
            <p>Created: {enrollment.createdAt}</p>
            <p>Updated: {enrollment.updatedAt}</p>
            <p>ID: {enrollment.id}</p>
          </div>
        </div>
      </div>

      {/* Add Skill Checkoff Modal */}
      {showSkillModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-surface-raised rounded-xl w-full max-w-md p-6">
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-lg font-bold">Add Skill Checkoff</h2>
              <button
                onClick={() => setShowSkillModal(false)}
                className="text-foreground-subtle hover:text-foreground-muted"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleAddSkillCheckoff} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Skill Name *
                </label>
                <input
                  type="text"
                  name="skill"
                  required
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
                  placeholder="e.g., Mask Clearing, Buoyancy Control"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Signed Off By *
                </label>
                <input
                  type="text"
                  name="signedOffBy"
                  required
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
                  placeholder="Instructor name"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSkillModal(false)}
                  className="flex-1 py-2 border rounded-lg hover:bg-surface-inset"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={fetcher.state === "submitting"}
                  className="flex-1 py-2 bg-brand text-white rounded-lg hover:bg-brand-hover disabled:bg-brand-disabled"
                >
                  Add Checkoff
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Issue Certification Modal */}
      {showCertModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-surface-raised rounded-xl w-full max-w-md p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-lg font-bold">Issue Certification</h2>
                <p className="text-sm text-foreground-muted">
                  {enrollment.customerFirstName} {enrollment.customerLastName} -{" "}
                  {enrollment.courseName}
                </p>
              </div>
              <button
                onClick={() => setShowCertModal(false)}
                className="text-foreground-subtle hover:text-foreground-muted"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleIssueCertification} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Certification Number *
                </label>
                <input
                  type="text"
                  name="certificationNumber"
                  required
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
                  placeholder="e.g., PADI-123456"
                />
              </div>
              <p className="text-sm text-foreground-muted">
                The certification date will be set to today. This will also mark
                the enrollment as completed.
              </p>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCertModal(false)}
                  className="flex-1 py-2 border rounded-lg hover:bg-surface-inset"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={fetcher.state === "submitting"}
                  className="flex-1 py-2 bg-success text-white rounded-lg hover:bg-success-hover disabled:bg-success-muted"
                >
                  Issue Certification
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
