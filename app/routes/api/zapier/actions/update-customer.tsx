/**
 * Zapier Action: Update Customer
 *
 * POST /api/zapier/actions/update-customer
 *
 * Allows Zapier to update customer information in DiveStreams.
 */

import type { ActionFunctionArgs } from "react-router";
import { validateZapierApiKey } from "../../../../../lib/integrations/zapier-enhanced.server.js";
import { db } from "../../../../../lib/db/index.js";
import { customers } from "../../../../../lib/db/schema.js";
import { eq, and } from "drizzle-orm";

interface UpdateCustomerInput {
  email: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  emergency_contact?: string;
  emergency_phone?: string;
  certification_level?: string;
  notes?: string;
}

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  // Authenticate request using API key
  const apiKey = request.headers.get("x-api-key");
  if (!apiKey) {
    return Response.json(
      { error: "Missing API key. Provide X-API-Key header." },
      { status: 401 }
    );
  }

  const orgId = await validateZapierApiKey(apiKey);
  if (!orgId) {
    return Response.json({ error: "Invalid API key" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as UpdateCustomerInput;

    // Validate required fields
    if (!body.email) {
      return Response.json(
        { error: "Missing required field: email" },
        { status: 400 }
      );
    }

    // Find customer
    const [customer] = await db
      .select()
      .from(customers)
      .where(and(eq(customers.email, body.email), eq(customers.organizationId, orgId)))
      .limit(1);

    if (!customer) {
      return Response.json(
        { error: "Customer not found with this email" },
        { status: 404 }
      );
    }

    // Update customer
    const updateData: Partial<typeof customers.$inferInsert> = {};

    if (body.first_name !== undefined) updateData.firstName = body.first_name;
    if (body.last_name !== undefined) updateData.lastName = body.last_name;
    if (body.phone !== undefined) updateData.phone = body.phone;
    if (body.emergency_contact !== undefined)
      updateData.emergencyContactName = body.emergency_contact;
    if (body.emergency_phone !== undefined)
      updateData.emergencyContactPhone = body.emergency_phone;
    if (body.certification_level !== undefined) {
      // Update certifications array
      updateData.certifications = customer.certifications || [];
      if (Array.isArray(updateData.certifications)) {
        updateData.certifications.push({
          agency: "Unknown",
          level: body.certification_level,
        });
      }
    }
    if (body.notes !== undefined) updateData.notes = body.notes;

    const [updated] = await db
      .update(customers)
      .set({
        ...updateData,
        updatedAt: new Date(),
      })
      .where(eq(customers.id, customer.id))
      .returning();

    return Response.json({
      id: updated.id,
      email: updated.email,
      first_name: updated.firstName,
      last_name: updated.lastName,
      phone: updated.phone,
      updated_at: updated.updatedAt,
    });
  } catch (error) {
    console.error("Zapier update customer error:", error);
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Failed to update customer",
      },
      { status: 500 }
    );
  }
}

export default function ZapierUpdateCustomer() {
  return null;
}
