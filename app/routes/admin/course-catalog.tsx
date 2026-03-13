import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, Link, useFetcher } from "react-router";
import { requirePlatformContext } from "../../../lib/auth/platform-context.server";
import {
  getAvailableAgencies,
  getAgencyTemplateCounts,
  refreshCatalogFromJson,
} from "../../../lib/db/training-templates.server";

export async function loader({ request }: LoaderFunctionArgs) {
  await requirePlatformContext(request);

  const [agencies, templateCounts] = await Promise.all([
    getAvailableAgencies(),
    getAgencyTemplateCounts(),
  ]);

  const agenciesWithCounts = agencies.map((agency) => {
    const countRow = templateCounts.find((c) => c.agencyCode === agency.code);
    return {
      ...agency,
      courseCount: countRow?.count ?? 0,
    };
  });

  return { agencies: agenciesWithCounts };
}

export async function action({ request }: ActionFunctionArgs) {
  await requirePlatformContext(request);

  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "refresh-catalog") {
    const result = await refreshCatalogFromJson();
    return {
      success: true,
      totalTemplates: result.totalTemplates,
      imagesUploaded: result.imagesUploaded,
      imagesFailed: result.imagesFailed,
      errors: result.errors,
    };
  }

  return { error: "Unknown action" };
}

export default function CourseCatalog() {
  const { agencies } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const isRefreshing = fetcher.state !== "idle";
  const result = fetcher.data;

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
        <fetcher.Form method="post">
          <input type="hidden" name="intent" value="refresh-catalog" />
          <button
            type="submit"
            disabled={isRefreshing}
            className="bg-brand text-white px-4 py-2 rounded-lg hover:bg-brand-hover disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isRefreshing ? "Refreshing..." : "Refresh Catalog"}
          </button>
        </fetcher.Form>
      </div>

      {result && "success" in result && (
        <div className="mb-6 p-4 bg-success-muted border border-success rounded-lg text-sm">
          <p className="font-medium text-success">Catalog refreshed</p>
          <p className="text-foreground-muted mt-1">
            {result.totalTemplates} templates synced. {result.imagesUploaded} images uploaded to S3.
            {(result.imagesFailed ?? 0) > 0 && (
              <span className="text-warning"> {result.imagesFailed} images failed.</span>
            )}
          </p>
          {result.errors && result.errors.length > 0 && (
            <details className="mt-2">
              <summary className="cursor-pointer text-warning">
                {result.errors.length} error(s)
              </summary>
              <ul className="mt-1 list-disc list-inside text-xs text-foreground-muted">
                {result.errors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}

      {result && "error" in result && (
        <div className="mb-6 p-4 bg-danger-muted border border-danger rounded-lg text-sm text-danger">
          {result.error}
        </div>
      )}

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
          <p>No agency templates found. Click "Refresh Catalog" to import from catalog files.</p>
        </div>
      )}
    </div>
  );
}
