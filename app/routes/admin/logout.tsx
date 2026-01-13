import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";
import { auth } from "../../../lib/auth";

export async function action({ request }: ActionFunctionArgs) {
  // Use Better Auth to sign out
  const response = await auth.api.signOut({
    headers: request.headers,
    asResponse: true,
  });

  // Get the Set-Cookie header to clear the session
  const cookies = response.headers.get("set-cookie");

  return redirect("/login", {
    headers: cookies ? { "Set-Cookie": cookies } : {},
  });
}

// Redirect GET requests to dashboard (if authenticated) or login
export async function loader({ request }: LoaderFunctionArgs) {
  // Check if authenticated
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (session?.user) {
    return redirect("/dashboard");
  }

  return redirect("/login");
}
