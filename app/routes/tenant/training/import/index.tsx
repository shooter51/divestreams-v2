import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, Form, useActionData, useNavigation, Link } from "react-router";
import React, { useState } from "react";
import { requireOrgContext, requireRole} from "../../../../../lib/auth/org-context.server";
import { getAgencies, createAgency, createCourse, enableCatalogCourse } from "../../../../../lib/db/training.server";
import { getGlobalAgencyCourseTemplates, getAvailableAgencies } from "../../../../../lib/db/training-templates.server";
import { escapeHtml } from "../../../../../lib/security/sanitize";
import { CsrfInput } from "../../../../components/CsrfInput";
import { useT } from "../../../../i18n/use-t";

export async function loader({ request }: LoaderFunctionArgs) {
  const ctx = await requireOrgContext(request);
  requireRole(ctx, ["owner", "admin"]);

  // Get all available agencies from global templates
  const agencies = await getAvailableAgencies();

  return { agencies };
}

export async function action({ request }: ActionFunctionArgs) {
  const orgContext = await requireOrgContext(request);
  requireRole(orgContext, ["owner", "admin"]);

  const formData = await request.formData();
  const step = formData.get("step") as string;

  // CSV Upload Handler
  if (step === "csv-upload") {
    const csvFile = formData.get("csvFile") as File | null;

    if (!csvFile || csvFile.size === 0) {
      return {
        error: "No CSV file was uploaded. Please select a file before clicking Upload CSV.",
        suggestion: "Click 'Choose File' or 'Browse' to select your CSV file, then click 'Upload CSV'."
      };
    }

    try {
      const csvText = await csvFile.text();
      const lines = csvText.trim().split("\n");

      if (lines.length < 2) {
        return {
          error: "The uploaded CSV file appears to be empty or only contains a header row.",
          suggestion: "Make sure your CSV file contains course data rows below the header row."
        };
      }

      // Parse CSV (skip header row)
      const importedCourses: string[] = [];
      const errors: { course: string; reason: string }[] = [];

      // Pre-fetch agencies once outside the loop to avoid N+1 queries
      let existingAgencies = await getAgencies(orgContext.org.id);

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const columns = parseCSVLine(line).map(col => col.trim());

        if (columns.length < 12) {
          errors.push({
            course: `Row ${i + 1}`,
            reason: `Invalid CSV format - expected 12 columns, got ${columns.length}. Make sure all commas are present.`
          });
          continue;
        }

        const [agencyCode, courseName, courseCode, description, durationDays, classroomHours, poolHours, openWaterDives, minAge, prerequisites, price, currency] = columns;

        if (!agencyCode || !courseName) {
          errors.push({
            course: `Row ${i + 1}`,
            reason: "Missing required fields: agency_code and course_name are required."
          });
          continue;
        }

        try {
          // Find or create agency
          let agency = existingAgencies.find(a => a.code.toLowerCase() === agencyCode.toLowerCase());

          if (!agency) {
            agency = await createAgency({
              organizationId: orgContext.org.id,
              name: agencyCode.toUpperCase(),
              code: agencyCode.toLowerCase(),
              isActive: true,
            });
            // Refresh the cached list so subsequent rows find this agency
            existingAgencies = await getAgencies(orgContext.org.id);
          }

          // Check for duplicate course before creating
          const { db } = await import("../../../../../lib/db/index");
          const { getTenantDb } = await import("../../../../../lib/db/tenant.server");
          const { eq, and } = await import("drizzle-orm");
          const { schema: tables } = getTenantDb(orgContext.org.id);

          const [existingCourse] = await db
            .select()
            .from(tables.trainingCourses)
            .where(and(
              eq(tables.trainingCourses.organizationId, orgContext.org.id),
              eq(tables.trainingCourses.agencyId, agency.id),
              eq(tables.trainingCourses.code, courseCode || "")
            ))
            .limit(1);

          if (existingCourse) {
            errors.push({
              course: courseName,
              reason: "This course already exists in your catalog. Skipped."
            });
            continue;
          }

          // Sanitize string fields to prevent stored XSS
          await createCourse({
            organizationId: orgContext.org.id,
            agencyId: agency.id,
            name: escapeHtml(courseName),
            code: escapeHtml(courseCode || ""),
            description: escapeHtml(description || ""),
            durationDays: parseInt(durationDays) || 0,
            classroomHours: classroomHours ? parseInt(classroomHours) : undefined,
            poolHours: poolHours ? parseInt(poolHours) : undefined,
            openWaterDives: openWaterDives ? parseInt(openWaterDives) : undefined,
            minAge: minAge ? parseInt(minAge) : undefined,
            prerequisites: prerequisites ? escapeHtml(prerequisites) : undefined,
            price: price || "0.00",
            currency: currency || "USD",
            isActive: true,
            isPublic: false,
          });

          importedCourses.push(courseName);
        } catch (error) {
          console.error(`Failed to import CSV row ${i + 1}:`, error);
          const errorMessage = error instanceof Error ? error.message : "Unknown error";
          errors.push({
            course: courseName || `Row ${i + 1}`,
            reason: errorMessage.includes("duplicate") || errorMessage.includes("unique")
              ? "This course already exists in your catalog."
              : "Database error while creating course. Please check the CSV format."
          });
        }
      }

      if (errors.length > 0 && importedCourses.length === 0) {
        return {
          error: "None of the courses in the CSV could be imported. See details below.",
          detailedErrors: errors,
          suggestion: "Check that your CSV file matches the template format exactly."
        };
      }

      return {
        success: true,
        step: "complete",
        importedCount: importedCourses.length,
        importedCourses,
        detailedErrors: errors.length > 0 ? errors : undefined,
      };
    } catch (error) {
      console.error("CSV parsing error:", error);
      return {
        error: "Failed to parse the CSV file. Make sure it's a valid CSV format.",
        suggestion: "Download the CSV template again and make sure you're using the correct format."
      };
    }
  }

  // Step 1: User selected an agency - fetch available course templates
  if (step === "select-agency") {
    const agencyCode = formData.get("agencyCode") as string;
    const agencyName = formData.get("agencyName") as string;

    if (!agencyCode) {
      return {
        error: "Please select a certification agency from the dropdown menu to continue.",
        fieldErrors: { agency: "Certification agency is required" }
      };
    }

    // Get templates for this agency from database
    const templates = await getGlobalAgencyCourseTemplates(agencyCode);
    if (!templates || templates.length === 0) {
      return {
        error: `We don't have any course templates available for ${agencyName} yet. This could mean the agency hasn't been set up in the system. Please contact support to add ${agencyName} course templates.`,
        suggestion: "Try selecting a different agency like PADI, SSI, or NAUI which have extensive course catalogs available."
      };
    }

    return {
      success: true,
      step: "select-courses",
      agency: { code: agencyCode, name: agencyName },
      courses: templates.map((template) => ({
        id: `${agencyCode}-${template.code || 'unknown'}`,
        name: template.name,
        code: template.code || '',
        description: template.description || '',
        images: template.images || [],
        durationDays: template.durationDays,
        classroomHours: template.classroomHours ?? 0,
        poolHours: template.poolHours ?? 0,
        openWaterDives: template.openWaterDives ?? 0,
        prerequisites: template.prerequisites || '',
        minAge: template.minAge ?? 0,
        medicalRequirements: template.medicalRequirements || '',
        requiredItems: template.requiredItems || [],
        materialsIncluded: template.materialsIncluded ?? false,
      })),
    };
  }

  // Step 2: User selected courses - show preview
  if (step === "select-courses") {
    const selectedCourseIds = formData.getAll("courses") as string[];
    const agencyCode = formData.get("agencyCode") as string;
    const agencyName = formData.get("agencyName") as string;

    if (selectedCourseIds.length === 0) {
      return {
        error: "Please select at least one course to import by checking the boxes next to the courses you want.",
        fieldErrors: { courses: "At least one course must be selected" },
        suggestion: "You can use the 'Select All' button to quickly select all available courses, or check individual courses one by one."
      };
    }

    // Get the templates again to get full course data
    const templates = await getGlobalAgencyCourseTemplates(agencyCode);
    if (!templates || templates.length === 0) {
      return {
        error: `The course templates for ${agencyName} could not be loaded. This might be a temporary issue.`,
        suggestion: "Please go back and try selecting the agency again. If the problem persists, contact support."
      };
    }

    // Filter to selected courses
    const selectedCourses = templates.filter((template) =>
      selectedCourseIds.includes(`${agencyCode}-${template.code}`)
    );

    return {
      success: true,
      step: "preview",
      agency: { code: agencyCode, name: agencyName },
      selectedCourses: selectedCourses.map(template => ({
        id: `${agencyCode}-${template.code || 'unknown'}`,
        name: template.name,
        code: template.code || '',
      })),
      selectedCount: selectedCourses.length,
    };
  }

  // Step 3: Execute the import
  if (step === "execute-import") {
    const agencyCode = formData.get("agencyCode") as string;
    const agencyName = formData.get("agencyName") as string;
    const courseCodesJson = formData.get("courseCodes") as string;

    if (!agencyCode || !courseCodesJson) {
      return {
        error: "Some required information is missing from your import request. Please start over from the beginning.",
        suggestion: "Click 'Start Over' and go through the import process again step by step."
      };
    }

    const courseCodes: string[] = JSON.parse(courseCodesJson);
    const templates = await getGlobalAgencyCourseTemplates(agencyCode);

    if (!templates || templates.length === 0) {
      return {
        error: `The course templates for ${agencyName} are no longer available. This might be a temporary database issue.`,
        suggestion: "Please try the import again in a few minutes. If the issue continues, contact support."
      };
    }

    // Find or create the agency record for this tenant
    const existingAgencies = await getAgencies(orgContext.org.id);
    let agency = existingAgencies.find(a => a.code.toLowerCase() === agencyCode.toLowerCase());

    if (!agency) {
      // Create the agency for this tenant
      agency = await createAgency({
        organizationId: orgContext.org.id,
        name: agencyName,
        code: agencyCode,
        isActive: true,
      });
    }

    const importedCourses: string[] = [];
    const errors: { course: string; reason: string }[] = [];

    for (const code of courseCodes) {
      const template = templates.find(t => t.code === code);
      if (!template) {
        errors.push({
          course: code,
          reason: `Course template "${code}" could not be found in the database. It may have been removed.`
        });
        continue;
      }

      try {
        // Create a thin reference to the global template (no data copying)
        // Images, name, description, etc. are read from the template at display time
        await enableCatalogCourse({
          organizationId: orgContext.org.id,
          templateId: template.id,
          price: "0.00", // Default price - user will set
          currency: "USD",
          isActive: true,
          isPublic: true, // Catalog courses are public by default; users can unpublish individually
        });

        importedCourses.push(template.name);
      } catch (error) {
        console.error(`Failed to enable ${template.name}:`, error);
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        errors.push({
          course: template.name,
          reason: errorMessage.includes("duplicate") || errorMessage.includes("unique")
            ? "This course already exists in your catalog."
            : "There was a database error while enabling this course. Please try again."
        });
      }
    }

    if (errors.length > 0 && importedCourses.length === 0) {
      return {
        error: "None of the selected courses could be imported. See details below for each course.",
        detailedErrors: errors,
        suggestion: "Some courses may already exist in your catalog. Try importing only new courses, or contact support if you need help."
      };
    }

    return {
      success: true,
      step: "complete",
      importedCount: importedCourses.length,
      importedCourses,
      detailedErrors: errors.length > 0 ? errors : undefined,
    };
  }

  return {
    error: "An unexpected error occurred during the import process.",
    suggestion: "Please start over and try again. If the problem continues, contact support."
  };
}

