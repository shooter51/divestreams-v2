import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, Form, useActionData } from "react-router";
import { useState } from "react";
import { requireOrgContext } from "../../../../../lib/auth/org-context.server";
import { getAgencies } from "../../../../../lib/db/training.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const orgContext = await requireOrgContext(request);

  // Get available agencies for this organization
  const agencies = await getAgencies(orgContext.org.id);

  console.log("[Import Route] Loaded", { agencyCount: agencies.length });

  return { agencies };
}

export async function action({ request }: ActionFunctionArgs) {
  const orgContext = await requireOrgContext(request);

  const formData = await request.formData();
  const agencyId = formData.get("agencyId") as string;
  const step = formData.get("step") as string;

  // TODO: Handle actual import logic when backend is ready
  console.log("[Import Action]", { step, agencyId });

  if (step === "select-agency") {
    // Return mock courses for the selected agency
    return {
      success: true,
      step: "select-courses",
      agency: { id: agencyId, name: "PADI" },
      courses: [
        {
          id: "1",
          name: "Open Water Diver",
          code: "OW",
          description: "Entry-level certification for new divers",
          duration: "3-4 days",
        },
        {
          id: "2",
          name: "Advanced Open Water Diver",
          code: "AOW",
          description: "Build on your Open Water skills",
          duration: "2-3 days",
        },
        {
          id: "3",
          name: "Rescue Diver",
          code: "RD",
          description: "Learn to prevent and manage dive emergencies",
          duration: "3-4 days",
        },
      ],
    };
  }

  if (step === "select-courses") {
    const selectedCourses = formData.getAll("courses") as string[];
    return {
      success: true,
      step: "preview",
      selectedCount: selectedCourses.length,
    };
  }

  return { success: true };
}

export default function TrainingImportPage() {
  const { agencies } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const [currentStep, setCurrentStep] = useState<"select-agency" | "select-courses" | "preview">("select-agency");

  // Update step based on action data
  const effectiveStep = actionData?.step || currentStep;

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Import Training Courses</h1>
        <p className="text-gray-600">
          Import course templates from certification agencies to quickly populate your course catalog
        </p>
      </div>

      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          <Step number={1} title="Select Agency" active={effectiveStep === "select-agency"} completed={effectiveStep !== "select-agency"} />
          <div className="flex-1 h-1 bg-gray-200 mx-2">
            <div className={`h-full ${effectiveStep !== "select-agency" ? "bg-blue-600" : "bg-gray-200"}`} />
          </div>
          <Step number={2} title="Choose Courses" active={effectiveStep === "select-courses"} completed={effectiveStep === "preview"} />
          <div className="flex-1 h-1 bg-gray-200 mx-2">
            <div className={`h-full ${effectiveStep === "preview" ? "bg-blue-600" : "bg-gray-200"}`} />
          </div>
          <Step number={3} title="Preview & Import" active={effectiveStep === "preview"} completed={false} />
        </div>
      </div>

      {/* Step Content */}
      <div className="bg-white rounded-lg shadow-lg p-8">
        {effectiveStep === "select-agency" && (
          <SelectAgencyStep agencies={agencies} />
        )}

        {effectiveStep === "select-courses" && actionData?.courses && (
          <SelectCoursesStep courses={actionData.courses} agency={actionData.agency} />
        )}

        {effectiveStep === "preview" && (
          <PreviewStep selectedCount={actionData?.selectedCount || 0} />
        )}
      </div>
    </div>
  );
}

