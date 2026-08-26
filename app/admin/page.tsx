"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ConfiguratorShell } from "@/app/components/configurator-shell";
import { defaultCatalogConfig } from "@/lib/admin-config";
import type {
  AdminConditionOperator,
  AdminConfigState,
  AdminFieldCondition,
  AdminFieldConfig,
  AdminFieldOptionConfig,
  AdminFieldType,
  AdminRuleConfig,
  AdminTabConfig,
} from "@/lib/schema";

type EditableAdminConfig = Pick<
  AdminConfigState,
  "tabsJson" | "fieldsJson" | "rulesJson" | "schemaVersion"
>;

const fieldTypeOptions: AdminFieldType[] = ["select", "text", "number", "checkbox"];
const conditionOperators: AdminConditionOperator[] = ["eq", "neq", "in", "notIn"];

const slugifyKey = (value: string) =>
  value
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_")
    .replace(/^([0-9])/, "field_$1")
    .toLowerCase() || "new_item";

const toCamelFieldKey = (value: string) => {
  const slug = slugifyKey(value);
  const parts = slug.split("_").filter(Boolean);

  if (!parts.length) {
    return "newField";
  }

  const [first, ...rest] = parts;
  return [
    first,
    ...rest.map((part) => part.charAt(0).toUpperCase() + part.slice(1)),
  ].join("");
};

const normalizeLabel = (value: string) => value.trim().toLowerCase();

const ensureUniqueFieldKey = (
  fields: AdminFieldConfig[],
  proposed: string,
  currentIndex: number
) => {
  const base = proposed || "newField";
  let next = base;
  let suffix = 2;

  while (
    fields.some(
      (field, index) => index !== currentIndex && field.fieldKey === next
    )
  ) {
    next = `${base}${suffix}`;
    suffix += 1;
  }

  return next;
};

const sortByOrder = <T extends { sortOrder: number }>(items: T[]) =>
  [...items].sort((left, right) => left.sortOrder - right.sortOrder);

const defaultOption = (sortOrder: number): AdminFieldOptionConfig => ({
  value: "",
  label: "",
  modelFileName: "",
  price: 0,
  isDisplayPrice: false,
  sortOrder,
  isHidden: false,
});

const toConditionValueText = (value: AdminFieldCondition["value"]) => {
  if (Array.isArray(value)) {
    return value.join(", ");
  }

  return String(value ?? "");
};

