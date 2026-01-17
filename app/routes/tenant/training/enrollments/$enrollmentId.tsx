/**
 * Enrollment Detail Route
 *
 * Displays comprehensive details for a student enrollment including
 * progress tracking, skill checkoffs, payment history, and certification status.
 * Part of the Training Module (premium feature).
 */

import type { MetaFunction, LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, Link, useFetcher, redirect } from "react-router";
import { useState } from "react";
import { requireOrgContext } from "../../../../../lib/auth/org-context.server";
import {
  getEnrollmentById,
  getSkillCheckoffs,
  getCourseSessions,
  updateEnrollmentStatus,
  updateEnrollmentPayment,
  getStudentProgress,
} from "../../../../../lib/db/training.server";

export const meta: MetaFunction<typeof loader> = ({ data }) => [
  {
    title: data?.enrollment?.customer
      ? `${data.enrollment.customer.firstName} ${data.enrollment.customer.lastName} - Enrollment - DiveStreams`
      : "Enrollment - Training - DiveStreams",
  },
];

// Enrollment status configuration with labels and colors
const statusConfig: Record<string, { label: string; color: string }> = {
  pending_scheduling: {
    label: "Pending Scheduling",
    color: "bg-yellow-100 text-yellow-800",
  },
  scheduled: {
    label: "Scheduled",
    color: "bg-blue-100 text-blue-800",
  },
  enrolled: {
    label: "Enrolled",
    color: "bg-indigo-100 text-indigo-800",
  },
  in_progress: {
    label: "In Progress",
    color: "bg-purple-100 text-purple-800",
  },
  completed: {
    label: "Completed",
    color: "bg-teal-100 text-teal-800",
  },
  certified: {
    label: "Certified",
    color: "bg-green-100 text-green-800",
  },
  withdrawn: {
    label: "Withdrawn",
    color: "bg-red-100 text-red-800",
  },
};

// Payment status configuration
const paymentStatusConfig: Record<string, { label: string; color: string }> = {
  pending: { label: "Pending", color: "bg-yellow-100 text-yellow-800" },
  deposit_paid: { label: "Deposit Paid", color: "bg-blue-100 text-blue-800" },
  paid_in_full: { label: "Paid in Full", color: "bg-green-100 text-green-800" },
};

export async function loader({ request, params }: LoaderFunctionArgs) {
  const ctx = await requireOrgContext(request);
  const enrollmentId = params.enrollmentId;

  if (!enrollmentId) {
    throw new Response("Enrollment ID required", { status: 400 });
  }

  // Check freemium access - training is a premium feature
  if (!ctx.isPremium) {
    return {
      hasAccess: false,
      enrollment: null,
      skillCheckoffs: [],
      sessions: [],
      progress: null,
    };
  }

  // Get enrollment data with course, customer, agency, level
  const enrollment = await getEnrollmentById(ctx.org.id, enrollmentId);

  if (!enrollment) {
    throw new Response("Enrollment not found", { status: 404 });
  }

  // Get related data in parallel
  const [skillCheckoffs, sessions, studentProgress] = await Promise.all([
    getSkillCheckoffs(ctx.org.id, enrollmentId),
    enrollment.course
      ? getCourseSessions(ctx.org.id, { courseId: enrollment.course.id })
      : Promise.resolve([]),
    getStudentProgress(ctx.org.id, enrollmentId),
  ]);

  return {
    hasAccess: true,
    enrollment,
    skillCheckoffs,
    sessions,
    progress: studentProgress?.progress || null,
  };
}

