# Defects

| # | Description | Severity | Status | Notes |
|---|-------------|----------|--------|-------|
| 1 | No tours have images | Medium | Open | `images` column is null for all tours in DB — seed data missing images |
| 2 | All bookings show $0 | High | Open | `trips.price` is null; mapTrip ignores `tour_price` fallback; getTrips list query omits tour_price |
| 3 | Depth unit (meters) not configurable | Low | Open | Depth displays in meters with no org-level setting to switch to feet |
| 4 | No dive site selection on trips | Medium | Open | Trip create/edit form has no field to associate a dive site |
| 5 | Image upload returns Forbidden, crashes JSON parse | High | Open | Upload endpoint returns plain text "Forbidden:..." — client SyntaxError on JSON.parse |
