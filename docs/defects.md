# Defects

| # | Description | Severity | Status | Notes |
|---|-------------|----------|--------|-------|
| 1 | Seeded entities have no images (tours, boats, dive sites, products, equipment) | Medium | Open | API seed pipeline creates entities via form actions which don't insert into `images` table. Server-side seedDemoData does insert images but only runs via Settings button which is hidden once data exists. Gallery images work (separate galleryImages table). |
| 2 | All bookings show $0 | High | Fixed | `trips.price` is null; mapTrip ignores `tour_price` fallback; getTrips list query omits tour_price |
| 3 | Depth unit (meters) not configurable | Low | Open | Depth displays in meters with no org-level setting to switch to feet |
| 4 | No dive site selection on trips | Medium | Open | Trip create/edit form has no field to associate a dive site |
| 5 | Image upload returns Forbidden, crashes JSON parse | High | Fixed | ImageManager missing CSRF token in upload/delete FormData |
| 6 | Import courses has no agencies | Medium | Fixed | `seed-agency-templates` was never run on test VPS; ran manually, 680 templates imported. `seed:templates` should be part of `seed:full` |
| 7 | Connect buttons on integrations page do nothing | High | Fixed | Page-level fetcher response (showXModal: true) never reaches component's own fetcher; refactored to client-side openModal prop |
| 8 | Inviting existing-pending user gives unhelpful error | Low | Open | "This email already has a pending invitation" — no way to resend or cancel |
| 9 | Post-invitation redirect goes to root URL instead of tenant login | Medium | Fixed | accept-invite.tsx redirected to /login (base domain); now looks up org slug and redirects to tenant subdomain login |
| 10 | Public site only shows gallery images; tour images absent | Medium | Open | Tours have no images in seed data (Defect #1 manifests on public site) |
| 11 | No staff assignment on trip edit form | Medium | Fixed | edit.tsx had no staff section; added staff loader, action handling, and UI with pre-checked checkboxes |
| 12 | Request account deletion does nothing | High | Fixed | Danger Zone section had no feedback display; fetcher.data.message now shown below the delete button so success/error is visible |
