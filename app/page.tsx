"use client";

import { Suspense, useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Center, useGLTF } from "@react-three/drei";
import { Box3, Vector3 } from "three";

type BodyTypeKey = "flatbed" | "box" | "tanker";

type BodyTypeOption = {
  key: BodyTypeKey;
  label: string;
  modelPath: string;
};

const bodyTypeOptions: BodyTypeOption[] = [
  { key: "flatbed", label: "Flatbed Body", modelPath: "/model1.glb" },
  { key: "box", label: "Box Body", modelPath: "/model2.glb" },
  { key: "tanker", label: "Tanker Body", modelPath: "/model3.glb" },
];

function BridgeModel({ modelPath }: { modelPath: string }) {
  const { scene } = useGLTF(modelPath);
  const model = useMemo(() => scene.clone(), [scene]);
  const scale = useMemo(() => {
    const bounds = new Box3().setFromObject(model);
    const size = new Vector3();
    bounds.getSize(size);

    const maxDimension = Math.max(size.x, size.y, size.z);
    if (!maxDimension) {
      return 1;
    }

    return 6 / maxDimension;
  }, [model]);

  return (
    <Center>
      <primitive object={model} scale={scale} />
    </Center>
  );
}

useGLTF.preload("/model1.glb");
useGLTF.preload("/model2.glb");
useGLTF.preload("/model3.glb");

function BridgeScene({ selectedBodyType }: { selectedBodyType: BodyTypeKey }) {
  const visibleBodyType = bodyTypeOptions.find((option) => option.key === selectedBodyType);

  return (
    <Canvas
      camera={{ position: [14, 8, 14], fov: 42 }}
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
        {visibleBodyType ? (
          <BridgeModel
            key={visibleBodyType.key}
            modelPath={visibleBodyType.modelPath}
          />
        ) : null}
      </Suspense>

      <OrbitControls
        enablePan={false}
        minDistance={6}
        maxDistance={40}
        minPolarAngle={Math.PI / 4.2}
        maxPolarAngle={Math.PI / 2.05}
        target={[0, 0, 0]}
      />
    </Canvas>
  );
}

