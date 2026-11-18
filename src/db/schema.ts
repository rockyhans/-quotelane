import { pgTable, serial, text, timestamp, boolean, varchar, jsonb } from "drizzle-orm/pg-core";

export const leads = pgTable("leads", {
  id: serial("id").primaryKey(),
  
  // Funnel & Variant Info
  variant: varchar("variant", { length: 10 }).notNull(), // 'A' or 'B'
  
  // Tracking Parameters
  clickId: text("click_id"),
  affId: text("aff_id"),
  channel: text("channel"),
  rawQueryParams: jsonb("raw_query_params"), // All surviving tracking params
  
  // Form Data
  zip: varchar("zip", { length: 10 }).notNull(),
  vehicleYear: varchar("vehicle_year", { length: 10 }),
  vehicleMake: text("vehicle_make"),
  insured: boolean("insured"),
  ageRange: varchar("age_range", { length: 20 }),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull(),
  phone: varchar("phone", { length: 20 }).notNull(),
  
  // Prepopulation Tracking: list of field names that were prefilled from URL
  prefilledFields: jsonb("prefilled_fields").$type<string[]>().default([]),
  
  // Consent Record (mandatory audit trail)
  consentText: text("consent_text").notNull(),
  consentGiven: boolean("consent_given").default(true).notNull(),
  consentTimestamp: timestamp("consent_timestamp", { withTimezone: true }).defaultNow().notNull(),
  ipAddress: text("ip_address").notNull(),
  userAgent: text("user_agent").notNull(),
  pageUrl: text("page_url").notNull(),
  
  // Partner Delivery Status
  partnerSent: boolean("partner_sent").default(false).notNull(),
  partnerSentAt: timestamp("partner_sent_at", { withTimezone: true }),
  partnerResponseCode: text("partner_response_code"),
  partnerResponseBody: text("partner_response_body"),
  partnerError: text("partner_error"),
  
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type Lead = typeof leads.$inferSelect;
export type NewLead = typeof leads.$inferInsert;

