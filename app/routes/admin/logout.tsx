import type { ActionFunctionArgs } from "react-router";
import { redirect } from "react-router";
import { clearAdminSessionCookie } from "../../../lib/auth/admin-auth.server";

export async function action({ request }: ActionFunctionArgs) {
  return redirect("/login", {
    headers: {
      "Set-Cookie": clearAdminSessionCookie(),
    },
  });
}

// Redirect GET requests to home
export async function loader() {
  return redirect("/dashboard");
}
