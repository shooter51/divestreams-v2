import type { SeedClient } from "../client";
import { sleep } from "../client";

export interface CreatedCustomer {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}

const CUSTOMERS = [
  { firstName: "Sarah", lastName: "Johnson", email: "sarah.johnson@example.com", phone: "+1-305-555-0101", dateOfBirth: "1985-03-15", emergencyContactName: "David Johnson", emergencyContactPhone: "+1-305-555-0201", emergencyContactRelation: "Spouse", certAgency: "PADI", certLevel: "Advanced Open Water" },
  { firstName: "Michael", lastName: "Chen", email: "michael.chen@example.com", phone: "+1-305-555-0102", dateOfBirth: "1978-07-22", emergencyContactName: "Lisa Chen", emergencyContactPhone: "+1-305-555-0202", emergencyContactRelation: "Spouse", certAgency: "PADI", certLevel: "Divemaster" },
  { firstName: "Emma", lastName: "Davis", email: "emma.davis@example.com", phone: "+1-305-555-0103", dateOfBirth: "1992-11-08", emergencyContactName: "Tom Davis", emergencyContactPhone: "+1-305-555-0203", emergencyContactRelation: "Parent", certAgency: "SSI", certLevel: "Open Water" },
  { firstName: "James", lastName: "Wilson", email: "james.wilson@example.com", phone: "+1-305-555-0104", dateOfBirth: "1965-01-30", emergencyContactName: "Carol Wilson", emergencyContactPhone: "+1-305-555-0204", emergencyContactRelation: "Spouse", certAgency: "PADI", certLevel: "Rescue Diver" },
  { firstName: "Olivia", lastName: "Brown", email: "olivia.brown@example.com", phone: "+1-305-555-0105", dateOfBirth: "1990-05-12", emergencyContactName: "Henry Brown", emergencyContactPhone: "+1-305-555-0205", emergencyContactRelation: "Parent", certAgency: "NAUI", certLevel: "Open Water" },
  { firstName: "Robert", lastName: "Martinez", email: "robert.martinez@example.com", phone: "+1-305-555-0106", dateOfBirth: "1973-09-25", emergencyContactName: "Ana Martinez", emergencyContactPhone: "+1-305-555-0206", emergencyContactRelation: "Spouse", certAgency: "PADI", certLevel: "Advanced Open Water" },
  { firstName: "Sophie", lastName: "Taylor", email: "sophie.taylor@example.com", phone: "+1-305-555-0107", dateOfBirth: "1988-02-14", emergencyContactName: "John Taylor", emergencyContactPhone: "+1-305-555-0207", emergencyContactRelation: "Parent", certAgency: "SSI", certLevel: "Advanced Open Water" },
  { firstName: "David", lastName: "Anderson", email: "david.anderson@example.com", phone: "+1-305-555-0108", dateOfBirth: "1981-06-03", emergencyContactName: "Karen Anderson", emergencyContactPhone: "+1-305-555-0208", emergencyContactRelation: "Spouse", certAgency: "PADI", certLevel: "Open Water" },
  { firstName: "Isabella", lastName: "Thompson", email: "isabella.thompson@example.com", phone: "+1-305-555-0109", dateOfBirth: "1995-08-19", emergencyContactName: "Mark Thompson", emergencyContactPhone: "+1-305-555-0209", emergencyContactRelation: "Parent", certAgency: "", certLevel: "" },
  { firstName: "William", lastName: "Garcia", email: "william.garcia@example.com", phone: "+1-305-555-0110", dateOfBirth: "1970-12-07", emergencyContactName: "Maria Garcia", emergencyContactPhone: "+1-305-555-0210", emergencyContactRelation: "Spouse", certAgency: "PADI", certLevel: "Divemaster" },
  { firstName: "Akira", lastName: "Tanaka", email: "akira.tanaka@example.com", phone: "+81-90-5555-0111", dateOfBirth: "1986-04-20", emergencyContactName: "Yoko Tanaka", emergencyContactPhone: "+81-90-5555-0211", emergencyContactRelation: "Spouse", certAgency: "PADI", certLevel: "Advanced Open Water" },
  { firstName: "Elena", lastName: "Petrov", email: "elena.petrov@example.com", phone: "+7-495-555-0112", dateOfBirth: "1989-10-15", emergencyContactName: "Ivan Petrov", emergencyContactPhone: "+7-495-555-0212", emergencyContactRelation: "Parent", certAgency: "CMAS", certLevel: "Open Water" },
  { firstName: "Lars", lastName: "Andersen", email: "lars.andersen@example.com", phone: "+45-5555-0113", dateOfBirth: "1977-07-30", emergencyContactName: "Ingrid Andersen", emergencyContactPhone: "+45-5555-0213", emergencyContactRelation: "Spouse", certAgency: "SSI", certLevel: "Rescue Diver" },
  { firstName: "Priya", lastName: "Patel", email: "priya.patel@example.com", phone: "+44-7555-0114", dateOfBirth: "1993-01-11", emergencyContactName: "Raj Patel", emergencyContactPhone: "+44-7555-0214", emergencyContactRelation: "Parent", certAgency: "PADI", certLevel: "Open Water" },
  { firstName: "Carlos", lastName: "Silva", email: "carlos.silva@example.com", phone: "+55-11-5555-0115", dateOfBirth: "1984-03-28", emergencyContactName: "Lucia Silva", emergencyContactPhone: "+55-11-5555-0215", emergencyContactRelation: "Spouse", certAgency: "PADI", certLevel: "Advanced Open Water" },
  { firstName: "Yuki", lastName: "Nakamura", email: "yuki.nakamura@example.com", phone: "+81-90-5555-0116", dateOfBirth: "1991-09-05", emergencyContactName: "Kenji Nakamura", emergencyContactPhone: "+81-90-5555-0216", emergencyContactRelation: "Parent", certAgency: "PADI", certLevel: "Open Water" },
  { firstName: "Fatima", lastName: "Al-Hassan", email: "fatima.alhassan@example.com", phone: "+971-55-555-0117", dateOfBirth: "1987-06-22", emergencyContactName: "Omar Al-Hassan", emergencyContactPhone: "+971-55-555-0217", emergencyContactRelation: "Spouse", certAgency: "PADI", certLevel: "Advanced Open Water" },
  { firstName: "Marco", lastName: "Rossi", email: "marco.rossi@example.com", phone: "+39-055-5550118", dateOfBirth: "1979-11-14", emergencyContactName: "Sofia Rossi", emergencyContactPhone: "+39-055-5550218", emergencyContactRelation: "Spouse", certAgency: "SSI", certLevel: "Divemaster" },
  { firstName: "Aisha", lastName: "Okafor", email: "aisha.okafor@example.com", phone: "+234-80-5550119", dateOfBirth: "1994-02-08", emergencyContactName: "Emeka Okafor", emergencyContactPhone: "+234-80-5550219", emergencyContactRelation: "Parent", certAgency: "PADI", certLevel: "Open Water" },
  { firstName: "Thomas", lastName: "Mueller", email: "thomas.mueller@example.com", phone: "+49-30-5550120", dateOfBirth: "1982-05-17", emergencyContactName: "Anna Mueller", emergencyContactPhone: "+49-30-5550220", emergencyContactRelation: "Spouse", certAgency: "PADI", certLevel: "Rescue Diver" },
];

