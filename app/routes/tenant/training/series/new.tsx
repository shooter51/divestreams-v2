import type { MetaFunction, LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { redirect, useLoaderData, useActionData, useNavigation, Link } from "react-router";
import { useState } from "react";
import { requireOrgContext, requireRole } from "../../../../../lib/auth/org-context.server";
import { getCourses, createSeries } from "../../../../../lib/db/training.server";
import { redirectWithNotification } from "../../../../../lib/use-notification";
import { CsrfInput } from "../../../../components/CsrfInput";
import { useT } from "../../../../i18n/use-t";

export const meta: MetaFunction = () => [{ title: "New Training Series - DiveStreams" }];

export async function loader({ request }: LoaderFunctionArgs) {
  const ctx = await requireOrgContext(request);
  requireRole(ctx, ["owner", "admin"]);
  const courses = await getCourses(ctx.org.id);
  return { courses };
}

export async function action({ request }: ActionFunctionArgs) {
  const ctx = await requireOrgContext(request);
  requireRole(ctx, ["owner", "admin"]);
  const formData = await request.formData();

  const name = formData.get("name") as string;
  const courseId = formData.get("courseId") as string;
  const maxStudents = formData.get("maxStudents") as string;
  const priceOverride = formData.get("priceOverride") as string;
  const instructorName = formData.get("instructorName") as string;
  const notes = formData.get("notes") as string;

  const errors: Record<string, string> = {};
  if (!name) errors.name = "Series name is required";
  if (!courseId) errors.courseId = "Please select a course";

  if (Object.keys(errors).length > 0) {
    return { errors };
  }

  // Parse dynamic session rows
  const sessions: Array<{
    startDate: string;
    endDate?: string;
    startTime?: string;
    location?: string;
    meetingPoint?: string;
    sessionType?: string;
  }> = [];
  let i = 0;
  while (formData.get(`sessions[${i}].startDate`)) {
    sessions.push({
      startDate: formData.get(`sessions[${i}].startDate`) as string,
      endDate: (formData.get(`sessions[${i}].endDate`) as string) || undefined,
      startTime: (formData.get(`sessions[${i}].startTime`) as string) || undefined,
      location: (formData.get(`sessions[${i}].location`) as string) || undefined,
      meetingPoint: (formData.get(`sessions[${i}].meetingPoint`) as string) || undefined,
      sessionType: (formData.get(`sessions[${i}].sessionType`) as string) || undefined,
    });
    i++;
  }

  await createSeries({
    organizationId: ctx.org.id,
    courseId,
    name,
    maxStudents: maxStudents ? parseInt(maxStudents) : undefined,
    priceOverride: priceOverride || undefined,
    instructorName: instructorName || undefined,
    notes: notes || undefined,
    status: "scheduled",
    sessions,
  });

  return redirect(redirectWithNotification("/tenant/training/series", "Series has been successfully created", "success"));
}

// SESSION_TYPES moved inside component for i18n

interface SessionRow {
  id: number;
  startDate: string;
  endDate: string;
  startTime: string;
  location: string;
  meetingPoint: string;
  sessionType: string;
}

export default function NewSeriesPage() {
  const t = useT();
  const { courses } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const SESSION_TYPES = [
    { value: "", label: t("tenant.training.series.notSpecified") },
    { value: "classroom", label: t("tenant.training.series.sessionTypeClassroom") },
    { value: "pool", label: t("tenant.training.series.sessionTypePool") },
    { value: "confined_water", label: t("tenant.training.series.sessionTypeConfinedWater") },
    { value: "open_water", label: t("tenant.training.series.sessionTypeOpenWater") },
    { value: "exam", label: t("tenant.training.series.sessionTypeExam") },
    { value: "other", label: t("tenant.training.series.sessionTypeOther") },
  ];

  const [sessionRows, setSessionRows] = useState<SessionRow[]>([]);
  const [nextId, setNextId] = useState(0);

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const defaultDate = tomorrow.toISOString().split("T")[0];

  const addSession = () => {
    setSessionRows((prev) => [
      ...prev,
      { id: nextId, startDate: defaultDate, endDate: "", startTime: "", location: "", meetingPoint: "", sessionType: "" },
    ]);
    setNextId((n) => n + 1);
  };

  const removeSession = (id: number) => {
    setSessionRows((prev) => prev.filter((row) => row.id !== id));
  };

  const updateSession = (id: number, field: keyof Omit<SessionRow, "id">, value: string) => {
    setSessionRows((prev) =>
      prev.map((row) => (row.id === id ? { ...row, [field]: value } : row))
    );
  };

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <Link to="/tenant/training/series" className="text-brand hover:underline text-sm">
          &larr; {t("tenant.training.series.backToSeries")}
        </Link>
        <h1 className="text-2xl font-bold mt-2">{t("tenant.training.series.createTrainingSeries")}</h1>
      </div>

      <form method="post" className="space-y-6">
        <CsrfInput />

        {/* Series Info */}
        <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">{t("tenant.training.series.seriesInformation")}</h2>

          <div className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium mb-1">
                {t("tenant.training.series.seriesName")} *
              </label>
              <input
                type="text"
                id="name"
                name="name"
                required
                placeholder={t("tenant.training.series.seriesNamePlaceholder")}
                className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
              />
              {actionData?.errors?.name && (
                <p className="text-danger text-sm mt-1">{actionData.errors.name}</p>
              )}
            </div>

            <div>
              <label htmlFor="courseId" className="block text-sm font-medium mb-1">
                {t("tenant.training.series.course")} *
              </label>
              <select
                id="courseId"
                name="courseId"
                required
                className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
              >
                <option value="">{t("tenant.training.series.chooseCourse")}</option>
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.name} {course.agencyName ? `(${course.agencyName})` : ""}
                  </option>
                ))}
              </select>
              {actionData?.errors?.courseId && (
                <p className="text-danger text-sm mt-1">{actionData.errors.courseId}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="maxStudents" className="block text-sm font-medium mb-1">
                  {t("tenant.training.series.maxStudents")}
                </label>
                <input
                  type="number"
                  id="maxStudents"
                  name="maxStudents"
                  min="1"
                  placeholder="8"
                  className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
                />
              </div>

              <div>
                <label htmlFor="priceOverride" className="block text-sm font-medium mb-1">
                  {t("tenant.training.series.priceOverride")}
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-foreground-muted">$</span>
                  <input
                    type="number"
                    id="priceOverride"
                    name="priceOverride"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    className="w-full pl-7 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
                  />
                </div>
                <p className="text-xs text-foreground-muted mt-1">{t("tenant.training.series.priceOverrideHint")}</p>
              </div>
            </div>

            <div>
              <label htmlFor="instructorName" className="block text-sm font-medium mb-1">
                {t("tenant.training.series.instructorName")}
              </label>
              <input
                type="text"
                id="instructorName"
                name="instructorName"
                placeholder={t("tenant.training.series.instructorNamePlaceholder")}
                className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
              />
            </div>

            <div>
              <label htmlFor="notes" className="block text-sm font-medium mb-1">
                {t("common.notes")}
              </label>
              <textarea
                id="notes"
                name="notes"
                rows={3}
                placeholder={t("tenant.training.series.notesPlaceholder")}
                className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
              />
            </div>
          </div>
        </div>

        {/* Sessions */}
        <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-semibold">{t("tenant.training.series.sessions")} ({sessionRows.length})</h2>
            <button
              type="button"
              onClick={addSession}
              className="px-3 py-1.5 text-sm bg-brand text-white rounded-lg hover:bg-brand-hover"
            >
              {t("tenant.training.series.addSession")}
            </button>
          </div>

          {sessionRows.length === 0 ? (
            <p className="text-foreground-muted text-sm text-center py-4">
              {t("tenant.training.series.noSessionsAddedYet")}
            </p>
          ) : (
            <div className="space-y-4">
              {sessionRows.map((row, idx) => (
                <div key={row.id} className="border border-border-strong rounded-lg p-4 relative">
                  <div className="flex justify-between items-center mb-3">
                    <p className="text-sm font-medium text-foreground-muted">{t("tenant.training.series.sessionNumber", { number: idx + 1 })}</p>
                    <button
                      type="button"
                      onClick={() => removeSession(row.id)}
                      className="text-danger text-sm hover:underline"
                    >
                      {t("tenant.training.series.remove")}
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium mb-1">{t("tenant.training.series.sessionType")}</label>
                      <select
                        name={`sessions[${idx}].sessionType`}
                        value={row.sessionType}
                        onChange={(e) => updateSession(row.id, "sessionType", e.target.value)}
                        className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand text-sm"
                      >
                        {SESSION_TYPES.map((st) => (
                          <option key={st.value} value={st.value}>{st.label}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium mb-1">{t("tenant.training.series.startDate")} *</label>
                      <input
                        type="date"
                        name={`sessions[${idx}].startDate`}
                        value={row.startDate}
                        onChange={(e) => updateSession(row.id, "startDate", e.target.value)}
                        required
                        className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium mb-1">{t("tenant.training.series.startTime")}</label>
                      <input
                        type="time"
                        name={`sessions[${idx}].startTime`}
                        value={row.startTime}
                        onChange={(e) => updateSession(row.id, "startTime", e.target.value)}
                        className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium mb-1">{t("tenant.training.series.endDate")}</label>
                      <input
                        type="date"
                        name={`sessions[${idx}].endDate`}
                        value={row.endDate}
                        onChange={(e) => updateSession(row.id, "endDate", e.target.value)}
                        className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium mb-1">{t("tenant.training.series.location")}</label>
                      <input
                        type="text"
                        name={`sessions[${idx}].location`}
                        value={row.location}
                        onChange={(e) => updateSession(row.id, "location", e.target.value)}
                        placeholder={t("tenant.training.series.locationPlaceholder")}
                        className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium mb-1">{t("tenant.training.series.meetingPoint")}</label>
                      <input
                        type="text"
                        name={`sessions[${idx}].meetingPoint`}
                        value={row.meetingPoint}
                        onChange={(e) => updateSession(row.id, "meetingPoint", e.target.value)}
                        placeholder={t("tenant.training.series.meetingPointPlaceholder")}
                        className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand text-sm"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={isSubmitting}
            className="bg-brand text-white px-6 py-2 rounded-lg hover:bg-brand-hover disabled:bg-brand-disabled"
          >
            {isSubmitting ? t("common.creating") : t("tenant.training.series.createSeries")}
          </button>
          <Link
            to="/tenant/training/series"
            className="px-6 py-2 border rounded-lg hover:bg-surface-inset"
          >
            {t("common.cancel")}
          </Link>
        </div>
      </form>
    </div>
  );
}
