import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData, Link } from "react-router";
import { requirePlatformContext } from "../../../lib/auth/platform-context.server";
import {
  getAllGlobalAgencyCourseTemplates,
  getAvailableAgencies,
  getAgencyTemplateCounts,
  AGENCY_METADATA,
} from "../../../lib/db/training-templates.server";

export async function loader({ request }: LoaderFunctionArgs) {
  await requirePlatformContext(request);

  const [agencies, templateCounts] = await Promise.all([
    getAvailableAgencies(),
    getAgencyTemplateCounts(),
  ]);

  // Build agency list with counts
  const agenciesWithCounts = agencies.map((agency) => {
    const countRow = templateCounts.find((c) => c.agencyCode === agency.code);
    return {
      ...agency,
      courseCount: countRow?.count ?? 0,
    };
  });

  return { agencies: agenciesWithCounts };
}

export default function CourseCatalog() {
  const { agencies } = useLoaderData<typeof loader>();

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-heading">Course Catalog</h1>
          <p className="text-sm text-muted mt-1">
            Global course templates used by all tenants. Tenants reference these templates
            instead of copying course data.
          </p>
        </div>
      </div>

      {/* Agency grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {agencies.map((agency) => (
          <Link
            key={agency.code}
            to={`/course-catalog/${agency.code}`}
            className="block p-4 bg-surface border border-default rounded-lg hover:border-brand transition-colors"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-heading">{agency.name}</h3>
              <span className="text-xs bg-surface-inset px-2 py-1 rounded-full text-muted">
                {agency.courseCount} courses
              </span>
            </div>
            {agency.description && (
              <p className="text-sm text-muted mt-2">{agency.description}</p>
            )}
            <div className="mt-3 text-xs text-muted">
              Code: <code className="bg-surface-inset px-1 rounded">{agency.code}</code>
            </div>
          </Link>
        ))}
      </div>

      {agencies.length === 0 && (
        <div className="text-center py-12 text-muted">
          <p>No agency templates found. Run the seed script to populate.</p>
          <code className="text-xs mt-2 block">npm run seed:templates</code>
        </div>
      )}
    </div>
  );
}
