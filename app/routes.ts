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

  // Tenant application routes (accessed via subdomain)
  // These routes check for tenant context in their loaders
  ...prefix("app", [
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

      // Customers
      route("customers", "routes/tenant/customers/index.tsx"),
      route("customers/new", "routes/tenant/customers/new.tsx"),
      route("customers/:id/edit", "routes/tenant/customers/$id/edit.tsx"),
      route("customers/:id", "routes/tenant/customers/$id.tsx"),

      // Tours & Trips
      route("tours", "routes/tenant/tours/index.tsx"),
      route("tours/new", "routes/tenant/tours/new.tsx"),
      route("tours/:id/edit", "routes/tenant/tours/$id/edit.tsx"),
      route("tours/:id", "routes/tenant/tours/$id.tsx"),

      // Image management API
      route("images", "routes/tenant/images/index.tsx"),
      route("images/upload", "routes/tenant/images/upload.tsx"),
      route("images/delete", "routes/tenant/images/delete.tsx"),
      route("images/reorder", "routes/tenant/images/reorder.tsx"),
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

      // Reports
      route("reports", "routes/tenant/reports/index.tsx"),
      route("reports/export/csv", "routes/tenant/reports/export.csv.tsx"),
      route("reports/export/pdf", "routes/tenant/reports/export.pdf.tsx"),

      // Settings
      route("settings", "routes/tenant/settings/index.tsx"),
      route("settings/profile", "routes/tenant/settings/profile.tsx"),
      route("settings/billing", "routes/tenant/settings/billing.tsx"),
      route("settings/team", "routes/tenant/settings/team.tsx"),
      route("settings/integrations", "routes/tenant/settings/integrations.tsx"),
      route("settings/notifications", "routes/tenant/settings/notifications.tsx"),
      route("settings/booking-widget", "routes/tenant/settings/booking-widget.tsx"),

      // Public Site Settings (with nested routes for tabs)
      layout("routes/tenant/settings/public-site.tsx", [
        route("settings/public-site", "routes/tenant/settings/public-site.general.tsx"),
        route("settings/public-site/content", "routes/tenant/settings/public-site.content.tsx"),
        route("settings/public-site/appearance", "routes/tenant/settings/public-site.appearance.tsx"),
      ]),
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

  // Admin protected routes with layout
  layout("routes/admin/layout.tsx", [
    route("dashboard", "routes/admin/index.tsx"),
    route("tenants/new", "routes/admin/tenants.new.tsx"),
    route("tenants/:id", "routes/admin/tenants.$id.tsx"),
    route("plans", "routes/admin/plans.tsx"),
    route("plans/:id", "routes/admin/plans.$id.tsx"),
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
  ...prefix("embed", [
    layout("routes/embed/$tenant.tsx", [
      route(":tenant", "routes/embed/$tenant._index.tsx"),
      route(":tenant/tour/:id", "routes/embed/$tenant.tour.$id.tsx"),
      route(":tenant/book", "routes/embed/$tenant.book.tsx"),
      route(":tenant/confirm", "routes/embed/$tenant.confirm.tsx"),
    ]),
  ]),
] satisfies RouteConfig;
