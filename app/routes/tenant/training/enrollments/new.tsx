import type { MetaFunction, LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, useActionData, Link, redirect, useSearchParams } from "react-router";
import { requireOrgContext } from "../../../../../lib/auth/org-context.server";
import { getSessionById, createEnrollment, getSessions } from "../../../../../lib/db/training.server";
import { getCustomers } from "../../../../../lib/db/queries.server";
import { redirectWithNotification } from "../../../../../lib/use-notification";

export const meta: MetaFunction = () => [{ title: "New Enrollment - DiveStreams" }];

export async function loader({ request }: LoaderFunctionArgs) {
  const ctx = await requireOrgContext(request);
  const url = new URL(request.url);
  const sessionId = url.searchParams.get("sessionId");

  // Support two modes:
  // 1. With sessionId - pre-selected session (from session detail page)
  // 2. Without sessionId - show session selector (from dashboard/enrollments list)

  if (sessionId) {
    // Mode 1: Session pre-selected
    const [session, customersResult] = await Promise.all([
      getSessionById(ctx.org.id, sessionId),
      getCustomers(ctx.org.id),
    ]);

    if (!session) {
      throw new Response("Session not found", { status: 404 });
    }

    return {
      session,
      sessions: null,
      customers: customersResult.customers,
      mode: "pre-selected" as const
    };
  } else {
    // Mode 2: User needs to select a session
    const [sessions, customersResult] = await Promise.all([
      getSessions(ctx.org.id),
      getCustomers(ctx.org.id),
    ]);

    return {
      session: null,
      sessions,
      customers: customersResult.customers,
      mode: "select-session" as const
    };
  }
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

  // Validate amount paid (must be >= 1 if provided)
  if (amountPaid) {
    const amount = parseFloat(amountPaid);
    if (isNaN(amount)) {
      errors.amountPaid = "Amount must be a valid number";
    } else if (amount < 0) {
      errors.amountPaid = "Amount cannot be negative";
    } else if (amount > 0 && amount < 1) {
      errors.amountPaid = "Amount paid must be at least $1 (or $0 for free enrollment)";
    }
  }

  if (Object.keys(errors).length > 0) {
    return {
      errors,
      values: {
        sessionId,
        customerId,
        paymentStatus,
        amountPaid,
      }
    };
  }

  try {
    const enrollment = await createEnrollment({
      organizationId: ctx.org.id,
      sessionId,
      customerId,
      paymentStatus,
      amountPaid: amountPaid || "0.00",
    });

    return redirect(redirectWithNotification("/tenant/training/enrollments", "Enrollment has been successfully created", "success"));
  } catch (error) {
    console.error("Error creating enrollment:", error);

    // Return specific error messages
    const errorMessage = error instanceof Error ? error.message : "Failed to create enrollment";

    // Handle specific error cases
    const values = { sessionId, customerId, paymentStatus, amountPaid };

    if (errorMessage.includes("already enrolled")) {
      return { errors: { form: "This customer is already enrolled in this session" }, values };
    }
    if (errorMessage.includes("Session not found")) {
      return { errors: { form: "Training session not found" }, values };
    }
    if (errorMessage.includes("Customer not found")) {
      return { errors: { customerId: "Selected customer not found" }, values };
    }
    if (errorMessage.includes("cancelled")) {
      return { errors: { form: "Cannot enroll in a cancelled session" }, values };
    }
    if (errorMessage.includes("full")) {
      return { errors: { form: errorMessage }, values };
    }

    return { errors: { form: errorMessage }, values };
  }
}

export default function NewEnrollmentPage() {
  const { session, sessions, customers, mode } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("sessionId");

  // Determine back link and header based on mode
  const backLink = session
    ? `/tenant/training/sessions/${session.id}`
    : "/tenant/training";
  const backText = session ? "← Back to Session" : "← Back to Training";

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <Link
          to={backLink}
          className="text-brand hover:underline text-sm"
        >
          {backText}
        </Link>
        <h1 className="text-2xl font-bold mt-2">Enroll Student</h1>
        {session && (
          <p className="text-foreground-muted mt-1">
            {session.courseName} - {new Date(session.startDate).toLocaleDateString()}
          </p>
        )}
      </div>

      <form method="post" className="bg-surface-raised rounded-xl p-6 shadow-sm space-y-6">
        {actionData?.errors?.form && (
          <div className="bg-danger-muted text-danger p-3 rounded-lg max-w-4xl break-words text-sm">
            {actionData.errors.form}
          </div>
        )}

        {/* Session Selector (only shown when no session pre-selected) */}
        {mode === "select-session" && sessions && (
          <div>
            <label htmlFor="sessionId" className="block text-sm font-medium mb-1">
              Training Session *
            </label>
            <select
              id="sessionId"
              name="sessionId"
              defaultValue={actionData?.values?.sessionId || ""}
              className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
              required
            >
              <option value="">Select a session...</option>
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.courseName} - {new Date(s.startDate).toLocaleDateString()}
                  {s.startTime ? ` at ${s.startTime}` : ""}
                  {" "}({s.enrolledCount || 0}/{s.maxStudents || "∞"} enrolled)
                </option>
              ))}
            </select>
            {actionData?.errors?.sessionId && (
              <p className="text-danger text-sm mt-1">{actionData.errors.sessionId}</p>
            )}
          </div>
        )}

        {/* Hidden input when session is pre-selected */}
        {mode === "pre-selected" && (
          <input type="hidden" name="sessionId" value={sessionId || ""} />
        )}

        <div>
          <label htmlFor="customerId" className="block text-sm font-medium mb-1">
            Student *
          </label>
          <select
            id="customerId"
            name="customerId"
            defaultValue={actionData?.values?.customerId || ""}
            className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
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
            defaultValue={actionData?.values?.paymentStatus || "pending"}
            className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
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
            defaultValue={actionData?.values?.amountPaid || "0"}
            className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
          />
          {actionData?.errors?.amountPaid && (
            <p className="text-danger text-sm mt-1">{actionData.errors.amountPaid}</p>
          )}
        </div>

        <div className="flex gap-3 pt-4">
          <button
            type="submit"
            className="bg-brand text-white px-6 py-2 rounded-lg hover:bg-brand-hover"
          >
            Create Enrollment
          </button>
          <Link
            to={backLink}
            className="px-6 py-2 border rounded-lg hover:bg-surface-inset"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
