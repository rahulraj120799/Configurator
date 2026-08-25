"use client";

import {
  ReactNode,
  Suspense,
  useEffect,
  useId,
  useMemo,
  useState,
} from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";
import { Box3, Vector3 } from "three";
import { ConfiguratorShell } from "./components/configurator-shell";
import { QuoteSummary, type QuoteGroup } from "./components/quote-summary";
import type {
  AdminConditionOperator,
  AdminConfigState,
  AdminFieldConfig,
  AdminFieldCondition,
  AdminFieldOptionConfig,
  AdminFieldType,
  AdminTabConfig,
} from "@/lib/schema";

type FieldValue = string | number | boolean;
type FieldValueMap = Record<string, FieldValue>;
type ManualOverrideMap = Record<string, boolean>;

type SelectOption = {
  value: string;
  label: string;
};

type SelectFieldProps = {
  label: string;
  value: string;
  placeholder: string;
  options: readonly SelectOption[];
  onChange: (value: string) => void;
  icon: ReactNode;
  helperText?: string;
  disabled?: boolean;
};

type SelectIconTone = "blue" | "cyan" | "emerald" | "amber" | "violet" | "rose";

const BODY_TYPE_FIELD_KEY = "bodyType";
const modelBaseUrl =
  process.env.NEXT_PUBLIC_S3_DOMAIN_URL?.replace(/\/$/, "") ?? "";

const sortByOrder = <T extends { sortOrder: number }>(items: T[]) =>
  [...items].sort((left, right) => left.sortOrder - right.sortOrder);

const normalizeValue = (value: unknown) => String(value ?? "");

const comparableStringForms = (value: unknown) => {
  const source = normalizeValue(value).trim().toLowerCase();
  if (!source) {
    return [] as string[];
  }

  const snake = source.replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  const compact = source.replace(/[^a-z0-9]+/g, "");
  const tokens = snake.split("_").filter(Boolean);

  const forms = new Set<string>([source, snake, compact]);
  for (const token of tokens) {
    forms.add(token);
  }

  return [...forms].filter(Boolean);
};

const hasComparableMatch = (left: unknown, right: unknown) => {
  const leftForms = comparableStringForms(left);
  const rightForms = comparableStringForms(right);

  return leftForms.some((form) => rightForms.includes(form));
};

