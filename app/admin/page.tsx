"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  GripVertical,
  LoaderCircle,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  Upload,
  X,
} from "lucide-react";
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

const MAX_MODEL_BYTES = 100 * 1024 * 1024;

// Vercel caps serverless request bodies at 4.5MB, so large models must skip the Next proxy route.
const cpqApiBaseUrl =
  process.env.NEXT_PUBLIC_CPQ_API_BASE_URL?.replace(/\/$/, "") ?? "";

const modelUploadUrl = (fieldKey: string, optionValue: string) =>
  cpqApiBaseUrl
    ? `${cpqApiBaseUrl}/api/admin/catalog/fields/${encodeURIComponent(
        fieldKey
      )}/options/${encodeURIComponent(optionValue)}/model`
    : "/api/admin/config/model";

// Exposed to the browser by design: the direct upload bypasses the server-side proxy.
const cpqUploadAuthHeader = (): Record<string, string> => {
  const username = process.env.NEXT_PUBLIC_CPQ_EMPLOYEE_USERNAME;
  const password = process.env.NEXT_PUBLIC_CPQ_EMPLOYEE_PASSWORD;

  if (!cpqApiBaseUrl || !username || !password) {
    return {};
  }

  return { Authorization: `Basic ${btoa(`${username}:${password}`)}` };
};

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

