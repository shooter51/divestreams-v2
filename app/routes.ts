import { type RouteConfig, index, route, prefix, layout } from "@react-router/dev/routes";

export default [
  // Public marketing pages (no subdomain)
  index("routes/marketing/home.tsx"),
  route("pricing", "routes/marketing/pricing.tsx"),
  route("features", "routes/marketing/features.tsx"),
  route("signup", "routes/marketing/signup.tsx"),

  // Stripe webhook
  route("api/stripe/webhook", "routes/api/stripe-webhook.tsx"),

  // Health check
  route("api/health", "routes/api/health.tsx"),

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

      // Reports
      route("reports", "routes/tenant/reports/index.tsx"),

      // Settings
      route("settings", "routes/tenant/settings/index.tsx"),
      route("settings/billing", "routes/tenant/settings/billing.tsx"),
      route("settings/team", "routes/tenant/settings/team.tsx"),
      route("settings/integrations", "routes/tenant/settings/integrations.tsx"),
    ]),
  ]),

  // Auth routes for tenants
  ...prefix("auth", [
    route("login", "routes/auth/login.tsx"),
    route("logout", "routes/auth/logout.tsx"),
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
] satisfies RouteConfig;
