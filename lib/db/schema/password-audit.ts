import { pgTable, text, timestamp, index, uuid } from "drizzle-orm/pg-core";
import { user, organization } from "./auth";

export const passwordChangeAudit = pgTable(
  "password_change_audit",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    changedByUserId: text("changed_by_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    targetUserId: text("target_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    method: text("method").notNull().$type<'auto_generated' | 'manual_entry' | 'email_reset'>(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { mode: 'date', withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_password_audit_target").on(table.targetUserId),
    index("idx_password_audit_changed_by").on(table.changedByUserId),
    index("idx_password_audit_org").on(table.organizationId),
    index("idx_password_audit_created").on(table.createdAt),
  ]
);

export type PasswordChangeAudit = typeof passwordChangeAudit.$inferSelect;
export type NewPasswordChangeAudit = typeof passwordChangeAudit.$inferInsert;
