import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, useActionData, useNavigation, Link } from "react-router";
import { requirePlatformContext } from "../../../lib/auth/platform-context.server";
import {
  getGlobalAgencyCourseTemplates,
  updateTemplate,
  AGENCY_METADATA,
} from "../../../lib/db/training-templates.server";

export async function loader({ request, params }: LoaderFunctionArgs) {
  await requirePlatformContext(request);

  const agencyCode = params.agencyCode!;
  const templates = await getGlobalAgencyCourseTemplates(agencyCode);
  const agencyName = AGENCY_METADATA[agencyCode]?.name || agencyCode.toUpperCase();

  return { agencyCode, agencyName, templates };
}

export async function action({ request }: ActionFunctionArgs) {
  await requirePlatformContext(request);

  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  if (intent === "update-images") {
    const templateId = formData.get("templateId") as string;
    const imagesJson = formData.get("images") as string;

    try {
      const images = JSON.parse(imagesJson) as string[];
      await updateTemplate(templateId, { images });
      return { success: true, message: "Images updated" };
    } catch (e) {
      return { error: "Failed to update images" };
    }
  }

  return { error: "Unknown action" };
}

export default function AgencyCourses() {
  const { agencyCode, agencyName, templates } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex items-center gap-4 mb-6">
        <Link to="/course-catalog" className="text-brand hover:underline text-sm">
          &larr; All Agencies
        </Link>
      </div>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-heading">{agencyName}</h1>
          <p className="text-sm text-muted mt-1">
            {templates.length} course templates &middot; Code: <code className="bg-surface-inset px-1 rounded">{agencyCode}</code>
          </p>
        </div>
      </div>

      {actionData && "success" in actionData && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded text-green-800 text-sm">
          {actionData.message}
        </div>
      )}
      {actionData && "error" in actionData && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-800 text-sm">
          {actionData.error}
        </div>
      )}

      <div className="space-y-4">
        {templates.map((template) => (
          <div key={template.id} className="bg-surface border border-default rounded-lg p-4">
            <div className="flex gap-4">
              {/* Image preview */}
              <div className="flex-shrink-0 w-32">
                {template.images && template.images.length > 0 ? (
                  <img
                    src={template.images[0]}
                    alt={template.name}
                    className="w-32 h-24 object-cover rounded"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='128' height='96' fill='%23ddd'%3E%3Crect width='128' height='96'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%23999' font-size='12'%3ENo Image%3C/text%3E%3C/svg%3E";
                    }}
                  />
                ) : (
                  <div className="w-32 h-24 bg-surface-inset rounded flex items-center justify-center text-xs text-muted">
                    No Image
                  </div>
                )}
                <div className="mt-1 text-xs text-muted text-center">
                  {template.images?.length ?? 0} image(s)
                </div>
              </div>

              {/* Course info */}
              <div className="flex-grow min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <Link
                      to={`/course-catalog/${agencyCode}/${template.id}`}
                      className="font-semibold text-heading hover:text-brand"
                    >
                      {template.name}
                    </Link>
                    <div className="flex gap-2 mt-1">
                      <span className="text-xs bg-surface-inset px-2 py-0.5 rounded text-muted">
                        {template.code}
                      </span>
                      {template.levelCode && (
                        <span className="text-xs bg-blue-50 px-2 py-0.5 rounded text-blue-700">
                          {template.levelCode}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                {template.description && (
                  <p className="text-sm text-muted mt-2 line-clamp-2">{template.description}</p>
                )}
                <div className="flex gap-4 mt-2 text-xs text-muted">
                  <span>{template.durationDays} day(s)</span>
                  {template.classroomHours ? <span>{template.classroomHours}h classroom</span> : null}
                  {template.poolHours ? <span>{template.poolHours}h pool</span> : null}
                  {template.openWaterDives ? <span>{template.openWaterDives} OW dives</span> : null}
                  {template.minAge ? <span>Min age: {template.minAge}</span> : null}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {templates.length === 0 && (
        <div className="text-center py-12 text-muted">
          No templates found for this agency.
        </div>
      )}
    </div>
  );
}