export async function action({ request, params }: ActionFunctionArgs) {
  const ctx = await requireOrgContext(request);
  const formData = await request.formData();
  const intent = formData.get("intent");
  const enrollmentId = params.enrollmentId!;

  if (intent === "update-status") {
    const status = formData.get("status") as string;
    const instructorNotes = formData.get("instructorNotes") as string;

    // Build additional data based on status
    const additionalData: Record<string, Date | string | number> = {};

    if (status === "in_progress" && !formData.get("startedAt")) {
      additionalData.startedAt = new Date();
    }

    if (status === "completed" || status === "certified") {
      additionalData.completedAt = new Date();
    }

    if (status === "certified") {
      const certificationNumber = formData.get("certificationNumber") as string;
      if (certificationNumber) {
        additionalData.certificationNumber = certificationNumber;
        additionalData.certifiedAt = new Date();
      }
    }

    if (instructorNotes) {
      additionalData.instructorNotes = instructorNotes;
    }

    await updateEnrollmentStatus(ctx.org.id, enrollmentId, status, additionalData);
    return { statusUpdated: true };
  }

  if (intent === "record-exam") {
    const examScore = parseInt(formData.get("examScore") as string);
    const enrollment = await getEnrollmentById(ctx.org.id, enrollmentId);

    if (enrollment) {
      const passScore = enrollment.course?.examPassScore || 75;
      const passed = examScore >= passScore;

      await updateEnrollmentStatus(ctx.org.id, enrollmentId, enrollment.enrollment.status, {
        examScore,
        ...(passed ? { examPassedAt: new Date() } : {}),
      });
    }
    return { examRecorded: true };
  }

  if (intent === "record-payment") {
    const paymentAmount = parseFloat(formData.get("paymentAmount") as string);
    const paymentType = formData.get("paymentType") as string;
    const enrollment = await getEnrollmentById(ctx.org.id, enrollmentId);

    if (enrollment) {
      const currentBalance = parseFloat(enrollment.enrollment.balanceDue || "0");
      const newBalance = Math.max(0, currentBalance - paymentAmount);

      let newPaymentStatus = "pending";
      if (paymentType === "deposit") {
        newPaymentStatus = "deposit_paid";
      }
      if (newBalance === 0) {
        newPaymentStatus = "paid_in_full";
      }

      await updateEnrollmentPayment(ctx.org.id, enrollmentId, {
        paymentStatus: newPaymentStatus,
        balanceDue: String(newBalance),
        ...(paymentType === "deposit" ? { depositPaidAt: new Date() } : {}),
      });
    }
    return { paymentRecorded: true };
  }

  if (intent === "mark-certified") {
    const certificationNumber = formData.get("certificationNumber") as string;

    await updateEnrollmentStatus(ctx.org.id, enrollmentId, "certified", {
      certificationNumber,
      certifiedAt: new Date(),
      completedAt: new Date(),
    });

    return { certified: true };
  }

  if (intent === "withdraw") {
    await updateEnrollmentStatus(ctx.org.id, enrollmentId, "withdrawn");
    return { withdrawn: true };
  }

  return null;
}

