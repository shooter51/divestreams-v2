import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";

export async function loader({ request }: LoaderFunctionArgs) {
  // For GET requests, just redirect to login
  // TODO: Clear session
  return redirect("/auth/login");
}

export async function action({ request }: ActionFunctionArgs) {
  // TODO: Clear session cookie
  return redirect("/auth/login");
}

export default function Logout() {
  return null;
}
