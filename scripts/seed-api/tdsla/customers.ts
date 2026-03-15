import type { SeedClient } from "../client";
import { sleep } from "../client";
import type { CreatedCustomer } from "../modules/customers";

// Diverse LA-area customer base — mix of local regulars and visiting divers
const CUSTOMERS = [
  // LA locals — regulars
  { firstName: "Jessica", lastName: "Nguyen", email: "jessica.nguyen@gmail.com", phone: "+1-310-555-0201", dateOfBirth: "1988-04-12", emergencyContactName: "Kevin Nguyen", emergencyContactPhone: "+1-310-555-0301", emergencyContactRelation: "Spouse", certAgency: "PADI", certLevel: "Advanced Open Water" },
  { firstName: "Marcus", lastName: "Rodriguez", email: "marcus.r@outlook.com", phone: "+1-310-555-0202", dateOfBirth: "1975-09-28", emergencyContactName: "Linda Rodriguez", emergencyContactPhone: "+1-310-555-0302", emergencyContactRelation: "Spouse", certAgency: "PADI", certLevel: "Divemaster" },
  { firstName: "Alyssa", lastName: "Park", email: "alyssa.park@icloud.com", phone: "+1-213-555-0203", dateOfBirth: "1992-01-15", emergencyContactName: "James Park", emergencyContactPhone: "+1-213-555-0303", emergencyContactRelation: "Parent", certAgency: "SSI", certLevel: "Open Water" },
  { firstName: "Derek", lastName: "Washington", email: "dwashington@gmail.com", phone: "+1-310-555-0204", dateOfBirth: "1983-07-04", emergencyContactName: "Monica Washington", emergencyContactPhone: "+1-310-555-0304", emergencyContactRelation: "Spouse", certAgency: "PADI", certLevel: "Rescue Diver" },
  { firstName: "Samantha", lastName: "Chen", email: "sam.chen@yahoo.com", phone: "+1-626-555-0205", dateOfBirth: "1990-11-22", emergencyContactName: "David Chen", emergencyContactPhone: "+1-626-555-0305", emergencyContactRelation: "Parent", certAgency: "PADI", certLevel: "Advanced Open Water" },
  { firstName: "Brandon", lastName: "Kim", email: "brandon.kim@gmail.com", phone: "+1-714-555-0206", dateOfBirth: "1986-03-18", emergencyContactName: "Sarah Kim", emergencyContactPhone: "+1-714-555-0306", emergencyContactRelation: "Spouse", certAgency: "NAUI", certLevel: "Advanced Open Water" },
  { firstName: "Rachel", lastName: "Goldstein", email: "rachel.g@gmail.com", phone: "+1-818-555-0207", dateOfBirth: "1978-12-01", emergencyContactName: "Daniel Goldstein", emergencyContactPhone: "+1-818-555-0307", emergencyContactRelation: "Spouse", certAgency: "PADI", certLevel: "Divemaster" },

  // Silicon Beach tech crowd
  { firstName: "Ryan", lastName: "Patel", email: "ryan.patel@gmail.com", phone: "+1-424-555-0208", dateOfBirth: "1994-06-14", emergencyContactName: "Anita Patel", emergencyContactPhone: "+1-424-555-0308", emergencyContactRelation: "Parent", certAgency: "PADI", certLevel: "Open Water" },
  { firstName: "Emily", lastName: "Thompson", email: "emily.t@protonmail.com", phone: "+1-310-555-0209", dateOfBirth: "1991-08-30", emergencyContactName: "Mark Thompson", emergencyContactPhone: "+1-310-555-0309", emergencyContactRelation: "Parent", certAgency: "SSI", certLevel: "Open Water" },

  // Students & young professionals
  { firstName: "Tyler", lastName: "Martinez", email: "tyler.mart@gmail.com", phone: "+1-323-555-0210", dateOfBirth: "1999-02-28", emergencyContactName: "Rosa Martinez", emergencyContactPhone: "+1-323-555-0310", emergencyContactRelation: "Parent", certAgency: "", certLevel: "" },
  { firstName: "Zoe", lastName: "Adams", email: "zoe.adams@gmail.com", phone: "+1-310-555-0211", dateOfBirth: "1997-10-08", emergencyContactName: "Chris Adams", emergencyContactPhone: "+1-310-555-0311", emergencyContactRelation: "Parent", certAgency: "PADI", certLevel: "Open Water" },

  // Visiting divers (out of state / international)
  { firstName: "Hans", lastName: "Weber", email: "hans.weber@gmx.de", phone: "+49-170-555-0212", dateOfBirth: "1972-05-20", emergencyContactName: "Ingrid Weber", emergencyContactPhone: "+49-170-555-0312", emergencyContactRelation: "Spouse", certAgency: "CMAS", certLevel: "Advanced Open Water" },
  { firstName: "Yuki", lastName: "Tanaka", email: "yuki.tanaka@gmail.com", phone: "+81-90-5555-0213", dateOfBirth: "1989-03-03", emergencyContactName: "Kenji Tanaka", emergencyContactPhone: "+81-90-5555-0313", emergencyContactRelation: "Parent", certAgency: "PADI", certLevel: "Open Water" },
  { firstName: "Sarah", lastName: "O'Brien", email: "sobrien@gmail.com", phone: "+1-512-555-0214", dateOfBirth: "1985-07-16", emergencyContactName: "Patrick O'Brien", emergencyContactPhone: "+1-512-555-0314", emergencyContactRelation: "Spouse", certAgency: "PADI", certLevel: "Advanced Open Water" },
  { firstName: "Carlos", lastName: "Mendoza", email: "carlos.mendoza@gmail.com", phone: "+52-55-5555-0215", dateOfBirth: "1980-11-25", emergencyContactName: "Maria Mendoza", emergencyContactPhone: "+52-55-5555-0315", emergencyContactRelation: "Spouse", certAgency: "PADI", certLevel: "Rescue Diver" },

  // Families
  { firstName: "Jennifer", lastName: "Brooks", email: "jen.brooks@gmail.com", phone: "+1-310-555-0216", dateOfBirth: "1982-04-09", emergencyContactName: "Michael Brooks", emergencyContactPhone: "+1-310-555-0316", emergencyContactRelation: "Spouse", certAgency: "PADI", certLevel: "Open Water" },
  { firstName: "Michael", lastName: "Brooks", email: "mike.brooks@gmail.com", phone: "+1-310-555-0217", dateOfBirth: "1980-08-15", emergencyContactName: "Jennifer Brooks", emergencyContactPhone: "+1-310-555-0316", emergencyContactRelation: "Spouse", certAgency: "PADI", certLevel: "Advanced Open Water" },

  // Photography enthusiasts
  { firstName: "Natasha", lastName: "Volkov", email: "natasha.v@gmail.com", phone: "+1-310-555-0218", dateOfBirth: "1987-06-30", emergencyContactName: "Alexei Volkov", emergencyContactPhone: "+1-310-555-0318", emergencyContactRelation: "Spouse", certAgency: "SSI", certLevel: "Advanced Open Water" },

  // Dive professionals passing through
  { firstName: "Jake", lastName: "Sullivan", email: "jake.sullivan@divepro.com", phone: "+1-808-555-0219", dateOfBirth: "1976-01-22", emergencyContactName: "Katie Sullivan", emergencyContactPhone: "+1-808-555-0319", emergencyContactRelation: "Spouse", certAgency: "PADI", certLevel: "Divemaster" },

  // Corporate group organizer
  { firstName: "Amanda", lastName: "Reeves", email: "areeves@techcorp.com", phone: "+1-310-555-0220", dateOfBirth: "1988-09-11", emergencyContactName: "Brian Reeves", emergencyContactPhone: "+1-310-555-0320", emergencyContactRelation: "Spouse", certAgency: "PADI", certLevel: "Open Water" },
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

export async function seedTdslaCustomers(client: SeedClient): Promise<CreatedCustomer[]> {
  console.log("Seeding TDSLA customers...");

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
      console.warn(`  Warning: Customer ${c.email} returned ${result.status}`);
    } else {
      console.log(`  Customer: ${c.firstName} ${c.lastName}`);
    }
    await sleep(50);
  }

  const html = await client.getHtml("/tenant/customers");
  const ids = parseCustomerIds(html);

  if (ids.length < CUSTOMERS.length) {
    console.warn(`  Warning: Expected ${CUSTOMERS.length} customer IDs but found ${ids.length}`);
  }

  return CUSTOMERS.map((c, i) => ({
    id: ids[i] ?? "",
    email: c.email,
    firstName: c.firstName,
    lastName: c.lastName,
  }));
}