const formatCurrency = (value: number): string =>
  `$${value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const selectFieldClasses: {
  card: string;
  label: string;
  input: string;
  chevron: string;
} = {
  card: "border-slate-200/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.98))] shadow-[0_12px_26px_rgba(15,23,42,0.06)]",
  label: "text-slate-800",
  input:
    "border-slate-200 bg-white hover:border-slate-300 focus:border-blue-500 focus:ring-blue-500/10",
  chevron: "border-slate-200 bg-slate-50 text-slate-500",
};

const selectIconToneClasses: Record<
  SelectIconTone,
  { rail: string; badge: string }
> = {
  blue: {
    rail: "border-blue-100 bg-[linear-gradient(180deg,#eff6ff_0%,#dbeafe_100%)]",
    badge:
      "border-blue-100 bg-white/80 text-blue-700 shadow-[0_8px_18px_rgba(59,130,246,0.14)]",
  },
  cyan: {
    rail: "border-cyan-100 bg-[linear-gradient(180deg,#ecfeff_0%,#cffafe_100%)]",
    badge:
      "border-cyan-100 bg-white/80 text-cyan-700 shadow-[0_8px_18px_rgba(6,182,212,0.14)]",
  },
  emerald: {
    rail: "border-emerald-100 bg-[linear-gradient(180deg,#ecfdf5_0%,#d1fae5_100%)]",
    badge:
      "border-emerald-100 bg-white/80 text-emerald-700 shadow-[0_8px_18px_rgba(16,185,129,0.14)]",
  },
  amber: {
    rail: "border-amber-100 bg-[linear-gradient(180deg,#fffbeb_0%,#fde68a_100%)]",
    badge:
      "border-amber-100 bg-white/85 text-amber-700 shadow-[0_8px_18px_rgba(245,158,11,0.14)]",
  },
  violet: {
    rail: "border-violet-100 bg-[linear-gradient(180deg,#f5f3ff_0%,#ede9fe_100%)]",
    badge:
      "border-violet-100 bg-white/80 text-violet-700 shadow-[0_8px_18px_rgba(139,92,246,0.14)]",
  },
  rose: {
    rail: "border-rose-100 bg-[linear-gradient(180deg,#fff1f2_0%,#ffe4e6_100%)]",
    badge:
      "border-rose-100 bg-white/80 text-rose-700 shadow-[0_8px_18px_rgba(244,63,94,0.14)]",
  },
};

const iconToneByFieldType: Record<AdminFieldType, SelectIconTone> = {
  select: "blue",
  text: "emerald",
  number: "violet",
  checkbox: "amber",
};

const fieldIcon = (field: AdminFieldConfig) => {
  if (field.type === "number") {
    return (
      <svg
        viewBox="0 0 24 24"
        className="h-4 w-4"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M3.5 12h17"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <path
          d="M7 9.5 4.5 12 7 14.5M17 9.5 19.5 12 17 14.5"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  if (field.type === "checkbox") {
    return (
      <svg
        viewBox="0 0 24 24"
        className="h-4 w-4"
        fill="none"
        aria-hidden="true"
      >
        <rect
          x="4"
          y="5"
          width="16"
          height="14"
          rx="2"
          stroke="currentColor"
          strokeWidth="1.8"
        />
        <path
          d="m8 12 2.5 2.5L16 9"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  if (field.type === "text") {
    return (
      <svg
        viewBox="0 0 24 24"
        className="h-4 w-4"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M6 7h12"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <path
          d="M9 7v10m6-10v10"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <path
          d="M5 17h14"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
      <rect
        x="4"
        y="6"
        width="16"
        height="12"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M8 10h8M8 14h5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
};

const defaultValueForField = (field: AdminFieldConfig): FieldValue => {
  if (field.type === "checkbox") {
    return "";
  }

  if (field.type === "number") {
    return "";
  }

  if (field.type === "text") {
    return "";
  }

  return "";
};

const isConditionMatch = (
  actual: FieldValue | undefined,
  operator: AdminConditionOperator,
  expected: AdminFieldCondition["value"]
) => {
  if (Array.isArray(expected)) {
    const arrayMatches = expected.some((entry) =>
      hasComparableMatch(actual, entry)
    );
    if (operator === "in") {
      return arrayMatches;
    }
    if (operator === "notIn") {
      return !arrayMatches;
    }
  }

  const strictOrComparableMatch = hasComparableMatch(actual, expected);
  if (operator === "eq") {
    return strictOrComparableMatch;
  }
  if (operator === "neq") {
    return !strictOrComparableMatch;
  }

  return strictOrComparableMatch;
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

const optionToLabel = (option: AdminFieldOptionConfig) => {
  const baseLabel = option.label || option.value;
  if (!option.isDisplayPrice || option.price === 0) {
    return baseLabel;
  }

  return `${baseLabel} (+${formatCurrency(option.price)})`;
};

const optionPriceByValue = (field: AdminFieldConfig, value: FieldValue) => {
  if (field.type !== "select") {
    return 0;
  }

  const selected = (field.options ?? []).find(
    (option) => option.value === normalizeValue(value)
  );
  return selected?.price ?? 0;
};

const buildInitialSelections = (schema: AdminConfigState) => {
  const initial: FieldValueMap = {};
  for (const field of schema.fieldsJson) {
    initial[field.fieldKey] = defaultValueForField(field);
  }
  return initial;
};

const applyDefaultRules = (
  schema: AdminConfigState,
  currentSelections: FieldValueMap,
  currentOverrides: ManualOverrideMap
) => {
  const nextSelections = { ...currentSelections };
  const nextOverrides = { ...currentOverrides };

  for (let pass = 0; pass < 6; pass += 1) {
    let changed = false;

    for (const rule of schema.rulesJson) {
      if (rule.ruleType !== "defaultByParentSelection") {
        continue;
      }

      const parentValue = normalizeValue(nextSelections[rule.parentFieldKey]);
      if (!parentValue) {
        continue;
      }

      const targetField = schema.fieldsJson.find(
        (field) => field.fieldKey === rule.targetFieldKey
      );
      if (!targetField) {
        continue;
      }

      const mapped = rule.mapping?.[parentValue];
      if (mapped === undefined) {
        continue;
      }

      const nextValue = Array.isArray(mapped)
        ? normalizeValue(mapped[0])
        : normalizeValue(mapped);
      if (!nextValue) {
        continue;
      }

      const currentValue = normalizeValue(nextSelections[rule.targetFieldKey]);
      const shouldAutoApply =
        currentValue === "" ||
        currentValue === nextValue ||
        !nextOverrides[rule.targetFieldKey];

      if (shouldAutoApply && currentValue !== nextValue) {
        nextSelections[rule.targetFieldKey] =
          targetField.type === "checkbox"
            ? nextValue === "true"
            : targetField.type === "number"
            ? Number(nextValue)
            : nextValue;
        nextOverrides[rule.targetFieldKey] = false;
        changed = true;
      }
    }

    if (!changed) {
      break;
    }
  }

  return {
    selections: nextSelections,
    overrides: nextOverrides,
  };
};

function SelectField({
  label,
  value,
  placeholder,
  options,
  onChange,
  icon,
  helperText,
  disabled,
}: SelectFieldProps) {
  const selectId = useId();
  const iconToneClass = selectIconToneClasses.blue;

  return (
    <div
      className={`grid grid-cols-[64px_1fr] gap-3 rounded-2xl border p-3.5 ${selectFieldClasses.card}`}
    >
      <span
        className={`inline-flex h-full min-h-[92px] items-center justify-center rounded-2xl border shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] ${iconToneClass.rail}`}
      >
        <span
          className={`relative inline-flex h-11 w-11 items-center justify-center rounded-xl border [&_svg]:h-[20px] [&_svg]:w-[20px] ${iconToneClass.badge}`}
        >
          {icon}
        </span>
      </span>
      <div className="flex flex-col justify-center">
        <label
          htmlFor={selectId}
          className={`text-sm font-semibold tracking-[0.01em] ${selectFieldClasses.label}`}
        >
          {label}
        </label>
        <div className="relative mt-2">
          <select
            id={selectId}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            disabled={disabled}
            className={`h-12 w-full appearance-none rounded-xl border px-4 pr-11 text-sm font-medium text-slate-900 shadow-[0_4px_14px_rgba(15,23,42,0.04)] transition-all duration-200 disabled:cursor-not-allowed disabled:bg-slate-100/80 disabled:text-slate-500 focus:outline-none focus:ring-4 ${selectFieldClasses.input}`}
          >
            <option value="">{placeholder}</option>
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <span
            className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded-md border p-1 ${selectFieldClasses.chevron}`}
          >
            <svg
              viewBox="0 0 20 20"
              className="h-3.5 w-3.5"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M5.75 7.75 10 12l4.25-4.25"
                stroke="currentColor"
                strokeWidth="1.9"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        </div>
      </div>
      {helperText ? (
        <p className="col-span-2 mt-0.5 text-xs text-slate-500">{helperText}</p>
      ) : null}
    </div>
  );
}

