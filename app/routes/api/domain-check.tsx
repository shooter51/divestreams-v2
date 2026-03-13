import { type LoaderFunctionArgs } from "react-router";
import { db } from "../../../lib/db";
import { organization } from "../../../lib/db/schema";
import { eq } from "drizzle-orm";

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const domain = url.searchParams.get("domain");

  if (!domain) {
    return new Response("Missing domain", { status: 400 });
  }

  // Always allow divestreams.com subdomains (production and environments)
  if (
    domain.endsWith(".divestreams.com") ||
    domain === "divestreams.com" ||
    domain === "www.divestreams.com"
  ) {
    return new Response("OK", { status: 200 });
  }

  // Check if domain is registered as a custom domain for any organization
  const org = await db
    .select({ id: organization.id })
    .from(organization)
    .where(eq(organization.customDomain, domain.toLowerCase()))
    .limit(1);

  if (org.length > 0) {
    return new Response("OK", { status: 200 });
  }

  return new Response("Domain not found", { status: 404 });
}
