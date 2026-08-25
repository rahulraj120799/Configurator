import { sql } from "drizzle-orm";
import {
  boolean,
  integer,
  json,
  jsonb,
  numeric,
  pgTable,
  smallint,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export type AdminFieldType = "select" | "text" | "number" | "checkbox";

export type AdminConditionOperator =
  | "eq"
  | "neq"
  | "in"
  | "notIn";

export type AdminRuleType =
  | "defaultByParentSelection"
  | "visibility"
  | "optionFilter";

export type AdminTabConfig = {
  tabKey: string;
  label: string;
  sortOrder: number;
  isHidden: boolean;
};

export type AdminFieldOptionConfig = {
  value: string;
  label: string;
  modelFileName?: string;
  price: number;
  isDisplayPrice: boolean;
  sortOrder: number;
  isHidden: boolean;
};

export type AdminFieldCondition = {
  fieldKey: string;
  operator: AdminConditionOperator;
  value: string | string[] | boolean | number;
};

export type AdminFieldConfig = {
  fieldKey: string;
  tabKey: string;
  label: string;
  type: AdminFieldType;
  placeholder?: string;
  helperText?: string;
  sortOrder: number;
  isRequired: boolean;
  isHidden: boolean;
  isDisplayPrice: boolean;
  basePrice: number;
  visibleWhen?: AdminFieldCondition[];
  options?: AdminFieldOptionConfig[];
};

export type AdminRuleConfig = {
  ruleKey: string;
  ruleType: AdminRuleType;
  parentFieldKey: string;
  targetFieldKey: string;
  mapping?: Record<string, string | string[] | boolean | number>;
  conditions?: AdminFieldCondition[];
  stopIfManualOverride?: boolean;
  isHidden: boolean;
};

export const trailerConfigs = pgTable("trailer_configs", {
  id:        text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  bodyType:  text("body_type").notNull(),
  config:    json("config").notNull(),
  totalPrice: text("total_price"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const adminConfigState = pgTable("admin_config_state", {
  id: smallint("id").primaryKey().default(1),
  configName: text("config_name").notNull().default("trailer-configurator"),
  schemaVersion: integer("schema_version").notNull().default(1),
  tabsJson: jsonb("tabs_json")
    .$type<AdminTabConfig[]>()
    .notNull()
    .default(sql`'[]'::jsonb`),
  fieldsJson: jsonb("fields_json")
    .$type<AdminFieldConfig[]>()
    .notNull()
    .default(sql`'[]'::jsonb`),
  rulesJson: jsonb("rules_json")
    .$type<AdminRuleConfig[]>()
    .notNull()
    .default(sql`'[]'::jsonb`),
  isActive: boolean("is_active").notNull().default(true),
  updatedBy: text("updated_by"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const configurationSubmissions = pgTable("configuration_submissions", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  schemaVersion: integer("schema_version").notNull(),
  bodyTypeKey: text("body_type_key"),
  payloadJson: jsonb("payload_json").notNull(),
  totalPrice: numeric("total_price", { precision: 12, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type TrailerConfig = typeof trailerConfigs.$inferSelect;
export type NewTrailerConfig = typeof trailerConfigs.$inferInsert;
export type AdminConfigState = typeof adminConfigState.$inferSelect;
export type NewAdminConfigState = typeof adminConfigState.$inferInsert;
export type ConfigurationSubmission =
  typeof configurationSubmissions.$inferSelect;
export type NewConfigurationSubmission =
  typeof configurationSubmissions.$inferInsert;
