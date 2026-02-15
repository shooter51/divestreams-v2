import { redirect, type ActionFunctionArgs, type LoaderFunctionArgs } from "react-router";
import { requireOrgContext } from "../../../../lib/auth/org-context.server";
import { duplicateTour } from "../../../../lib/db/queries.server";

// Support both GET (Link) and POST (Form) for duplication
export async function loader({ params, request }: LoaderFunctionArgs) {
  const { id } = params;
  if (!id) {
    throw new Response("Tour ID required", { status: 400 });
  }

  try {
    const ctx = await requireOrgContext(request);
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
