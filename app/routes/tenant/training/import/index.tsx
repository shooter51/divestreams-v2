import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, Form, useActionData, useNavigation } from "react-router";
import React, { useState } from "react";
import { requireOrgContext } from "../../../../../lib/auth/org-context.server";
import { getAgencies, createAgency, createCourse } from "../../../../../lib/db/training.server";
import { getGlobalAgencyCourseTemplates, getAvailableAgencies } from "../../../../../lib/db/training-templates.server";

export async function loader({ request }: LoaderFunctionArgs) {
  await requireOrgContext(request);

  // Get all available agencies from global templates
  const agencies = await getAvailableAgencies();

  return { agencies };
}

export async function action({ request }: ActionFunctionArgs) {
  const orgContext = await requireOrgContext(request);

  const formData = await request.formData();
  const step = formData.get("step") as string;

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
        const course = await createCourse({
          organizationId: orgContext.org.id,
          agencyId: agency.id,
          name: template.name,
          code: template.code || "",
          description: template.description || "",
          durationDays: template.durationDays,
          classroomHours: template.classroomHours ?? undefined,
          poolHours: template.poolHours ?? undefined,
          openWaterDives: template.openWaterDives ?? undefined,
          minAge: template.minAge ?? undefined,
          prerequisites: template.prerequisites ?? undefined,
          medicalRequirements: template.medicalRequirements ?? undefined,
          materialsIncluded: template.materialsIncluded ?? undefined,
          requiredItems: template.requiredItems ?? undefined,
          price: "0.00", // Default price - user will set
          currency: "USD",
          isActive: true,
          isPublic: false, // Default to private - user will publish
        });
        importedCourses.push(course.name);
      } catch (error) {
        console.error(`Failed to import ${template.name}:`, error);
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        errors.push({
          course: template.name,
          reason: errorMessage.includes("duplicate") || errorMessage.includes("unique")
            ? "This course already exists in your catalog."
            : "There was a database error while creating this course. Please try again."
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
  const { agencies } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  // Determine current step from action data
  const currentStep = actionData?.step || "select-agency";

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Import Training Courses</h1>
        <p className="text-foreground-muted">
          Import course templates from certification agencies to quickly populate your course catalog
        </p>

        {/* CSV Template Download */}
        <div className="mt-4 p-4 bg-brand-muted border border-brand rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium text-brand">Need to import custom courses?</h3>
              <p className="text-sm text-brand mt-1">
                Download our CSV template to bulk import your own training courses
              </p>
            </div>
            <a
              href="/templates/training-courses-import-template.csv"
              download
              className="px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand-hover transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Download CSV Template
            </a>
          </div>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          <Step number={1} title="Select Agency" active={currentStep === "select-agency"} completed={currentStep !== "select-agency"} />
          <div className="flex-1 h-1 bg-surface-overlay mx-2">
            <div className={`h-full transition-all ${currentStep !== "select-agency" ? "bg-brand" : "bg-surface-overlay"}`} />
          </div>
          <Step number={2} title="Choose Courses" active={currentStep === "select-courses"} completed={currentStep === "preview" || currentStep === "complete"} />
          <div className="flex-1 h-1 bg-surface-overlay mx-2">
            <div className={`h-full transition-all ${currentStep === "preview" || currentStep === "complete" ? "bg-brand" : "bg-surface-overlay"}`} />
          </div>
          <Step number={3} title="Import" active={currentStep === "preview" || currentStep === "complete"} completed={currentStep === "complete"} />
        </div>
      </div>

      {/* Error Display */}
      {actionData?.error && (
        <div className="mb-6 bg-danger-muted border border-danger rounded-lg p-4">
          <div className="flex items-start gap-2">
            <span className="text-danger font-bold text-xl">⚠</span>
            <div className="flex-1">
              <h3 className="font-semibold text-danger mb-1">Import Error</h3>
              <p className="text-danger text-sm mb-2">{actionData.error}</p>
              {actionData.suggestion && (
                <p className="text-danger-hover text-sm italic">💡 {actionData.suggestion}</p>
              )}
              {actionData.detailedErrors && actionData.detailedErrors.length > 0 && (
                <div className="mt-3 space-y-2">
                  <p className="text-danger text-sm font-medium">Course-specific errors:</p>
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
        completed ? "bg-green-600 text-white" :
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

function SelectAgencyStep({ agencies, isSubmitting }: { agencies: Array<{ code: string; name: string; description?: string }>; isSubmitting: boolean }) {
  const [selectedAgency, setSelectedAgency] = React.useState<string>("");

  const handleAgencyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedAgency(e.target.value);
  };

  const selectedAgencyData = agencies.find(a => a.code === selectedAgency);

  return (
    <div>
      <h2 className="text-2xl font-semibold mb-4">Step 1: Select Certification Agency</h2>
      <p className="text-foreground-muted mb-6">
        Choose the certification agency whose courses you want to import. We support 10 major certification agencies with 680+ course templates.
      </p>

      <Form method="post" className="max-w-md">
        <input type="hidden" name="step" value="select-agency" />
        <input type="hidden" name="agencyCode" value={selectedAgency} />
        <input type="hidden" name="agencyName" value={selectedAgencyData?.name || ""} />

        <div className="space-y-4">
          <div>
            <label htmlFor="agencySelect" className="block text-sm font-medium mb-2">
              Certification Agency *
            </label>
            <select
              id="agencySelect"
              value={selectedAgency}
              onChange={handleAgencyChange}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-brand focus:border-brand"
              required
              disabled={isSubmitting}
            >
              <option value="">Select an agency...</option>
              {agencies.map((agency) => (
                <option key={agency.code} value={agency.code}>
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
              {isSubmitting ? "Loading courses..." : "Next: Select Courses →"}
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
      <h2 className="text-2xl font-semibold mb-2">Step 2: Choose Courses to Import</h2>
      <p className="text-foreground-muted mb-6">
        Select which courses from <span className="font-medium">{agency.name}</span> you'd like to import into your catalog
      </p>

      <div className="mb-4 flex gap-2">
        <button
          type="button"
          onClick={selectAll}
          className="px-3 py-1 text-sm bg-surface-inset hover:bg-surface-overlay rounded"
        >
          Select All
        </button>
        <button
          type="button"
          onClick={selectNone}
          className="px-3 py-1 text-sm bg-surface-inset hover:bg-surface-overlay rounded"
        >
          Select None
        </button>
        <span className="ml-auto text-sm text-foreground-muted">
          {selectedCourses.size} of {courses.length} selected
        </span>
      </div>

      <Form method="post">
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
                    <span>{course.durationDays} days</span>
                    <span>{course.openWaterDives} open water dives</span>
                    <span>Min age: {course.minAge}</span>
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
            ← Back
          </a>
          <button
            type="submit"
            disabled={selectedCourses.size === 0 || isSubmitting}
            className="flex-1 bg-brand text-white px-6 py-3 rounded-lg hover:bg-brand-hover transition-colors font-medium disabled:bg-surface-overlay disabled:cursor-not-allowed"
          >
            {isSubmitting ? "Loading preview..." : `Preview Import (${selectedCourses.size} courses) →`}
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
  return (
    <div>
      <h2 className="text-2xl font-semibold mb-2">Step 3: Preview & Import</h2>
      <p className="text-foreground-muted mb-6">
        Ready to import {selectedCourses.length} courses from {agency.name} into your catalog
      </p>

      <div className="bg-brand-muted border border-brand rounded-lg p-4 mb-6">
        <h3 className="font-medium text-brand mb-2">What will happen:</h3>
        <ul className="space-y-2 text-sm text-brand">
          <li className="flex items-start gap-2">
            <span className="text-brand mt-0.5">✓</span>
            <span>{selectedCourses.length} course templates will be added to your catalog</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-brand mt-0.5">✓</span>
            <span>Courses will be created as drafts (not public) with $0 price</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-brand mt-0.5">✓</span>
            <span>You can customize pricing, schedule, and settings for each course after import</span>
          </li>
        </ul>
      </div>

      <div className="mb-6">
        <h3 className="font-medium mb-3">Courses to import:</h3>
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
        <input type="hidden" name="step" value="execute-import" />
        <input type="hidden" name="agencyCode" value={agency.code} />
        <input type="hidden" name="agencyName" value={agency.name} />
        <input type="hidden" name="courseCodes" value={JSON.stringify(selectedCourses.map(c => c.code))} />

        <div className="flex gap-3">
          <a
            href="/tenant/training/import"
            className="px-6 py-3 border border-border-strong rounded-lg hover:bg-surface-inset transition-colors text-center"
          >
            ← Start Over
          </a>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors font-medium disabled:bg-success-muted"
          >
            {isSubmitting ? "Importing courses..." : `Import ${selectedCourses.length} Courses`}
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
  return (
    <div className="text-center">
      <div className="w-20 h-20 bg-success-muted rounded-full flex items-center justify-center mx-auto mb-6">
        <span className="text-4xl text-success">✓</span>
      </div>

      <h2 className="text-2xl font-semibold mb-2">Import Complete!</h2>
      <p className="text-foreground-muted mb-6">
        Successfully imported {importedCount} {importedCount === 1 ? 'course' : 'courses'} into your catalog
      </p>

      {detailedErrors && detailedErrors.length > 0 && (
        <div className="bg-warning-muted border border-warning rounded-lg p-4 mb-6 text-left">
          <div className="flex items-start gap-2 mb-3">
            <span className="text-warning">⚠</span>
            <h3 className="font-medium text-warning">Some courses couldn't be imported:</h3>
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
        <h3 className="font-medium mb-2">Imported courses:</h3>
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
        <h3 className="font-medium text-brand mb-2">Next steps:</h3>
        <ul className="text-sm text-brand text-left space-y-1">
          <li>1. Set pricing for each imported course</li>
          <li>2. Configure course details and requirements</li>
          <li>3. Publish courses to make them visible on your public site</li>
          <li>4. Create training sessions to start accepting enrollments</li>
        </ul>
      </div>

      <div className="flex gap-3 justify-center">
        <a
          href="/tenant/training/courses"
          className="bg-brand text-white px-6 py-3 rounded-lg hover:bg-brand-hover transition-colors font-medium"
        >
          View Courses →
        </a>
        <a
          href="/tenant/training/import"
          className="px-6 py-3 border border-border-strong rounded-lg hover:bg-surface-inset transition-colors"
        >
          Import More
        </a>
      </div>
    </div>
  );
}
