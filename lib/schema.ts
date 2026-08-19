import { pgTable, text, json, timestamp } from "drizzle-orm/pg-core";

export const trailerConfigs = pgTable("trailer_configs", {
  id:        text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  bodyType:  text("body_type").notNull(),
  config:    json("config").notNull(),
  totalPrice: text("total_price"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type TrailerConfig = typeof trailerConfigs.$inferSelect;
export type NewTrailerConfig = typeof trailerConfigs.$inferInsert;