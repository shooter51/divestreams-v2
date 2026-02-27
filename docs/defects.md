# Defects

| # | Description | Severity | Status | Notes |
|---|-------------|----------|--------|-------|
| 1 | Seeded entities have no images (tours, boats, dive sites, products, equipment) | Medium | Fixed | Added `scripts/seed-images.ts` (`npm run seed:images -- <subdomain>`) that inserts Unsplash URLs into the `images` table for all existing entities that have none. |
| 2 | All bookings show $0 | High | Fixed | `trips.price` is null; mapTrip ignores `tour_price` fallback; getTrips list query omits tour_price |
| 3 | Depth unit (meters) not configurable | Low | Fixed | Added `depthUnit` (meters/feet) to org metadata; toggle in Settings → Profile → Regional Settings; dive site detail page respects unit |
| 4 | No dive site selection on trips | Medium | Fixed | Trip edit form shows dive sites from the selected tour (read-only). Create form shows dive sites when tour pre-selected via URL param. |
| 5 | Image upload returns Forbidden, crashes JSON parse | High | Fixed | ImageManager missing CSRF token in upload/delete FormData |
| 6 | Import courses has no agencies | Medium | Fixed | `seed-agency-templates` was never run on test VPS; ran manually, 680 templates imported. `seed:templates` should be part of `seed:full` |
| 7 | Connect buttons on integrations page do nothing | High | Fixed | Page-level fetcher response (showXModal: true) never reaches component's own fetcher; refactored to client-side openModal prop |
| 8 | Inviting existing-pending user gives unhelpful error | Low | Fixed | Error message now points to Pending Invitations section; Resend/Cancel buttons were already present there |
| 9 | Post-invitation redirect goes to root URL instead of tenant login | Medium | Fixed | accept-invite.tsx redirected to /login (base domain); now looks up org slug and redirects to tenant subdomain login |
| 10 | Public site only shows gallery images; tour images absent | Medium | Fixed | Resolved by Defect #1 fix — run `npm run seed:images` to populate tour images |
| 11 | No staff assignment on trip edit form | Medium | Fixed | edit.tsx had no staff section; added staff loader, action handling, and UI with pre-checked checkboxes |
| 12 | Request account deletion does nothing | High | Fixed | Danger Zone section had no feedback display; fetcher.data.message now shown below the delete button so success/error is visible |
# Post-seed gaps fixes
