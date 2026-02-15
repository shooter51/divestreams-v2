#!/usr/bin/env python3
"""
Fix inline mock structures in integration tests from old tenant format to new OrgContext format
"""

import re
import glob

files = glob.glob("tests/integration/**/*.ts", recursive=True)

# Pattern to match the old inline mock structure (more flexible with whitespace)
old_pattern = re.compile(
    r'vi\.mocked\(orgContext\.requireOrgContext\)\.mockResolvedValue\(\{[^}]*'
    r'tenant:\s*\{[^}]+\},[^}]*'
    r'organizationId:\s*([^,\s]+),?[^}]*'
    r'\}\s*as\s+any\);',
    re.DOTALL | re.MULTILINE
)

new_template = '''vi.mocked(orgContext.requireOrgContext).mockResolvedValue({{
      org: {{ id: {org_id}, name: "Test Org", slug: "test", createdAt: new Date() }},
      user: {{ id: "user-1", email: "owner@example.com", name: "Owner" }},
      session: {{ id: "session-1" }},
      membership: {{ id: "member-1", role: "owner" }},
      subscription: null,
      limits: {{
        customers: 50, bookingsPerMonth: 100, tours: 10, teamMembers: 1,
        hasPOS: true, hasEquipmentRentals: true, hasAdvancedReports: false, hasEmailNotifications: false,
      }},
      usage: {{ customers: 0, tours: 0, bookingsThisMonth: 0 }},
      canAddCustomer: true, canAddTour: true, canAddBooking: true, isPremium: false,
    }} as any);'''

count = 0
for file_path in files:
    try:
        with open(file_path, 'r') as f:
            content = f.read()

        if 'tenant: { id:' not in content and 'tenant: {' not in content:
            continue

        # Find org ID from mockOrganizationId variable or from the old structure
        org_id_var = re.search(r'const mockOrganizationId = (["\'][^"\']+["\']);', content)
        if org_id_var:
            org_id = org_id_var.group(1)
        else:
            # Try to extract from the mock itself
            org_id_match = old_pattern.search(content)
            if org_id_match:
                org_id = org_id_match.group(1)
            else:
                org_id = '"org-uuid-123"'

        # Replace the old pattern with new
        new_content = old_pattern.sub(new_template.format(org_id=org_id), content)

        if new_content != content:
            with open(file_path, 'w') as f:
                f.write(new_content)
            print(f"Fixed {file_path}")
            count += 1

    except Exception as e:
        print(f"Error processing {file_path}: {e}")

print(f"\nFixed {count} files")
