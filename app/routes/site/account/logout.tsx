/**
 * Account Logout Route
 *
 * Handles POST requests to log out the customer.
 * Clears the session cookie and redirects to login.
 */

import type { ActionFunctionArgs } from "react-router";
import { redirect } from "react-router";
import { logoutCustomer } from "../../../../lib/auth/customer-auth.server";

export async function action({ request }: ActionFunctionArgs) {
  // Get session token from cookie
  const cookieHeader = request.headers.get("Cookie") || "";
  const cookies = Object.fromEntries(
    cookieHeader.split("; ").filter(Boolean).map((c) => {
      const [key, ...rest] = c.split("=");
      return [key, rest.join("=")];
    })
  );

  const sessionToken = cookies["customer_session"];

  if (sessionToken) {
    await logoutCustomer(sessionToken);
  }

  return redirect("/site/login", {
    headers: {
      "Set-Cookie": "customer_session=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax",
    },
  });
}

// If someone navigates here directly, redirect to account
export async function loader() {
  return redirect("/site/account");
}
