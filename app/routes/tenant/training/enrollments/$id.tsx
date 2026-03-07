import type { MetaFunction, LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, Link, useFetcher, redirect } from "react-router";
import { useState } from "react";
import { requireOrgContext, requireRole} from "../../../../../lib/auth/org-context.server";
import {
  getEnrollmentById,
  updateEnrollment,
  deleteEnrollment,
} from "../../../../../lib/db/training.server";
import { redirectWithNotification, useNotification } from "../../../../../lib/use-notification";
import { formatLabel, formatDisplayDate } from "../../../../lib/format";
import { CsrfInput } from "../../../../components/CsrfInput";
import { useT } from "../../../../i18n/use-t";

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
  requireRole(ctx, ["owner", "admin"]);
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
    return redirect(redirectWithNotification(`/tenant/training/enrollments/${enrollmentId}`, "Enrollment has been successfully updated", "success"));
  }

  if (intent === "update-payment") {
    const paymentStatus = formData.get("paymentStatus") as string;
    const amountPaid = formData.get("amountPaid") as string;

    await updateEnrollment(ctx.org.id, enrollmentId, {
      paymentStatus,
      amountPaid,
    });
    return redirect(redirectWithNotification(`/tenant/training/enrollments/${enrollmentId}`, "Enrollment has been successfully updated", "success"));
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
    return redirect(redirectWithNotification(`/tenant/training/enrollments/${enrollmentId}`, "Enrollment has been successfully updated", "success"));
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
    return redirect(redirectWithNotification(`/tenant/training/enrollments/${enrollmentId}`, "Enrollment has been successfully updated", "success"));
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
    return redirect(redirectWithNotification(`/tenant/training/enrollments/${enrollmentId}`, "Enrollment has been successfully updated", "success"));
  }

  if (intent === "update-notes") {
    const notes = formData.get("notes") as string;
    await updateEnrollment(ctx.org.id, enrollmentId, { notes });
    return redirect(redirectWithNotification(`/tenant/training/enrollments/${enrollmentId}`, "Enrollment has been successfully updated", "success"));
  }

  if (intent === "delete") {
    await deleteEnrollment(ctx.org.id, enrollmentId);
    return redirect(redirectWithNotification("/tenant/training/enrollments", "Enrollment has been successfully deleted", "success"));
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


export default function EnrollmentDetailPage() {
  useNotification();
  const t = useT();

  const { enrollment } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<{
    error?: string;
  }>();
  const [showSkillModal, setShowSkillModal] = useState(false);
  const [showCertModal, setShowCertModal] = useState(false);

  const handleDelete = () => {
    if (
      confirm(
        t("tenant.training.enrollments.confirmDelete")
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
          &larr; {t("tenant.training.enrollments.backToEnrollments")}
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
              {formatLabel(enrollment.status)}
            </span>
          </div>
          <p className="text-foreground-muted">
            {enrollment.courseName} - {t("tenant.training.enrollments.enrolledOn", { date: formatDisplayDate(enrollment.enrolledAt) || "" })}
          </p>
        </div>
        <div className="flex gap-2">
          {enrollment.status !== "completed" && !enrollment.certificationNumber && (
            <button
              onClick={() => setShowCertModal(true)}
              className="bg-success text-white px-4 py-2 rounded-lg hover:bg-success-hover"
            >
              {t("tenant.training.enrollments.issueCertification")}
            </button>
          )}
          <button
            onClick={handleDelete}
            className="px-4 py-2 text-danger border border-danger rounded-lg hover:bg-danger-muted"
          >
            {t("common.delete")}
          </button>
        </div>
      </div>

      {/* Error Messages */}
      {fetcher.data?.error && (
        <div className="bg-danger-muted border border-danger text-danger px-4 py-3 rounded-lg max-w-4xl break-words mb-6">
          {fetcher.data.error}
        </div>
      )}

      <div className="grid grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="col-span-2 space-y-6">
          {/* Student Info */}
          <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold mb-4">{t("tenant.training.enrollments.studentInformation")}</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-foreground-muted">{t("common.name")}</p>
                <Link
                  to={`/tenant/customers/${enrollment.customerId}`}
                  className="font-medium text-brand hover:underline"
                >
                  {enrollment.customerFirstName} {enrollment.customerLastName}
                </Link>
              </div>
              <div>
                <p className="text-sm text-foreground-muted">{t("common.email")}</p>
                <p>{enrollment.customerEmail}</p>
              </div>
              <div>
                <p className="text-sm text-foreground-muted">{t("common.phone")}</p>
                <p>{enrollment.customerPhone || t("tenant.training.enrollments.notProvided")}</p>
              </div>
            </div>
          </div>

          {/* Course & Session Info */}
          <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold mb-4">{t("tenant.training.enrollments.courseAndSession")}</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-foreground-muted">{t("tenant.training.enrollments.col.course")}</p>
                <Link
                  to={`/tenant/training/courses/${enrollment.courseId}`}
                  className="font-medium text-brand hover:underline"
                >
                  {enrollment.courseName}
                </Link>
              </div>
              <div>
                <p className="text-sm text-foreground-muted">{t("tenant.training.enrollments.agencyLevel")}</p>
                <p>
                  {enrollment.agencyName}{" "}
                  {enrollment.levelName && `- ${enrollment.levelName}`}
                </p>
              </div>
              <div>
                <p className="text-sm text-foreground-muted">{t("tenant.training.enrollments.sessionDates")}</p>
                <p>
                  {formatDisplayDate(enrollment.sessionStartDate)}
                  {enrollment.sessionEndDate &&
                    ` - ${formatDisplayDate(enrollment.sessionEndDate)}`}
                </p>
              </div>
              <div>
                <p className="text-sm text-foreground-muted">{t("tenant.training.enrollments.location")}</p>
                <p>{enrollment.sessionLocation || t("tenant.training.enrollments.tbd")}</p>
              </div>
              <div>
                <p className="text-sm text-foreground-muted">{t("tenant.training.enrollments.instructor")}</p>
                <p>{enrollment.sessionInstructor || t("tenant.training.enrollments.tbd")}</p>
              </div>
            </div>
          </div>

          {/* Progress Tracking */}
          <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-semibold">{t("tenant.training.enrollments.progressTracking")}</h2>
            </div>
            <fetcher.Form method="post" className="space-y-4">
              <CsrfInput />
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
                  <span>{t("tenant.training.enrollments.classroomComplete")}</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="poolComplete"
                    value="true"
                    defaultChecked={progress.poolComplete}
                    className="rounded border-border-strong"
                  />
                  <span>{t("tenant.training.enrollments.poolComplete")}</span>
                </label>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    {t("tenant.training.enrollments.openWaterDivesCompleted")}
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
                    {t("tenant.training.enrollments.quizScore")}
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
                    {t("tenant.training.enrollments.finalExamScore")}
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
                  ? t("common.saving")
                  : t("tenant.training.enrollments.updateProgress")}
              </button>
            </fetcher.Form>
          </div>

          {/* Skill Checkoffs */}
          <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-semibold">{t("tenant.training.enrollments.skillCheckoffs")}</h2>
              <button
                onClick={() => setShowSkillModal(true)}
                className="text-sm text-brand hover:underline"
              >
                + {t("tenant.training.enrollments.addSkillCheckoff")}
              </button>
            </div>
            {skillCheckoffs.length === 0 ? (
              <p className="text-foreground-muted text-sm">{t("tenant.training.enrollments.noSkillCheckoffs")}</p>
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
                        {t("tenant.training.enrollments.signedOffBy", { name: checkoff.signedOffBy })}
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
            <h2 className="font-semibold mb-4">{t("common.notes")}</h2>
            <fetcher.Form method="post">
              <CsrfInput />
              <input type="hidden" name="intent" value="update-notes" />
              <textarea
                name="notes"
                rows={4}
                defaultValue={enrollment.notes || ""}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand mb-3"
                placeholder={t("tenant.training.enrollments.notesPlaceholder")}
              />
              <button
                type="submit"
                disabled={fetcher.state === "submitting"}
                className="px-4 py-2 bg-surface-inset rounded-lg hover:bg-surface-overlay"
              >
                {t("tenant.training.enrollments.saveNotes")}
              </button>
            </fetcher.Form>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Status Update */}
          <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold mb-4">{t("tenant.training.enrollments.updateStatus")}</h2>
            <fetcher.Form method="post">
              <CsrfInput />
              <input type="hidden" name="intent" value="update-status" />
              <select
                name="status"
                defaultValue={enrollment.status}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand mb-3"
              >
                <option value="enrolled">{t("tenant.training.enrollments.status.enrolled")}</option>
                <option value="in_progress">{t("tenant.training.enrollments.status.inProgress")}</option>
                <option value="completed">{t("tenant.training.enrollments.status.completed")}</option>
                <option value="dropped">{t("tenant.training.enrollments.status.dropped")}</option>
                <option value="failed">{t("tenant.training.enrollments.status.failed")}</option>
              </select>
              <button
                type="submit"
                disabled={fetcher.state === "submitting"}
                className="w-full px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand-hover"
              >
                {t("tenant.training.enrollments.updateStatus")}
              </button>
            </fetcher.Form>
          </div>

          {/* Payment */}
          <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold mb-4">{t("tenant.training.enrollments.col.payment")}</h2>
            <fetcher.Form method="post" className="space-y-3">
              <CsrfInput />
              <input type="hidden" name="intent" value="update-payment" />
              <div>
                <label className="block text-sm font-medium mb-1">{t("common.status")}</label>
                <select
                  name="paymentStatus"
                  defaultValue={enrollment.paymentStatus || "pending"}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
                >
                  <option value="pending">{t("tenant.training.enrollments.paymentStatus.pending")}</option>
                  <option value="partial">{t("tenant.training.enrollments.paymentStatus.partial")}</option>
                  <option value="paid">{t("tenant.training.enrollments.paymentStatus.paid")}</option>
                  <option value="refunded">{t("tenant.training.enrollments.paymentStatus.refunded")}</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  {t("tenant.training.enrollments.amountPaid")}
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
                {t("tenant.training.enrollments.coursePrice", { price: enrollment.coursePrice || "0.00" })}
              </div>
              <button
                type="submit"
                disabled={fetcher.state === "submitting"}
                className="w-full px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand-hover"
              >
                {t("tenant.training.enrollments.updatePayment")}
              </button>
            </fetcher.Form>
          </div>

          {/* Certification */}
          <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold mb-4">{t("tenant.training.enrollments.col.certification")}</h2>
            {enrollment.certificationNumber ? (
              <div className="space-y-2">
                <div className="p-4 bg-success-muted rounded-lg border border-success">
                  <p className="text-sm text-foreground-muted">{t("tenant.training.enrollments.certificationNumber")}</p>
                  <p className="font-bold text-success">
                    {enrollment.certificationNumber}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-foreground-muted">{t("tenant.training.enrollments.issueDate")}</p>
                  <p>{formatDisplayDate(enrollment.certificationDate)}</p>
                </div>
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-foreground-muted text-sm mb-3">
                  {t("tenant.training.enrollments.noCertification")}
                </p>
                <button
                  onClick={() => setShowCertModal(true)}
                  className="px-4 py-2 bg-success text-white rounded-lg hover:bg-success-hover"
                >
                  {t("tenant.training.enrollments.issueCertification")}
                </button>
              </div>
            )}
          </div>

          {/* Meta */}
          <div className="text-xs text-foreground-subtle space-y-1">
            <p>{t("tenant.training.enrollments.created", { date: formatDisplayDate(enrollment.createdAt) || "" })}</p>
            <p>{t("tenant.training.enrollments.updated", { date: formatDisplayDate(enrollment.updatedAt) || "" })}</p>
            <p>{t("tenant.training.enrollments.id", { id: enrollment.id })}</p>
          </div>
        </div>
      </div>

      {/* Add Skill Checkoff Modal */}
      {showSkillModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-surface-raised rounded-xl w-full max-w-md p-6">
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-lg font-bold">{t("tenant.training.enrollments.addSkillCheckoff")}</h2>
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
                  {t("tenant.training.enrollments.skillName")} *
                </label>
                <input
                  type="text"
                  name="skill"
                  required
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
                  placeholder={t("tenant.training.enrollments.skillNamePlaceholder")}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  {t("tenant.training.enrollments.signedOffByLabel")} *
                </label>
                <input
                  type="text"
                  name="signedOffBy"
                  required
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
                  placeholder={t("tenant.training.enrollments.instructorNamePlaceholder")}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSkillModal(false)}
                  className="flex-1 py-2 border rounded-lg hover:bg-surface-inset"
                >
                  {t("common.cancel")}
                </button>
                <button
                  type="submit"
                  disabled={fetcher.state === "submitting"}
                  className="flex-1 py-2 bg-brand text-white rounded-lg hover:bg-brand-hover disabled:bg-brand-disabled"
                >
                  {t("tenant.training.enrollments.addCheckoff")}
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
                <h2 className="text-lg font-bold">{t("tenant.training.enrollments.issueCertification")}</h2>
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
                  {t("tenant.training.enrollments.certificationNumber")} *
                </label>
                <input
                  type="text"
                  name="certificationNumber"
                  required
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
                  placeholder={t("tenant.training.enrollments.certificationNumberPlaceholder")}
                />
              </div>
              <p className="text-sm text-foreground-muted">
                {t("tenant.training.enrollments.certificationDateNote")}
              </p>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCertModal(false)}
                  className="flex-1 py-2 border rounded-lg hover:bg-surface-inset"
                >
                  {t("common.cancel")}
                </button>
                <button
                  type="submit"
                  disabled={fetcher.state === "submitting"}
                  className="flex-1 py-2 bg-success text-white rounded-lg hover:bg-success-hover disabled:bg-success-muted"
                >
                  {t("tenant.training.enrollments.issueCertification")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