function parseCustomerIds(html: string): string[] {
  const pattern = /\/tenant\/customers\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/g;
  const ids = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html)) !== null) {
    ids.add(match[1]);
  }
  return [...ids];
}

export async function seedCustomers(client: SeedClient): Promise<CreatedCustomer[]> {
  for (const c of CUSTOMERS) {
    const fd = new FormData();
    const csrf = await client.getCsrfToken();
    fd.append("_csrf", csrf);
    fd.append("firstName", c.firstName);
    fd.append("lastName", c.lastName);
    fd.append("email", c.email);
    fd.append("phone", c.phone);
    fd.append("dateOfBirth", c.dateOfBirth);
    fd.append("emergencyContactName", c.emergencyContactName);
    fd.append("emergencyContactPhone", c.emergencyContactPhone);
    fd.append("emergencyContactRelation", c.emergencyContactRelation);
    if (c.certAgency) fd.append("certAgency", c.certAgency);
    if (c.certLevel) fd.append("certLevel", c.certLevel);

    const result = await client.post("/tenant/customers/new", fd);
    if (!result.ok && result.status !== 302 && result.status !== 303) {
      console.warn(`  ⚠ Customer ${c.email} may have failed (status ${result.status})`);
    } else {
      console.log(`  ✓ Customer: ${c.firstName} ${c.lastName}`);
    }
    await sleep(50);
  }

  // Get the customer list and parse IDs
  const html = await client.getHtml("/tenant/customers");
  const ids = parseCustomerIds(html);

  if (ids.length < CUSTOMERS.length) {
    console.warn(`  ⚠ Expected ${CUSTOMERS.length} customer IDs but found ${ids.length}`);
  }

  return CUSTOMERS.map((c, i) => ({
    id: ids[i] ?? "",
    email: c.email,
    firstName: c.firstName,
    lastName: c.lastName,
  }));
}
