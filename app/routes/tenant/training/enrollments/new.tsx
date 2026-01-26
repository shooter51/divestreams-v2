import type { MetaFunction, LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, useActionData, Link, redirect, useSearchParams } from "react-router";
import { requireOrgContext } from "../../../../../lib/auth/org-context.server";
import { getSessionById, createEnrollment } from "../../../../../lib/db/training.server";
import { getCustomers } from "../../../../../lib/db/queries.server";

export const meta: MetaFunction = () => [{ title: "New Enrollment - DiveStreams" }];

export async function loader({ request }: LoaderFunctionArgs) {
  const ctx = await requireOrgContext(request);
  const url = new URL(request.url);
  const sessionId = url.searchParams.get("sessionId");

  if (!sessionId) {
    throw new Response("Session ID required", { status: 400 });
  }

  const [session, customers] = await Promise.all([
    getSessionById(ctx.org.id, sessionId),
    getCustomers(ctx.org.id),
  ]);

  if (!session) {
    throw new Response("Session not found", { status: 404 });
  }

  return { session, customers };
}

export async function action({ request }: ActionFunctionArgs) {
  const ctx = await requireOrgContext(request);
  const formData = await request.formData();

  const sessionId = formData.get("sessionId") as string;
  const customerId = formData.get("customerId") as string;
  const paymentStatus = (formData.get("paymentStatus") as string) || "pending";
  const amountPaid = formData.get("amountPaid") as string;

  const errors: Record<string, string> = {};
  if (!sessionId) errors.sessionId = "Session is required";
  if (!customerId) errors.customerId = "Customer is required";

  if (Object.keys(errors).length > 0) {
    return { errors };
  }

  try {
    const enrollment = await createEnrollment({
      organizationId: ctx.org.id,
      sessionId,
      customerId,
      paymentStatus,
      amountPaid: amountPaid || "0.00",
    });

    return redirect(`/tenant/training/enrollments/${enrollment.id}`);
  } catch (error) {
    console.error("Error creating enrollment:", error);
    return { errors: { form: "Failed to create enrollment" } };
  }
}

export default function NewEnrollmentPage() {
  const { session, customers } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("sessionId");

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <Link
          to={`/tenant/training/sessions/${session.id}`}
          className="text-brand hover:underline text-sm"
        >
          ← Back to Session
        </Link>
        <h1 className="text-2xl font-bold mt-2">Enroll Student</h1>
        <p className="text-foreground-muted mt-1">
          {session.courseName} - {new Date(session.startDate).toLocaleDateString()}
        </p>
      </div>

      <form method="post" className="bg-surface-raised rounded-xl p-6 shadow-sm space-y-6">
        <input type="hidden" name="sessionId" value={sessionId || ""} />

        {actionData?.errors?.form && (
          <div className="bg-danger-muted text-danger p-3 rounded-lg text-sm">
            {actionData.errors.form}
          </div>
        )}

        <div>
          <label htmlFor="customerId" className="block text-sm font-medium mb-1">
            Student *
          </label>
          <select
            id="customerId"
            name="customerId"
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
            required
          >
            <option value="">Select a student...</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.firstName} {customer.lastName} ({customer.email})
              </option>
            ))}
          </select>
          {actionData?.errors?.customerId && (
            <p className="text-danger text-sm mt-1">{actionData.errors.customerId}</p>
          )}
        </div>

        <div>
          <label htmlFor="paymentStatus" className="block text-sm font-medium mb-1">
            Payment Status
          </label>
          <select
            id="paymentStatus"
            name="paymentStatus"
            defaultValue="pending"
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
          >
            <option value="pending">Pending</option>
            <option value="partial">Partial</option>
            <option value="paid">Paid</option>
          </select>
        </div>

        <div>
          <label htmlFor="amountPaid" className="block text-sm font-medium mb-1">
            Amount Paid
          </label>
          <input
            type="number"
            id="amountPaid"
            name="amountPaid"
            step="0.01"
            min="0"
            defaultValue="0"
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
          />
        </div>

        <div className="flex gap-3 pt-4">
          <button
            type="submit"
            className="bg-brand text-white px-6 py-2 rounded-lg hover:bg-brand-hover"
          >
            Create Enrollment
          </button>
          <Link
            to={`/tenant/training/sessions/${session.id}`}
            className="px-6 py-2 border rounded-lg hover:bg-surface-inset"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
