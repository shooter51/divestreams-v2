#!/bin/bash

# Fix integration tests to use requireOrgContext instead of requireTenant

set -e

echo "Fixing integration test mocks..."

# List of test files to fix
test_files=(
  "tests/integration/lib/tenant-action-isolation.test.ts"
  "tests/integration/routes/tenant/boats/\$id.test.ts"
  "tests/integration/routes/tenant/boats/\$id/edit.test.ts"
  "tests/integration/routes/tenant/boats/new.test.ts"
  "tests/integration/routes/tenant/bookings/\$id.edit.test.ts"
  "tests/integration/routes/tenant/bookings/\$id.test.ts"
  "tests/integration/routes/tenant/bookings/new.test.ts"
  "tests/integration/routes/tenant/customers-new.test.ts"
  "tests/integration/routes/tenant/customers/\$id.test.ts"
  "tests/integration/routes/tenant/customers/\$id/edit.test.ts"
  "tests/integration/routes/tenant/dive-sites/\$id.test.ts"
  "tests/integration/routes/tenant/dive-sites/\$id/edit.test.ts"
  "tests/integration/routes/tenant/dive-sites/new.test.ts"
  "tests/integration/routes/tenant/equipment/\$id/edit.test.ts"
  "tests/integration/routes/tenant/equipment/new.test.ts"
  "tests/integration/routes/tenant/gallery/\$id.test.ts"
  "tests/integration/routes/tenant/gallery/index.test.ts"
  "tests/integration/routes/tenant/gallery/new.test.ts"
  "tests/integration/routes/tenant/gallery/upload.test.ts"
  "tests/integration/routes/tenant/images-upload.test.ts"
  "tests/integration/routes/tenant/images/delete.test.ts"
  "tests/integration/routes/tenant/images/index.test.ts"
  "tests/integration/routes/tenant/images/reorder.test.ts"
  "tests/integration/routes/tenant/images/upload.test.ts"
  "tests/integration/routes/tenant/pos/products/\$id.test.ts"
  "tests/integration/routes/tenant/pos/products/\$id/edit.test.ts"
  "tests/integration/routes/tenant/pos/products/index.test.ts"
  "tests/integration/routes/tenant/pos/products/new.test.ts"
  "tests/integration/routes/tenant/pos/transactions/index.test.ts"
)

for file in "${test_files[@]}"; do
  if [ -f "$file" ]; then
    echo "Processing $file..."

    # 1. Change mock from requireTenant to requireOrgContext
    sed -i '' 's/requireTenant: vi\.fn()/requireOrgContext: vi.fn()/g' "$file"

    # 2. Change import from requireTenant to requireOrgContext
    sed -i '' 's/import { requireTenant }/import { requireOrgContext }/g' "$file"

    # 3. Change variable references from requireTenant to requireOrgContext
    sed -i '' 's/(requireTenant as Mock)/(requireOrgContext as Mock)/g' "$file"
    sed -i '' 's/expect(requireTenant)/expect(requireOrgContext)/g' "$file"

  else
    echo "Warning: $file not found"
  fi
done

echo "Done! Remember to also update mockTenantContext to mockOrgContext format manually."