function PreviewModel({
  modelPath,
  onReady,
}: {
  modelPath: string;
  onReady: () => void;
}) {
  const { scene } = useGLTF(modelPath);
  const model = useMemo(() => scene.clone(), [scene]);

  useEffect(() => {
    onReady();
  }, [onReady]);

  const { groundedModel, scale } = useMemo(() => {
    const bounds = new Box3().setFromObject(model);
    const size = new Vector3();
    const center = new Vector3();
    bounds.getSize(size);
    bounds.getCenter(center);

    const maxDimension = Math.max(size.x, size.y, size.z);
    if (!maxDimension) {
      return { groundedModel: model, scale: 1 };
    }

    model.position.set(-center.x, -bounds.min.y, -center.z);

    return {
      groundedModel: model,
      scale: 8 / maxDimension,
    };
  }, [model]);

  return <primitive object={groundedModel} scale={scale} />;
}

function PreviewScene({
  modelPath,
  onModelReady,
}: {
  modelPath: string;
  onModelReady: () => void;
}) {
  return (
    <Canvas
      camera={{ position: [10, 6, 10], fov: 38 }}
      gl={{ antialias: true }}
      dpr={[1, 2]}
      style={{ width: "100%", height: "100%" }}
    >
      <color attach="background" args={["#f5f5f5"]} />
      <hemisphereLight intensity={1.2} groundColor="#e0e0e0" />
      <directionalLight position={[10, 18, 10]} intensity={1.6} />
      <directionalLight position={[-8, 8, -6]} intensity={0.8} />

      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -1.25, 0]}
        receiveShadow
      >
        <planeGeometry args={[60, 60]} />
        <meshStandardMaterial
          color="#e8e8e8"
          roughness={0.9}
          metalness={0.05}
        />
      </mesh>

      <Suspense fallback={null}>
        <PreviewModel modelPath={modelPath} onReady={onModelReady} />
      </Suspense>

      <OrbitControls
        enablePan={false}
        minDistance={4}
        maxDistance={40}
        minPolarAngle={Math.PI / 4.2}
        maxPolarAngle={Math.PI / 2.05}
        target={[0, 0.75, 0]}
      />
    </Canvas>
  );
}

