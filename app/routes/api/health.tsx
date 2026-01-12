import type { LoaderFunctionArgs } from "react-router";

export async function loader({ request }: LoaderFunctionArgs) {
  return Response.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    version: "2.0.0",
  });
}

export default function Health() {
  return null;
}
