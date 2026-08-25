"use client";

import { useEffect, useMemo, useState } from "react";
import { ConfiguratorShell } from "@/app/components/configurator-shell";
import type {
  AdminConditionOperator,
  AdminConfigState,
  AdminFieldConfig,
  AdminFieldOptionConfig,
  AdminFieldType,
  AdminRuleConfig,
  AdminTabConfig,
} from "@/lib/schema";

const sortByOrder = <T extends { sortOrder: number }>(items: T[]) =>
  [...items].sort((left, right) => left.sortOrder - right.sortOrder);

const normalizeValue = (value: unknown) => String(value ?? "");

type FieldValue = string | number | boolean;

type FieldValueMap = Record<string, FieldValue>;
type ManualOverrideMap = Record<string, boolean>;

const defaultValueForField = (field: AdminFieldConfig): FieldValue => {
  switch (field.type) {
    case "checkbox":
      return false;
    case "number":
      return "";
    case "text":
      return "";
    case "select":
    default:
      return (
        sortByOrder(field.options ?? []).find((option) => !option.isHidden)?.value ?? ""
      );
  }
};

const isConditionMatch = (
  actual: FieldValue | undefined,
  operator: AdminConditionOperator,
  expected: AdminFieldConfig["visibleWhen"] extends infer T
    ? T extends Array<infer U>
      ? U extends { value: infer V }
        ? V
        : never
      : never
    : never
) => {
  const actualValue = normalizeValue(actual);

  if (Array.isArray(expected)) {
    const expectedValues = expected.map((entry) => normalizeValue(entry));

    if (operator === "in") {
      return expectedValues.includes(actualValue);
    }

    if (operator === "notIn") {
      return !expectedValues.includes(actualValue);
    }
  }

  const expectedValue = normalizeValue(expected);

  if (operator === "eq") {
    return actualValue === expectedValue;
  }

  if (operator === "neq") {
    return actualValue !== expectedValue;
  }

  return actualValue === expectedValue;
};

const isFieldVisible = (field: AdminFieldConfig, selections: FieldValueMap) => {
  const conditions = field.visibleWhen ?? [];

  return conditions.every((condition) =>
    isConditionMatch(
      selections[condition.fieldKey],
      condition.operator,
      condition.value
    )
  );
};

const buildInitialSelections = (config: AdminConfigState) => {
  const selections: FieldValueMap = {};

  for (const field of config.fieldsJson) {
    selections[field.fieldKey] = defaultValueForField(field);
  }

  return selections;
};

const applyDefaultRules = (
  config: AdminConfigState,
  currentSelections: FieldValueMap,
  currentManualOverrides: ManualOverrideMap
) => {
  const nextSelections = { ...currentSelections };
  const nextManualOverrides = { ...currentManualOverrides };
  let didChange = false;

  for (let pass = 0; pass < 6; pass += 1) {
    let passChanged = false;

    for (const rule of config.rulesJson) {
      if (rule.ruleType !== "defaultByParentSelection") {
        continue;
      }

      const parentValue = normalizeValue(nextSelections[rule.parentFieldKey]);
      if (!parentValue) {
        continue;
      }

      const targetField = config.fieldsJson.find(
        (field) => field.fieldKey === rule.targetFieldKey
      );
      if (!targetField) {
        continue;
      }

      const mappingKey = parentValue;
      const mappedValue = rule.mapping?.[mappingKey];
      if (mappedValue === undefined) {
        continue;
      }

      const nextTargetValue = Array.isArray(mappedValue)
        ? normalizeValue(mappedValue[0])
        : normalizeValue(mappedValue);

      if (!nextTargetValue) {
        continue;
      }

      const currentTargetValue = normalizeValue(nextSelections[rule.targetFieldKey]);
      const shouldAutoApply =
        currentTargetValue === "" ||
        currentTargetValue === nextTargetValue ||
        !nextManualOverrides[rule.targetFieldKey];

      if (shouldAutoApply && currentTargetValue !== nextTargetValue) {
        nextSelections[rule.targetFieldKey] =
          targetField.type === "checkbox"
            ? nextTargetValue === "true"
            : targetField.type === "number"
              ? Number(nextTargetValue)
              : nextTargetValue;
        nextManualOverrides[rule.targetFieldKey] = false;
        passChanged = true;
        didChange = true;
      }
    }

    if (!passChanged) {
      break;
    }
  }

  return {
    selections: nextSelections,
    manualOverrides: nextManualOverrides,
    didChange,
  };
};

const optionLabelWithPrice = (option: AdminFieldOptionConfig) => {
  if (!option.isDisplayPrice || option.price === 0) {
    return option.label || option.value;
  }

  return `${option.label || option.value} (+$${option.price.toLocaleString("en-US")})`;
};