export default function ConfigurePage() {
  const [schema, setSchema] = useState<AdminConfigState | null>(null);
  const [activeBodyTab, setActiveBodyTab] = useState<string>("");
  const [selections, setSelections] = useState<FieldValueMap>({});
  const [manualOverrides, setManualOverrides] = useState<ManualOverrideMap>({});
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingSchema, setIsLoadingSchema] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(true);
  const [isCurrentConfigOpen, setIsCurrentConfigOpen] = useState(true);
  const [isQuoteViewOpen, setIsQuoteViewOpen] = useState(false);
  const [quoteSnapshot, setQuoteSnapshot] = useState<{
    bodyType: string;
    totalPrice: number;
    groups: QuoteGroup[];
  } | null>(null);

  useEffect(() => {
    const loadSchema = async () => {
      try {
        setIsLoadingSchema(true);
        setError(null);

        const response = await fetch("/api/admin/config");
        if (!response.ok) {
          throw new Error("Failed to load configurator schema");
        }

        const nextSchema = (await response.json()) as AdminConfigState;
        setSchema(nextSchema);

        const visibleTabs = sortByOrder(nextSchema.tabsJson).filter(
          (tab) => !tab.isHidden
        );
        setActiveBodyTab(visibleTabs[0]?.tabKey ?? "");

        const initialSelections = buildInitialSelections(nextSchema);
        const resolved = applyDefaultRules(nextSchema, initialSelections, {});
        setSelections(resolved.selections);
        setManualOverrides(resolved.overrides);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Failed to load schema"
        );
      } finally {
        setIsLoadingSchema(false);
      }
    };

    void loadSchema();
  }, []);

  const visibleTabs = useMemo<AdminTabConfig[]>(() => {
    return sortByOrder((schema?.tabsJson ?? []).filter((tab) => !tab.isHidden));
  }, [schema]);

  const visibleFieldsForActiveTab = useMemo<AdminFieldConfig[]>(() => {
    if (!schema || !activeBodyTab) {
      return [];
    }

    return sortByOrder(
      schema.fieldsJson.filter(
        (field) =>
          field.tabKey === activeBodyTab &&
          !field.isHidden &&
          isFieldVisible(field, selections)
      )
    );
  }, [activeBodyTab, schema, selections]);

  useEffect(() => {
    if (!activeBodyTab && visibleTabs.length > 0) {
      setActiveBodyTab(visibleTabs[0].tabKey);
    }
  }, [activeBodyTab, visibleTabs]);

  const totalPrice = useMemo(() => {
    if (!schema) {
      return 0;
    }

    return schema.fieldsJson.reduce((sum, field) => {
      if (field.isHidden || !isFieldVisible(field, selections)) {
        return sum;
      }

      const value = selections[field.fieldKey];
      let fieldTotal = field.basePrice ?? 0;

      if (field.type === "select") {
        fieldTotal += optionPriceByValue(field, value);
      }

      if (field.type === "checkbox") {
        fieldTotal = value ? fieldTotal : 0;
      }

      return sum + fieldTotal;
    }, 0);
  }, [schema, selections]);

  const bodyTypeValue = normalizeValue(selections[BODY_TYPE_FIELD_KEY]);

  const quoteGroups = useMemo<QuoteGroup[]>(() => {
    if (!schema) {
      return [];
    }

    return visibleTabs.map((tab) => {
      const items = sortByOrder(schema.fieldsJson)
        .filter(
          (field) =>
            field.tabKey === tab.tabKey &&
            !field.isHidden &&
            isFieldVisible(field, selections)
        )
        .map((field) => {
          const value = normalizeValue(selections[field.fieldKey]);
          return {
            field,
            value,
          };
        })
        .filter(({ value }) => value && value !== "false")
        .map(({ field, value }) => ({
          fieldKey: field.fieldKey,
          label: field.label,
          value:
            field.type === "checkbox"
              ? "Yes"
              : field.type === "select"
              ? sortByOrder(field.options ?? []).find((option) =>
                  hasComparableMatch(option.value, value)
                )?.label ?? value
              : value,
          price:
            (field.type === "select"
              ? optionPriceByValue(field, value)
              : 0) + (field.basePrice ?? 0),
        }));

      return {
        groupKey: tab.tabKey,
        label: tab.label,
        items,
      };
    });
  }, [schema, selections, visibleTabs]);

  const selectedModelFileName = useMemo(() => {
    if (!schema) {
      return null;
    }

    const visibleFields = sortByOrder(schema.fieldsJson).filter(
      (field) => !field.isHidden && isFieldVisible(field, selections)
    );

    for (const field of visibleFields) {
      if (field.type !== "select") {
        continue;
      }

      const selectedValue = normalizeValue(selections[field.fieldKey]);
      if (!selectedValue) {
        continue;
      }

      const selectedOption = sortByOrder(field.options ?? []).find(
        (option) =>
          !option.isHidden && hasComparableMatch(option.value, selectedValue)
      );
      const modelFileName = selectedOption?.modelFileName?.trim();

      if (modelFileName) {
        return modelFileName;
      }
    }

    return null;
  }, [schema, selections]);

  const resolvedModelPath = useMemo(() => {
    if (!selectedModelFileName) {
      return null;
    }

    if (/^https?:\/\//i.test(selectedModelFileName)) {
      return selectedModelFileName;
    }

    if (modelBaseUrl) {
      return `${modelBaseUrl}/${selectedModelFileName.replace(/^\/+/, "")}`;
    }

    return `/${selectedModelFileName.replace(/^\/+/, "")}`;
  }, [selectedModelFileName]);

  useEffect(() => {
    if (!resolvedModelPath) {
      setIsPreviewLoading(false);
      return;
    }

    setIsPreviewLoading(true);
    useGLTF.preload(resolvedModelPath);
  }, [resolvedModelPath]);

  const handleFieldChange = (field: AdminFieldConfig, nextValue: string) => {
    if (!schema) {
      return;
    }

    setSelections((current) => {
      const value: FieldValue =
        field.type === "number"
          ? Number(nextValue) || 0
          : field.type === "checkbox"
          ? nextValue === "true"
          : nextValue;

      const nextSelections = { ...current, [field.fieldKey]: value };
      const nextOverrides = { ...manualOverrides, [field.fieldKey]: true };
      const resolved = applyDefaultRules(schema, nextSelections, nextOverrides);

      setManualOverrides(resolved.overrides);
      setSavedMessage(null);
      return resolved.selections;
    });
  };

  const handleReset = () => {
    if (!schema) {
      return;
    }

    const initialSelections = buildInitialSelections(schema);
    const resolved = applyDefaultRules(schema, initialSelections, {});
    setSelections(resolved.selections);
    setManualOverrides(resolved.overrides);
    setSavedMessage(null);
    setError(null);
  };

  const handleSaveConfiguration = async () => {
    if (!bodyTypeValue || !schema) {
      return;
    }

    setIsSaving(true);
    setError(null);
    setSavedMessage(null);

    try {
      const response = await fetch("/api/configurations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bodyType: bodyTypeValue,
          config: {
            schemaVersion: schema?.schemaVersion ?? null,
            selections,
          },
          totalPrice,
        }),
      });

      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        throw new Error(body.error ?? "Failed to get quote for configuration");
      }

      setQuoteSnapshot({
        bodyType: bodyTypeValue,
        totalPrice,
        groups: quoteGroups,
      });
      setSavedMessage("Quote retrieved successfully");
      setIsQuoteViewOpen(true);

      const initialSelections = buildInitialSelections(schema);
      const resolved = applyDefaultRules(schema, initialSelections, {});
      setSelections(resolved.selections);
      setManualOverrides(resolved.overrides);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Failed to get quote for configuration"
      );
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoadingSchema) {
    return (
      <ConfiguratorShell activeNav="configure">
        <div className="mx-auto max-w-6xl px-8 py-8">
          <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-md">
            <p className="text-sm text-gray-600">
              Loading configurator schema...
            </p>
          </div>
        </div>
      </ConfiguratorShell>
    );
  }

  if (!schema) {
    return (
      <ConfiguratorShell activeNav="configure">
        <div className="mx-auto max-w-6xl px-8 py-8">
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-8 shadow-md">
            <p className="text-sm text-rose-700">
              {error || "Unable to load configurator."}
            </p>
          </div>
        </div>
      </ConfiguratorShell>
    );
  }

  if (isQuoteViewOpen && quoteSnapshot) {
    return (
      <ConfiguratorShell activeNav="configure">
        <QuoteSummary
          bodyType={quoteSnapshot.bodyType}
          totalPrice={quoteSnapshot.totalPrice}
          groups={quoteSnapshot.groups}
          onBack={() => setIsQuoteViewOpen(false)}
        />
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
          <p className="mt-2 text-3xl font-bold text-white">
            {formatCurrency(totalPrice)}
          </p>
          <p className="mt-2 text-xs text-blue-100/75">
            Starts after Body Type selection
          </p>
        </div>
      }
    >
      <div className="mx-auto flex h-[calc(100vh-2rem)] max-w-6xl flex-col px-8 py-4">
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-8 lg:grid-cols-2">
          <div className="relative z-20 flex h-full min-h-0 flex-col">
            <div className="shrink-0">
              <h2 className="mb-3 text-xl font-semibold text-gray-900">
                Vehicle Configuration
              </h2>

              <div className="relative z-30 isolate mb-4 grid grid-cols-2 rounded-xl border border-blue-200 bg-blue-50/80 p-1 shadow-sm pointer-events-auto">
                {visibleTabs.map((tab) => (
                  <button
                    key={tab.tabKey}
                    type="button"
                    onClick={() => setActiveBodyTab(tab.tabKey)}
                    onMouseDown={() => setActiveBodyTab(tab.tabKey)}
                    className={`rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors ${
                      activeBodyTab === tab.tabKey
                        ? "bg-white text-blue-700 shadow-sm"
                        : "text-blue-900/75 hover:text-blue-900"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto pr-1">
              {visibleFieldsForActiveTab.map((field) => {
                const tone =
                  selectIconToneClasses[iconToneByFieldType[field.type]];
                const value = normalizeValue(selections[field.fieldKey]);
                const isRequired = field.isRequired;
                const options: SelectOption[] =
                  field.type === "select"
                    ? sortByOrder(field.options ?? [])
                        .filter((option) => !option.isHidden)
                        .map((option) => ({
                          value: option.value,
                          label: optionToLabel(option),
                        }))
                    : field.type === "checkbox"
                    ? [
                        { value: "true", label: "Yes" },
                        { value: "false", label: "No" },
                      ]
                    : [];

                const helperText =
                  field.type === "select"
                    ? value
                      ? `Price: ${formatCurrency(
                          optionPriceByValue(field, value)
                        )}`
                      : field.helperText
                    : field.helperText;

                return (
                  <div
                    key={field.fieldKey}
                    className={`grid grid-cols-[64px_1fr] gap-3 rounded-2xl border p-3.5 ${selectFieldClasses.card}`}
                  >
                    <span
                      className={`inline-flex h-full min-h-[92px] items-center justify-center rounded-2xl border shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] ${tone.rail}`}
                    >
                      <span
                        className={`relative inline-flex h-11 w-11 items-center justify-center rounded-xl border [&_svg]:h-[20px] [&_svg]:w-[20px] ${tone.badge}`}
                      >
                        {fieldIcon(field)}
                      </span>
                    </span>
                    <div className="flex flex-col justify-center">
                      <label
                        className={`text-sm font-semibold tracking-[0.01em] ${selectFieldClasses.label}`}
                      >
                        {field.label}
                        {isRequired ? (
                          <span
                            className="ml-1 align-middle text-rose-600"
                            aria-label="required"
                            title="Required"
                          >
                            *
                          </span>
                        ) : null}
                      </label>
                      {field.type === "select" || field.type === "checkbox" ? (
                        <div className="relative mt-2">
                          <select
                            value={value}
                            onChange={(event) =>
                              handleFieldChange(field, event.target.value)
                            }
                            className={`h-12 w-full appearance-none rounded-xl border px-4 pr-11 text-sm font-medium text-slate-900 shadow-[0_4px_14px_rgba(15,23,42,0.04)] transition-all duration-200 focus:outline-none focus:ring-4 ${selectFieldClasses.input}`}
                          >
                            <option value="">
                              {field.placeholder || "Select option"}
                            </option>
                            {options.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                          <span
                            className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded-md border p-1 ${selectFieldClasses.chevron}`}
                          >
                            <svg
                              viewBox="0 0 20 20"
                              className="h-3.5 w-3.5"
                              fill="none"
                              aria-hidden="true"
                            >
                              <path
                                d="M5.75 7.75 10 12l4.25-4.25"
                                stroke="currentColor"
                                strokeWidth="1.9"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          </span>
                        </div>
                      ) : (
                        <input
                          type={field.type === "number" ? "number" : "text"}
                          value={value}
                          onChange={(event) =>
                            handleFieldChange(field, event.target.value)
                          }
                          placeholder={field.placeholder || field.label}
                          className={`mt-2 h-12 w-full rounded-xl border px-4 text-sm font-medium text-slate-900 shadow-[0_4px_14px_rgba(15,23,42,0.04)] transition-all duration-200 focus:outline-none focus:ring-4 ${selectFieldClasses.input}`}
                        />
                      )}
                    </div>
                    {helperText ? (
                      <p className="col-span-2 mt-0.5 text-xs text-slate-500">
                        {helperText}
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>

            <div className="shrink-0">
              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleSaveConfiguration}
                  disabled={!bodyTypeValue || isSaving}
                  className="flex-1 rounded-lg bg-blue-600 px-6 py-3 font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSaving ? "Loading..." : "Get Quote"}
                </button>
                <button
                  onClick={handleReset}
                  className="flex-1 rounded-lg border border-gray-300 bg-white px-6 py-3 font-medium text-gray-700 transition-colors hover:bg-gray-50"
                >
                  Reset
                </button>
              </div>

              {savedMessage ? (
                <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  {savedMessage}
                </div>
              ) : null}
              {error ? (
                <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {error}
                </div>
              ) : null}
            </div>
          </div>

          <div className="relative z-0 flex h-full min-h-0 flex-col overflow-y-auto pr-1">
            <button
              type="button"
              onClick={() => setIsPreviewOpen((open) => !open)}
              className="mb-3 flex shrink-0 items-center justify-between text-left"
            >
              <h2 className="text-xl font-semibold text-gray-900">Preview</h2>
              <svg
                viewBox="0 0 20 20"
                className={`h-4 w-4 text-slate-500 transition-transform ${
                  isPreviewOpen ? "rotate-180" : ""
                }`}
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M5.75 7.75 10 12l4.25-4.25"
                  stroke="currentColor"
                  strokeWidth="1.9"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            {isPreviewOpen ? (
              <div className="relative h-[500px] w-full shrink-0 overflow-hidden rounded-xl border border-gray-200 bg-gray-50 shadow-md">
                {resolvedModelPath ? (
                  <PreviewScene
                    modelPath={resolvedModelPath}
                    onModelReady={() => setIsPreviewLoading(false)}
                  />
                ) : null}
                <div className="absolute left-4 top-4 z-10 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm">
                  3D Model View
                </div>
                <div className="absolute bottom-4 left-4 z-10 rounded-lg bg-white px-3 py-2 text-xs text-gray-600 shadow-sm">
                  <p className="font-medium">Drag to rotate • Scroll to zoom</p>
                </div>
                {!resolvedModelPath ? (
                  <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/82 backdrop-blur-sm">
                    <div className="max-w-xs rounded-2xl border border-slate-200 bg-white px-6 py-5 text-center shadow-lg">
                      <p className="text-sm font-semibold text-slate-900">
                        Select body type to preview
                      </p>
                      <p className="mt-2 text-sm text-slate-500">
                        Choose Dump Body or Service Body to load the 3D model.
                      </p>
                    </div>
                  </div>
                ) : null}
                {resolvedModelPath && isPreviewLoading ? (
                  <div className="absolute inset-0 z-30 flex items-center justify-center bg-white/70 backdrop-blur-sm">
                    <div className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold tracking-[0.08em] text-slate-600 shadow-sm">
                      Loading 3D preview...
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="mt-6 shrink-0 rounded-lg border border-blue-100 bg-blue-50 p-4">
              <button
                type="button"
                onClick={() => setIsCurrentConfigOpen((open) => !open)}
                className="flex w-full items-center justify-between text-left"
              >
                <p className="text-sm font-medium text-gray-900">
                  Current Configuration
                </p>
                <svg
                  viewBox="0 0 20 20"
                  className={`h-4 w-4 text-slate-500 transition-transform ${
                    isCurrentConfigOpen ? "rotate-180" : ""
                  }`}
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M5.75 7.75 10 12l4.25-4.25"
                    stroke="currentColor"
                    strokeWidth="1.9"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
              {isCurrentConfigOpen ? (
                <div className="mt-3 space-y-1 text-sm text-gray-600">
                  {sortByOrder(schema.fieldsJson)
                    .filter(
                      (field) =>
                        !field.isHidden && isFieldVisible(field, selections)
                    )
                    .map((field) => {
                      const value = normalizeValue(selections[field.fieldKey]);
                      if (!value || value === "false") {
                        return null;
                      }

                      return (
                        <div
                          key={field.fieldKey}
                          className="flex justify-between"
                        >
                          <span>{field.label}:</span>
                          <span className="font-medium text-gray-900">
                            {value}
                          </span>
                        </div>
                      );
                    })}
                  <div className="flex justify-between border-t border-blue-200 pt-2">
                    <span>Body Package Price:</span>
                    <span className="font-medium text-gray-900">
                      {formatCurrency(totalPrice)}
                    </span>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </ConfiguratorShell>
  );
}
