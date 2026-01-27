import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";
import { auth } from "../../../lib/auth";

export async function loader({ request }: LoaderFunctionArgs) {
  // For GET requests, use Better Auth to sign out
  const response = await auth.api.signOut({
    headers: request.headers,
    asResponse: true,
  });

  // Get the Set-Cookie header to clear the session
  const cookies = response.headers.get("set-cookie");

  return redirect("/auth/login", {
    headers: cookies ? { "Set-Cookie": cookies } : {},
  });
}

export async function action({ request }: ActionFunctionArgs) {
  // Use Better Auth to sign out
  const response = await auth.api.signOut({
    headers: request.headers,
    asResponse: true,
  });

  // Get the Set-Cookie header to clear the session
  const cookies = response.headers.get("set-cookie");

  return redirect("/auth/login", {
    headers: cookies ? { "Set-Cookie": cookies } : {},
  });
}

export default function Logout() {
  return null;
}