export default function TrainingImportPage() {
  const t = useT();
  const { agencies } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  // Determine current step from action data
  const currentStep = actionData?.step || "select-agency";

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-4">
        <Link to="/tenant/training" className="text-brand hover:underline text-sm">
          &larr; {t("tenant.training.backToTraining")}
        </Link>
      </div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">{t("tenant.training.import.title")}</h1>
        <p className="text-foreground-muted">
          {t("tenant.training.import.subtitle")}
        </p>

        {/* CSV Upload Section */}
        <div className="mt-4 p-4 bg-brand-muted border border-brand rounded-lg">
          <h3 className="font-medium text-brand mb-3">{t("tenant.training.import.csvTitle")}</h3>
          <p className="text-sm text-brand mb-4">
            {t("tenant.training.import.csvDescription")}
          </p>
          <div className="flex gap-3">
            <a
              href="/templates/training-courses-import-template.csv"
              download
              className="px-4 py-2 bg-surface-raised text-brand border border-brand rounded-lg hover:bg-brand-muted transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              {t("tenant.training.import.downloadTemplate")}
            </a>
            <Form method="post" encType="multipart/form-data" className="flex-1 flex gap-2">
              <CsrfInput />
              <input type="hidden" name="step" value="csv-upload" />
              <input
                type="file"
                name="csvFile"
                accept=".csv"
                className="flex-1 px-3 py-2 border border-brand rounded-lg bg-surface-raised text-sm file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:text-sm file:font-medium file:bg-brand file:text-white hover:file:bg-brand-hover"
                required
              />
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand-hover transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                {t("tenant.training.import.uploadCsv")}
              </button>
            </Form>
          </div>
          <p className="text-xs text-brand mt-2 italic">
            {t("tenant.training.import.csvFormat")}
          </p>
        </div>
        {/* Note: Images are now managed globally on templates via admin portal */}
      </div>

      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          <Step number={1} title={t("tenant.training.import.step.selectAgency")} active={currentStep === "select-agency"} completed={currentStep !== "select-agency"} />
          <div className="flex-1 h-1 bg-surface-overlay mx-2">
            <div className={`h-full transition-all ${currentStep !== "select-agency" ? "bg-brand" : "bg-surface-overlay"}`} />
          </div>
          <Step number={2} title={t("tenant.training.import.step.chooseCourses")} active={currentStep === "select-courses"} completed={currentStep === "preview" || currentStep === "complete"} />
          <div className="flex-1 h-1 bg-surface-overlay mx-2">
            <div className={`h-full transition-all ${currentStep === "preview" || currentStep === "complete" ? "bg-brand" : "bg-surface-overlay"}`} />
          </div>
          <Step number={3} title={t("tenant.training.import.step.import")} active={currentStep === "preview" || currentStep === "complete"} completed={currentStep === "complete"} />
        </div>
      </div>

      {/* Error Display */}
      {actionData?.error && (
        <div className="mb-6 bg-danger-muted border border-danger rounded-lg p-4 max-w-4xl break-words">
          <div className="flex items-start gap-2">
            <span className="text-danger font-bold text-xl">⚠</span>
            <div className="flex-1">
              <h3 className="font-semibold text-danger mb-1">{t("tenant.training.import.importError")}</h3>
              <p className="text-danger text-sm mb-2">{actionData.error}</p>
              {actionData.suggestion && (
                <p className="text-danger-hover text-sm italic">💡 {actionData.suggestion}</p>
              )}
              {actionData.detailedErrors && actionData.detailedErrors.length > 0 && (
                <div className="mt-3 space-y-2">
                  <p className="text-danger text-sm font-medium">{t("tenant.training.import.courseErrors")}:</p>
                  {actionData.detailedErrors.map((err: { course: string; reason: string }, idx: number) => (
                    <div key={idx} className="bg-surface-raised rounded p-2 text-sm">
                      <span className="font-medium text-foreground">{err.course}:</span>
                      <span className="text-foreground-muted ml-2">{err.reason}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Step Content */}
      <div className="bg-surface-raised rounded-lg shadow-lg p-8">
        {currentStep === "select-agency" && (
          <SelectAgencyStep agencies={agencies} isSubmitting={isSubmitting} />
        )}

        {currentStep === "select-courses" && actionData?.courses && actionData?.agency && (
          <SelectCoursesStep
            courses={actionData.courses}
            agency={actionData.agency}
            isSubmitting={isSubmitting}
          />
        )}

        {currentStep === "preview" && actionData?.selectedCourses && actionData?.agency && (
          <PreviewStep
            selectedCourses={actionData.selectedCourses}
            agency={actionData.agency}
            isSubmitting={isSubmitting}
          />
        )}

        {currentStep === "complete" && (
          <CompleteStep
            importedCount={actionData?.importedCount || 0}
            importedCourses={actionData?.importedCourses || []}
            detailedErrors={actionData?.detailedErrors}
          />
        )}
      </div>
    </div>
  );
}

function Step({ number, title, active, completed }: { number: number; title: string; active: boolean; completed: boolean }) {
  return (
    <div className="flex flex-col items-center">
      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-colors ${
        completed ? "bg-success text-white" :
        active ? "bg-brand text-white" :
        "bg-surface-overlay text-foreground-muted"
      }`}>
        {completed ? "✓" : number}
      </div>
      <span className={`text-sm mt-2 ${active ? "text-brand font-medium" : "text-foreground-muted"}`}>
        {title}
      </span>
    </div>
  );
}

function SelectAgencyStep({ agencies, isSubmitting }: { agencies: Array<{ code: string | null; name: string; description?: string }>; isSubmitting: boolean }) {
  const t = useT();
  const [selectedAgency, setSelectedAgency] = React.useState<string>("");

  const handleAgencyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedAgency(e.target.value);
  };

  const selectedAgencyData = agencies.find(a => a.code === selectedAgency && a.code !== null);

  return (
    <div>
      <h2 className="text-2xl font-semibold mb-4">{t("tenant.training.import.step1Title")}</h2>
      <p className="text-foreground-muted mb-6">
        {t("tenant.training.import.step1Description")}
      </p>

      <Form method="post" className="max-w-md">
        <CsrfInput />
        <input type="hidden" name="step" value="select-agency" />
        <input type="hidden" name="agencyCode" value={selectedAgency} />
        <input type="hidden" name="agencyName" value={selectedAgencyData?.name || ""} />

        <div className="space-y-4">
          <div>
            <label htmlFor="agencySelect" className="block text-sm font-medium mb-2">
              {t("tenant.training.import.certificationAgency")} *
            </label>
            <select
              id="agencySelect"
              value={selectedAgency}
              onChange={handleAgencyChange}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-brand focus:border-brand"
              required
              disabled={isSubmitting}
            >
              <option value="">{t("tenant.training.import.selectAgency")}</option>
              {agencies.filter(a => a.code !== null).map((agency) => (
                <option key={agency.code!} value={agency.code!}>
                  {agency.name}
                </option>
              ))}
            </select>
            {selectedAgencyData?.description && (
              <p className="text-sm text-foreground-muted mt-2">
                {selectedAgencyData.description}
              </p>
            )}
          </div>

          <div className="pt-4">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-brand text-white px-6 py-3 rounded-lg hover:bg-brand-hover transition-colors font-medium disabled:bg-brand-disabled"
            >
              {isSubmitting ? t("tenant.training.import.loadingCourses") : t("tenant.training.import.nextSelectCourses")}
            </button>
          </div>
        </div>
      </Form>
    </div>
  );
}

function SelectCoursesStep({
  courses,
  agency,
  isSubmitting
}: {
  courses: Array<{
    id: string;
    name: string;
    code: string;
    description: string;
    durationDays: number;
    openWaterDives: number;
    minAge: number;
  }>;
  agency: { code: string; name: string };
  isSubmitting: boolean;
}) {
  const t = useT();
  const [selectedCourses, setSelectedCourses] = useState<Set<string>>(new Set());

  const toggleCourse = (courseId: string) => {
    setSelectedCourses(prev => {
      const next = new Set(prev);
      if (next.has(courseId)) {
        next.delete(courseId);
      } else {
        next.add(courseId);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelectedCourses(new Set(courses.map(c => c.id)));
  };

  const selectNone = () => {
    setSelectedCourses(new Set());
  };

  return (
    <div>
      <h2 className="text-2xl font-semibold mb-2">{t("tenant.training.import.step2Title")}</h2>
      <p className="text-foreground-muted mb-6">
        {t("tenant.training.import.step2Description", { agency: agency.name })}
      </p>

      <div className="mb-4 flex gap-2">
        <button
          type="button"
          onClick={selectAll}
          className="px-3 py-1 text-sm bg-surface-inset hover:bg-surface-overlay rounded"
        >
          {t("tenant.training.import.selectAll")}
        </button>
        <button
          type="button"
          onClick={selectNone}
          className="px-3 py-1 text-sm bg-surface-inset hover:bg-surface-overlay rounded"
        >
          {t("tenant.training.import.selectNone")}
        </button>
        <span className="ml-auto text-sm text-foreground-muted">
          {t("tenant.training.import.selectedOfTotal", { selected: selectedCourses.size, total: courses.length })}
        </span>
      </div>

      <Form method="post">
        <CsrfInput />
        <input type="hidden" name="step" value="select-courses" />
        <input type="hidden" name="agencyCode" value={agency.code} />
        <input type="hidden" name="agencyName" value={agency.name} />

        <div className="space-y-3 mb-6 max-h-96 overflow-y-auto">
          {courses.map((course) => (
            <label
              key={course.id}
              className={`block p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                selectedCourses.has(course.id)
                  ? "border-brand bg-brand-muted"
                  : "border-border hover:border-border-strong"
              }`}
            >
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  name="courses"
                  value={course.id}
                  checked={selectedCourses.has(course.id)}
                  onChange={() => toggleCourse(course.id)}
                  className="mt-1 w-5 h-5 text-brand"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{course.name}</h3>
                    <span className="text-xs bg-surface-inset px-2 py-1 rounded">{course.code}</span>
                  </div>
                  <p className="text-sm text-foreground-muted mt-1">{course.description}</p>
                  <div className="flex gap-4 mt-2 text-xs text-foreground-muted">
                    <span>{t("tenant.training.import.durationDays", { count: course.durationDays })}</span>
                    <span>{t("tenant.training.import.openWaterDives", { count: course.openWaterDives })}</span>
                    <span>{t("tenant.training.import.minAge", { age: course.minAge })}</span>
                  </div>
                </div>
              </div>
            </label>
          ))}
        </div>

        <div className="flex gap-3">
          <a
            href="/tenant/training/import"
            className="px-6 py-3 border border-border-strong rounded-lg hover:bg-surface-inset transition-colors text-center"
          >
            ← {t("common.back")}
          </a>
          <button
            type="submit"
            disabled={selectedCourses.size === 0 || isSubmitting}
            className="flex-1 bg-brand text-white px-6 py-3 rounded-lg hover:bg-brand-hover transition-colors font-medium disabled:bg-surface-overlay disabled:cursor-not-allowed"
          >
            {isSubmitting ? t("tenant.training.import.loadingPreview") : t("tenant.training.import.previewImport", { count: selectedCourses.size })}
          </button>
        </div>
      </Form>
    </div>
  );
}

function PreviewStep({
  selectedCourses,
  agency,
  isSubmitting
}: {
  selectedCourses: Array<{
    id: string;
    name: string;
    code: string;
  }>;
  agency: { code: string; name: string };
  isSubmitting: boolean;
}) {
  const t = useT();
  return (
    <div>
      <h2 className="text-2xl font-semibold mb-2">{t("tenant.training.import.step3Title")}</h2>
      <p className="text-foreground-muted mb-6">
        {t("tenant.training.import.step3Description", { count: selectedCourses.length, agency: agency.name })}
      </p>

      <div className="bg-brand-muted border border-brand rounded-lg p-4 mb-6">
        <h3 className="font-medium text-brand mb-2">{t("tenant.training.import.whatWillHappen")}:</h3>
        <ul className="space-y-2 text-sm text-brand">
          <li className="flex items-start gap-2">
            <span className="text-brand mt-0.5">✓</span>
            <span>{t("tenant.training.import.willAddTemplates", { count: selectedCourses.length })}</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-brand mt-0.5">✓</span>
            <span>{t("tenant.training.import.willCreateDrafts")}</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-brand mt-0.5">✓</span>
            <span>{t("tenant.training.import.willCustomize")}</span>
          </li>
        </ul>
      </div>

      <div className="mb-6">
        <h3 className="font-medium mb-3">{t("tenant.training.import.coursesToImport")}:</h3>
        <ul className="space-y-2 text-sm">
          {selectedCourses.map((course) => (
            <li key={course.id} className="flex items-center gap-2 p-2 bg-surface-inset rounded">
              <span className="font-mono text-xs bg-surface-overlay px-2 py-0.5 rounded">{course.code}</span>
              <span>{course.name}</span>
            </li>
          ))}
        </ul>
      </div>

      <Form method="post" className="space-y-4">
        <CsrfInput />
        <input type="hidden" name="step" value="execute-import" />
        <input type="hidden" name="agencyCode" value={agency.code} />
        <input type="hidden" name="agencyName" value={agency.name} />
        <input type="hidden" name="courseCodes" value={JSON.stringify(selectedCourses.map(c => c.code))} />

        <div className="flex gap-3">
          <a
            href="/tenant/training/import"
            className="px-6 py-3 border border-border-strong rounded-lg hover:bg-surface-inset transition-colors text-center"
          >
            ← {t("tenant.training.import.startOver")}
          </a>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 bg-success text-white px-6 py-3 rounded-lg hover:bg-success-hover transition-colors font-medium disabled:bg-success-muted flex items-center justify-center gap-2"
          >
            {isSubmitting && (
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            )}
            {isSubmitting ? t("tenant.training.import.importingCourses") : t("tenant.training.import.importCourses", { count: selectedCourses.length })}
          </button>
        </div>
      </Form>
    </div>
  );
}

function CompleteStep({
  importedCount,
  importedCourses,
  detailedErrors
}: {
  importedCount: number;
  importedCourses: string[];
  detailedErrors?: Array<{ course: string; reason: string }>;
}) {
  const t = useT();
  return (
    <div className="text-center">
      <div className="w-20 h-20 bg-success-muted rounded-full flex items-center justify-center mx-auto mb-6">
        <span className="text-4xl text-success">✓</span>
      </div>

      <h2 className="text-2xl font-semibold mb-2">{t("tenant.training.import.importComplete")}</h2>
      <p className="text-foreground-muted mb-6">
        {t("tenant.training.import.successfullyImported", { count: importedCount })}
      </p>

      {detailedErrors && detailedErrors.length > 0 && (
        <div className="bg-warning-muted border border-warning rounded-lg max-w-4xl break-words p-4 mb-6 text-left">
          <div className="flex items-start gap-2 mb-3">
            <span className="text-warning">⚠</span>
            <h3 className="font-medium text-warning">{t("tenant.training.import.someCoursesNotImported")}:</h3>
          </div>
          <div className="space-y-2">
            {detailedErrors.map((error, i) => (
              <div key={i} className="bg-surface-raised rounded p-3">
                <p className="text-sm font-medium text-foreground mb-1">{error.course}</p>
                <p className="text-xs text-foreground-muted">{error.reason}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-surface-inset rounded-lg p-4 mb-6 text-left">
        <h3 className="font-medium mb-2">{t("tenant.training.import.importedCourses")}:</h3>
        <ul className="text-sm space-y-1">
          {importedCourses.map((name, i) => (
            <li key={i} className="flex items-center gap-2">
              <span className="text-success">✓</span>
              {name}
            </li>
          ))}
        </ul>
      </div>

      <div className="bg-brand-muted border border-brand rounded-lg p-4 mb-6">
        <h3 className="font-medium text-brand mb-2">{t("tenant.training.import.nextSteps")}:</h3>
        <ul className="text-sm text-brand text-left space-y-1">
          <li>1. {t("tenant.training.import.nextStep1")}</li>
          <li>2. {t("tenant.training.import.nextStep2")}</li>
          <li>3. {t("tenant.training.import.nextStep3")}</li>
          <li>4. {t("tenant.training.import.nextStep4")}</li>
        </ul>
      </div>

      <div className="flex gap-3 justify-center">
        <a
          href="/tenant/training/courses"
          className="bg-brand text-white px-6 py-3 rounded-lg hover:bg-brand-hover transition-colors font-medium"
        >
          {t("tenant.training.import.viewCourses")} →
        </a>
        <a
          href="/tenant/training/import"
          className="px-6 py-3 border border-border-strong rounded-lg hover:bg-surface-inset transition-colors"
        >
          {t("tenant.training.import.importMore")}
        </a>
      </div>
    </div>
  );
}

/**
 * RFC 4180 compliant CSV parser that handles quoted fields and embedded commas
 * Copied from products.tsx to ensure consistent CSV parsing across the codebase
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
}