const formatCurrency = (value: number) =>
  `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function SchemaDrivenConfigurator() {
  const [config, setConfig] = useState<AdminConfigState | null>(null);
  const [activeTabKey, setActiveTabKey] = useState<string>("");
  const [selections, setSelections] = useState<FieldValueMap>({});
  const [manualOverrides, setManualOverrides] = useState<ManualOverrideMap>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    const loadSchema = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch("/api/admin/config");
        if (!response.ok) {
          throw new Error("Failed to load configurator schema");
        }

        const nextConfig = (await response.json()) as AdminConfigState;
        setConfig(nextConfig);

        const firstVisibleTab = sortByOrder(nextConfig.tabsJson).find(
          (tab) => !tab.isHidden
        );
        setActiveTabKey(firstVisibleTab?.tabKey ?? "");

        const initialSelections = buildInitialSelections(nextConfig);
        const resolved = applyDefaultRules(nextConfig, initialSelections, {});
        setSelections(resolved.selections);
        setManualOverrides(resolved.manualOverrides);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load schema");
      } finally {
        setIsLoading(false);
      }
    };

    void loadSchema();
  }, []);

  useEffect(() => {
    if (!config || !activeTabKey) {
      return;
    }

    const activeTab = config.tabsJson.find((tab) => tab.tabKey === activeTabKey);
    if (!activeTab || activeTab.isHidden) {
      const firstVisibleTab = sortByOrder(config.tabsJson).find((tab) => !tab.isHidden);
      setActiveTabKey(firstVisibleTab?.tabKey ?? "");
    }
  }, [activeTabKey, config]);

  const visibleTabs = useMemo(() => {
    return sortByOrder((config?.tabsJson ?? []).filter((tab) => !tab.isHidden));
  }, [config]);

  const visibleFieldsForActiveTab = useMemo(() => {
    if (!config || !activeTabKey) {
      return [];
    }

    return sortByOrder(
      config.fieldsJson.filter(
        (field) =>
          field.tabKey === activeTabKey && !field.isHidden && isFieldVisible(field, selections)
      )
    );
  }, [activeTabKey, config, selections]);

  const totalPrice = useMemo(() => {
    if (!config) {
      return 0;
    }

    return config.fieldsJson.reduce((runningTotal, field) => {
      if (field.isHidden || !isFieldVisible(field, selections)) {
        return runningTotal;
      }

      const selectedValue = selections[field.fieldKey];
      let fieldPrice = field.basePrice ?? 0;

      if (field.type === "select") {
        const selectedOption = sortByOrder(field.options ?? []).find(
          (option) => option.value === normalizeValue(selectedValue)
        );
        fieldPrice += selectedOption?.price ?? 0;
      } else if (field.type === "checkbox") {
        fieldPrice += selectedValue ? field.basePrice ?? 0 : 0;
      }

      return runningTotal + fieldPrice;
    }, 0);
  }, [config, selections]);

  const bodyTypeValue = normalizeValue(selections.bodyType);

  const handleFieldChange = (field: AdminFieldConfig, rawValue: string | boolean) => {
    if (!config) {
      return;
    }

    setSelections((current) => {
      const nextSelections: FieldValueMap = {
        ...current,
        [field.fieldKey]:
          field.type === "number"
            ? Number(rawValue) || 0
            : field.type === "checkbox"
              ? Boolean(rawValue)
              : rawValue,
      };

      const nextManualOverrides: ManualOverrideMap = {
        ...manualOverrides,
        [field.fieldKey]: true,
      };

      const resolved = applyDefaultRules(config, nextSelections, nextManualOverrides);
      setManualOverrides(resolved.manualOverrides);
      setSuccessMessage(null);
      return resolved.selections;
    });
  };

  const handleSave = async () => {
    if (!config) {
      return;
    }

    try {
      setIsSaving(true);
      setError(null);

      const response = await fetch("/api/configurations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          bodyType: bodyTypeValue || null,
          config: selections,
          totalPrice,
        }),
      });

      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        throw new Error(body.error ?? "Failed to save configuration");
      }

      setSuccessMessage("Configuration saved successfully");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save configuration");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <ConfiguratorShell activeNav="configure">
        <div className="mx-auto max-w-7xl px-8 py-8">
          <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
            <p className="text-sm text-slate-600">Loading configurator schema...</p>
          </div>
        </div>
      </ConfiguratorShell>
    );
  }

  if (error && !config) {
    return (
      <ConfiguratorShell activeNav="configure">
        <div className="mx-auto max-w-7xl px-8 py-8">
          <div className="rounded-3xl border border-rose-200 bg-rose-50 p-8 shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
            <p className="text-sm text-rose-700">{error}</p>
          </div>
        </div>
      </ConfiguratorShell>
    );
  }

  return (
    <ConfiguratorShell
      activeNav="configure"
      sidebarContent={
        <div className="rounded-[20px] border border-white/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.16),rgba(255,255,255,0.08))] px-4 py-4 shadow-xl backdrop-blur-xl">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-100/80">
            Estimated Price
          </p>
          <p className="mt-2 text-3xl font-bold text-white">{formatCurrency(totalPrice)}</p>
          <p className="mt-2 text-xs text-blue-100/75">
            Driven by the active schema from the database.
          </p>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || !bodyTypeValue}
            className="mt-4 w-full rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? "Saving..." : "Save Configuration"}
          </button>
          {successMessage ? (
            <p className="mt-3 text-sm text-emerald-100">{successMessage}</p>
          ) : null}
          {error ? <p className="mt-3 text-sm text-rose-100">{error}</p> : null}
        </div>
      }
    >
      <div className="mx-auto max-w-6xl px-8 py-8">
        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-blue-600/80">
                Schema Driven Configurator
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
                Rendered from admin schema in the database
              </h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-600">
                Tabs, fields, options, visibility, and default rules are fetched from the
                admin schema and rendered dynamically.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-700">
                Schema v{config?.schemaVersion ?? "-"}
              </span>
            </div>
          </div>
          {error ? (
            <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          ) : null}
        </section>

        <section className="mt-6 space-y-6">
          <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-slate-900">Tabs</h2>
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              {visibleTabs.map((tab) => (
                <button
                  key={tab.tabKey}
                  type="button"
                  onClick={() => setActiveTabKey(tab.tabKey)}
                  className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                    activeTabKey === tab.tabKey
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
            <div className="space-y-4">
              {visibleFieldsForActiveTab.length > 0 ? (
                visibleFieldsForActiveTab.map((field) => {
                  const selectedValue = selections[field.fieldKey];
                  const fieldOptions = sortByOrder(field.options ?? []).filter(
                    (option) => !option.isHidden
                  );

                  return (
                    <article
                      key={field.fieldKey}
                      className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_10px_24px_rgba(15,23,42,0.06)]"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h3 className="text-base font-semibold text-slate-900">
                            {field.label}
                          </h3>
                          {field.helperText ? (
                            <p className="mt-1 text-sm text-slate-500">{field.helperText}</p>
                          ) : null}
                        </div>
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-500">
                          {field.type}
                        </span>
                      </div>

                      <div className="mt-4">
                        {field.type === "select" ? (
                          <select
                            value={normalizeValue(selectedValue)}
                            onChange={(event) => handleFieldChange(field, event.target.value)}
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                          >
                            <option value="">{field.placeholder || "Select option"}</option>
                            {fieldOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {optionLabelWithPrice(option)}
                              </option>
                            ))}
                          </select>
                        ) : field.type === "text" ? (
                          <input
                            type="text"
                            value={normalizeValue(selectedValue)}
                            onChange={(event) => handleFieldChange(field, event.target.value)}
                            placeholder={field.placeholder || field.label}
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                          />
                        ) : field.type === "number" ? (
                          <input
                            type="number"
                            value={normalizeValue(selectedValue)}
                            onChange={(event) => handleFieldChange(field, event.target.value)}
                            placeholder={field.placeholder || field.label}
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                          />
                        ) : (
                          <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
                            <input
                              type="checkbox"
                              checked={Boolean(selectedValue)}
                              onChange={(event) => handleFieldChange(field, event.target.checked)}
                            />
                            {field.placeholder || field.label}
                          </label>
                        )}
                      </div>
                    </article>
                  );
                })
              ) : (
                <div className="rounded-[24px] border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
                  No visible fields in this tab.
                </div>
              )}
            </div>

            <div className="space-y-6">
              <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
                <h2 className="text-lg font-semibold text-slate-900">Current Selection</h2>
                <div className="mt-3 space-y-2 text-sm text-slate-600">
                  <p>
                    <span className="font-semibold text-slate-900">Body Type:</span> {bodyTypeValue || "-"}
                  </p>
                  <p>
                    <span className="font-semibold text-slate-900">Active Tab:</span> {activeTabKey || "-"}
                  </p>
                </div>
              </div>

              <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
                <h2 className="text-lg font-semibold text-slate-900">How It Maps</h2>
                <div className="mt-3 space-y-3 text-sm text-slate-600">
                  <p>Tabs are loaded from `tabsJson` in the admin schema.</p>
                  <p>Fields are loaded from `fieldsJson` and filtered by tab and visibility rules.</p>
                  <p>Default dependencies are resolved from `rulesJson`.</p>
                  <p>Saving stores the current selection payload in `configuration_submissions`.</p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </ConfiguratorShell>
  );
}
