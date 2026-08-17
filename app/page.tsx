"use client";

import { ReactNode, Suspense, useEffect, useId, useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";
import { Box3, Vector3 } from "three";
import { APP_NAME } from "./constant";

type BodyTypeKey = "dump" | "service";

type ServiceDimensionKey = "length" | "width" | "height" | "ca";

type DumpDimensionKey =
  | "length"
  | "sideHeight"
  | "bodyStyle"
  | "rearGate"
  | "asphaltGate"
  | "tailgateAngle"
  | "hoist"
  | "cabGuard";

type PricingOption = {
  value: string;
  label: string;
  price: number;
};

type ServiceDimensionConfig = {
  key: ServiceDimensionKey;
  label: string;
  placeholder: string;
  options: PricingOption[];
  defaultByLength?: Record<string, string>;
};

type ServiceBodyPricingConfig = {
  baseDimensionKey: ServiceDimensionKey;
  dimensions: ServiceDimensionConfig[];
};

type DumpDimensionConfig = {
  key: DumpDimensionKey;
  label: string;
  placeholder: string;
  options: PricingOption[];
  defaultByLength?: Record<string, string>;
};

type DumpBodyPricingConfig = {
  baseDimensionKey: DumpDimensionKey;
  dimensions: DumpDimensionConfig[];
};

type BodyTypeOption = {
  key: BodyTypeKey;
  label: string;
  modelFileName: string;
};

const bodyTypeOptions: BodyTypeOption[] = [
  { key: "dump", label: "Dump Body", modelFileName: "dump_body.glb" },
  { key: "service", label: "Service Body", modelFileName: "service_body.glb" },
];

const modelBaseUrl = process.env.NEXT_PUBLIC_S3_DOMAIN_URL?.replace(/\/$/, "") ?? "";

const dropdownOptions = {
  make: ["Volvo", "Scania", "MAN", "Daimler", "Renault"],
  modelYear: ["2024", "2023", "2022", "2021", "2020"],
  cabStyle: ["Day Cab", "Sleeper Cab", "Crew Cab"],
  modelName: ["FH16", "S730", "TGX", "Actros", "T"],
  cabType: ["Standard", "Premium", "Executive"],
  ca: ["2.5m", "3.0m", "3.5m", "4.0m"],
  wb: ["3.0m", "3.5m", "4.0m", "4.5m", "5.0m"],
  fuelType: ["Diesel", "LNG", "Hybrid", "Electric"],
  gvwr: ["33,000", "52,000", "66,000", "80,000"],
  rearWheelDriveType: ["Single", "Dual", "Tridem"],
} as const;

type OemConfigState = {
  make: string;
  modelYear: string;
  cabStyle: string;
  modelName: string;
  cabType: string;
  ca: string;
  wb: string;
  fuelType: string;
  gvwr: string;
  rearWheelDriveType: string;
};

type BodyTabKey = "oemChassis" | "bodyUi";

type BodyConfigState = {
  bodyType: BodyTypeKey | "";
  dumpSelections: Record<DumpDimensionKey, string>;
  serviceSelections: Record<ServiceDimensionKey, string>;
};

type DumpEditableDimensionKey = Exclude<DumpDimensionKey, "length">;

type ServiceEditableDimensionKey = Exclude<ServiceDimensionKey, "length">;

type BodyManualOverrideState = {
  dump: Record<DumpEditableDimensionKey, boolean>;
  service: Record<ServiceEditableDimensionKey, boolean>;
};

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

const dumpBodyPricingConfig: DumpBodyPricingConfig = {
  baseDimensionKey: "length",
  dimensions: [
    {
      key: "length",
      label: "Length",
      placeholder: "Select Length",
      options: [
        { value: "336", label: "336", price: 47740 },
        { value: "360", label: "360", price: 51715 },
        { value: "384", label: "384", price: 55690 },
        { value: "192", label: "192", price: 47740 },
        { value: "216", label: "216", price: 47740 },
      ],
    },
    {
      key: "sideHeight",
      label: "Side Height",
      placeholder: "Select Side Height",
      options: [
        { value: "57", label: "57", price: 0 },
        { value: "60", label: "60", price: 800 },
        { value: "63", label: "63", price: 1600 },
      ],
      defaultByLength: {
        "192": "57",
        "216": "57",
        "336": "57",
        "360": "60",
        "384": "63",
      },
    },
    {
      key: "bodyStyle",
      label: "Body Style",
      placeholder: "Select Body Style",
      options: [
        { value: "Square", label: "Square", price: 0 },
        { value: "Tapered", label: "Tapered", price: 400 },
        { value: "Elliptical", label: "Elliptical", price: 600 },
      ],
      defaultByLength: {
        "192": "Square",
        "216": "Square",
        "336": "Square",
        "360": "Tapered",
        "384": "Elliptical",
      },
    },
    {
      key: "rearGate",
      label: "Rear Gate",
      placeholder: "Select Rear Gate",
      options: [
        { value: "Cargo Door", label: "Cargo Door", price: 0 },
        { value: "Lift Door", label: "Lift Door", price: 1200 },
      ],
      defaultByLength: {
        "192": "Cargo Door",
        "216": "Cargo Door",
        "336": "Cargo Door",
        "360": "Cargo Door",
        "384": "Lift Door",
      },
    },
    {
      key: "asphaltGate",
      label: "Asphalt Gate",
      placeholder: "Select Asphalt Gate",
      options: [
        { value: "No", label: "No", price: 0 },
        { value: "1", label: "1", price: 100 },
        { value: "2", label: "2", price: 175 },
        { value: "3", label: "3", price: 250 },
      ],
      defaultByLength: {
        "192": "No",
        "216": "No",
        "336": "No",
        "360": "1",
        "384": "2",
      },
    },
    {
      key: "tailgateAngle",
      label: "Tailgate Angle",
      placeholder: "Select Tailgate Angle",
      options: [
        { value: "90°", label: "90°", price: 0 },
        { value: "20°", label: "20°", price: 125 },
      ],
      defaultByLength: {
        "192": "90°",
        "216": "90°",
        "336": "90°",
        "360": "20°",
        "384": "20°",
      },
    },
    {
      key: "hoist",
      label: "Hoist",
      placeholder: "Select Hoist",
      options: [
        { value: "Power Up", label: "Power Up", price: 0 },
        { value: "Power Up & Down", label: "Power Up & Down", price: 750 },
      ],
      defaultByLength: {
        "192": "Power Up",
        "216": "Power Up",
        "336": "Power Up",
        "360": "Power Up & Down",
        "384": "Power Up & Down",
      },
    },
    {
      key: "cabGuard",
      label: "Cab Guard",
      placeholder: "Select Cab Guard",
      options: [
        { value: "Yes", label: "Yes", price: 780 },
        { value: "No", label: "No", price: 0 },
      ],
      defaultByLength: {
        "192": "Yes",
        "216": "Yes",
        "336": "Yes",
        "360": "No",
        "384": "No",
      },
    },
  ],
};

const serviceBodyPricingConfig: ServiceBodyPricingConfig = {
  baseDimensionKey: "length",
  dimensions: [
    {
      key: "length",
      label: "Length",
      placeholder: "Select Length",
      options: [
        { value: "82", label: "82", price: 10965 },
        { value: "97", label: "97", price: 11560 },
        { value: "108", label: "108", price: 12980 },
        { value: "130", label: "130", price: 14590 },
        { value: "134", label: "134", price: 15280 },
      ],
    },
    {
      key: "width",
      label: "Width",
      placeholder: "Select Width",
      options: [
        { value: "78", label: "78", price: 0 },
        { value: "80", label: "80", price: 350 },
        { value: "82", label: "82", price: 550 },
        { value: "94", label: "94", price: 965 },
      ],
      defaultByLength: {
        "82": "78",
        "97": "80",
        "108": "94",
        "130": "82",
        "134": "78",
      },
    },
    {
      key: "height",
      label: "Height",
      placeholder: "Select Height",
      options: [
        { value: "36", label: "36", price: 0 },
        { value: "40", label: "40", price: 125 },
        { value: "43", label: "43", price: 185 },
        { value: "46", label: "46", price: 235 },
        { value: "60", label: "60", price: 400 },
      ],
      defaultByLength: {
        "82": "36",
        "97": "40",
        "108": "43",
        "130": "46",
        "134": "60",
      },
    },
    {
      key: "ca",
      label: "CA",
      placeholder: "Select CA",
      options: [
        { value: "40", label: "40", price: 0 },
        { value: "56", label: "56", price: 40 },
        { value: "60", label: "60", price: 90 },
        { value: "82", label: "82", price: 140 },
        { value: "84", label: "84", price: 160 },
      ],
      defaultByLength: {
        "82": "40",
        "97": "56",
        "108": "60",
        "130": "82",
        "134": "84",
      },
    },
  ],
};

const selectIconToneByLabel: Partial<Record<string, SelectIconTone>> = {
  Make: "emerald",
  "Model Year": "violet",
  "Cab Style": "cyan",
  "Model Name": "amber",
  "Cab Type": "rose",
  CA: "blue",
  WB: "cyan",
  "Fuel Type": "amber",
  GVWR: "violet",
  "Rear Wheel Drive Type": "emerald",
  "Body Type": "blue",
  Length: "cyan",
  "Base Price": "emerald",
  "Side Height": "violet",
  "Body Style": "amber",
  Width: "violet",
  Height: "amber",
  "Rear Gate": "rose",
  "Asphalt Gate": "rose",
  "Tailgate Angle": "cyan",
  Hoist: "blue",
  "Cab Guard": "emerald",
};

const selectFieldClasses: {
  card: string;
  label: string;
  input: string;
  chevron: string;
} = {
  card: "border-slate-200/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.98))] shadow-[0_12px_26px_rgba(15,23,42,0.06)]",
  label: "text-slate-800",
  input: "border-slate-200 bg-white hover:border-slate-300 focus:border-blue-500 focus:ring-blue-500/10",
  chevron: "border-slate-200 bg-slate-50 text-slate-500",
};

const selectIconToneClasses: Record<SelectIconTone, { rail: string; badge: string }> = {
  blue: {
    rail: "border-blue-100 bg-[linear-gradient(180deg,#eff6ff_0%,#dbeafe_100%)]",
    badge: "border-blue-100 bg-white/80 text-blue-700 shadow-[0_8px_18px_rgba(59,130,246,0.14)]",
  },
  cyan: {
    rail: "border-cyan-100 bg-[linear-gradient(180deg,#ecfeff_0%,#cffafe_100%)]",
    badge: "border-cyan-100 bg-white/80 text-cyan-700 shadow-[0_8px_18px_rgba(6,182,212,0.14)]",
  },
  emerald: {
    rail: "border-emerald-100 bg-[linear-gradient(180deg,#ecfdf5_0%,#d1fae5_100%)]",
    badge: "border-emerald-100 bg-white/80 text-emerald-700 shadow-[0_8px_18px_rgba(16,185,129,0.14)]",
  },
  amber: {
    rail: "border-amber-100 bg-[linear-gradient(180deg,#fffbeb_0%,#fde68a_100%)]",
    badge: "border-amber-100 bg-white/85 text-amber-700 shadow-[0_8px_18px_rgba(245,158,11,0.14)]",
  },
  violet: {
    rail: "border-violet-100 bg-[linear-gradient(180deg,#f5f3ff_0%,#ede9fe_100%)]",
    badge: "border-violet-100 bg-white/80 text-violet-700 shadow-[0_8px_18px_rgba(139,92,246,0.14)]",
  },
  rose: {
    rail: "border-rose-100 bg-[linear-gradient(180deg,#fff1f2_0%,#ffe4e6_100%)]",
    badge: "border-rose-100 bg-white/80 text-rose-700 shadow-[0_8px_18px_rgba(244,63,94,0.14)]",
  },
};

const toSelectOptions = (options: readonly string[]): SelectOption[] =>
  options.map((option) => ({ value: option, label: option }));

const toPricingSelectOptions = (options: PricingOption[]): SelectOption[] =>
  options.map((option) => ({ value: option.value, label: option.label }));

const toSingleOption = (value: string): SelectOption[] => [{ value, label: value }];

const formatCurrency = (value: number): string =>
  `$${value.toLocaleString("en-US", { minimumFractionDigits: 0 })}`;

const getDumpDimensionByKey = (
  config: DumpBodyPricingConfig,
  key: DumpDimensionKey
): DumpDimensionConfig =>
  config.dimensions.find((dimension) => dimension.key === key)
  ?? config.dimensions[0];

const getDumpOptionPrice = (
  config: DumpBodyPricingConfig,
  key: DumpDimensionKey,
  value: string
): number => {
  const dimension = getDumpDimensionByKey(config, key);
  const option = dimension.options.find((item) => item.value === value);
  return option?.price ?? 0;
};

const getDumpTotalPrice = (
  config: DumpBodyPricingConfig,
  selections: Record<DumpDimensionKey, string>
): number => {
  const selectedBaseValue = selections[config.baseDimensionKey];
  if (!selectedBaseValue) {
    return 0;
  }

  return config.dimensions.reduce((total, dimension) => {
    const selectedValue = selections[dimension.key];
    if (!selectedValue) {
      return total;
    }

    return total + getDumpOptionPrice(config, dimension.key, selectedValue);
  }, 0);
};

const getDumpAutoSelectionsByLength = (
  config: DumpBodyPricingConfig,
  lengthValue: string
): Record<DumpDimensionKey, string> => {
  const nextSelections: Record<DumpDimensionKey, string> = {
    length: lengthValue,
    sideHeight: "",
    bodyStyle: "",
    rearGate: "",
    asphaltGate: "",
    tailgateAngle: "",
    hoist: "",
    cabGuard: "",
  };

  (config.dimensions.filter((dimension) => dimension.key !== "length") as DumpDimensionConfig[])
    .forEach((dimension) => {
      const defaultValue = dimension.defaultByLength?.[lengthValue] ?? dimension.options[0]?.value ?? "";
      nextSelections[dimension.key] = defaultValue;
    });

  return nextSelections;
};

const dumpEditableDimensionKeys: DumpEditableDimensionKey[] = [
  "sideHeight",
  "bodyStyle",
  "rearGate",
  "asphaltGate",
  "tailgateAngle",
  "hoist",
  "cabGuard",
];

const getDumpDefaultSelectionByLength = (
  config: DumpBodyPricingConfig,
  key: DumpEditableDimensionKey,
  lengthValue: string
): string => {
  const dimension = getDumpDimensionByKey(config, key);
  return dimension.defaultByLength?.[lengthValue] ?? dimension.options[0]?.value ?? "";
};

const getDumpManualOverridesFromSelections = (
  config: DumpBodyPricingConfig,
  selections: Record<DumpDimensionKey, string>
): Record<DumpEditableDimensionKey, boolean> => {
  if (!selections.length) {
    return {
      sideHeight: false,
      bodyStyle: false,
      rearGate: false,
      asphaltGate: false,
      tailgateAngle: false,
      hoist: false,
      cabGuard: false,
    };
  }

  return {
    sideHeight: Boolean(selections.sideHeight) && selections.sideHeight !== getDumpDefaultSelectionByLength(config, "sideHeight", selections.length),
    bodyStyle: Boolean(selections.bodyStyle) && selections.bodyStyle !== getDumpDefaultSelectionByLength(config, "bodyStyle", selections.length),
    rearGate: Boolean(selections.rearGate) && selections.rearGate !== getDumpDefaultSelectionByLength(config, "rearGate", selections.length),
    asphaltGate: Boolean(selections.asphaltGate) && selections.asphaltGate !== getDumpDefaultSelectionByLength(config, "asphaltGate", selections.length),
    tailgateAngle: Boolean(selections.tailgateAngle) && selections.tailgateAngle !== getDumpDefaultSelectionByLength(config, "tailgateAngle", selections.length),
    hoist: Boolean(selections.hoist) && selections.hoist !== getDumpDefaultSelectionByLength(config, "hoist", selections.length),
    cabGuard: Boolean(selections.cabGuard) && selections.cabGuard !== getDumpDefaultSelectionByLength(config, "cabGuard", selections.length),
  };
};

const mergeDumpSelectionsByLength = (
  config: DumpBodyPricingConfig,
  previousSelections: Record<DumpDimensionKey, string>,
  lengthValue: string,
  manualOverrides: Record<DumpEditableDimensionKey, boolean>
): Record<DumpDimensionKey, string> => {
  const autoSelections = getDumpAutoSelectionsByLength(config, lengthValue);
  const nextSelections: Record<DumpDimensionKey, string> = { ...autoSelections };

  dumpEditableDimensionKeys.forEach((key) => {
    if (manualOverrides[key] && previousSelections[key]) {
      nextSelections[key] = previousSelections[key];
    }
  });

  return nextSelections;
};

const getDimensionByKey = (
  config: ServiceBodyPricingConfig,
  key: ServiceDimensionKey
): ServiceDimensionConfig =>
  config.dimensions.find((dimension) => dimension.key === key)
  ?? config.dimensions[0];

const getOptionPrice = (
  config: ServiceBodyPricingConfig,
  key: ServiceDimensionKey,
  value: string
): number => {
  const dimension = getDimensionByKey(config, key);
  const option = dimension.options.find((item) => item.value === value);
  return option?.price ?? 0;
};

const getAutoSelectionsByBaseDimension = (
  config: ServiceBodyPricingConfig,
  baseValue: string
): Record<ServiceDimensionKey, string> => {
  const nextSelections: Record<ServiceDimensionKey, string> = {
    length: "",
    width: "",
    height: "",
    ca: "",
  };
  nextSelections[config.baseDimensionKey] = baseValue;

  (config.dimensions.filter((dimension) => dimension.key !== config.baseDimensionKey) as ServiceDimensionConfig[])
    .forEach((dimension) => {
      const defaultValue = dimension.defaultByLength?.[baseValue] ?? dimension.options[0]?.value ?? "";
      nextSelections[dimension.key] = defaultValue;
    });

  return nextSelections;
};

const serviceEditableDimensionKeys: ServiceEditableDimensionKey[] = ["width", "height", "ca"];

const getServiceDefaultSelectionByLength = (
  config: ServiceBodyPricingConfig,
  key: ServiceEditableDimensionKey,
  lengthValue: string
): string => {
  const dimension = getDimensionByKey(config, key);
  return dimension.defaultByLength?.[lengthValue] ?? dimension.options[0]?.value ?? "";
};

const getServiceManualOverridesFromSelections = (
  config: ServiceBodyPricingConfig,
  selections: Record<ServiceDimensionKey, string>
): Record<ServiceEditableDimensionKey, boolean> => {
  if (!selections.length) {
    return {
      width: false,
      height: false,
      ca: false,
    };
  }

  return {
    width: Boolean(selections.width) && selections.width !== getServiceDefaultSelectionByLength(config, "width", selections.length),
    height: Boolean(selections.height) && selections.height !== getServiceDefaultSelectionByLength(config, "height", selections.length),
    ca: Boolean(selections.ca) && selections.ca !== getServiceDefaultSelectionByLength(config, "ca", selections.length),
  };
};

const mergeServiceSelectionsByLength = (
  config: ServiceBodyPricingConfig,
  previousSelections: Record<ServiceDimensionKey, string>,
  lengthValue: string,
  manualOverrides: Record<ServiceEditableDimensionKey, boolean>
): Record<ServiceDimensionKey, string> => {
  const autoSelections = getAutoSelectionsByBaseDimension(config, lengthValue);
  const nextSelections: Record<ServiceDimensionKey, string> = { ...autoSelections };

  serviceEditableDimensionKeys.forEach((key) => {
    if (manualOverrides[key] && previousSelections[key]) {
      nextSelections[key] = previousSelections[key];
    }
  });

  return nextSelections;
};

const getTotalPriceFromSelections = (
  config: ServiceBodyPricingConfig,
  selections: Record<ServiceDimensionKey, string>
): number => {
  const selectedBaseValue = selections[config.baseDimensionKey];
  if (!selectedBaseValue) {
    return 0;
  }

  return config.dimensions.reduce((total, dimension) => {
    const selectedValue = selections[dimension.key];
    if (!selectedValue) {
      return total;
    }

    return total + getOptionPrice(config, dimension.key, selectedValue);
  }, 0);
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
  const iconTone = selectIconToneByLabel[label] ?? "blue";
  const iconToneClass = selectIconToneClasses[iconTone];

  return (
    <div className={`grid grid-cols-[64px_1fr] gap-3 rounded-2xl border p-3.5 ${selectFieldClasses.card}`}>
      <span className={`inline-flex h-full min-h-[92px] items-center justify-center rounded-2xl border shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] ${iconToneClass.rail}`}>
        <span className={`relative inline-flex h-11 w-11 items-center justify-center rounded-xl border [&_svg]:h-[20px] [&_svg]:w-[20px] ${iconToneClass.badge}`}>
          {icon}
        </span>
      </span>
      <div className="flex flex-col justify-center">
        <label htmlFor={selectId} className={`text-sm font-semibold tracking-[0.01em] ${selectFieldClasses.label}`}>
          {label}
        </label>
        <div className="relative mt-2">
          <select
            id={selectId}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            className={`h-12 w-full appearance-none rounded-xl border px-4 pr-11 text-sm font-medium text-slate-900 shadow-[0_4px_14px_rgba(15,23,42,0.04)] transition-all duration-200 disabled:cursor-not-allowed disabled:bg-slate-100/80 disabled:text-slate-500 focus:outline-none focus:ring-4 ${selectFieldClasses.input}`}
          >
            <option value="">{placeholder}</option>
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <span className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded-md border p-1 ${selectFieldClasses.chevron}`}>
            <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" aria-hidden="true">
              <path d="M5.75 7.75 10 12l4.25-4.25" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </div>
      </div>
      {helperText ? <p className="col-span-2 mt-0.5 text-xs text-slate-500">{helperText}</p> : null}
    </div>
  );
}

function BridgeModel({ modelPath, onReady }: { modelPath: string; onReady: () => void }) {
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

function BridgeScene({
  selectedBodyType,
  modelPath,
  onModelReady,
}: {
  selectedBodyType: BodyTypeKey | "";
  modelPath: string | null;
  onModelReady: () => void;
}) {
  const visibleBodyType = bodyTypeOptions.find((option) => option.key === selectedBodyType);

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

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.25, 0]} receiveShadow>
        <planeGeometry args={[60, 60]} />
        <meshStandardMaterial color="#e8e8e8" roughness={0.9} metalness={0.05} />
      </mesh>

      <Suspense fallback={null}>
        {visibleBodyType && modelPath ? (
          <BridgeModel
            key={visibleBodyType.key}
            modelPath={modelPath}
            onReady={onModelReady}
          />
        ) : null}
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

type DumpBodyConfiguratorProps = {
  selections: Record<DumpDimensionKey, string>;
  onSelectionChange: (field: DumpDimensionKey, value: string) => void;
};

function DumpBodyConfigurator({ selections, onSelectionChange }: DumpBodyConfiguratorProps) {
  const lengthDimension = getDumpDimensionByKey(dumpBodyPricingConfig, "length");
  const sideHeightDimension = getDumpDimensionByKey(dumpBodyPricingConfig, "sideHeight");
  const bodyStyleDimension = getDumpDimensionByKey(dumpBodyPricingConfig, "bodyStyle");
  const rearGateDimension = getDumpDimensionByKey(dumpBodyPricingConfig, "rearGate");
  const asphaltGateDimension = getDumpDimensionByKey(dumpBodyPricingConfig, "asphaltGate");
  const tailgateAngleDimension = getDumpDimensionByKey(dumpBodyPricingConfig, "tailgateAngle");
  const hoistDimension = getDumpDimensionByKey(dumpBodyPricingConfig, "hoist");
  const cabGuardDimension = getDumpDimensionByKey(dumpBodyPricingConfig, "cabGuard");

  return (
    <div className="space-y-5">
      <SelectField
        label={lengthDimension.label}
        value={selections.length}
        onChange={(value) => onSelectionChange("length", value)}
        placeholder={lengthDimension.placeholder}
        options={toPricingSelectOptions(lengthDimension.options)}
        helperText={selections.length
          ? `Base Price: ${formatCurrency(getDumpOptionPrice(dumpBodyPricingConfig, "length", selections.length))}`
          : "Select length to start dump pricing."}
        icon={
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
            <path d="M3.5 12h17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            <path d="M7 9.5 4.5 12 7 14.5M17 9.5 19.5 12 17 14.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        }
      />

      <SelectField
        label={sideHeightDimension.label}
        value={selections.sideHeight}
        onChange={(value) => onSelectionChange("sideHeight", value)}
        placeholder={sideHeightDimension.placeholder}
        options={toPricingSelectOptions(sideHeightDimension.options)}
        disabled={!selections.length}
        helperText={selections.length
          ? `Price Diff: ${formatCurrency(getDumpOptionPrice(dumpBodyPricingConfig, "sideHeight", selections.sideHeight))}`
          : "Select length first"}
        icon={
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
            <path d="M5 18V6M19 18V6M5 12h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        }
      />

      <SelectField
        label={bodyStyleDimension.label}
        value={selections.bodyStyle}
        onChange={(value) => onSelectionChange("bodyStyle", value)}
        placeholder={bodyStyleDimension.placeholder}
        options={toPricingSelectOptions(bodyStyleDimension.options)}
        disabled={!selections.length}
        helperText={selections.length
          ? `Price Diff: ${formatCurrency(getDumpOptionPrice(dumpBodyPricingConfig, "bodyStyle", selections.bodyStyle))}`
          : "Select length first"}
        icon={
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
            <path d="M4 16V9.5L12 5l8 4.5V16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M4 12h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        }
      />

      <SelectField
        label={rearGateDimension.label}
        value={selections.rearGate}
        onChange={(value) => onSelectionChange("rearGate", value)}
        placeholder={rearGateDimension.placeholder}
        options={toPricingSelectOptions(rearGateDimension.options)}
        disabled={!selections.length}
        helperText={selections.length
          ? `Price Diff: ${formatCurrency(getDumpOptionPrice(dumpBodyPricingConfig, "rearGate", selections.rearGate))}`
          : "Select length first"}
        icon={
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
            <path d="M6 7h12v10H6z" stroke="currentColor" strokeWidth="1.8" />
            <path d="M6 12h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        }
      />

      <SelectField
        label={asphaltGateDimension.label}
        value={selections.asphaltGate}
        onChange={(value) => onSelectionChange("asphaltGate", value)}
        placeholder={asphaltGateDimension.placeholder}
        options={toPricingSelectOptions(asphaltGateDimension.options)}
        disabled={!selections.length}
        helperText={selections.length
          ? `Price Diff: ${formatCurrency(getDumpOptionPrice(dumpBodyPricingConfig, "asphaltGate", selections.asphaltGate))}`
          : "Select length first"}
        icon={
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
            <path d="M6 7h12v10H6z" stroke="currentColor" strokeWidth="1.8" />
            <path d="M6 12h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        }
      />

      <SelectField
        label={tailgateAngleDimension.label}
        value={selections.tailgateAngle}
        onChange={(value) => onSelectionChange("tailgateAngle", value)}
        placeholder={tailgateAngleDimension.placeholder}
        options={toPricingSelectOptions(tailgateAngleDimension.options)}
        disabled={!selections.length}
        helperText={selections.length
          ? `Price Diff: ${formatCurrency(getDumpOptionPrice(dumpBodyPricingConfig, "tailgateAngle", selections.tailgateAngle))}`
          : "Select length first"}
        icon={
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
            <path d="M5 16h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            <path d="M15 16 19 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        }
      />

      <SelectField
        label={hoistDimension.label}
        value={selections.hoist}
        onChange={(value) => onSelectionChange("hoist", value)}
        placeholder={hoistDimension.placeholder}
        options={toPricingSelectOptions(hoistDimension.options)}
        disabled={!selections.length}
        helperText={selections.length
          ? `Price Diff: ${formatCurrency(getDumpOptionPrice(dumpBodyPricingConfig, "hoist", selections.hoist))}`
          : "Select length first"}
        icon={
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
            <path d="M6 16V9h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            <path d="M15 6h3v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M9 18h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        }
      />

      <SelectField
        label={cabGuardDimension.label}
        value={selections.cabGuard}
        onChange={(value) => onSelectionChange("cabGuard", value)}
        placeholder={cabGuardDimension.placeholder}
        options={toPricingSelectOptions(cabGuardDimension.options)}
        disabled={!selections.length}
        helperText={selections.length
          ? `Price Diff: ${formatCurrency(getDumpOptionPrice(dumpBodyPricingConfig, "cabGuard", selections.cabGuard))}`
          : "Select length first"}
        icon={
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
            <path d="M6 18V8l6-3 6 3v10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M9 12h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        }
      />
    </div>
  );
}

type ServiceBodyConfiguratorProps = {
  selections: Record<ServiceDimensionKey, string>;
  onLengthChange: (value: string) => void;
  onDimensionChange: (field: Exclude<ServiceDimensionKey, "length">, value: string) => void;
};

function ServiceBodyConfigurator({ selections, onLengthChange, onDimensionChange }: ServiceBodyConfiguratorProps) {
  const lengthDimension = getDimensionByKey(serviceBodyPricingConfig, "length");
  const widthDimension = getDimensionByKey(serviceBodyPricingConfig, "width");
  const heightDimension = getDimensionByKey(serviceBodyPricingConfig, "height");
  const caDimension = getDimensionByKey(serviceBodyPricingConfig, "ca");

  const widthPriceDiff = selections.width ? getOptionPrice(serviceBodyPricingConfig, "width", selections.width) : 0;
  const heightPriceDiff = selections.height ? getOptionPrice(serviceBodyPricingConfig, "height", selections.height) : 0;
  const caPriceDiff = selections.ca ? getOptionPrice(serviceBodyPricingConfig, "ca", selections.ca) : 0;

  return (
    <div className="space-y-5">
      <SelectField
        label={lengthDimension.label}
        value={selections.length}
        onChange={onLengthChange}
        placeholder={lengthDimension.placeholder}
        options={toPricingSelectOptions(lengthDimension.options)}
        helperText={selections.length
          ? `Base Price: ${formatCurrency(getOptionPrice(serviceBodyPricingConfig, "length", selections.length))}`
          : "Choose length to auto-fill Width, Height, and CA."}
        icon={
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
            <path d="M3.5 12h17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            <path d="M7 9.5 4.5 12 7 14.5M17 9.5 19.5 12 17 14.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        }
      />

      <SelectField
        label={widthDimension.label}
        value={selections.width}
        onChange={(value) => onDimensionChange("width", value)}
        placeholder={widthDimension.placeholder}
        options={toPricingSelectOptions(widthDimension.options)}
        disabled={!selections.length}
        helperText={selections.length ? `Price Diff: ${formatCurrency(widthPriceDiff)}` : "Select length first"}
        icon={
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
            <path d="M3.5 12h17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            <path d="M7 9.5 4.5 12 7 14.5M17 9.5 19.5 12 17 14.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        }
      />

      <SelectField
        label={heightDimension.label}
        value={selections.height}
        onChange={(value) => onDimensionChange("height", value)}
        placeholder={heightDimension.placeholder}
        options={toPricingSelectOptions(heightDimension.options)}
        disabled={!selections.length}
        helperText={selections.length ? `Price Diff: ${formatCurrency(heightPriceDiff)}` : "Select length first"}
        icon={
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
            <path d="M12 4v16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            <path d="M9.5 7 12 4.5 14.5 7M9.5 17 12 19.5 14.5 17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        }
      />

      <SelectField
        label={caDimension.label}
        value={selections.ca}
        onChange={(value) => onDimensionChange("ca", value)}
        placeholder={caDimension.placeholder}
        options={toPricingSelectOptions(caDimension.options)}
        disabled={!selections.length}
        helperText={selections.length ? `Price Diff: ${formatCurrency(caPriceDiff)}` : "Select length first"}
        icon={
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
            <path d="M4 12h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            <path d="M4 9v6M20 9v6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            <path d="M10 9l-2 3 2 3M14 9l2 3-2 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        }
      />
    </div>
  );
}

export default function ConfigurePage() {
  const [activeTab, setActiveTab] = useState("configure");
  const [activeBodyTab, setActiveBodyTab] = useState<BodyTabKey>("oemChassis");
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [oemConfig, setOemConfig] = useState<OemConfigState>({
    make: "",
    modelYear: "",
    cabStyle: "",
    modelName: "",
    cabType: "",
    ca: "",
    wb: "",
    fuelType: "",
    gvwr: "",
    rearWheelDriveType: "",
  });
  const [bodyConfig, setBodyConfig] = useState<BodyConfigState>({
    bodyType: "",
    dumpSelections: {
      length: "",
      sideHeight: "",
      bodyStyle: "",
      rearGate: "",
      asphaltGate: "",
      tailgateAngle: "",
      hoist: "",
      cabGuard: "",
    },
    serviceSelections: {
      length: "",
      width: "",
      height: "",
      ca: "",
    },
  });
  const [manualOverrides, setManualOverrides] = useState<BodyManualOverrideState>({
    dump: {
      sideHeight: false,
      bodyStyle: false,
      rearGate: false,
      asphaltGate: false,
      tailgateAngle: false,
      hoist: false,
      cabGuard: false,
    },
    service: {
      width: false,
      height: false,
      ca: false,
    },
  });

  const resolvedModelPath = useMemo(() => {
    if (!bodyConfig.bodyType) {
      return null;
    }

    const selectedOption = bodyTypeOptions.find((option) => option.key === bodyConfig.bodyType);

    if (!selectedOption) {
      return null;
    }

    if (modelBaseUrl) {
      return `${modelBaseUrl}/${selectedOption.modelFileName}`;
    }

    return bodyConfig.bodyType === "dump" ? "/model1.glb" : "/model2.glb";
  }, [bodyConfig.bodyType]);

  useEffect(() => {
    if (!resolvedModelPath) {
      setIsPreviewLoading(false);
      return;
    }

    setIsPreviewLoading(true);
    useGLTF.preload(resolvedModelPath);
  }, [resolvedModelPath]);

  const handleOemChange = (field: keyof OemConfigState, value: string) => {
    setOemConfig((prev) => ({ ...prev, [field]: value }));
  };

  const handleBodyTypeChange = (value: string) => {
    setBodyConfig((prev) => ({ ...prev, bodyType: value as BodyTypeKey | "" }));
  };

  const handleDumpSelectionChange = (field: DumpDimensionKey, value: string) => {
    if (field === "length") {
      setBodyConfig((prev) => ({
        ...prev,
        dumpSelections: mergeDumpSelectionsByLength(
          dumpBodyPricingConfig,
          prev.dumpSelections,
          value,
          manualOverrides.dump
        ),
      }));
      setManualOverrides((prev) => ({
        ...prev,
        dump: getDumpManualOverridesFromSelections(
          dumpBodyPricingConfig,
          mergeDumpSelectionsByLength(
            dumpBodyPricingConfig,
            bodyConfig.dumpSelections,
            value,
            prev.dump
          )
        ),
      }));
      return;
    }

    setBodyConfig((prev) => ({
      ...prev,
      dumpSelections: {
        ...prev.dumpSelections,
        [field]: value,
      },
    }));
    setManualOverrides((prev) => ({
      ...prev,
      dump: {
        ...prev.dump,
        [field]: Boolean(value)
          && value !== getDumpDefaultSelectionByLength(dumpBodyPricingConfig, field, bodyConfig.dumpSelections.length),
      },
    }));
  };

  const handleServiceLengthChange = (value: string) => {
    setBodyConfig((prev) => ({
      ...prev,
      serviceSelections: mergeServiceSelectionsByLength(
        serviceBodyPricingConfig,
        prev.serviceSelections,
        value,
        manualOverrides.service
      ),
    }));
    setManualOverrides((prev) => ({
      ...prev,
      service: getServiceManualOverridesFromSelections(
        serviceBodyPricingConfig,
        mergeServiceSelectionsByLength(
          serviceBodyPricingConfig,
          bodyConfig.serviceSelections,
          value,
          prev.service
        )
      ),
    }));
  };

  const handleServiceDimensionChange = (field: Exclude<ServiceDimensionKey, "length">, value: string) => {
    setBodyConfig((prev) => ({
      ...prev,
      serviceSelections: {
        ...prev.serviceSelections,
        [field]: value,
      },
    }));
    setManualOverrides((prev) => ({
      ...prev,
      service: {
        ...prev.service,
        [field]: Boolean(value)
          && value !== getServiceDefaultSelectionByLength(serviceBodyPricingConfig, field, bodyConfig.serviceSelections.length),
      },
    }));
  };

  const totalPrice = useMemo(() => {
    if (bodyConfig.bodyType === "dump") {
      return getDumpTotalPrice(dumpBodyPricingConfig, bodyConfig.dumpSelections);
    }

    if (bodyConfig.bodyType === "service") {
      return getTotalPriceFromSelections(serviceBodyPricingConfig, bodyConfig.serviceSelections);
    }

    return 0;
  }, [bodyConfig.bodyType, bodyConfig.dumpSelections, bodyConfig.serviceSelections]);

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="relative w-72 overflow-hidden border-r border-blue-950/10 bg-[linear-gradient(180deg,#0b2344_0%,#123c72_42%,#1f5fa8_100%)] text-white shadow-[18px_0_50px_rgba(15,23,42,0.12)]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.16),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(251,146,60,0.16),transparent_28%)]" />
        <div className="relative flex h-full flex-col p-6">
          {/* Logo & Branding */}
          <div className="mb-8 flex items-center gap-3">
            <div className="rounded-2xl border border-white/20 bg-white/12 p-2.5 shadow-lg backdrop-blur-xl">
              <svg className="h-6 w-6 text-orange-200" fill="currentColor" viewBox="0 0 24 24">
                <path d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-bold leading-tight tracking-tight">{APP_NAME}</h1>
              <p className="text-xs text-blue-100/80">Configurator</p>
            </div>
          </div>

          {/* Price Card */}
          <div className="mb-8 rounded-[20px] border border-white/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.16),rgba(255,255,255,0.08))] px-4 py-4 shadow-xl backdrop-blur-xl">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-100/80">Estimated Price</p>
            <p className="mt-2 text-3xl font-bold text-white">${totalPrice.toLocaleString("en-US", { minimumFractionDigits: 2 })}</p>
            <p className="mt-2 text-xs text-blue-100/75">Starts after Body Type selection</p>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex-1 space-y-2.5">
            <p className="mb-4 px-1 text-xs font-semibold uppercase tracking-[0.3em] text-blue-100/70">Navigation</p>
            {[
              { id: "configure", label: "Configure", icon: "⚙️" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition-all duration-300 ${
                  activeTab === tab.id
                    ? "border border-white/20 bg-white text-slate-900 shadow-[0_16px_40px_rgba(15,23,42,0.22)]"
                    : "text-blue-50/90 hover:bg-white/12 hover:text-white"
                }`}
              >
                <span className={`text-lg ${activeTab === tab.id ? "" : "opacity-95"}`}>{tab.icon}</span>
                <span>{tab.label}</span>
                {activeTab === tab.id && <span className="ml-auto h-2.5 w-2.5 rounded-full bg-orange-500" />}
              </button>
            ))}
          </nav>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-6xl px-8 py-8">
        {activeTab === "configure" && (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            {/* Left Section - Configuration */}
            <div className="relative z-20 space-y-6">
              <div>
                <h2 className="mb-6 text-xl font-semibold text-gray-900">Vehicle Configuration</h2>

                <div className="relative z-30 isolate mb-6 grid grid-cols-2 rounded-xl border border-blue-200 bg-blue-50/80 p-1 shadow-sm pointer-events-auto">
                  <button
                    type="button"
                    onClick={() => setActiveBodyTab("oemChassis")}
                    onMouseDown={() => setActiveBodyTab("oemChassis")}
                    className={`rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors ${
                      activeBodyTab === "oemChassis"
                        ? "bg-white text-blue-700 shadow-sm"
                        : "text-blue-900/75 hover:text-blue-900"
                    }`}
                  >
                    OEM Chassis
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveBodyTab("bodyUi")}
                    onMouseDown={() => setActiveBodyTab("bodyUi")}
                    className={`rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors ${
                      activeBodyTab === "bodyUi"
                        ? "bg-white text-blue-700 shadow-sm"
                        : "text-blue-900/75 hover:text-blue-900"
                    }`}
                  >
                    Body UI
                  </button>
                </div>

                <div className="space-y-5">
                  {activeBodyTab === "oemChassis" && (
                    <>
                      <SelectField
                        label="Make"
                        value={oemConfig.make}
                        onChange={(value) => handleOemChange("make", value)}
                        placeholder="Select Make"
                        options={toSelectOptions(dropdownOptions.make)}
                        icon={
                          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
                            <path d="M4 14h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                            <path d="M6 14V10l2-3h8l2 3v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                            <circle cx="8" cy="16" r="1.5" fill="currentColor" />
                            <circle cx="16" cy="16" r="1.5" fill="currentColor" />
                          </svg>
                        }
                      />

                      <SelectField
                        label="Model Year"
                        value={oemConfig.modelYear}
                        onChange={(value) => handleOemChange("modelYear", value)}
                        placeholder="Select Year"
                        options={toSelectOptions(dropdownOptions.modelYear)}
                        icon={
                          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
                            <rect x="4" y="6" width="16" height="14" rx="2" stroke="currentColor" strokeWidth="1.8" />
                            <path d="M8 4v4M16 4v4M4 10h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                          </svg>
                        }
                      />

                      <SelectField
                        label="Cab Style"
                        value={oemConfig.cabStyle}
                        onChange={(value) => handleOemChange("cabStyle", value)}
                        placeholder="Select Cab Style"
                        options={toSelectOptions(dropdownOptions.cabStyle)}
                        icon={
                          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
                            <path d="M6 17V9h9l3 3v5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M15 9v3h3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        }
                      />

                      <SelectField
                        label="Model Name"
                        value={oemConfig.modelName}
                        onChange={(value) => handleOemChange("modelName", value)}
                        placeholder="Select Model"
                        options={toSelectOptions(dropdownOptions.modelName)}
                        icon={
                          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
                            <path d="M5 7h14v10H5z" stroke="currentColor" strokeWidth="1.8" />
                            <path d="M9 11h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                          </svg>
                        }
                      />

                      <SelectField
                        label="Cab Type"
                        value={oemConfig.cabType}
                        onChange={(value) => handleOemChange("cabType", value)}
                        placeholder="Select Cab Type"
                        options={toSelectOptions(dropdownOptions.cabType)}
                        icon={
                          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
                            <path d="M6 18v-7h12v7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M9 11V8h6v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        }
                      />

                      <SelectField
                        label="CA"
                        value={oemConfig.ca}
                        onChange={(value) => handleOemChange("ca", value)}
                        placeholder="Select CA"
                        options={toSelectOptions(dropdownOptions.ca)}
                        icon={
                          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
                            <path d="M4 12h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                            <path d="M4 9v6M20 9v6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                            <path d="M10 9l-2 3 2 3M14 9l2 3-2 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        }
                      />

                      <SelectField
                        label="WB"
                        value={oemConfig.wb}
                        onChange={(value) => handleOemChange("wb", value)}
                        placeholder="Select WB"
                        options={toSelectOptions(dropdownOptions.wb)}
                        icon={
                          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
                            <path d="M3.5 12h17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                            <path d="M7 9.5 4.5 12 7 14.5M17 9.5 19.5 12 17 14.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        }
                      />

                      <SelectField
                        label="Fuel Type"
                        value={oemConfig.fuelType}
                        onChange={(value) => handleOemChange("fuelType", value)}
                        placeholder="Select Fuel Type"
                        options={toSelectOptions(dropdownOptions.fuelType)}
                        icon={
                          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
                            <path d="M12 4c2.7 3 4 5.1 4 7.1A4 4 0 1 1 8 11c0-2 1.3-4.1 4-7Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        }
                      />

                      <SelectField
                        label="GVWR"
                        value={oemConfig.gvwr}
                        onChange={(value) => handleOemChange("gvwr", value)}
                        placeholder="Select GVWR"
                        options={toSelectOptions(dropdownOptions.gvwr)}
                        icon={
                          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
                            <rect x="4" y="6" width="16" height="12" rx="2" stroke="currentColor" strokeWidth="1.8" />
                            <path d="M8 10h8M8 14h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                          </svg>
                        }
                      />

                      <SelectField
                        label="Rear Wheel Drive Type"
                        value={oemConfig.rearWheelDriveType}
                        onChange={(value) => handleOemChange("rearWheelDriveType", value)}
                        placeholder="Select Drive Type"
                        options={toSelectOptions(dropdownOptions.rearWheelDriveType)}
                        icon={
                          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
                            <circle cx="7.5" cy="16" r="2.3" stroke="currentColor" strokeWidth="1.8" />
                            <circle cx="16.5" cy="16" r="2.3" stroke="currentColor" strokeWidth="1.8" />
                            <path d="M6 9h9l3 3v2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        }
                      />
                    </>
                  )}

                  {activeBodyTab === "bodyUi" && (
                    <>
                      <SelectField
                        label="Body Type"
                        value={bodyConfig.bodyType}
                        onChange={handleBodyTypeChange}
                        placeholder="Select Body Type"
                        options={bodyTypeOptions.map((opt) => ({ value: opt.key, label: opt.label }))}
                        icon={
                          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
                            <path d="M4 16V9.5L12 5l8 4.5V16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M4 12h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                          </svg>
                        }
                        helperText="Choose a body type to render its dedicated configuration UI."
                      />

                      {bodyConfig.bodyType === "dump" && (
                        <DumpBodyConfigurator
                          selections={bodyConfig.dumpSelections}
                          onSelectionChange={handleDumpSelectionChange}
                        />
                      )}

                      {bodyConfig.bodyType === "service" && (
                        <ServiceBodyConfigurator
                          selections={bodyConfig.serviceSelections}
                          onLengthChange={handleServiceLengthChange}
                          onDimensionChange={handleServiceDimensionChange}
                        />
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-6">
                <button className="flex-1 rounded-lg bg-blue-600 px-6 py-3 font-medium text-white transition-colors hover:bg-blue-700">
                  Save Configuration
                </button>
                <button className="flex-1 rounded-lg border border-gray-300 bg-white px-6 py-3 font-medium text-gray-700 transition-colors hover:bg-gray-50">
                  Reset
                </button>
              </div>
            </div>

            {/* Right Section - 3D Preview */}
            <div className="relative z-0">
              <h2 className="mb-6 text-xl font-semibold text-gray-900">Preview</h2>
              <div className="relative h-[600px] w-full overflow-hidden rounded-xl border border-gray-200 bg-gray-50 shadow-md">
                <div className="absolute left-4 top-4 z-10 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm">
                  3D Model View
                </div>
                <div className="absolute bottom-4 left-4 z-10 rounded-lg bg-white px-3 py-2 text-xs text-gray-600 shadow-sm">
                  <p className="font-medium">Drag to rotate • Scroll to zoom</p>
                </div>
                {!bodyConfig.bodyType ? (
                  <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/82 backdrop-blur-sm">
                    <div className="max-w-xs rounded-2xl border border-slate-200 bg-white px-6 py-5 text-center shadow-lg">
                      <p className="text-sm font-semibold text-slate-900">Select body type to preview</p>
                      <p className="mt-2 text-sm text-slate-500">Choose Dump Body or Service Body to load the 3D model.</p>
                    </div>
                  </div>
                ) : null}
                {bodyConfig.bodyType && isPreviewLoading ? (
                  <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/72 backdrop-blur-sm">
                    <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-center shadow-lg">
                      <div className="mx-auto h-9 w-9 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600" />
                      <p className="mt-3 text-sm font-semibold text-slate-900">Loading 3D preview</p>
                    </div>
                  </div>
                ) : null}
                <BridgeScene
                  selectedBodyType={bodyConfig.bodyType}
                  modelPath={resolvedModelPath}
                  onModelReady={() => setIsPreviewLoading(false)}
                />
              </div>

              {/* Configuration Summary */}
              <div className="mt-6 rounded-lg bg-blue-50 p-4 border border-blue-100">
                <p className="text-sm font-medium text-gray-900">Current Configuration</p>
                <div className="mt-3 space-y-1 text-sm text-gray-600">
                  {Object.entries(oemConfig).map(
                    ([key, value]) =>
                      value && (
                        <div key={key} className="flex justify-between">
                          <span className="capitalize">{key.replace(/([A-Z])/g, " $1")}:</span>
                          <span className="font-medium text-gray-900">{value}</span>
                        </div>
                      )
                  )}

                  {bodyConfig.bodyType && (
                    <>
                      <div className="flex justify-between">
                        <span>Body Type:</span>
                        <span className="font-medium text-gray-900">
                          {bodyTypeOptions.find((opt) => opt.key === bodyConfig.bodyType)?.label ?? bodyConfig.bodyType}
                        </span>
                      </div>

                      <div className="flex justify-between">
                        <span>Length:</span>
                        <span className="font-medium text-gray-900">
                          {bodyConfig.bodyType === "dump"
                            ? (bodyConfig.dumpSelections.length || "-")
                            : (bodyConfig.serviceSelections.length || "-")}
                        </span>
                      </div>

                      {bodyConfig.bodyType === "dump" && (
                        <>
                          <div className="flex justify-between">
                            <span>Side Height:</span>
                            <span className="font-medium text-gray-900">{bodyConfig.dumpSelections.sideHeight || "-"}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Body Style:</span>
                            <span className="font-medium text-gray-900">{bodyConfig.dumpSelections.bodyStyle || "-"}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Rear Gate:</span>
                            <span className="font-medium text-gray-900">{bodyConfig.dumpSelections.rearGate || "-"}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Asphalt Gate:</span>
                            <span className="font-medium text-gray-900">{bodyConfig.dumpSelections.asphaltGate || "-"}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Tailgate Angle:</span>
                            <span className="font-medium text-gray-900">{bodyConfig.dumpSelections.tailgateAngle || "-"}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Hoist:</span>
                            <span className="font-medium text-gray-900">{bodyConfig.dumpSelections.hoist || "-"}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Cab Guard:</span>
                            <span className="font-medium text-gray-900">{bodyConfig.dumpSelections.cabGuard || "-"}</span>
                          </div>
                        </>
                      )}

                      {bodyConfig.bodyType === "service" && (
                        <>
                          <div className="flex justify-between">
                            <span>Width:</span>
                            <span className="font-medium text-gray-900">{bodyConfig.serviceSelections.width || "-"}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Height:</span>
                            <span className="font-medium text-gray-900">{bodyConfig.serviceSelections.height || "-"}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>CA:</span>
                            <span className="font-medium text-gray-900">{bodyConfig.serviceSelections.ca || "-"}</span>
                          </div>
                        </>
                      )}

                      <div className="flex justify-between">
                        <span>Body Package Price:</span>
                        <span className="font-medium text-gray-900">
                          {bodyConfig.bodyType === "dump"
                            ? formatCurrency(getDumpTotalPrice(dumpBodyPricingConfig, bodyConfig.dumpSelections))
                            : formatCurrency(getTotalPriceFromSelections(serviceBodyPricingConfig, bodyConfig.serviceSelections))}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        </div>
      </main>
    </div>
  );
}
