import { redirect, type Route } from "react-router";
import { requireTenant } from "~/lib/auth/org-context.server";
import { duplicateTour } from "~/lib/db/queries.server";

export const action: Route.ActionFunction = async ({ params, request }: { params: Record<string, string | undefined>; request: Request }) => {
  if (request.method !== "POST") {
    throw new Response("Method not allowed", { status: 405 });
  }

  const { id } = params;
  if (!id) {
    throw new Response("Tour ID required", { status: 400 });
  }

  try {
    const { organizationId } = await requireTenant(request);

    const newTour = await duplicateTour(organizationId, id);
    return redirect(`/tenant/tours/${newTour.id}`);
  } catch (error) {
    if (error instanceof Error && error.message === "Tour not found") {
      throw new Response("Tour not found", { status: 404 });
    }
    console.error("Error duplicating tour:", error);
    throw new Response("Failed to duplicate tour", { status: 500 });
  }
};