export default function ConfigurePage() {
  const [activeTab, setActiveTab] = useState("configure");
  const [config, setConfig] = useState({
    bodyType: "flatbed" as BodyTypeKey,
    make: "",
    modelYear: "",
    cabStyle: "",
    modelName: "",
    cabType: "",
    ca: "",
    wb: "",
    fuelType: "",
    rearWheelDriveType: "",
  });

  const price = 45299.99;

  const handleChange = (field: string, value: string) => {
    setConfig((prev) => ({ ...prev, [field]: value }));
  };

  const handleBodyTypeChange = (value: string) => {
    setConfig((prev) => ({ ...prev, bodyType: value as BodyTypeKey }));
  };

  const dropdownOptions = {
    make: ["Volvo", "Scania", "MAN", "Daimler", "Renault"],
    modelYear: ["2024", "2023", "2022", "2021", "2020"],
    cabStyle: ["Day Cab", "Sleeper Cab", "Crew Cab"],
    modelName: ["FH16", "S730", "TGX", "Actros", "T"],
    cabType: ["Standard", "Premium", "Executive"],
    ca: ["2.5m", "3.0m", "3.5m", "4.0m"],
    wb: ["3.0m", "3.5m", "4.0m", "4.5m", "5.0m"],
    fuelType: ["Diesel", "LNG", "Hybrid", "Electric"],
    rearWheelDriveType: ["Single", "Dual", "Tridem"],
  };

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
              <h1 className="text-lg font-bold leading-tight tracking-tight">Jaydu</h1>
              <p className="text-xs text-blue-100/80">Configurator</p>
            </div>
          </div>

          {/* Price Card */}
          <div className="mb-8 rounded-[20px] border border-white/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.16),rgba(255,255,255,0.08))] px-4 py-4 shadow-xl backdrop-blur-xl">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-100/80">Estimated Price</p>
            <p className="mt-2 text-3xl font-bold text-white">${price.toLocaleString("en-US", { minimumFractionDigits: 2 })}</p>
            <p className="mt-2 text-xs text-blue-100/75">Live quote with selected configuration</p>
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
            <div className="space-y-6">
              <div>
                <h2 className="mb-6 text-xl font-semibold text-gray-900">Vehicle Configuration</h2>
                <div className="space-y-5">
                  {/* Body Type */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Body Type</label>
                    <select
                      value={config.bodyType}
                      onChange={(e) => handleBodyTypeChange(e.target.value)}
                      className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900 shadow-sm transition-colors hover:border-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    >
                      {bodyTypeOptions.map((opt) => (
                        <option key={opt.key} value={opt.key}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <p className="mt-1 text-xs text-gray-500">Choose one body type to preview the matching 3D model.</p>
                  </div>

                  {/* Make */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Make</label>
                    <select
                      value={config.make}
                      onChange={(e) => handleChange("make", e.target.value)}
                      className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900 shadow-sm transition-colors hover:border-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    >
                      <option value="">Select Make</option>
                      {dropdownOptions.make.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Model Year */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Model Year</label>
                    <select
                      value={config.modelYear}
                      onChange={(e) => handleChange("modelYear", e.target.value)}
                      className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900 shadow-sm transition-colors hover:border-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    >
                      <option value="">Select Year</option>
                      {dropdownOptions.modelYear.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Cab Style */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Cab Style</label>
                    <select
                      value={config.cabStyle}
                      onChange={(e) => handleChange("cabStyle", e.target.value)}
                      className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900 shadow-sm transition-colors hover:border-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    >
                      <option value="">Select Cab Style</option>
                      {dropdownOptions.cabStyle.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Model Name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Model Name</label>
                    <select
                      value={config.modelName}
                      onChange={(e) => handleChange("modelName", e.target.value)}
                      className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900 shadow-sm transition-colors hover:border-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    >
                      <option value="">Select Model</option>
                      {dropdownOptions.modelName.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Cab Type */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Cab Type</label>
                    <select
                      value={config.cabType}
                      onChange={(e) => handleChange("cabType", e.target.value)}
                      className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900 shadow-sm transition-colors hover:border-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    >
                      <option value="">Select Cab Type</option>
                      {dropdownOptions.cabType.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* CA (Cab to Axle) */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700">CA (Cab to Axle)</label>
                    <select
                      value={config.ca}
                      onChange={(e) => handleChange("ca", e.target.value)}
                      className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900 shadow-sm transition-colors hover:border-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    >
                      <option value="">Select CA</option>
                      {dropdownOptions.ca.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* WB (Wheelbase) */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700">WB (Wheelbase)</label>
                    <select
                      value={config.wb}
                      onChange={(e) => handleChange("wb", e.target.value)}
                      className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900 shadow-sm transition-colors hover:border-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    >
                      <option value="">Select WB</option>
                      {dropdownOptions.wb.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Fuel Type */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Fuel Type</label>
                    <select
                      value={config.fuelType}
                      onChange={(e) => handleChange("fuelType", e.target.value)}
                      className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900 shadow-sm transition-colors hover:border-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    >
                      <option value="">Select Fuel Type</option>
                      {dropdownOptions.fuelType.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Rear Wheel Drive Type */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Rear Wheel Drive Type</label>
                    <select
                      value={config.rearWheelDriveType}
                      onChange={(e) => handleChange("rearWheelDriveType", e.target.value)}
                      className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900 shadow-sm transition-colors hover:border-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    >
                      <option value="">Select Drive Type</option>
                      {dropdownOptions.rearWheelDriveType.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>
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
            <div>
              <h2 className="mb-6 text-xl font-semibold text-gray-900">Preview</h2>
              <div className="relative h-[600px] w-full overflow-hidden rounded-xl border border-gray-200 bg-gray-50 shadow-md">
                <div className="absolute left-4 top-4 z-10 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm">
                  3D Model View
                </div>
                <div className="absolute bottom-4 left-4 z-10 rounded-lg bg-white px-3 py-2 text-xs text-gray-600 shadow-sm">
                  <p className="font-medium">Drag to rotate • Scroll to zoom</p>
                </div>
                <BridgeScene selectedBodyType={config.bodyType} />
              </div>

              {/* Configuration Summary */}
              <div className="mt-6 rounded-lg bg-blue-50 p-4 border border-blue-100">
                <p className="text-sm font-medium text-gray-900">Current Configuration</p>
                <div className="mt-3 space-y-1 text-sm text-gray-600">
                  {Object.entries(config).map(
                    ([key, value]) =>
                      value && (
                        <div key={key} className="flex justify-between">
                          <span className="capitalize">{key.replace(/([A-Z])/g, " $1")}:</span>
                          <span className="font-medium text-gray-900">{Array.isArray(value) ? value.join(", ") : value}</span>
                        </div>
                      )
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
