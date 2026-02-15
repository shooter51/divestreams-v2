import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, Form, useActionData, useNavigation } from "react-router";
import { useState } from "react";
import { requireOrgContext } from "../../../../../lib/auth/org-context.server";
import { getAgencies, getAgencyById, createCourse } from "../../../../../lib/db/training.server";
import { getAgencyTemplates, type AgencyCourseTemplate } from "../../../../../lib/data/agency-templates";

export async function loader({ request }: LoaderFunctionArgs) {
  const orgContext = await requireOrgContext(request);

  // Get available agencies for this organization
  const agencies = await getAgencies(orgContext.org.id);

  return { agencies };
}

export async function action({ request }: ActionFunctionArgs) {
  const orgContext = await requireOrgContext(request);

  const formData = await request.formData();
  const step = formData.get("step") as string;
  const agencyId = formData.get("agencyId") as string;

  // Step 1: User selected an agency - fetch available course templates
  if (step === "select-agency") {
    if (!agencyId) {
      return { error: "Please select a certification agency" };
    }

    // Get the agency from database to get its code
    const agency = await getAgencyById(orgContext.org.id, agencyId);
    if (!agency) {
      return { error: "Agency not found" };
    }

    // Get templates for this agency
    const templates = getAgencyTemplates(agency.code);
    if (!templates) {
      return {
        error: `No course templates available for ${agency.name}. Templates are available for: PADI, SSI, NAUI`
      };
    }

    return {
      success: true,
      step: "select-courses",
      agency: { id: agency.id, name: agency.name, code: agency.code },
      courses: templates.courses.map((course, index) => ({
        id: `${agency.code}-${course.code}`,
        templateIndex: index,
        ...course,
      })),
    };
  }

  // Step 2: User selected courses - show preview
  if (step === "select-courses") {
    const selectedCourseIds = formData.getAll("courses") as string[];
    const agencyCode = formData.get("agencyCode") as string;
    const agencyName = formData.get("agencyName") as string;

    if (selectedCourseIds.length === 0) {
      return { error: "Please select at least one course to import" };
    }

    // Get the templates again to get full course data
    const templates = getAgencyTemplates(agencyCode);
    if (!templates) {
      return { error: "Agency templates not found" };
    }

    // Filter to selected courses
    const selectedCourses = templates.courses.filter((_, index) =>
      selectedCourseIds.includes(`${agencyCode}-${templates.courses[index].code}`)
    );

    return {
      success: true,
      step: "preview",
      agency: { id: agencyId, name: agencyName, code: agencyCode },
      selectedCourses: selectedCourses.map(course => ({
        id: `${agencyCode}-${course.code}`,
        ...course,
      })),
      selectedCount: selectedCourses.length,
    };
  }

  // Step 3: Execute the import
  if (step === "execute-import") {
    const agencyCode = formData.get("agencyCode") as string;
    const courseCodesJson = formData.get("courseCodes") as string;

    if (!agencyCode || !courseCodesJson) {
      return { error: "Missing import data" };
    }

    const courseCodes: string[] = JSON.parse(courseCodesJson);
    const templates = getAgencyTemplates(agencyCode);

    if (!templates) {
      return { error: "Agency templates not found" };
    }

    // Get the agency record for linking
    const agencies = await getAgencies(orgContext.org.id);
    const agency = agencies.find(a => a.code.toLowerCase() === agencyCode.toLowerCase());

    const importedCourses: string[] = [];
    const errors: string[] = [];

    for (const code of courseCodes) {
      const template = templates.courses.find(c => c.code === code);
      if (!template) {
        errors.push(`Template not found for code: ${code}`);
        continue;
      }

      try {
        const course = await createCourse({
          organizationId: orgContext.org.id,
          agencyId: agency?.id,
          name: template.name,
          code: template.code,
          description: template.description,
          durationDays: template.durationDays,
          classroomHours: template.classroomHours,
          poolHours: template.poolHours,
          openWaterDives: template.openWaterDives,
          minAge: template.minAge,
          prerequisites: template.prerequisites,
          medicalRequirements: template.medicalRequirements,
          materialsIncluded: template.materialsIncluded,
          requiredItems: template.requiredItems,
          price: "0.00", // Default price - user will set
          currency: "USD",
          isActive: true,
          isPublic: false, // Default to private - user will publish
        });
        importedCourses.push(course.name);
      } catch (error) {
        console.error(`Failed to import ${template.name}:`, error);
        errors.push(`Failed to import ${template.name}`);
      }
    }

    if (errors.length > 0 && importedCourses.length === 0) {
      return { error: errors.join(", ") };
    }

    return {
      success: true,
      step: "complete",
      importedCount: importedCourses.length,
      importedCourses,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  return { error: "Unknown step" };
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
        <div className="mb-6 bg-danger-muted border border-danger rounded-lg p-4 text-danger">
          {actionData.error}
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
            errors={actionData?.errors}
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

function SelectAgencyStep({ agencies, isSubmitting }: { agencies: Array<{ id: string; name: string; code: string }>; isSubmitting: boolean }) {
  return (
    <div>
      <h2 className="text-2xl font-semibold mb-4">Step 1: Select Certification Agency</h2>
      <p className="text-foreground-muted mb-6">
        Choose the certification agency whose courses you want to import. We support PADI, SSI, and NAUI course templates.
      </p>

      <Form method="post" className="max-w-md">
        <input type="hidden" name="step" value="select-agency" />

        <div className="space-y-4">
          <div>
            <label htmlFor="agencyId" className="block text-sm font-medium mb-2">
              Certification Agency *
            </label>
            <select
              id="agencyId"
              name="agencyId"
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-brand focus:border-brand"
              required
              disabled={isSubmitting}
            >
              <option value="">Select an agency...</option>
              {agencies.map((agency) => (
                <option key={agency.id} value={agency.id}>
                  {agency.name}
                </option>
              ))}
            </select>
            <p className="text-sm text-foreground-muted mt-1">
              Don't see your agency? Add it in Settings → Training → Agencies first.
            </p>
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
  courses: Array<AgencyCourseTemplate & { id: string }>;
  agency: { id: string; name: string; code: string };
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
        <input type="hidden" name="agencyId" value={agency.id} />
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
  selectedCourses: Array<AgencyCourseTemplate & { id: string }>;
  agency: { id: string; name: string; code: string };
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
        <input type="hidden" name="agencyId" value={agency.id} />
        <input type="hidden" name="agencyCode" value={agency.code} />
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
            className="flex-1 bg-success text-white px-6 py-3 rounded-lg hover:bg-success-hover transition-colors font-medium disabled:bg-success-muted"
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
  errors
}: {
  importedCount: number;
  importedCourses: string[];
  errors?: string[];
}) {
  return (
    <div className="text-center">
      <div className="w-20 h-20 bg-success-muted rounded-full flex items-center justify-center mx-auto mb-6">
        <span className="text-4xl text-success">✓</span>
      </div>

      <h2 className="text-2xl font-semibold mb-2">Import Complete!</h2>
      <p className="text-foreground-muted mb-6">
        Successfully imported {importedCount} courses into your catalog
      </p>

      {errors && errors.length > 0 && (
        <div className="bg-warning-muted border border-warning rounded-lg p-4 mb-6 text-left">
          <h3 className="font-medium text-warning mb-2">Some courses had issues:</h3>
          <ul className="text-sm text-warning list-disc list-inside">
            {errors.map((error, i) => (
              <li key={i}>{error}</li>
            ))}
          </ul>
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