function Step({ number, title, active, completed }: { number: number; title: string; active: boolean; completed: boolean }) {
  return (
    <div className="flex flex-col items-center">
      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
        completed ? "bg-green-600 text-white" :
        active ? "bg-blue-600 text-white" :
        "bg-gray-200 text-gray-600"
      }`}>
        {completed ? "✓" : number}
      </div>
      <span className={`text-sm mt-2 ${active ? "text-blue-600 font-medium" : "text-gray-600"}`}>
        {title}
      </span>
    </div>
  );
}

function SelectAgencyStep({ agencies }: { agencies: Array<{ id: string; name: string }> }) {
  return (
    <div>
      <h2 className="text-2xl font-semibold mb-4">Step 1: Select Certification Agency</h2>
      <p className="text-gray-600 mb-6">
        Choose the certification agency whose courses you want to import. We'll fetch their latest course catalog.
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
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            >
              <option value="">Select an agency...</option>
              {agencies.map((agency) => (
                <option key={agency.id} value={agency.id}>
                  {agency.name}
                </option>
              ))}
            </select>
            <p className="text-sm text-gray-500 mt-1">
              Don't see your agency? Add it in Settings → Training → Agencies
            </p>
          </div>

          <div className="pt-4">
            <button
              type="submit"
              className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Next: Select Courses →
            </button>
          </div>
        </div>
      </Form>
    </div>
  );
}

function SelectCoursesStep({ courses, agency }: { courses: Array<any>; agency: { id: string; name: string } }) {
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
      <p className="text-gray-600 mb-6">
        Select which courses from <span className="font-medium">{agency.name}</span> you'd like to import into your catalog
      </p>

      <div className="mb-4 flex gap-2">
        <button
          type="button"
          onClick={selectAll}
          className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded"
        >
          Select All
        </button>
        <button
          type="button"
          onClick={selectNone}
          className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded"
        >
          Select None
        </button>
        <span className="ml-auto text-sm text-gray-600">
          {selectedCourses.size} of {courses.length} selected
        </span>
      </div>

      <Form method="post">
        <input type="hidden" name="step" value="select-courses" />
        <input type="hidden" name="agencyId" value={agency.id} />

        <div className="space-y-3 mb-6 max-h-96 overflow-y-auto">
          {courses.map((course) => (
            <label
              key={course.id}
              className={`block p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                selectedCourses.has(course.id)
                  ? "border-blue-600 bg-blue-50"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  name="courses"
                  value={course.id}
                  checked={selectedCourses.has(course.id)}
                  onChange={() => toggleCourse(course.id)}
                  className="mt-1 w-5 h-5 text-blue-600"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{course.name}</h3>
                    <span className="text-xs bg-gray-100 px-2 py-1 rounded">{course.code}</span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">{course.description}</p>
                  <p className="text-xs text-gray-500 mt-1">Duration: {course.duration}</p>
                </div>
              </div>
            </label>
          ))}
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => window.history.back()}
            className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            ← Back
          </button>
          <button
            type="submit"
            disabled={selectedCourses.size === 0}
            className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            Preview Import ({selectedCourses.size} courses) →
          </button>
        </div>
      </Form>
    </div>
  );
}

function PreviewStep({ selectedCount }: { selectedCount: number }) {
  return (
    <div>
      <h2 className="text-2xl font-semibold mb-2">Step 3: Preview & Import</h2>
      <p className="text-gray-600 mb-6">
        Ready to import {selectedCount} courses into your catalog
      </p>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <h3 className="font-medium text-blue-900 mb-2">What will happen:</h3>
        <ul className="space-y-2 text-sm text-blue-800">
          <li className="flex items-start gap-2">
            <span className="text-blue-600 mt-0.5">✓</span>
            <span>{selectedCount} course templates will be added to your catalog</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-600 mt-0.5">✓</span>
            <span>You can customize pricing and settings for each course after import</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-600 mt-0.5">✓</span>
            <span>Agency course information will be preserved for future updates</span>
          </li>
        </ul>
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
        <h3 className="font-medium text-yellow-900 mb-2">⚠️ Coming Soon</h3>
        <p className="text-sm text-yellow-800">
          The import functionality is currently under development. This preview shows the planned workflow.
          The backend API integration and data processing will be available in the next release.
        </p>
      </div>

      <Form method="post" className="space-y-4">
        <input type="hidden" name="step" value="execute-import" />

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => window.history.back()}
            className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            ← Back
          </button>
          <button
            type="submit"
            disabled={true}
            className="flex-1 bg-green-600 text-white px-6 py-3 rounded-lg font-medium disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            Start Import (Coming Soon)
          </button>
        </div>
      </Form>
    </div>
  );
}