type ModelUploadTarget = {
  fieldKey: string;
  fieldLabel: string;
  optionIndex: number;
  optionLabel: string;
};

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
  const [isFieldOrderModalOpen, setIsFieldOrderModalOpen] = useState(false);
  const [newFieldKeys, setNewFieldKeys] = useState<string[]>([]);
  const [pendingScrollFieldKey, setPendingScrollFieldKey] = useState<string | null>(null);
  const [reorderedFieldKeys, setReorderedFieldKeys] = useState<string[]>([]);
  const [draggedFieldKey, setDraggedFieldKey] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [basePriceDrafts, setBasePriceDrafts] = useState<Record<string, string>>({});
  const [modelUploadTarget, setModelUploadTarget] = useState<ModelUploadTarget | null>(null);
  const [modelUploadFile, setModelUploadFile] = useState<File | null>(null);
  const [modelUploadError, setModelUploadError] = useState<string | null>(null);
  const [isModelDragActive, setIsModelDragActive] = useState(false);
  const [isUploadingModel, setIsUploadingModel] = useState(false);
  const fieldRefs = useRef<Record<string, HTMLElement | null>>({});
  const modelFileInputRef = useRef<HTMLInputElement | null>(null);

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

  const reorderedFields = useMemo(() => {
    const fieldsByKey = new Map(fieldsForSelectedTab.map((field) => [field.fieldKey, field]));
    return reorderedFieldKeys
      .map((fieldKey) => fieldsByKey.get(fieldKey))
      .filter((field): field is AdminFieldConfig => Boolean(field));
  }, [fieldsForSelectedTab, reorderedFieldKeys]);

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

  useEffect(() => {
    if (!toastMessage) {
      return;
    }

    const timeoutId = window.setTimeout(() => setToastMessage(null), 3000);
    return () => window.clearTimeout(timeoutId);
  }, [toastMessage]);

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
    setExpandedFieldKeys((current) => [...current, newFieldKey]);
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
    setBasePriceDrafts((current) => {
      const next = { ...current };
      delete next[fieldKey];
      return next;
    });
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

  const handleOpenFieldOrderModal = () => {
    setReorderedFieldKeys(fieldsForSelectedTab.map((field) => field.fieldKey));
    setDraggedFieldKey(null);
    setIsFieldOrderModalOpen(true);
  };

  const moveReorderedField = (sourceFieldKey: string, targetFieldKey: string) => {
    if (sourceFieldKey === targetFieldKey) {
      return;
    }

    setReorderedFieldKeys((current) => {
      const next = [...current];
      const sourceIndex = next.indexOf(sourceFieldKey);
      const targetIndex = next.indexOf(targetFieldKey);

      if (sourceIndex === -1 || targetIndex === -1) {
        return current;
      }

      const [movedFieldKey] = next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, movedFieldKey);
      return next;
    });
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

  const handleSave = async (
    configOverride?: EditableAdminConfig,
    savedMessage?: string
  ) => {
    const configToSave = configOverride ?? config;

    if (!configToSave) {
      return false;
    }

    try {
      setError(null);
      setIsSaving(true);
      const parsedRules = JSON.parse(rulesDraft) as AdminRuleConfig[];
      const normalizedFields = configToSave.fieldsJson.map((field) => {
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

      for (const tab of configToSave.tabsJson) {
        const labels = normalizedFields
          .filter((field) => field.tabKey === tab.tabKey)
          .map((field) => field.label)
          .filter(Boolean);

        labels.find(
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
          tabsJson: configToSave.tabsJson,
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
      setSuccessMessage(savedMessage ?? `Saved schema version ${saved.schemaVersion}`);
      return true;
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save config");
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveFieldOrder = async () => {
    if (!config) {
      return;
    }

    const orderByFieldKey = new Map(
      reorderedFieldKeys.map((fieldKey, index) => [fieldKey, index + 1])
    );
    const nextConfig: EditableAdminConfig = {
      ...config,
      fieldsJson: config.fieldsJson.map((field) =>
        field.tabKey === selectedTabKey
          ? { ...field, sortOrder: orderByFieldKey.get(field.fieldKey) ?? field.sortOrder }
          : field
      ),
    };

    setConfig(nextConfig);
    const saved = await handleSave(nextConfig, "Order changed successfully.");
    if (!saved) {
      return;
    }

    setIsFieldOrderModalOpen(false);
    setDraggedFieldKey(null);
    setToastMessage("Order changed successfully.");
  };

  const applySavedCatalog = (saved: AdminConfigState) => {
    setConfig({
      tabsJson: saved.tabsJson,
      fieldsJson: saved.fieldsJson,
      rulesJson: saved.rulesJson,
      schemaVersion: saved.schemaVersion,
    });
    setNewFieldKeys([]);
    setRulesDraft(JSON.stringify(saved.rulesJson, null, 2));
  };

  const openModelUploadModal = (target: ModelUploadTarget) => {
    setModelUploadTarget(target);
    setModelUploadFile(null);
    setModelUploadError(null);
    setIsModelDragActive(false);
  };

  const closeModelUploadModal = () => {
    if (isUploadingModel) {
      return;
    }

    setModelUploadTarget(null);
    setModelUploadFile(null);
    setModelUploadError(null);
    setIsModelDragActive(false);
  };

  const selectModelFile = (file: File | null | undefined) => {
    if (!file) {
      return;
    }

    if (!file.name.toLowerCase().endsWith(".glb")) {
      setModelUploadError("Only .glb files are supported.");
      setModelUploadFile(null);
      return;
    }

    if (file.size > MAX_MODEL_BYTES) {
      setModelUploadError("File exceeds the 100MB limit.");
      setModelUploadFile(null);
      return;
    }

    setModelUploadError(null);
    setModelUploadFile(file);
  };

  const handleUploadModel = async () => {
    if (!modelUploadTarget || !modelUploadFile || !config) {
      return;
    }

    const optionValue = modelUploadTarget.optionLabel.trim();

    if (!optionValue) {
      setModelUploadError("Add an option label before uploading a model.");
      return;
    }

    try {
      setIsUploadingModel(true);
      setModelUploadError(null);

      // The backend resolves the option from the saved catalog, so persist pending edits first.
      const persisted = await handleSave(config, "Catalog saved before model upload.");
      if (!persisted) {
        setModelUploadError("Unable to save the catalog before uploading. Fix the errors and retry.");
        return;
      }

      const formData = new FormData();
      formData.append("file", modelUploadFile);

      if (!cpqApiBaseUrl) {
        formData.append("fieldKey", modelUploadTarget.fieldKey);
        formData.append("optionValue", optionValue);
      }

      const response = await fetch(
        modelUploadUrl(modelUploadTarget.fieldKey, optionValue),
        {
          method: "POST",
          body: formData,
          headers: { Accept: "application/json", ...cpqUploadAuthHeader() },
        }
      );

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as
          | { message?: string; error?: string }
          | null;
        throw new Error(
          body?.message ??
            body?.error ??
            (response.status === 413
              ? "The upload was rejected as too large by the server."
              : response.status === 401
              ? "The upload was rejected as unauthorized. Check the CPQ credentials."
              : "Failed to upload the model file")
        );
      }

      const saved = (await response.json()) as AdminConfigState;
      applySavedCatalog(saved);
      setSuccessMessage(`Model uploaded and linked to "${optionValue}".`);
      setToastMessage("Model uploaded successfully.");
      setModelUploadTarget(null);
      setModelUploadFile(null);
    } catch (uploadError) {
      setModelUploadError(
        uploadError instanceof Error ? uploadError.message : "Failed to upload the model file"
      );
    } finally {
      setIsUploadingModel(false);
    }
  };

  if (isLoading) {
    return (
      <ConfiguratorShell activeNav="admin">
        <div className="mx-auto max-w-7xl px-8 py-8">
          <div className="flex min-h-[420px] items-center justify-center rounded-[28px] border border-slate-200 bg-white p-8 shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
            <div className="flex max-w-md flex-col items-center text-center">
              <span className="inline-flex h-16 w-16 items-center justify-center rounded-full border border-blue-100 bg-blue-50 text-blue-700 shadow-sm">
                <LoaderCircle className="h-8 w-8 animate-spin" />
              </span>
              <h1 className="mt-5 text-2xl font-semibold tracking-tight text-slate-900">
                Loading admin catalog
              </h1>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Fetching the latest configurator setup. This can take a moment if the backend is waking up or the network is slow.
              </p>
              <div className="mt-6 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div className="h-full w-1/2 animate-pulse rounded-full bg-blue-600" />
              </div>
            </div>
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
                Catalog Setup
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
            {isSyncing === true && (
              <button
                type="button"
                onClick={handleSyncData}
                disabled={isSyncing || isSaving}
                title="Overwrite the backend catalog with the known-good default data"
                className="inline-flex items-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-5 py-2.5 text-sm font-semibold text-amber-800 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSyncing ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                <span>{isSyncing ? "Syncing..." : "Sync Data"}</span>
              </button>
            )}
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={isSaving}
                className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                <span>{isSaving ? "Saving..." : "Save Catalog"}</span>
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
                  className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  <span>Edit Tab</span>
                </button>
                <button
                  type="button"
                  onClick={handleAddTab}
                  className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 transition hover:border-blue-300 hover:bg-blue-100"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add Tab</span>
                </button>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              {visibleTabs.map((tab) => (
                <button
                  key={tab.tabKey}
                  type="button"
                  onClick={() => setSelectedTabKey(tab.tabKey)}
                  className={`rounded-full border px-4 py-2 text-sm font-semibold shadow-sm transition ${
                    selectedTabKey === tab.tabKey
                      ? "border-blue-600 bg-blue-600 text-white shadow-[0_10px_24px_rgba(37,99,235,0.22)]"
                      : "border-blue-100 bg-white text-blue-700 hover:border-blue-300 hover:bg-blue-50"
                  }`}
                >
                  {tab.label || tab.tabKey}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-6">

            <div className="space-y-6">
            <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">Fields</h2>
                  <p className="text-sm text-slate-500">Manage fields for the selected tab.</p>
                </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={handleOpenFieldOrderModal}
                        disabled={fieldsForSelectedTab.length < 2 || isSaving}
                        className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <GripVertical className="h-4 w-4" />
                        <span>Reorder Fields</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleAddField}
                        className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
                      >
                        <Plus className="h-4 w-4" />
                        <span>Add Field</span>
                      </button>
                    </div>
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
                            className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-100"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span>Delete</span>
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
                        <ChevronDown
                          className={`h-5 w-5 transition-transform duration-200 ${
                            isExpanded ? "rotate-180" : "rotate-0"
                          }`}
                        />
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
                            updateConfig((current) => ({
                              ...current,
                              fieldsJson: current.fieldsJson.map((item, itemIndex) => {
                                if (itemIndex !== fieldIndex) {
                                  return item;
                                }

                                return {
                                  ...item,
                                  label: value,
                                };
                              }),
                            }));
                          }}
                          onBlur={(event) => {
                            const currentFieldKey = field.fieldKey;

                            if (!currentFieldKey.startsWith("field_")) {
                              return;
                            }

                            const nextFieldKey = ensureUniqueFieldKey(
                              config.fieldsJson,
                              toCamelFieldKey(event.currentTarget.value),
                              fieldIndex
                            );

                            if (nextFieldKey === currentFieldKey) {
                              return;
                            }

                            updateConfig((current) => ({
                              ...current,
                              fieldsJson: current.fieldsJson.map((item, itemIndex) =>
                                itemIndex === fieldIndex
                                  ? { ...item, fieldKey: nextFieldKey }
                                  : item
                              ),
                              rulesJson: current.rulesJson.map((rule) => ({
                                ...rule,
                                parentFieldKey:
                                  rule.parentFieldKey === currentFieldKey
                                    ? nextFieldKey
                                    : rule.parentFieldKey,
                                targetFieldKey:
                                  rule.targetFieldKey === currentFieldKey
                                    ? nextFieldKey
                                    : rule.targetFieldKey,
                              })),
                            }));

                            if (newFieldKeys.includes(currentFieldKey)) {
                              setNewFieldKeys((current) =>
                                current.map((key) => (key === currentFieldKey ? nextFieldKey : key))
                              );
                            }

                            setExpandedFieldKeys((current) =>
                              current.map((key) => (key === currentFieldKey ? nextFieldKey : key))
                            );
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
                            type="text"
                            inputMode="decimal"
                            value={basePriceDrafts[field.fieldKey] ?? String(field.basePrice)}
                            onChange={(event) => {
                              const nextValue = event.target.value;
                              setBasePriceDrafts((current) => ({
                                ...current,
                                [field.fieldKey]: nextValue,
                              }));

                              if (nextValue === "") {
                                return;
                              }

                              const value = Number(nextValue) || 0;
                              updateConfig((current) => ({
                                ...current,
                                fieldsJson: current.fieldsJson.map((item, itemIndex) =>
                                  itemIndex === fieldIndex ? { ...item, basePrice: value } : item
                                ),
                              }));
                            }}
                            onBlur={(event) => {
                              const value = event.currentTarget.value === ""
                                ? 0
                                : Number(event.currentTarget.value) || 0;

                              updateConfig((current) => ({
                                ...current,
                                fieldsJson: current.fieldsJson.map((item, itemIndex) =>
                                  itemIndex === fieldIndex ? { ...item, basePrice: value } : item
                                ),
                              }));
                              setBasePriceDrafts((current) => {
                                const next = { ...current };
                                delete next[field.fieldKey];
                                return next;
                              });
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
                          className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 transition hover:border-blue-300 hover:bg-blue-100"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          <span>Add Condition</span>
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
                            className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 transition hover:border-blue-300 hover:bg-blue-100"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            <span>Add Option</span>
                          </button>
                        </div>

                        <div className="mt-3 space-y-3">
                          {(field.options ?? []).map((option, optionIndex) => (
                            <div
                              key={`${field.fieldKey}-${optionIndex}`}
                              className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-white p-3 md:grid-cols-2 xl:grid-cols-5"
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
                              <div className="min-w-0 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
                                <span className="flex items-center gap-1.5">
                                  <span>3D Model</span>
                                  <span
                                    className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-300 bg-slate-50 text-[10px] font-bold normal-case tracking-normal text-slate-500"
                                    aria-label="Model upload guidance"
                                    title="Upload a .glb file for this option. The stored URL is used by the configurator preview."
                                  >
                                    i
                                  </span>
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    openModelUploadModal({
                                      fieldKey: field.fieldKey,
                                      fieldLabel: field.label,
                                      optionIndex,
                                      optionLabel: option.label,
                                    })
                                  }
                                  disabled={!option.label.trim()}
                                  title={
                                    option.label.trim()
                                      ? option.modelFileName || "Upload a .glb model for this option"
                                      : "Add an option label first"
                                  }
                                  className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold normal-case tracking-normal text-blue-700 transition hover:border-blue-300 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  <Upload className="h-3.5 w-3.5 shrink-0" />
                                  <span className="truncate">
                                    {option.modelFileName ? "Replace Model" : "Upload GLB"}
                                  </span>
                                </button>
                              </div>
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

          </div>
        </section>
      </div>

      {toastMessage ? (
        <div className="fixed bottom-6 right-6 z-[60] rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm font-semibold text-emerald-700 shadow-[0_18px_45px_rgba(15,23,42,0.16)]">
          {toastMessage}
        </div>
      ) : null}

      {modelUploadTarget ? (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/55 p-4"
          onClick={closeModelUploadModal}
        >
          <div
            className="w-full max-w-lg rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_24px_64px_rgba(15,23,42,0.24)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Upload 3D Model</h2>
                <p className="text-sm text-slate-500">
                  {modelUploadTarget.fieldLabel} · {modelUploadTarget.optionLabel}
                </p>
              </div>
              <button
                type="button"
                onClick={closeModelUploadModal}
                disabled={isUploadingModel}
                aria-label="Close model upload"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <input
              ref={modelFileInputRef}
              type="file"
              accept=".glb,model/gltf-binary"
              className="hidden"
              onChange={(event) => {
                selectModelFile(event.target.files?.[0]);
                event.target.value = "";
              }}
            />

            <button
              type="button"
              onClick={() => modelFileInputRef.current?.click()}
              disabled={isUploadingModel}
              onDragOver={(event) => {
                event.preventDefault();
                if (!isUploadingModel) {
                  setIsModelDragActive(true);
                }
              }}
              onDragLeave={() => setIsModelDragActive(false)}
              onDrop={(event) => {
                event.preventDefault();
                setIsModelDragActive(false);
                if (!isUploadingModel) {
                  selectModelFile(event.dataTransfer.files?.[0]);
                }
              }}
              className={`mt-5 flex w-full flex-col items-center justify-center gap-2 rounded-[20px] border-2 border-dashed px-6 py-10 text-center transition disabled:cursor-not-allowed disabled:opacity-60 ${
                isModelDragActive
                  ? "border-blue-400 bg-blue-50"
                  : "border-slate-300 bg-slate-50 hover:border-blue-300 hover:bg-blue-50/50"
              }`}
            >
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-blue-100 bg-white text-blue-600 shadow-sm">
                {isUploadingModel ? (
                  <LoaderCircle className="h-5 w-5 animate-spin" />
                ) : (
                  <Upload className="h-5 w-5" />
                )}
              </span>
              <span className="text-sm font-semibold text-slate-800">
                {isUploadingModel ? "Uploading model..." : "Drag and drop a .glb file"}
              </span>
              <span className="text-xs text-slate-500">
                or click to browse. Max size 100MB.
              </span>
            </button>

            {modelUploadFile ? (
              <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {modelUploadFile.name}
                  </p>
                  <p className="text-xs text-slate-500">{formatFileSize(modelUploadFile.size)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setModelUploadFile(null)}
                  disabled={isUploadingModel}
                  aria-label="Remove selected file"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-600 transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : null}

            {modelUploadError ? (
              <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {modelUploadError}
              </div>
            ) : null}

            <div className="mt-5 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={closeModelUploadModal}
                disabled={isUploadingModel}
                className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleUploadModel()}
                disabled={isUploadingModel || !modelUploadFile}
                className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isUploadingModel ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                <span>{isUploadingModel ? "Uploading..." : "Upload & Save"}</span>
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isFieldOrderModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 p-4"
          onClick={() => {
            if (!isSaving) {
              setIsFieldOrderModalOpen(false);
              setDraggedFieldKey(null);
            }
          }}
        >
          <div
            className="flex max-h-[92vh] w-full max-w-xl flex-col rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_24px_64px_rgba(15,23,42,0.24)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Reorder Fields</h2>
                <p className="text-sm text-slate-500">Drag fields into the order shown in the configurator.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsFieldOrderModalOpen(false);
                  setDraggedFieldKey(null);
                }}
                disabled={isSaving}
                aria-label="Close reorder fields"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
              {reorderedFields.map((field) => (
                <div
                  key={field.fieldKey}
                  draggable={!isSaving}
                  onDragStart={() => setDraggedFieldKey(field.fieldKey)}
                  onDragOver={(event) => {
                    event.preventDefault();
                    if (draggedFieldKey) {
                      moveReorderedField(draggedFieldKey, field.fieldKey);
                    }
                  }}
                  onDragEnd={() => setDraggedFieldKey(null)}
                  className={`flex cursor-grab items-center gap-3 rounded-2xl border bg-white px-4 py-3 text-sm font-semibold text-slate-800 shadow-sm transition active:cursor-grabbing ${
                    draggedFieldKey === field.fieldKey
                      ? "border-blue-300 bg-blue-50 text-blue-800"
                      : "border-slate-200 hover:border-blue-200"
                  }`}
                >
                  <GripVertical className="h-4 w-4 shrink-0 text-slate-400" />
                  <span className="min-w-0 flex-1 truncate">{field.label.trim() || "Untitled Field"}</span>
                </div>
              ))}
            </div>

            <div className="mt-5 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setIsFieldOrderModalOpen(false);
                  setDraggedFieldKey(null);
                }}
                disabled={isSaving}
                className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleSaveFieldOrder()}
                disabled={isSaving}
                className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                <span>{isSaving ? "Saving..." : "Save Order"}</span>
              </button>
            </div>
          </div>
        </div>
      ) : null}

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
                <X className="h-4 w-4" />
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