export default function EnrollmentDetailPage() {
  const { hasAccess, enrollment, skillCheckoffs, sessions, progress } =
    useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showExamModal, setShowExamModal] = useState(false);
  const [showCertifyModal, setShowCertifyModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);

  // Format date for display
  const formatDate = (dateStr: string | Date | null | undefined) => {
    if (!dateStr) return "N/A";
    return new Date(dateStr).toLocaleDateString();
  };

  // Format currency
  const formatCurrency = (amount: string | number | null | undefined) => {
    if (amount === null || amount === undefined) return "$0.00";
    return `$${Number(amount).toFixed(2)}`;
  };

  // Premium gate
  if (!hasAccess || !enrollment) {
    return (
      <div className="max-w-2xl mx-auto text-center py-12">
        <div className="text-6xl mb-4">👤</div>
        <h1 className="text-2xl font-bold mb-4">Student Enrollment</h1>
        <p className="text-gray-600 mb-6">
          View and manage student enrollment details. Available on Premium plans.
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

  const handleWithdraw = () => {
    if (confirm("Are you sure you want to withdraw this student from the course?")) {
      fetcher.submit({ intent: "withdraw" }, { method: "post" });
    }
  };

  // Calculate completed sessions
  const completedSessions = sessions.filter(
    (s) => s.session.status === "completed"
  ).length;
  const totalSessions = enrollment.course?.totalSessions || sessions.length || 1;

  // Calculate demonstrated skills
  const demonstratedSkills = skillCheckoffs.filter(
    (c) => c.status === "demonstrated"
  ).length;
  const totalSkills = skillCheckoffs.length || 0;

  // Status info
  const currentStatus = statusConfig[enrollment.enrollment.status] || {
    label: enrollment.enrollment.status,
    color: "bg-gray-100 text-gray-800",
  };

  const currentPaymentStatus =
    paymentStatusConfig[enrollment.enrollment.paymentStatus || "pending"] ||
    paymentStatusConfig.pending;

  return (
    <div>
      {/* Breadcrumb */}
      <div className="mb-6">
        <Link
          to="/app/training/enrollments"
          className="text-blue-600 hover:underline text-sm"
        >
          &larr; Back to Enrollments
        </Link>
      </div>

      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">
              {enrollment.customer?.firstName} {enrollment.customer?.lastName}
            </h1>
            <span className={`inline-flex px-3 py-1 text-sm rounded-full ${currentStatus.color}`}>
              {currentStatus.label}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <Link
              to={`/app/training/courses/${enrollment.course?.id}`}
              className="text-blue-600 hover:underline"
            >
              {enrollment.course?.name}
            </Link>
            {enrollment.agency?.name && (
              <span className="text-gray-400">|</span>
            )}
            {enrollment.agency?.name && (
              <span className="text-gray-500 text-sm">{enrollment.agency.name}</span>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowStatusModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Update Status
          </button>
          {enrollment.enrollment.status !== "certified" &&
            enrollment.enrollment.status !== "withdrawn" && (
              <button
                onClick={() => setShowCertifyModal(true)}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Mark Certified
              </button>
            )}
          {enrollment.enrollment.status !== "withdrawn" && (
            <button
              onClick={handleWithdraw}
              className="px-4 py-2 text-red-600 border border-red-200 rounded-lg hover:bg-red-50"
            >
              Withdraw
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="col-span-2 space-y-6">
          {/* Progress Overview */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold mb-4">Progress Overview</h2>
            <div className="mb-4">
              <div className="flex justify-between text-sm mb-1">
                <span>Overall Progress</span>
                <span className="font-medium">{progress?.total || 0}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-blue-600 h-3 rounded-full transition-all"
                  style={{ width: `${progress?.total || 0}%` }}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">
                  {progress?.sessions?.completed || completedSessions}
                </div>
                <div className="text-gray-500">
                  of {progress?.sessions?.total || totalSessions} Sessions
                </div>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">
                  {demonstratedSkills}
                </div>
                <div className="text-gray-500">of {totalSkills} Skills</div>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-purple-600">
                  {enrollment.enrollment.examScore || "-"}
                </div>
                <div className="text-gray-500">
                  Exam Score {enrollment.course?.hasExam ? `(${enrollment.course.examPassScore}% to pass)` : ""}
                </div>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <div
                  className={`text-2xl font-bold ${
                    enrollment.enrollment.examPassedAt
                      ? "text-green-600"
                      : enrollment.enrollment.examScore
                      ? "text-red-600"
                      : "text-gray-400"
                  }`}
                >
                  {enrollment.enrollment.examPassedAt
                    ? "PASS"
                    : enrollment.enrollment.examScore
                    ? "FAIL"
                    : "N/A"}
                </div>
                <div className="text-gray-500">Exam Status</div>
              </div>
            </div>
            {enrollment.course?.hasExam && !enrollment.enrollment.examPassedAt && (
              <div className="mt-4 pt-4 border-t">
                <button
                  onClick={() => setShowExamModal(true)}
                  className="text-blue-600 text-sm hover:underline"
                >
                  + Record Exam Score
                </button>
              </div>
            )}
          </div>

          {/* Student Information */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-semibold">Student Information</h2>
              <Link
                to={`/app/customers/${enrollment.customer?.id}`}
                className="text-blue-600 text-sm hover:underline"
              >
                View Full Profile
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-500">Name</p>
                <p className="font-medium">
                  {enrollment.customer?.firstName} {enrollment.customer?.lastName}
                </p>
              </div>
              <div>
                <p className="text-gray-500">Email</p>
                <p className="font-medium">{enrollment.customer?.email || "N/A"}</p>
              </div>
              <div>
                <p className="text-gray-500">Phone</p>
                <p className="font-medium">{enrollment.customer?.phone || "N/A"}</p>
              </div>
              <div>
                <p className="text-gray-500">Date of Birth</p>
                <p className="font-medium">
                  {enrollment.customer?.dateOfBirth
                    ? formatDate(enrollment.customer.dateOfBirth as string)
                    : "N/A"}
                </p>
              </div>
            </div>
            {/* Existing Certifications */}
            {enrollment.customer?.certifications &&
              Array.isArray(enrollment.customer.certifications) &&
              enrollment.customer.certifications.length > 0 && (
                <div className="mt-4 pt-4 border-t">
                  <p className="text-gray-500 text-sm mb-2">Existing Certifications</p>
                  <div className="flex flex-wrap gap-2">
                    {(enrollment.customer.certifications as Array<{ agency: string; level: string }>).map(
                      (cert, i) => (
                        <span
                          key={i}
                          className="inline-flex px-2 py-1 text-xs bg-blue-50 text-blue-700 rounded"
                        >
                          {cert.agency} {cert.level}
                        </span>
                      )
                    )}
                  </div>
                </div>
              )}
          </div>

          {/* Course Information */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold mb-4">Course Information</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-gray-500">Course</p>
                <Link
                  to={`/app/training/courses/${enrollment.course?.id}`}
                  className="font-medium text-blue-600 hover:underline"
                >
                  {enrollment.course?.name}
                </Link>
              </div>
              <div>
                <p className="text-gray-500">Agency</p>
                <p className="font-medium">{enrollment.agency?.name || "N/A"}</p>
              </div>
              <div>
                <p className="text-gray-500">Certification Level</p>
                <p className="font-medium">{enrollment.level?.name || "N/A"}</p>
              </div>
              <div>
                <p className="text-gray-500">Total Sessions</p>
                <p className="font-medium">{enrollment.course?.totalSessions || 1}</p>
              </div>
              <div>
                <p className="text-gray-500">Has Exam</p>
                <p className="font-medium">{enrollment.course?.hasExam ? "Yes" : "No"}</p>
              </div>
              <div>
                <p className="text-gray-500">Min Open Water Dives</p>
                <p className="font-medium">{enrollment.course?.minOpenWaterDives || "N/A"}</p>
              </div>
            </div>
          </div>

          {/* Skill Checkoffs */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold mb-4">
              Skill Checkoffs ({demonstratedSkills}/{totalSkills})
            </h2>
            {skillCheckoffs.length === 0 ? (
              <p className="text-gray-500 text-sm">
                No skill checkoffs recorded yet. Skills are recorded during training sessions.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b">
                    <tr>
                      <th className="text-left py-2 px-3">Skill</th>
                      <th className="text-left py-2 px-3">Category</th>
                      <th className="text-left py-2 px-3">Status</th>
                      <th className="text-left py-2 px-3">Date</th>
                      <th className="text-left py-2 px-3">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {skillCheckoffs.map((checkoff) => (
                      <tr key={checkoff.id} className="hover:bg-gray-50">
                        <td className="py-2 px-3">{checkoff.skillName}</td>
                        <td className="py-2 px-3 capitalize">{checkoff.skillCategory}</td>
                        <td className="py-2 px-3">
                          <span
                            className={`inline-flex px-2 py-0.5 text-xs rounded-full ${
                              checkoff.status === "demonstrated"
                                ? "bg-green-100 text-green-800"
                                : checkoff.status === "attempted"
                                ? "bg-yellow-100 text-yellow-800"
                                : "bg-gray-100 text-gray-600"
                            }`}
                          >
                            {checkoff.status.replace("_", " ")}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-gray-500">
                          {formatDate(checkoff.checkedOffAt)}
                        </td>
                        <td className="py-2 px-3 text-gray-500 max-w-[200px] truncate">
                          {checkoff.notes || "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Sessions Attended */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-semibold">
                Sessions ({completedSessions}/{sessions.length})
              </h2>
              <Link
                to={`/app/training/sessions?courseId=${enrollment.course?.id}`}
                className="text-blue-600 text-sm hover:underline"
              >
                View All Sessions
              </Link>
            </div>
            {sessions.length === 0 ? (
              <p className="text-gray-500 text-sm">No sessions scheduled for this course.</p>
            ) : (
              <div className="space-y-3">
                {sessions.slice(0, 5).map((item) => (
                  <Link
                    key={item.session.id}
                    to={`/app/training/sessions/${item.session.id}`}
                    className="flex justify-between items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100"
                  >
                    <div>
                      <p className="font-medium">
                        {new Date(item.session.scheduledDate).toLocaleDateString()} at{" "}
                        {item.session.startTime}
                      </p>
                      <p className="text-sm text-gray-500 capitalize">
                        {item.session.sessionType.replace("_", " ")}
                        {item.session.location && ` - ${item.session.location}`}
                      </p>
                    </div>
                    <span
                      className={`text-xs px-2 py-1 rounded-full ${
                        item.session.status === "completed"
                          ? "bg-green-100 text-green-800"
                          : item.session.status === "cancelled"
                          ? "bg-red-100 text-red-800"
                          : item.session.status === "in_progress"
                          ? "bg-purple-100 text-purple-800"
                          : "bg-blue-100 text-blue-800"
                      }`}
                    >
                      {item.session.status.replace("_", " ")}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Payment Information */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-semibold">Payment</h2>
              <span
                className={`inline-flex px-2 py-1 text-xs rounded-full ${currentPaymentStatus.color}`}
              >
                {currentPaymentStatus.label}
              </span>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Total Price</span>
                <span className="font-medium">
                  {formatCurrency(enrollment.enrollment.totalPrice)}
                </span>
              </div>
              {enrollment.enrollment.depositAmount && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Deposit</span>
                  <span className="font-medium">
                    {formatCurrency(enrollment.enrollment.depositAmount)}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-500">Balance Due</span>
                <span
                  className={`font-bold ${
                    parseFloat(enrollment.enrollment.balanceDue || "0") > 0
                      ? "text-red-600"
                      : "text-green-600"
                  }`}
                >
                  {formatCurrency(enrollment.enrollment.balanceDue)}
                </span>
              </div>
              {enrollment.enrollment.depositPaidAt && (
                <div className="flex justify-between text-xs text-gray-400">
                  <span>Deposit Paid</span>
                  <span>{formatDate(enrollment.enrollment.depositPaidAt)}</span>
                </div>
              )}
            </div>
            <button
              onClick={() => setShowPaymentModal(true)}
              className="w-full mt-4 text-center border px-4 py-2 rounded-lg hover:bg-gray-50 text-sm"
            >
              Record Payment
            </button>
          </div>

          {/* Enrollment Timeline */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold mb-4">Timeline</h2>
            <div className="space-y-4 text-sm">
              <div className="flex gap-3">
                <div className="w-2 h-2 rounded-full bg-green-500 mt-1.5" />
                <div>
                  <p className="font-medium">Enrolled</p>
                  <p className="text-gray-500 text-xs">
                    {formatDate(enrollment.enrollment.enrolledAt)}
                  </p>
                </div>
              </div>
              {enrollment.enrollment.startedAt && (
                <div className="flex gap-3">
                  <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5" />
                  <div>
                    <p className="font-medium">Started Training</p>
                    <p className="text-gray-500 text-xs">
                      {formatDate(enrollment.enrollment.startedAt)}
                    </p>
                  </div>
                </div>
              )}
              {enrollment.enrollment.examPassedAt && (
                <div className="flex gap-3">
                  <div className="w-2 h-2 rounded-full bg-purple-500 mt-1.5" />
                  <div>
                    <p className="font-medium">Passed Exam</p>
                    <p className="text-gray-500 text-xs">
                      Score: {enrollment.enrollment.examScore}% -{" "}
                      {formatDate(enrollment.enrollment.examPassedAt)}
                    </p>
                  </div>
                </div>
              )}
              {enrollment.enrollment.completedAt && (
                <div className="flex gap-3">
                  <div className="w-2 h-2 rounded-full bg-teal-500 mt-1.5" />
                  <div>
                    <p className="font-medium">Completed Training</p>
                    <p className="text-gray-500 text-xs">
                      {formatDate(enrollment.enrollment.completedAt)}
                    </p>
                  </div>
                </div>
              )}
              {enrollment.enrollment.certifiedAt && (
                <div className="flex gap-3">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5" />
                  <div>
                    <p className="font-medium">Certified</p>
                    <p className="text-gray-500 text-xs">
                      #{enrollment.enrollment.certificationNumber} -{" "}
                      {formatDate(enrollment.enrollment.certifiedAt)}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Certification Info (if certified) */}
          {enrollment.enrollment.status === "certified" && (
            <div className="bg-green-50 rounded-xl p-6 border border-green-200">
              <h2 className="font-semibold mb-3 text-green-800">Certification</h2>
              <div className="space-y-2 text-sm">
                <div>
                  <p className="text-green-600">Certificate Number</p>
                  <p className="font-bold text-green-900">
                    {enrollment.enrollment.certificationNumber || "N/A"}
                  </p>
                </div>
                <div>
                  <p className="text-green-600">Certification Date</p>
                  <p className="font-medium text-green-900">
                    {formatDate(enrollment.enrollment.certifiedAt)}
                  </p>
                </div>
                <div>
                  <p className="text-green-600">Level</p>
                  <p className="font-medium text-green-900">
                    {enrollment.agency?.name} {enrollment.level?.name}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Instructor Notes */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold mb-3">Instructor Notes</h2>
            <p className="text-sm text-gray-600">
              {enrollment.enrollment.instructorNotes || "No notes yet."}
            </p>
          </div>

          {/* Meta */}
          <div className="text-xs text-gray-400">
            <p>Enrolled {formatDate(enrollment.enrollment.createdAt)}</p>
            <p>Enrollment ID: {enrollment.enrollment.id}</p>
          </div>
        </div>
      </div>

      {/* Update Status Modal */}
      {showStatusModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold mb-4">Update Enrollment Status</h2>
            <fetcher.Form
              method="post"
              onSubmit={() => setShowStatusModal(false)}
            >
              <input type="hidden" name="intent" value="update-status" />
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Status</label>
                  <select
                    name="status"
                    defaultValue={enrollment.enrollment.status}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    {Object.entries(statusConfig).map(([value, { label }]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Instructor Notes (optional)
                  </label>
                  <textarea
                    name="instructorNotes"
                    rows={3}
                    defaultValue={enrollment.enrollment.instructorNotes || ""}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Add any notes about this status change..."
                  />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowStatusModal(false)}
                  className="flex-1 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Update Status
                </button>
              </div>
            </fetcher.Form>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold mb-4">Record Payment</h2>
            <fetcher.Form
              method="post"
              onSubmit={() => setShowPaymentModal(false)}
            >
              <input type="hidden" name="intent" value="record-payment" />
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Payment Type
                  </label>
                  <select
                    name="paymentType"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="deposit">Deposit</option>
                    <option value="partial">Partial Payment</option>
                    <option value="full">Full Payment</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Amount</label>
                  <input
                    type="number"
                    name="paymentAmount"
                    step="0.01"
                    min="0"
                    defaultValue={enrollment.enrollment.balanceDue || "0"}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Balance due: {formatCurrency(enrollment.enrollment.balanceDue)}
                  </p>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="flex-1 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  Record Payment
                </button>
              </div>
            </fetcher.Form>
          </div>
        </div>
      )}

      {/* Record Exam Modal */}
      {showExamModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold mb-4">Record Exam Score</h2>
            <fetcher.Form
              method="post"
              onSubmit={() => setShowExamModal(false)}
            >
              <input type="hidden" name="intent" value="record-exam" />
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Exam Score (%)
                  </label>
                  <input
                    type="number"
                    name="examScore"
                    min="0"
                    max="100"
                    required
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter score 0-100"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Pass score: {enrollment.course?.examPassScore || 75}%
                  </p>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowExamModal(false)}
                  className="flex-1 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                >
                  Record Score
                </button>
              </div>
            </fetcher.Form>
          </div>
        </div>
      )}

      {/* Mark Certified Modal */}
      {showCertifyModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold mb-4">Mark as Certified</h2>
            <fetcher.Form
              method="post"
              onSubmit={() => setShowCertifyModal(false)}
            >
              <input type="hidden" name="intent" value="mark-certified" />
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Certification Number
                  </label>
                  <input
                    type="text"
                    name="certificationNumber"
                    required
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter certification number"
                  />
                </div>
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">
                  This will mark the student as certified for{" "}
                  <strong>
                    {enrollment.agency?.name} {enrollment.level?.name}
                  </strong>
                  .
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowCertifyModal(false)}
                  className="flex-1 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  Mark Certified
                </button>
              </div>
            </fetcher.Form>
          </div>
        </div>
      )}
    </div>
  );
}
