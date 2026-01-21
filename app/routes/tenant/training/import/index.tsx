import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, Form } from "react-router";
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

  // TODO: Handle import logic in next task

  return { success: true };
}

export default function TrainingImportPage() {
  const { agencies } = useLoaderData<typeof loader>();

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Import Training Courses</h1>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Select Certification Agency</h2>

        <Form method="post">
          <div className="space-y-4">
            <div>
              <label htmlFor="agencyId" className="block text-sm font-medium mb-2">
                Certification Agency
              </label>
              <select
                id="agencyId"
                name="agencyId"
                className="w-full px-4 py-2 border rounded-lg"
                required
              >
                <option value="">Select an agency...</option>
                {agencies.map((agency) => (
                  <option key={agency.id} value={agency.id}>
                    {agency.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
            >
              Next: Select Courses
            </button>
          </div>
        </Form>
      </div>
    </div>
  );
}
