import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";

// Clear session cookie by setting it to expire immediately
function clearSessionCookie(): string {
  return "session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Secure";
}

export async function loader({ request }: LoaderFunctionArgs) {
  // For GET requests, clear session and redirect to login
  return redirect("/auth/login", {
    headers: {
      "Set-Cookie": clearSessionCookie(),
    },
  });
}

export async function action({ request }: ActionFunctionArgs) {
  // Clear session cookie and redirect to login
  return redirect("/auth/login", {
    headers: {
      "Set-Cookie": clearSessionCookie(),
    },
  });
}

export default function Logout() {
  return null;
}