const toConditionValue = (
  operator: AdminConditionOperator,
  value: string
): AdminFieldCondition["value"] => {
  if (operator === "in" || operator === "notIn") {
    return value
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  return value;
};

const defaultCondition = (fieldKey = "bodyType", value = ""): AdminFieldCondition => ({
  fieldKey,
  operator: "eq",
  value,
});

const createField = (tabKey: string, sortOrder: number, fieldKey: string): AdminFieldConfig => ({
  fieldKey,
  tabKey,
  label: "New Field",
  type: "select",
  placeholder: "Select option",
  helperText: "",
  sortOrder,
  isRequired: false,
  isHidden: false,
  isDisplayPrice: false,
  basePrice: 0,
  options: [defaultOption(1)],
});

export default function AdminPage() {
  const [config, setConfig] = useState<EditableAdminConfig | null>(null);
  const [selectedTabKey, setSelectedTabKey] = useState<string>("oemChassis");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [rulesDraft, setRulesDraft] = useState("[]");
  const [expandedFieldKeys, setExpandedFieldKeys] = useState<string[]>([]);
  const [isTabModalOpen, setIsTabModalOpen] = useState(false);
  const [newFieldKeys, setNewFieldKeys] = useState<string[]>([]);
  const [pendingScrollFieldKey, setPendingScrollFieldKey] = useState<string | null>(null);
  const fieldRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    const loadConfig = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const response = await fetch("/api/admin/config");
        if (!response.ok) {
          throw new Error("Failed to load admin config");
        }

        const data = (await response.json()) as AdminConfigState;
        setConfig({
          tabsJson: data.tabsJson,
          fieldsJson: data.fieldsJson,
          rulesJson: data.rulesJson,
          schemaVersion: data.schemaVersion,
        });
        setRulesDraft(JSON.stringify(data.rulesJson, null, 2));

        const firstVisibleTab = sortByOrder(data.tabsJson).find((tab) => !tab.isHidden);
        if (firstVisibleTab) {
          setSelectedTabKey(firstVisibleTab.tabKey);
        }
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load config");
      } finally {
        setIsLoading(false);
      }
    };

    void loadConfig();
  }, []);

  const visibleTabs = useMemo(
    () => sortByOrder(config?.tabsJson ?? []),
    [config?.tabsJson]
  );

  const fieldsForSelectedTab = useMemo(() => {
    if (!config) {
      return [];
    }

    return sortByOrder(
      config.fieldsJson.filter((field) => field.tabKey === selectedTabKey)
    );
  }, [config, selectedTabKey]);

  useEffect(() => {
    if (!pendingScrollFieldKey) {
      return;
    }

    const node = fieldRefs.current[pendingScrollFieldKey];
    if (!node) {
      return;
    }

    node.scrollIntoView({ behavior: "smooth", block: "start" });
    setPendingScrollFieldKey(null);
  }, [fieldsForSelectedTab, pendingScrollFieldKey]);

  const toggleFieldAccordion = (fieldKey: string) => {
    setExpandedFieldKeys((current) =>
      current.includes(fieldKey)
        ? current.filter((key) => key !== fieldKey)
        : [...current, fieldKey]
    );
  };

  const updateConfig = (updater: (current: EditableAdminConfig) => EditableAdminConfig) => {
    setConfig((current) => {
      if (!current) {
        return current;
      }

      return updater(current);
    });
    setSuccessMessage(null);
  };

  const handleAddTab = () => {
    updateConfig((current) => {
      const sortOrder = current.tabsJson.length + 1;
      const newTab: AdminTabConfig = {
        tabKey: `tab_${Date.now()}`,
        label: "New Tab",
        sortOrder,
        isHidden: false,
      };

      setSelectedTabKey(newTab.tabKey);
      return {
        ...current,
        tabsJson: [...current.tabsJson, newTab],
      };
    });
  };

  const handleAddField = () => {
    const newFieldKey = `field_${Date.now()}`;
    setPendingScrollFieldKey(newFieldKey);
    setNewFieldKeys((current) => [...current, newFieldKey]);
    updateConfig((current) => ({
      ...current,
      fieldsJson: [
        ...current.fieldsJson,
        createField(selectedTabKey, fieldsForSelectedTab.length + 1, newFieldKey),
      ],
    }));
  };

  const handleDeleteField = (fieldKey: string) => {
    setNewFieldKeys((current) => current.filter((key) => key !== fieldKey));
    setExpandedFieldKeys((current) => current.filter((key) => key !== fieldKey));
    if (pendingScrollFieldKey === fieldKey) {
      setPendingScrollFieldKey(null);
    }

    updateConfig((current) => ({
      ...current,
      fieldsJson: current.fieldsJson.filter((field) => field.fieldKey !== fieldKey),
    }));
  };

  const handleEditTab = () => {
    setIsTabModalOpen(true);
  };

  const handleSyncData = async () => {
    try {
      setError(null);
      setSuccessMessage(null);
      setIsSyncing(true);

      const response = await fetch("/api/admin/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(defaultCatalogConfig),
      });

      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        throw new Error(body.error ?? "Failed to sync default data");
      }

      const saved = (await response.json()) as AdminConfigState;
      setConfig({
        tabsJson: saved.tabsJson,
        fieldsJson: saved.fieldsJson,
        rulesJson: saved.rulesJson,
        schemaVersion: saved.schemaVersion,
      });
      setNewFieldKeys([]);
      setRulesDraft(JSON.stringify(saved.rulesJson, null, 2));
      setSuccessMessage(`Synced default data to schema version ${saved.schemaVersion}`);
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : "Failed to sync default data");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSave = async () => {
    if (!config) {
      return;
    }

    try {
      setError(null);
      setIsSaving(true);
      const parsedRules = JSON.parse(rulesDraft) as AdminRuleConfig[];
      const normalizedFields = config.fieldsJson.map((field) => {
        const normalizedOptions =
          field.type === "select"
            ? (field.options ?? []).map((option) => {
                const label = option.label.trim();
                return {
                  ...option,
                  label,
                  modelFileName: option.modelFileName?.trim() ?? "",
                  value: label,
                };
              })
            : field.options;

        return {
          ...field,
          label: field.label.trim(),
          options: normalizedOptions,
        };
      });

      for (const field of normalizedFields) {
        if (field.type !== "select") {
          continue;
        }

        const optionLabels = (field.options ?? [])
          .map((option) => option.label.trim())
          .filter(Boolean);

        const duplicateOptionLabel = optionLabels.find(
          (label, index) =>
            optionLabels.findIndex(
              (currentLabel) => normalizeLabel(currentLabel) === normalizeLabel(label)
            ) !== index
        );

        if (duplicateOptionLabel) {
          throw new Error(
            `Duplicate option label \"${duplicateOptionLabel}\" in field \"${field.label}\".`
          );
        }
      }

      for (const tab of config.tabsJson) {
        const labels = normalizedFields
          .filter((field) => field.tabKey === tab.tabKey)
          .map((field) => field.label)
          .filter(Boolean);

        const duplicateFieldLabel = labels.find(
          (label, index) =>
            labels.findIndex(
              (currentLabel) => normalizeLabel(currentLabel) === normalizeLabel(label)
            ) !== index
        );

        // if (duplicateFieldLabel) {
        //   throw new Error(
        //     `Duplicate field label \"${duplicateFieldLabel}\" in tab \"${tab.label}\".`
        //   );
        // }
      }

      const response = await fetch("/api/admin/config", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tabsJson: config.tabsJson,
          fieldsJson: normalizedFields,
          rulesJson: parsedRules,
          updatedBy: "admin-demo",
        }),
      });

      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        throw new Error(body.error ?? "Failed to save config");
      }

      const saved = (await response.json()) as AdminConfigState;
      setConfig({
        tabsJson: saved.tabsJson,
        fieldsJson: saved.fieldsJson,
        rulesJson: saved.rulesJson,
        schemaVersion: saved.schemaVersion,
      });
      setNewFieldKeys([]);
      setRulesDraft(JSON.stringify(saved.rulesJson, null, 2));
      setSuccessMessage(`Saved schema version ${saved.schemaVersion}`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save config");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <ConfiguratorShell
        activeNav="admin"
        sidebarContent={
          <div className="rounded-[20px] border border-white/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.16),rgba(255,255,255,0.08))] px-4 py-4 shadow-xl backdrop-blur-xl">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-100/80">
              Admin Workspace
            </p>
            <p className="mt-2 text-2xl font-bold text-white">Loading</p>
            <p className="mt-2 text-xs text-blue-100/75">
              Preparing configurator schema.
            </p>
          </div>
        }
      >
        <div className="mx-auto max-w-7xl px-8 py-8">
          <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
            <p className="text-sm text-slate-600">Loading admin configurator...</p>
          </div>
        </div>
      </ConfiguratorShell>
    );
  }

  if (!config) {
    return (
      <ConfiguratorShell activeNav="admin">
        <div className="mx-auto max-w-7xl px-8 py-8">
          <div className="rounded-3xl border border-rose-200 bg-rose-50 p-8 shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
            <p className="text-sm text-rose-700">Unable to load admin configurator.</p>
          </div>
        </div>
      </ConfiguratorShell>
    );
  }

  return (
    <ConfiguratorShell activeNav="admin">
      <div className="mx-auto max-w-7xl space-y-6 px-8 py-8">
        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-blue-600/80">
                Admin Configurator
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
                Manage Tabs, Fields, Options, and Conditions
              </h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-600">
                This editor updates the singleton configurator schema used by the app.
                Add tabs, attach fields to tabs, define body-type visibility, and maintain
                option pricing without hardcoding the Configure page.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-700">
                Schema v{config.schemaVersion}
              </span>
            {isSyncing === 'true' && (
              <button
                type="button"
                onClick={handleSyncData}
                disabled={isSyncing || isSaving}
                title="Overwrite the backend catalog with the known-good default data"
                className="rounded-full border border-amber-300 bg-amber-50 px-5 py-2.5 text-sm font-semibold text-amber-800 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSyncing ? "Syncing..." : "Sync Data"}
              </button>
            )}
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="rounded-full bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving ? "Saving..." : "Save Admin Config"}
              </button>
            </div>
          </div>

          {error ? (
            <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          ) : null}
          {successMessage ? (
            <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {successMessage}
            </div>
          ) : null}
        </section>

        <section className="space-y-6">
          <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-slate-900">Tabs</h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleEditTab}
                  className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                >
                  Edit Tab
                </button>
                <button
                  type="button"
                  onClick={handleAddTab}
                  className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 transition hover:border-blue-300 hover:bg-blue-100"
                >
                  Add Tab
                </button>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              {visibleTabs.map((tab) => (
                <button
                  key={tab.tabKey}
                  type="button"
                  onClick={() => setSelectedTabKey(tab.tabKey)}
                  className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                    selectedTabKey === tab.tabKey
                      ? "border-blue-300 bg-blue-50 text-blue-800"
                      : "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300"
                  }`}
                >
                  {tab.label || tab.tabKey}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">

            <div className="space-y-6">
            <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">Fields</h2>
                  <p className="text-sm text-slate-500">Manage fields for the selected tab.</p>
                </div>
                <button
                  type="button"
                  onClick={handleAddField}
                  className="rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
                >
                  Add Field
                </button>
              </div>
            </div>

            <div className="space-y-4">
              {fieldsForSelectedTab.map((field) => {
                const fieldIndex = config.fieldsJson.findIndex(
                  (item) => item.fieldKey === field.fieldKey
                );
                const isExpanded = expandedFieldKeys.includes(field.fieldKey);
                const isNewField = newFieldKeys.includes(field.fieldKey);
                const selectableSourceFields = sortByOrder(
                  config.fieldsJson.filter(
                    (item) =>
                      item.type === "select" &&
                      !item.isHidden &&
                      item.fieldKey !== field.fieldKey
                  )
                );
                const primaryCondition = field.visibleWhen?.[0];
                const primarySourceField = config.fieldsJson.find(
                  (item) => item.fieldKey === primaryCondition?.fieldKey
                );
                const primarySourceOptions = sortByOrder(
                  (primarySourceField?.options ?? []).filter((option) => !option.isHidden)
                );

                return (
                  <article
                    key={field.fieldKey}
                    ref={(node) => {
                      fieldRefs.current[field.fieldKey] = node;
                    }}
                    className={`rounded-[24px] border bg-white p-5 transition shadow-[0_10px_24px_rgba(15,23,42,0.06)] ${
                      isExpanded
                        ? "border-blue-300 shadow-[0_12px_28px_rgba(59,130,246,0.12)]"
                        : "border-slate-200"
                    }`}
                  >
                    <div className="mb-3 flex items-center justify-between gap-3">
                      {isNewField ? (
                        <div className="flex w-full items-center justify-between gap-2">
                          <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700">
                            New Field
                          </span>
                          <button
                            type="button"
                            onClick={() => handleDeleteField(field.fieldKey)}
                            className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-100"
                          >
                            Delete
                          </button>
                        </div>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleFieldAccordion(field.fieldKey)}
                      aria-expanded={isExpanded}
                      className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-[linear-gradient(180deg,rgba(248,250,252,0.96),rgba(239,246,255,0.9))] px-4 py-3 text-left shadow-sm transition hover:border-blue-200 hover:bg-[linear-gradient(180deg,rgba(248,250,252,1),rgba(219,234,254,0.9))]"
                    >
                      <p className="pr-4 text-sm font-semibold text-slate-900">
                        {field.label.trim() || "Untitled Field"}
                      </p>
                      <span className="flex h-10 w-10 items-center justify-center rounded-full border border-blue-100 bg-white text-blue-700 shadow-sm transition">
                        <svg
                          viewBox="0 0 20 20"
                          fill="none"
                          aria-hidden="true"
                          className={`h-5 w-5 transition-transform duration-200 ${
                            isExpanded ? "rotate-180" : "rotate-0"
                          }`}
                        >
                          <path
                            d="M5 7.5L10 12.5L15 7.5"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </span>
                    </button>

                    {isExpanded ? (
                      <div className="mt-4">
                    <div className="grid gap-4 lg:grid-cols-2">
                      <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-600">
                        Label
                        <input
                          value={field.label}
                          onChange={(event) => {
                            const value = event.target.value;
                            const currentFieldKey = field.fieldKey;
                            const isTransientField = newFieldKeys.includes(currentFieldKey);
                            const nextFieldKey = currentFieldKey.startsWith("field_")
                              ? ensureUniqueFieldKey(
                                  config.fieldsJson,
                                  toCamelFieldKey(value),
                                  fieldIndex
                                )
                              : currentFieldKey;
                            updateConfig((current) => ({
                              ...current,
                              fieldsJson: current.fieldsJson.map((item, itemIndex) => {
                                if (itemIndex !== fieldIndex) {
                                  return item;
                                }

                                const nextLabel = value;
                                const isNewFieldKey = item.fieldKey.startsWith("field_");
                                const generatedKey = isNewFieldKey
                                  ? ensureUniqueFieldKey(
                                      current.fieldsJson,
                                      toCamelFieldKey(nextLabel),
                                      itemIndex
                                    )
                                  : item.fieldKey;

                                return {
                                  ...item,
                                  label: nextLabel,
                                  fieldKey: generatedKey,
                                };
                              }),
                              rulesJson: current.rulesJson.map((rule) => {
                                const updatedField = current.fieldsJson[fieldIndex];
                                const nextGenerated = updatedField.fieldKey.startsWith("field_")
                                  ? ensureUniqueFieldKey(
                                      current.fieldsJson,
                                      toCamelFieldKey(value),
                                      fieldIndex
                                    )
                                  : updatedField.fieldKey;

                                return {
                                  ...rule,
                                  parentFieldKey:
                                    rule.parentFieldKey === field.fieldKey
                                      ? nextGenerated
                                      : rule.parentFieldKey,
                                  targetFieldKey:
                                    rule.targetFieldKey === field.fieldKey
                                      ? nextGenerated
                                      : rule.targetFieldKey,
                                };
                              }),
                            }));
                            if (isTransientField && nextFieldKey !== currentFieldKey) {
                              setNewFieldKeys((current) =>
                                current.map((key) => (key === currentFieldKey ? nextFieldKey : key))
                              );
                            }
                          }}
                          className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        />
                      </label>

                      <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-600">
                        Field Type
                        <select
                          value={field.type}
                          onChange={(event) => {
                            const value = event.target.value as AdminFieldType;
                            updateConfig((current) => ({
                              ...current,
                              fieldsJson: current.fieldsJson.map((item, itemIndex) =>
                                itemIndex === fieldIndex
                                  ? {
                                      ...item,
                                      type: value,
                                      options:
                                        value === "select"
                                          ? item.options && item.options.length > 0
                                            ? item.options
                                            : [defaultOption(1)]
                                          : undefined,
                                    }
                                  : item
                              ),
                            }));
                          }}
                          className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        >
                          {fieldTypeOptions.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-600">
                        Placeholder
                        <input
                          value={field.placeholder ?? ""}
                          onChange={(event) => {
                            const value = event.target.value;
                            updateConfig((current) => ({
                              ...current,
                              fieldsJson: current.fieldsJson.map((item, itemIndex) =>
                                itemIndex === fieldIndex ? { ...item, placeholder: value } : item
                              ),
                            }));
                          }}
                          className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        />
                      </label>

                      <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-600">
                        Helper Text
                        <input
                          value={field.helperText ?? ""}
                          onChange={(event) => {
                            const value = event.target.value;
                            updateConfig((current) => ({
                              ...current,
                              fieldsJson: current.fieldsJson.map((item, itemIndex) =>
                                itemIndex === fieldIndex ? { ...item, helperText: value } : item
                              ),
                            }));
                          }}
                          className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        />
                      </label>

                      <div className="grid grid-cols-2 gap-3 lg:col-span-2 xl:grid-cols-5">
                        <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-600">
                          Sort
                          <input
                            type="number"
                            value={field.sortOrder}
                            onChange={(event) => {
                              const value = Number(event.target.value) || 0;
                              updateConfig((current) => ({
                                ...current,
                                fieldsJson: current.fieldsJson.map((item, itemIndex) =>
                                  itemIndex === fieldIndex ? { ...item, sortOrder: value } : item
                                ),
                              }));
                            }}
                            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                          />
                        </label>
                        <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-600">
                          Base Price
                          <input
                            type="number"
                            value={field.basePrice}
                            onChange={(event) => {
                              const value = Number(event.target.value) || 0;
                              updateConfig((current) => ({
                                ...current,
                                fieldsJson: current.fieldsJson.map((item, itemIndex) =>
                                  itemIndex === fieldIndex ? { ...item, basePrice: value } : item
                                ),
                              }));
                            }}
                            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                          />
                        </label>
                        <label className="mt-7 flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                          <input
                            type="checkbox"
                            checked={field.isRequired}
                            onChange={(event) => {
                              const checked = event.target.checked;
                              updateConfig((current) => ({
                                ...current,
                                fieldsJson: current.fieldsJson.map((item, itemIndex) =>
                                  itemIndex === fieldIndex ? { ...item, isRequired: checked } : item
                                ),
                              }));
                            }}
                          />
                          Required
                        </label>
                        <label className="mt-7 flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                          <input
                            type="checkbox"
                            checked={field.isDisplayPrice}
                            onChange={(event) => {
                              const checked = event.target.checked;
                              updateConfig((current) => ({
                                ...current,
                                fieldsJson: current.fieldsJson.map((item, itemIndex) =>
                                  itemIndex === fieldIndex ? { ...item, isDisplayPrice: checked } : item
                                ),
                              }));
                            }}
                          />
                          Display Price
                        </label>
                        <label className="mt-7 flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                          <input
                            type="checkbox"
                            checked={field.isHidden}
                            onChange={(event) => {
                              const checked = event.target.checked;
                              updateConfig((current) => ({
                                ...current,
                                fieldsJson: current.fieldsJson.map((item, itemIndex) =>
                                  itemIndex === fieldIndex ? { ...item, isHidden: checked } : item
                                ),
                              }));
                            }}
                          />
                          Hidden
                        </label>
                      </div>
                    </div>

                    <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="mb-4 rounded-xl border border-blue-100 bg-blue-50/40 p-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">
                          Quick Visibility Association
                        </p>
                        <p className="mt-1 text-xs text-blue-800/70">
                          Link this field to any dropdown option (for example, show fields when Truck Tier = Tier 1).
                        </p>

                        <div className="mt-3 grid gap-3 md:grid-cols-3">
                          <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
                            Source Field
                            <select
                              value={primaryCondition?.fieldKey ?? ""}
                              onChange={(event) => {
                                const sourceFieldKey = event.target.value;

                                updateConfig((current) => ({
                                  ...current,
                                  fieldsJson: current.fieldsJson.map((item, itemIndex) => {
                                    if (itemIndex !== fieldIndex) {
                                      return item;
                                    }

                                    const currentConditions = item.visibleWhen ?? [];
                                    if (!sourceFieldKey) {
                                      const remaining = currentConditions.slice(1);
                                      return {
                                        ...item,
                                        visibleWhen: remaining.length > 0 ? remaining : undefined,
                                      };
                                    }

                                    const selectedSourceField = current.fieldsJson.find(
                                      (entry) => entry.fieldKey === sourceFieldKey
                                    );
                                    const selectedSourceValue =
                                      sortByOrder(selectedSourceField?.options ?? []).find(
                                        (entry) => !entry.isHidden
                                      )?.value ?? "";

                                    const nextPrimary = defaultCondition(
                                      sourceFieldKey,
                                      selectedSourceValue
                                    );

                                    return {
                                      ...item,
                                      visibleWhen: [nextPrimary, ...currentConditions.slice(1)],
                                    };
                                  }),
                                }));
                              }}
                              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                            >
                              <option value="">Always visible</option>
                              {selectableSourceFields.map((sourceField) => (
                                <option key={sourceField.fieldKey} value={sourceField.fieldKey}>
                                  {sourceField.label} ({sourceField.fieldKey})
                                </option>
                              ))}
                            </select>
                          </label>

                          <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
                            Operator
                            <select
                              value={primaryCondition?.operator ?? "eq"}
                              onChange={(event) => {
                                const operator = event.target.value as AdminConditionOperator;
                                updateConfig((current) => ({
                                  ...current,
                                  fieldsJson: current.fieldsJson.map((item, itemIndex) => {
                                    if (itemIndex !== fieldIndex) {
                                      return item;
                                    }

                                    const currentConditions = item.visibleWhen ?? [];
                                    if (!currentConditions.length) {
                                      return item;
                                    }

                                    const first = currentConditions[0];
                                    return {
                                      ...item,
                                      visibleWhen: [
                                        {
                                          ...first,
                                          operator,
                                          value: toConditionValue(
                                            operator,
                                            toConditionValueText(first.value)
                                          ),
                                        },
                                        ...currentConditions.slice(1),
                                      ],
                                    };
                                  }),
                                }));
                              }}
                              disabled={!primaryCondition}
                              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:opacity-50"
                            >
                              {conditionOperators.map((operator) => (
                                <option key={operator} value={operator}>
                                  {operator}
                                </option>
                              ))}
                            </select>
                          </label>

                          <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
                            Option Value
                            {primarySourceOptions.length > 0 &&
                            primaryCondition &&
                            primaryCondition.operator !== "in" &&
                            primaryCondition.operator !== "notIn" ? (
                              <select
                                value={toConditionValueText(primaryCondition.value)}
                                onChange={(event) => {
                                  const value = event.target.value;
                                  updateConfig((current) => ({
                                    ...current,
                                    fieldsJson: current.fieldsJson.map((item, itemIndex) => {
                                      if (itemIndex !== fieldIndex) {
                                        return item;
                                      }

                                      const currentConditions = item.visibleWhen ?? [];
                                      if (!currentConditions.length) {
                                        return item;
                                      }

                                      const first = currentConditions[0];
                                      return {
                                        ...item,
                                        visibleWhen: [
                                          { ...first, value },
                                          ...currentConditions.slice(1),
                                        ],
                                      };
                                    }),
                                  }));
                                }}
                                disabled={!primaryCondition}
                                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:opacity-50"
                              >
                                <option value="">Select option</option>
                                {primarySourceOptions.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <input
                                value={primaryCondition ? toConditionValueText(primaryCondition.value) : ""}
                                onChange={(event) => {
                                  const value = event.target.value;
                                  updateConfig((current) => ({
                                    ...current,
                                    fieldsJson: current.fieldsJson.map((item, itemIndex) => {
                                      if (itemIndex !== fieldIndex) {
                                        return item;
                                      }

                                      const currentConditions = item.visibleWhen ?? [];
                                      if (!currentConditions.length) {
                                        return item;
                                      }

                                      const first = currentConditions[0];
                                      return {
                                        ...item,
                                        visibleWhen: [
                                          {
                                            ...first,
                                            value: toConditionValue(first.operator, value),
                                          },
                                          ...currentConditions.slice(1),
                                        ],
                                      };
                                    }),
                                  }));
                                }}
                                placeholder={
                                  primaryCondition?.operator === "in" ||
                                  primaryCondition?.operator === "notIn"
                                    ? "comma,separated,values"
                                    : "value"
                                }
                                disabled={!primaryCondition}
                                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:opacity-50"
                              />
                            )}
                          </label>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-slate-900">Visibility Conditions</h3>
                        <button
                          type="button"
                          onClick={() => {
                            const fallbackSource = selectableSourceFields[0];
                            const fallbackValue =
                              sortByOrder(fallbackSource?.options ?? []).find(
                                (entry) => !entry.isHidden
                              )?.value ?? "";

                            updateConfig((current) => ({
                              ...current,
                              fieldsJson: current.fieldsJson.map((item, itemIndex) =>
                                itemIndex === fieldIndex
                                  ? {
                                      ...item,
                                      visibleWhen: [
                                        ...(item.visibleWhen ?? []),
                                        defaultCondition(
                                          fallbackSource?.fieldKey ?? "bodyType",
                                          fallbackValue
                                        ),
                                      ],
                                    }
                                  : item
                              ),
                            }));
                          }}
                          className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 transition hover:border-blue-300 hover:bg-blue-100"
                        >
                          Add Condition
                        </button>
                      </div>

                      <div className="mt-3 space-y-3">
                        {(field.visibleWhen ?? []).map((condition, conditionIndex) => (
                          <div key={`${field.fieldKey}-${conditionIndex}`} className="grid gap-3 md:grid-cols-3">
                            <input
                              value={condition.fieldKey}
                              onChange={(event) => {
                                const value = event.target.value;
                                updateConfig((current) => ({
                                  ...current,
                                  fieldsJson: current.fieldsJson.map((item, itemIndex) =>
                                    itemIndex === fieldIndex
                                      ? {
                                          ...item,
                                          visibleWhen: (item.visibleWhen ?? []).map((entry, entryIndex) =>
                                            entryIndex === conditionIndex
                                              ? { ...entry, fieldKey: value }
                                              : entry
                                          ),
                                        }
                                      : item
                                  ),
                                }));
                              }}
                              placeholder="fieldKey"
                              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                            />
                            <select
                              value={condition.operator}
                              onChange={(event) => {
                                const value = event.target.value as AdminConditionOperator;
                                updateConfig((current) => ({
                                  ...current,
                                  fieldsJson: current.fieldsJson.map((item, itemIndex) =>
                                    itemIndex === fieldIndex
                                      ? {
                                          ...item,
                                          visibleWhen: (item.visibleWhen ?? []).map((entry, entryIndex) =>
                                            entryIndex === conditionIndex
                                              ? {
                                                  ...entry,
                                                  operator: value,
                                                  value: toConditionValue(
                                                    value,
                                                    toConditionValueText(entry.value)
                                                  ),
                                                }
                                              : entry
                                          ),
                                        }
                                      : item
                                  ),
                                }));
                              }}
                              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                            >
                              {conditionOperators.map((operator) => (
                                <option key={operator} value={operator}>
                                  {operator}
                                </option>
                              ))}
                            </select>
                            <input
                              value={toConditionValueText(condition.value)}
                              onChange={(event) => {
                                const value = event.target.value;
                                updateConfig((current) => ({
                                  ...current,
                                  fieldsJson: current.fieldsJson.map((item, itemIndex) =>
                                    itemIndex === fieldIndex
                                      ? {
                                          ...item,
                                          visibleWhen: (item.visibleWhen ?? []).map((entry, entryIndex) =>
                                            entryIndex === conditionIndex
                                              ? {
                                                  ...entry,
                                                  value: toConditionValue(entry.operator, value),
                                                }
                                              : entry
                                          ),
                                        }
                                      : item
                                  ),
                                }));
                              }}
                              placeholder="value"
                              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    {field.type === "select" ? (
                      <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-semibold text-slate-900">Options</h3>
                          <button
                            type="button"
                            onClick={() => {
                              updateConfig((current) => ({
                                ...current,
                                fieldsJson: current.fieldsJson.map((item, itemIndex) =>
                                  itemIndex === fieldIndex
                                    ? {
                                        ...item,
                                        options: [
                                          ...(item.options ?? []),
                                          defaultOption((item.options?.length ?? 0) + 1),
                                        ],
                                      }
                                    : item
                                ),
                              }));
                            }}
                            className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 transition hover:border-blue-300 hover:bg-blue-100"
                          >
                            Add Option
                          </button>
                        </div>

                        <div className="mt-3 space-y-3">
                          {(field.options ?? []).map((option, optionIndex) => (
                            <div
                              key={`${field.fieldKey}-${optionIndex}`}
                              className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-white p-3 md:grid-cols-2 xl:grid-cols-6"
                            >
                              <label className="min-w-0 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
                                Label
                                <input
                                  value={option.label}
                                  onChange={(event) => {
                                    const value = event.target.value;
                                    updateConfig((current) => ({
                                      ...current,
                                      fieldsJson: current.fieldsJson.map((item, itemIndex) => {
                                        if (itemIndex !== fieldIndex) {
                                          return item;
                                        }

                                        const existingOptions = item.options ?? [];
                                        const hasDuplicate = existingOptions.some(
                                          (entry, entryIndex) =>
                                            entryIndex !== optionIndex &&
                                            normalizeLabel(entry.label) === normalizeLabel(value) &&
                                            normalizeLabel(value).length > 0
                                        );

                                        if (hasDuplicate) {
                                          setError(
                                            `Duplicate option label \"${value}\" in field \"${field.label}\".`
                                          );
                                          return item;
                                        }

                                        return {
                                          ...item,
                                          options: existingOptions.map((entry, entryIndex) =>
                                            entryIndex === optionIndex
                                              ? { ...entry, label: value, value }
                                              : entry
                                          ),
                                        };
                                      }),
                                    }));
                                  }}
                                  placeholder="Option label"
                                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                />
                              </label>
                              <label className="min-w-0 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
                                <span className="flex items-center gap-1.5">
                                  <span>File Name</span>
                                  <span
                                    className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-300 bg-slate-50 text-[10px] font-bold normal-case tracking-normal text-slate-500"
                                    aria-label="File name guidance"
                                    title="Enter the exact file name uploaded to S3. Only files already available in the configured S3 asset location can be loaded in the preview."
                                  >
                                    i
                                  </span>
                                </span>
                                <input
                                  value={option.modelFileName ?? ""}
                                  onChange={(event) => {
                                    const value = event.target.value;
                                    updateConfig((current) => ({
                                      ...current,
                                      fieldsJson: current.fieldsJson.map((item, itemIndex) =>
                                        itemIndex === fieldIndex
                                          ? {
                                              ...item,
                                              options: (item.options ?? []).map((entry, entryIndex) =>
                                                entryIndex === optionIndex
                                                  ? { ...entry, modelFileName: value }
                                                  : entry
                                              ),
                                            }
                                          : item
                                      ),
                                    }));
                                  }}
                                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                />
                              </label>
                              <label className="min-w-0 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
                                Price
                                <input
                                  type="number"
                                  value={option.price}
                                  onChange={(event) => {
                                    const value = Number(event.target.value) || 0;
                                    updateConfig((current) => ({
                                      ...current,
                                      fieldsJson: current.fieldsJson.map((item, itemIndex) =>
                                        itemIndex === fieldIndex
                                          ? {
                                              ...item,
                                              options: (item.options ?? []).map((entry, entryIndex) =>
                                                entryIndex === optionIndex
                                                  ? { ...entry, price: value }
                                                  : entry
                                              ),
                                            }
                                          : item
                                      ),
                                    }));
                                  }}
                                  placeholder="Price"
                                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                />
                              </label>
                              <label className="min-w-0 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
                                Sort Order
                                <input
                                  type="number"
                                  value={option.sortOrder}
                                  onChange={(event) => {
                                    const value = Number(event.target.value) || 0;
                                    updateConfig((current) => ({
                                      ...current,
                                      fieldsJson: current.fieldsJson.map((item, itemIndex) =>
                                        itemIndex === fieldIndex
                                          ? {
                                              ...item,
                                              options: (item.options ?? []).map((entry, entryIndex) =>
                                                entryIndex === optionIndex
                                                  ? { ...entry, sortOrder: value }
                                                  : entry
                                              ),
                                            }
                                          : item
                                      ),
                                    }));
                                  }}
                                  placeholder="Sort order"
                                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                />
                              </label>
                              <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 md:min-h-[42px]">
                                <input
                                  type="checkbox"
                                  checked={option.isDisplayPrice}
                                  onChange={(event) => {
                                    const checked = event.target.checked;
                                    updateConfig((current) => ({
                                      ...current,
                                      fieldsJson: current.fieldsJson.map((item, itemIndex) =>
                                        itemIndex === fieldIndex
                                          ? {
                                              ...item,
                                              options: (item.options ?? []).map((entry, entryIndex) =>
                                                entryIndex === optionIndex
                                                  ? { ...entry, isDisplayPrice: checked }
                                                  : entry
                                              ),
                                            }
                                          : item
                                      ),
                                    }));
                                  }}
                                />
                                Show Price
                              </label>
                              <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                                <input
                                  type="checkbox"
                                  checked={option.isHidden}
                                  onChange={(event) => {
                                    const checked = event.target.checked;
                                    updateConfig((current) => ({
                                      ...current,
                                      fieldsJson: current.fieldsJson.map((item, itemIndex) =>
                                        itemIndex === fieldIndex
                                          ? {
                                              ...item,
                                              options: (item.options ?? []).map((entry, entryIndex) =>
                                                entryIndex === optionIndex
                                                  ? { ...entry, isHidden: checked }
                                                  : entry
                                              ),
                                            }
                                          : item
                                      ),
                                    }));
                                  }}
                                />
                                Hidden
                              </label>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
            </div>

            <div className="space-y-6">
            <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
              <h2 className="text-lg font-semibold text-slate-900">Advanced Rules</h2>
              <p className="mt-2 text-sm text-slate-500">
                Use this JSON editor for dependent defaults such as length-to-dimension mappings.
              </p>
              <textarea
                value={rulesDraft}
                onChange={(event) => {
                  setRulesDraft(event.target.value);
                  setSuccessMessage(null);
                }}
                className="mt-4 min-h-[640px] w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-mono text-xs text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                spellCheck={false}
              />
            </div>

            <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
              <h2 className="text-lg font-semibold text-slate-900">How It Maps</h2>
              <div className="mt-3 space-y-3 text-sm text-slate-600">
                <p>Fields attach to tabs through `field.tabKey === tab.tabKey`.</p>
                <p>Use `visibleWhen` for field visibility by body type or other field selections.</p>
                <p>Use `rulesJson` for dependent defaults where one field selection drives another field value.</p>
                <p>Use `isHidden` instead of deleting tabs, fields, or options.</p>
              </div>
            </div>
            </div>
          </div>
        </section>
      </div>

      {isTabModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 p-4"
          onClick={() => setIsTabModalOpen(false)}
        >
          <div
            className="max-h-[88vh] w-full max-w-3xl overflow-y-auto rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_24px_64px_rgba(15,23,42,0.24)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Selected Tab</h2>
                <p className="text-sm text-slate-500">
                  Edit tab metadata and manage its fields.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsTabModalOpen(false)}
                aria-label="Close tab editor"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
              >
                <svg
                  viewBox="0 0 20 20"
                  fill="none"
                  aria-hidden="true"
                  className="h-4 w-4"
                >
                  <path
                    d="M5 5L15 15M15 5L5 15"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>

            {sortByOrder(config.tabsJson)
              .filter((tab) => tab.tabKey === selectedTabKey)
              .map((tab) => {
                const tabIndex = config.tabsJson.findIndex((item) => item.tabKey === tab.tabKey);
                return (
                  <div key={tab.tabKey} className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="grid gap-3 md:grid-cols-2">
                      <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                        Tab Key
                        <input
                          value={tab.tabKey}
                          onChange={(event) => {
                            const nextKey = slugifyKey(event.target.value);
                            updateConfig((current) => ({
                              ...current,
                              tabsJson: current.tabsJson.map((item, itemIndex) =>
                                itemIndex === tabIndex ? { ...item, tabKey: nextKey } : item
                              ),
                              fieldsJson: current.fieldsJson.map((field) =>
                                field.tabKey === tab.tabKey ? { ...field, tabKey: nextKey } : field
                              ),
                            }));
                            setSelectedTabKey(nextKey);
                          }}
                          className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        />
                      </label>
                      <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                        Label
                        <input
                          value={tab.label}
                          onChange={(event) => {
                            const value = event.target.value;
                            updateConfig((current) => ({
                              ...current,
                              tabsJson: current.tabsJson.map((item, itemIndex) =>
                                itemIndex === tabIndex ? { ...item, label: value } : item
                              ),
                            }));
                          }}
                          className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        />
                      </label>
                      <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                        Sort Order
                        <input
                          type="number"
                          value={tab.sortOrder}
                          onChange={(event) => {
                            const value = Number(event.target.value) || 0;
                            updateConfig((current) => ({
                              ...current,
                              tabsJson: current.tabsJson.map((item, itemIndex) =>
                                itemIndex === tabIndex ? { ...item, sortOrder: value } : item
                              ),
                            }));
                          }}
                          className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        />
                      </label>
                      <label className="mt-7 flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={tab.isHidden}
                          onChange={(event) => {
                            const checked = event.target.checked;
                            updateConfig((current) => ({
                              ...current,
                              tabsJson: current.tabsJson.map((item, itemIndex) =>
                                itemIndex === tabIndex ? { ...item, isHidden: checked } : item
                              ),
                            }));
                          }}
                        />
                        Hidden
                      </label>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      ) : null}
    </ConfiguratorShell>
  );
}