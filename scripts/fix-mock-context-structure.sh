#!/bin/bash

# Fix mockTenantContext to mockOrgContext structure in integration tests

set -e

echo "Updating mock context structure..."

# Python script to do the complex replacement
python3 << 'PYTHON_SCRIPT'
import re
import os

test_files = [
    "tests/integration/lib/tenant-action-isolation.test.ts",
    "tests/integration/routes/tenant/boats/$id.test.ts",
    "tests/integration/routes/tenant/boats/$id/edit.test.ts",
    "tests/integration/routes/tenant/boats/new.test.ts",
    "tests/integration/routes/tenant/bookings/$id.edit.test.ts",
    "tests/integration/routes/tenant/bookings/$id.test.ts",
    "tests/integration/routes/tenant/bookings/new.test.ts",
    "tests/integration/routes/tenant/customers-new.test.ts",
    "tests/integration/routes/tenant/customers/$id.test.ts",
    "tests/integration/routes/tenant/customers/$id/edit.test.ts",
    "tests/integration/routes/tenant/dive-sites/$id.test.ts",
    "tests/integration/routes/tenant/dive-sites/$id/edit.test.ts",
    "tests/integration/routes/tenant/dive-sites/new.test.ts",
    "tests/integration/routes/tenant/equipment/$id/edit.test.ts",
    "tests/integration/routes/tenant/equipment/new.test.ts",
    "tests/integration/routes/tenant/gallery/$id.test.ts",
    "tests/integration/routes/tenant/gallery/index.test.ts",
    "tests/integration/routes/tenant/gallery/new.test.ts",
    "tests/integration/routes/tenant/gallery/upload.test.ts",
    "tests/integration/routes/tenant/images-upload.test.ts",
    "tests/integration/routes/tenant/images/delete.test.ts",
    "tests/integration/routes/tenant/images/index.test.ts",
    "tests/integration/routes/tenant/images/reorder.test.ts",
    "tests/integration/routes/tenant/images/upload.test.ts",
    "tests/integration/routes/tenant/pos/products/$id.test.ts",
    "tests/integration/routes/tenant/pos/products/$id/edit.test.ts",
    "tests/integration/routes/tenant/pos/products/index.test.ts",
    "tests/integration/routes/tenant/pos/products/new.test.ts",
    "tests/integration/routes/tenant/pos/transactions/index.test.ts",
]

# Pattern to match mockTenantContext definitions
pattern = r'const mockTenantContext = \{[^}]+tenant: \{[^}]+\},\s*organizationId: "[^"]+",\s*\};'

replacement_template = '''const mockOrgContext = {{
    org: {{ id: "{org_id}", name: "{org_name}", slug: "{slug}", createdAt: new Date() }},
    user: {{ id: "user-1", email: "owner@example.com", name: "Owner" }},
    session: {{ id: "session-1" }},
    membership: {{ id: "member-1", role: "owner" }},
    subscription: null,
    limits: {{
      customers: 50, bookingsPerMonth: 100, tours: 10, teamMembers: 1,
      hasPOS: false, hasEquipmentRentals: true, hasAdvancedReports: false, hasEmailNotifications: false,
    }},
    usage: {{ customers: 0, tours: 0, bookingsThisMonth: 0 }},
    canAddCustomer: true, canAddTour: true, canAddBooking: true, isPremium: false,
  }};'''

for file_path in test_files:
    if not os.path.exists(file_path):
        print(f"Warning: {file_path} not found")
        continue

    with open(file_path, 'r') as f:
        content = f.read()

    # Extract org_id from the old mockTenantContext
    org_id_match = re.search(r'organizationId: "([^"]+)"', content)
    org_id = org_id_match.group(1) if org_id_match else "org-uuid-123"

    # Extract tenant name
    name_match = re.search(r'name: "([^"]+)"', content)
    org_name = name_match.group(1) if name_match else "Demo Shop"

    # Extract subdomain
    subdomain_match = re.search(r'subdomain: "([^"]+)"', content)
    slug = subdomain_match.group(1) if subdomain_match else "demo"

    # Replace mockTenantContext with mockOrgContext
    content = re.sub(pattern, replacement_template.format(org_id=org_id, org_name=org_name, slug=slug), content, flags=re.DOTALL)

    # Also replace variable name references
    content = content.replace('mockTenantContext', 'mockOrgContext')

    with open(file_path, 'w') as f:
        f.write(content)

    print(f"Updated {file_path}")

print("Done!")
PYTHON_SCRIPT

echo "Mock context structure update complete!"
