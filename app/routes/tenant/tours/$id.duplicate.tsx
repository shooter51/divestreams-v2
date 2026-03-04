import { redirect, type ActionFunctionArgs, type LoaderFunctionArgs } from "react-router";
import { requireOrgContext, requireRole} from "../../../../lib/auth/org-context.server";
import { duplicateTour } from "../../../../lib/db/queries.server";

// DS-rpqm: GET must not perform mutations — redirect to tour list instead
export async function loader({ request }: LoaderFunctionArgs) {
  await requireOrgContext(request);
  throw new Response("Method not allowed. Use POST to duplicate a tour.", { status: 405 });
}

export async function action({ params, request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    throw new Response("Method not allowed", { status: 405 });
  }

  const { id } = params;
  if (!id) {
    throw new Response("Tour ID required", { status: 400 });
  }

  try {
    const ctx = await requireOrgContext(request);
    requireRole(ctx, ["owner", "admin"]);
    const organizationId = ctx.org.id;

    const newTour = await duplicateTour(organizationId, id);
    return redirect(`/tenant/tours/${newTour.id}`);
  } catch (error) {
    if (error instanceof Error && error.message === "Tour not found") {
      throw new Response("Tour not found", { status: 404 });
    }
    console.error("Error duplicating tour:", error);
    throw new Response("Failed to duplicate tour", { status: 500 });
  }
}
