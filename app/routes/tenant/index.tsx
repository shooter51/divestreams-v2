import { redirect } from "react-router";
import type { LoaderFunctionArgs } from "react-router";

export async function loader({ request }: LoaderFunctionArgs) {
  // Redirect /tenant to /tenant/dashboard
  const url = new URL(request.url);
  return redirect(url.pathname + "/dashboard");
}
