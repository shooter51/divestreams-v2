import { type RouteConfig, index, route, prefix, layout } from "@react-router/dev/routes";

export default [
  // Public marketing pages (no subdomain)
  index("routes/marketing/home.tsx"),
  route("pricing", "routes/marketing/pricing.tsx"),
  route("features", "routes/marketing/features.tsx"),
  route("signup", "routes/marketing/signup.tsx"),
  route("terms", "routes/marketing/terms.tsx"),
  route("privacy", "routes/marketing/privacy.tsx"),

  // Stripe webhook
  route("api/stripe/webhook", "routes/api/stripe-webhook.tsx"),

  // Health check
  route("api/health", "routes/api/health.tsx"),

  // Debug endpoint (temporary)
  route("api/debug-orgs", "routes/api/debug-orgs.tsx"),

  // Better Auth API (catch-all for /api/auth/*)
  route("api/auth/*", "routes/api/auth.$.tsx"),

  // Site disabled page (shown when public site is disabled)
  route("site-disabled", "routes/site-disabled.tsx"),

  // Tenant application routes (accessed via subdomain)
  // These routes check for tenant context in their loaders
  ...prefix("tenant", [
    // Image management API (outside layout - JSON responses only)
    route("images", "routes/tenant/images/index.tsx"),
    route("images/upload", "routes/tenant/images/upload.tsx"),
    route("images/delete", "routes/tenant/images/delete.tsx"),
    route("images/reorder", "routes/tenant/images/reorder.tsx"),

    // Gallery upload API (outside layout - JSON responses only)
    route("gallery/upload", "routes/tenant/gallery/upload.tsx"),

    // Reports export API (outside layout - file responses only)
    route("reports/export/csv", "routes/tenant/reports/export.csv.tsx"),
    route("reports/export/pdf", "routes/tenant/reports/export.pdf.tsx"),

    // Tenant dashboard layout
    layout("routes/tenant/layout.tsx", [
      index("routes/tenant/dashboard.tsx"),

      // Bookings
      route("bookings", "routes/tenant/bookings/index.tsx"),
      route("bookings/new", "routes/tenant/bookings/new.tsx"),
      route("bookings/:id/edit", "routes/tenant/bookings/$id/edit.tsx"),
      route("bookings/:id", "routes/tenant/bookings/$id.tsx"),

      // Calendar
      route("calendar", "routes/tenant/calendar.tsx"),

      // POS
      route("pos", "routes/tenant/pos.tsx"),
      route("pos/products", "routes/tenant/pos/products/index.tsx"),
      route("pos/products/new", "routes/tenant/pos/products/new.tsx"),
      route("pos/products/:id", "routes/tenant/pos/products/$id.tsx"),
      route("pos/products/:id/edit", "routes/tenant/pos/products/$id/edit.tsx"),
      route("pos/transactions", "routes/tenant/pos/transactions/index.tsx"),

      // Customers
      route("customers", "routes/tenant/customers/index.tsx"),
      route("customers/new", "routes/tenant/customers/new.tsx"),
      route("customers/:id/edit", "routes/tenant/customers/$id/edit.tsx"),
      route("customers/:id", "routes/tenant/customers/$id.tsx"),

      // Tours & Trips
      route("tours", "routes/tenant/tours/index.tsx"),
      route("tours/new", "routes/tenant/tours/new.tsx"),
      route("tours/:id/edit", "routes/tenant/tours/$id/edit.tsx"),
      route("tours/:id/duplicate", "routes/tenant/tours/$id.duplicate.tsx"),
      route("tours/:id", "routes/tenant/tours/$id.tsx"),

      // Trips
      route("trips", "routes/tenant/trips/index.tsx"),
      route("trips/new", "routes/tenant/trips/new.tsx"),
      route("trips/:id/edit", "routes/tenant/trips/$id/edit.tsx"),
      route("trips/:id", "routes/tenant/trips/$id.tsx"),

      // Dive Sites
      route("dive-sites", "routes/tenant/dive-sites/index.tsx"),
      route("dive-sites/new", "routes/tenant/dive-sites/new.tsx"),
      route("dive-sites/:id/edit", "routes/tenant/dive-sites/$id/edit.tsx"),
      route("dive-sites/:id", "routes/tenant/dive-sites/$id.tsx"),

      // Boats
      route("boats", "routes/tenant/boats/index.tsx"),
      route("boats/new", "routes/tenant/boats/new.tsx"),
      route("boats/:id/edit", "routes/tenant/boats/$id/edit.tsx"),
      route("boats/:id", "routes/tenant/boats/$id.tsx"),

      // Equipment
      route("equipment", "routes/tenant/equipment/index.tsx"),
      route("equipment/new", "routes/tenant/equipment/new.tsx"),
      route("equipment/:id/edit", "routes/tenant/equipment/$id/edit.tsx"),
      route("equipment/:id", "routes/tenant/equipment/$id.tsx"),

      // Products (Inventory)
      route("products", "routes/tenant/products.tsx"),

      // Discount Codes
      route("discounts", "routes/tenant/discounts.tsx"),

      // Gallery
      route("gallery", "routes/tenant/gallery/index.tsx"),
      route("gallery/new", "routes/tenant/gallery/new.tsx"),
      route("gallery/upload-images", "routes/tenant/gallery/upload-images.tsx"),
      route("gallery/:id", "routes/tenant/gallery/$id.tsx"),

      // Training Module
      route("training", "routes/tenant/training/index.tsx"),
      route("training/import", "routes/tenant/training/import/index.tsx"),
      route("training/courses", "routes/tenant/training/courses/index.tsx"),
      route("training/courses/new", "routes/tenant/training/courses/new.tsx"),
      route("training/courses/:id/edit", "routes/tenant/training/courses/$id/edit.tsx"),
      route("training/courses/:id", "routes/tenant/training/courses/$id.tsx"),
      route("training/sessions", "routes/tenant/training/sessions/index.tsx"),
      route("training/sessions/new", "routes/tenant/training/sessions/new.tsx"),
      route("training/sessions/:id", "routes/tenant/training/sessions/$id.tsx"),
      route("training/enrollments", "routes/tenant/training/enrollments/index.tsx"),
      route("training/enrollments/new", "routes/tenant/training/enrollments/new.tsx"),
      route("training/enrollments/:id", "routes/tenant/training/enrollments/$id.tsx"),

      // Reports
      route("reports", "routes/tenant/reports/index.tsx"),

      // Settings
      route("settings", "routes/tenant/settings/index.tsx"),
      route("settings/profile", "routes/tenant/settings/profile.tsx"),
      route("settings/billing", "routes/tenant/settings/billing.tsx"),
      route("settings/team", "routes/tenant/settings/team.tsx"),
      route("settings/integrations", "routes/tenant/settings/integrations.tsx"),
      route("settings/integrations/quickbooks", "routes/tenant/settings/integrations/quickbooks.tsx"),
      route("settings/integrations/zapier", "routes/tenant/settings/integrations/zapier.tsx"),
      route("settings/notifications", "routes/tenant/settings/notifications.tsx"),
      route("settings/booking-widget", "routes/tenant/settings/booking-widget.tsx"),

      // Public Site Settings (with nested routes for tabs)
      layout("routes/tenant/settings/public-site.tsx", [
        route("settings/public-site", "routes/tenant/settings/public-site.general.tsx"),
        route("settings/public-site/content", "routes/tenant/settings/public-site.content.tsx"),
        route("settings/public-site/appearance", "routes/tenant/settings/public-site.appearance.tsx"),
      ]),

      // Training Settings
      route("settings/training/agencies", "routes/tenant/settings/training/agencies.tsx"),
      route("settings/training/levels", "routes/tenant/settings/training/levels.tsx"),
    ]),
  ]),

  // Auth routes for tenants
  ...prefix("auth", [
    route("login", "routes/auth/login.tsx"),
    route("logout", "routes/auth/logout.tsx"),
    route("signup", "routes/tenant/signup.tsx"),
    route("forgot-password", "routes/auth/forgot-password.tsx"),
    route("reset-password", "routes/auth/reset-password.tsx"),
  ]),

  // Admin routes (accessed via admin.divestreams.com)
  // Login is outside the layout so it doesn't require auth
  route("login", "routes/admin/login.tsx"),
  route("logout", "routes/admin/logout.tsx"),
  route("auth/accept-invite", "routes/admin/auth/accept-invite.tsx"),

  // Admin protected routes with layout
  layout("routes/admin/layout.tsx", [
    route("dashboard", "routes/admin/index.tsx"),
    route("tenants/new", "routes/admin/tenants.new.tsx"),
    route("tenants/:id", "routes/admin/tenants.$id.tsx"),
    route("plans", "routes/admin/plans.tsx"),
    route("plans/:id", "routes/admin/plans.$id.tsx"),
    route("settings", "routes/admin/settings.tsx"),
    route("settings/team", "routes/admin/settings.team.tsx"),
    route("contact-messages", "routes/admin/contact-messages.tsx"),
  ]),
  // Public site routes (accessed via subdomain/site)
  // These routes are for the customer-facing public website
  ...prefix("site", [
    layout("routes/site/_layout.tsx", [
      index("routes/site/index.tsx"), // Homepage
      route("about", "routes/site/about.tsx"),
      route("trips", "routes/site/trips/index.tsx"),
      route("trips/:tripId", "routes/site/trips/$tripId.tsx"),
      route("courses", "routes/site/courses/index.tsx"),
      route("courses/:courseId", "routes/site/courses/$courseId.tsx"),
      route("equipment", "routes/site/equipment/index.tsx"),
      route("equipment/:equipmentId", "routes/site/equipment/$equipmentId.tsx"),
      route("gallery", "routes/site/gallery.tsx"),
      route("contact", "routes/site/contact.tsx"),
      route("login", "routes/site/login.tsx"),
      route("register", "routes/site/register.tsx"),
      route("book/:type/:id", "routes/site/book/$type.$id.tsx"),

      // Account routes (protected by layout auth guard)
      layout("routes/site/account/_layout.tsx", [
        route("account", "routes/site/account/index.tsx"),
        route("account/bookings", "routes/site/account/bookings.tsx"),
        route("account/profile", "routes/site/account/profile.tsx"),
        route("account/logout", "routes/site/account/logout.tsx"),
      ]),
    ]),
  ]),
  // Embed booking widget routes (for external website integration)
  ...prefix("embed/:tenant", [
    layout("routes/embed/$tenant.tsx", [
      index("routes/embed/$tenant._index.tsx"),
      route("tour/:id", "routes/embed/$tenant.tour.$id.tsx"),
      route("book", "routes/embed/$tenant.book.tsx"),
      route("confirm", "routes/embed/$tenant.confirm.tsx"),
      // Course enrollment widget routes
      route("courses", "routes/embed/$tenant.courses.tsx"),
      route("courses/:courseId", "routes/embed/$tenant.courses.$courseId.tsx"),
      route("courses/:courseId/enroll", "routes/embed/$tenant.courses.$courseId.enroll.tsx"),
      route("courses/confirm", "routes/embed/$tenant.courses.confirm.tsx"),
    ]),
  ]),
] satisfies RouteConfig;
