"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { runSimulation } from "@/lib/physics";
import { useSimulatorStore } from "@/store/useSimulatorStore";
import { ChartToggles, Hardware } from "@/types/simulator";

interface SliderConfig {
  key: keyof Hardware;
  label: string;
  description: string;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
}

const HARDWARE_SLIDERS: SliderConfig[] = [
  {
    key: "mitoDensity",
    label: "Mitochondrial Density",
    description: "Oxidative phosphorylation & aerobic clearance",
    min: 0,
    max: 1,
    step: 0.01,
  },
  {
    key: "mct1Density",
    label: "MCT1 Density",
    description: "Lactate influx into oxidative fibers & heart",
    min: 0,
    max: 1,
    step: 0.01,
  },
  {
    key: "mct4Density",
    label: "MCT4 Density",
    description: "Lactate efflux from glycolytic muscle to blood",
    min: 0,
    max: 1,
    step: 0.01,
  },
  {
    key: "bufferCapacity",
    label: "Buffering Capacity",
    description: "Intracellular acidosis resistance (pH buffering)",
    min: 0,
    max: 1,
    step: 0.01,
  },
  {
    key: "fiberType1",
    label: "Type 1 Slow-Twitch Fiber",
    description: "Fatigue-resistant aerobic motor unit fraction",
    min: 0,
    max: 1,
    step: 0.01,
  },
  {
    key: "coolingEfficiency",
    label: "Cooling Efficiency",
    description: "Thermoregulation, sweating & heat dissipation",
    min: 0,
    max: 1,
    step: 0.01,
  },
  {
    key: "sweatRate",
    label: "Sweat Rate",
    description: "Thermoregulatory fluid loss & dehydration kinetics",
    min: 0,
    max: 1,
    step: 0.01,
  },
  {
    key: "svMax",
    label: "Max Stroke Volume (SVmax)",
    description: "Peak ventricular stroke volume (cardiac capacity)",
    min: 100,
    max: 150,
    step: 1,
    unit: "mL",
  },
];

interface ToggleMeta {
  key: keyof ChartToggles;
  label: string;
  color: string;
  activeClass: string;
}

const TOGGLE_CONFIGS: ToggleMeta[] = [
  {
    key: "showWatts",
    label: "Watts",
    color: "#9ca3af",
    activeClass: "bg-gray-600 text-white border-gray-600",
  },
  {
    key: "showHR",
    label: "Heart Rate",
    color: "#ef4444",
    activeClass: "bg-red-500 text-white border-red-500",
  },
  {
    key: "showMuscleH",
    label: "Muscle Lactate",
    color: "#8b5cf6",
    activeClass: "bg-purple-600 text-white border-purple-600",
  },
  {
    key: "showBloodH",
    label: "Blood Lactate",
    color: "#3b82f6",
    activeClass: "bg-blue-600 text-white border-blue-600",
  },
  {
    key: "showPCr1",
    label: "Type 1 PCr",
    color: "#10b981",
    activeClass: "bg-emerald-600 text-white border-emerald-600",
  },
  {
    key: "showPCr2",
    label: "Type 2 PCr",
    color: "#f59e0b",
    activeClass: "bg-amber-500 text-white border-amber-500",
  },
  {
    key: "showEpi",
    label: "Epinephrine",
    color: "#f97316",
    activeClass: "bg-orange-500 text-white border-orange-500",
  },
  {
    key: "showGlycogen",
    label: "Glycogen",
    color: "#06b6d4",
    activeClass: "bg-cyan-600 text-white border-cyan-600",
  },
  {
    key: "showPi",
    label: "Inorganic Pi",
    color: "#ec4899",
    activeClass: "bg-pink-600 text-white border-pink-600",
  },
  {
    key: "showGutIschemia",
    label: "Gut Ischemia",
    color: "#dc2626",
    activeClass: "bg-rose-700 text-white border-rose-700",
  },
];

/**
 * Helper to determine the physiological training zone background color relative to MLSS.
 */
function getZoneColor(watts: number, mlss: number): string {
  if (mlss <= 0) return "#f3f4f6";
  const ratio = watts / mlss;

  if (ratio < 0.6) return "#f3f4f6"; // Z1 (0-60% MLSS): gray
  if (ratio < 0.75) return "#dbeafe"; // Z2 (60-75%): blue
  if (ratio < 0.9) return "#dcfce7"; // Z3 (75-90%): green
  if (ratio < 1.05) return "#fef08a"; // Z4 (90-105%): yellow
  if (ratio < 1.2) return "#fed7aa"; // Z5 (105-120%): orange
  if (ratio < 1.5) return "#fecaca"; // Z6 (120-150%): red
  return "#e9d5ff"; // Z7 (150%+): purple
}

export default function SimulatorClient() {
  const {
    hardware,
    setHardware,
    workout,
    updateWorkoutBlock,
    addWorkoutBlock,
    removeWorkoutBlock,
    reorderWorkoutBlocks,
    toggles,
    setToggle,
  } = useSimulatorStore();

  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Local state for drag-and-drop reordering
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Local state for "Add Intervals" generator
  const [showIntervalsForm, setShowIntervalsForm] = useState(false);
  const [intervalPower1, setIntervalPower1] = useState(400);
  const [intervalDuration1, setIntervalDuration1] = useState(60);
  const [intervalPower2, setIntervalPower2] = useState(200);
  const [intervalDuration2, setIntervalDuration2] = useState(60);
  const [intervalRepeats, setIntervalRepeats] = useState(5);

  // Physics execution recalculates instantly when inputs change
  const simulationData = useMemo(
    () => runSimulation(hardware, workout),
    [hardware, workout]
  );

  // Check if simulation triggered failure
  const blowupPoint = useMemo(
    () => simulationData.find((p) => p.blown_up),
    [simulationData]
  );

  // Dynamic MLSS calculation from physics baseline formula
  const fiberType2 = 1.0 - hardware.fiberType1;
  const calculatedMLSS = Math.round(
    150 +
      300 * hardware.mitoDensity * hardware.fiberType1 * hardware.mct1Density -
      50 * fiberType2 * hardware.mct4Density
  );
  const power1h = calculatedMLSS;
  const power5m = Math.round(
    calculatedMLSS +
      100 * hardware.mitoDensity * hardware.mct1Density +
      50 * fiberType2
  );
  const power1m = Math.round(
    calculatedMLSS +
      250 * hardware.mct4Density * hardware.bufferCapacity * fiberType2
  );
  const power5s = Math.round(calculatedMLSS + 800 * fiberType2);

  // Power zone shading areas mapped over workout blocks
  const zoneAreas = useMemo(() => {
    let currentStart = 0;
    return workout.map((block, index) => {
      const start = currentStart;
      const end = currentStart + block.durationSeconds;
      currentStart = end;
      return {
        id: block.id || `zone-${index}`,
        start,
        end,
        color: getZoneColor(block.watts, calculatedMLSS),
      };
    });
  }, [workout, calculatedMLSS]);

  // Handler to generate repeated interval blocks
  const handleGenerateIntervals = () => {
    const repeats = Math.max(1, Math.min(50, intervalRepeats || 1));
    const p1 = Math.max(0, intervalPower1 || 0);
    const d1 = Math.max(1, intervalDuration1 || 1);
    const p2 = Math.max(0, intervalPower2 || 0);
    const d2 = Math.max(1, intervalDuration2 || 1);

    for (let i = 0; i < repeats; i++) {
      addWorkoutBlock({ watts: p1, durationSeconds: d1 });
      addWorkoutBlock({ watts: p2, durationSeconds: d2 });
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-200 pb-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">
            Cycling Simulator
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Dynamic computational model of bioenergetics, hemodynamics, acid-base balance, and fatigue kinetics.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap sm:justify-end">
          {blowupPoint && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-1.5 text-right">
              <span className="text-[10px] uppercase font-bold tracking-wider text-red-600 block">
                Status
              </span>
              <div className="text-xs font-bold text-red-800">
                Blown Up @ {blowupPoint.time}s
              </div>
            </div>
          )}

          {/* 5s Power */}
          <div className="bg-amber-50/80 border border-amber-200 rounded-xl px-3 py-1.5 text-center min-w-[72px]">
            <span className="text-[10px] uppercase font-bold tracking-wider text-amber-700 block">
              5s Power
            </span>
            <div className="text-base font-bold text-amber-950">
              {power5s} <span className="text-xs font-semibold text-amber-700">W</span>
            </div>
          </div>

          {/* 1m Power */}
          <div className="bg-orange-50/80 border border-orange-200 rounded-xl px-3 py-1.5 text-center min-w-[72px]">
            <span className="text-[10px] uppercase font-bold tracking-wider text-orange-700 block">
              1m Power
            </span>
            <div className="text-base font-bold text-orange-950">
              {power1m} <span className="text-xs font-semibold text-orange-700">W</span>
            </div>
          </div>

          {/* 5m Power */}
          <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl px-3 py-1.5 text-center min-w-[72px]">
            <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-700 block">
              5m Power
            </span>
            <div className="text-base font-bold text-emerald-950">
              {power5m} <span className="text-xs font-semibold text-emerald-700">W</span>
            </div>
          </div>

          {/* 1h / MLSS (More prominent) */}
          <div className="bg-indigo-50 border-2 border-indigo-300 rounded-xl px-3.5 py-1.5 text-center min-w-[84px] shadow-xs">
            <span className="text-[10px] uppercase font-bold tracking-wider text-indigo-700 block">
              1h (MLSS)
            </span>
            <div className="text-lg font-black text-indigo-950">
              {power1h} <span className="text-xs font-bold text-indigo-700">W</span>
            </div>
          </div>
        </div>
      </div>

      {/* Grid Layout: Sidebar (Hardware) + Main (Recharts Graph) + Bottom (Workout Builder) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Sidebar: Hardware Sliders (4 Cols on lg) */}
        <aside className="lg:col-span-4 bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-5">
          <div className="border-b border-gray-100 pb-3">
            <h2 className="text-lg font-bold text-gray-900">Physiology Hardware</h2>
            <p className="text-xs text-gray-500">
              Adjust biological parameters & hemodynamic limits
            </p>
          </div>

          <div className="space-y-4">
            {HARDWARE_SLIDERS.map(
              ({
                key,
                label,
                description,
                min = 0,
                max = 1,
                step = 0.01,
                unit,
              }) => {
                const value = hardware[key];
                const displayVal = unit ? `${value}${unit}` : value.toFixed(2);
                return (
                  <div
                    key={key}
                    className="space-y-1.5 bg-gray-50/70 p-3 rounded-xl border border-gray-100"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-gray-800">
                        {label}
                      </span>
                      <span className="font-mono font-bold text-indigo-600 bg-white px-2 py-0.5 rounded border border-gray-200 shadow-2xs">
                        {displayVal}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={min}
                      max={max}
                      step={step}
                      value={value}
                      onChange={(e) =>
                        setHardware({ [key]: parseFloat(e.target.value) })
                      }
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600 focus:outline-none"
                    />
                    <p className="text-[11px] text-gray-500 leading-tight">
                      {description}
                    </p>
                  </div>
                );
              }
            )}
          </div>
        </aside>

        {/* Main Center Area: Live Recharts Graph & Toggles (8 Cols on lg) */}
        <main className="lg:col-span-8 bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-4">
          {/* Toggles UI: Pill Buttons */}
          <div className="flex items-center justify-between flex-wrap gap-2 border-b border-gray-100 pb-3">
            <div className="text-xs font-bold text-gray-600 uppercase tracking-wider">
              Chart Traces:
            </div>
            <div className="flex flex-wrap gap-1.5">
              {TOGGLE_CONFIGS.map(({ key, label, activeClass, color }) => {
                const isActive = toggles[key];
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setToggle(key)}
                    className={`px-3 py-1 text-xs font-semibold rounded-full border transition-all flex items-center gap-1.5 ${
                      isActive
                        ? activeClass
                        : "bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100"
                    }`}
                  >
                    <span
                      className="w-2 h-2 rounded-full inline-block"
                      style={{ backgroundColor: color }}
                    />
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Chart View */}
          <div className="w-full min-h-[400px] flex items-center justify-center">
            {!isMounted ? (
              <div className="flex flex-col items-center justify-center h-[400px] text-gray-400 space-y-2">
                <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs">Loading simulator charts...</span>
              </div>
            ) : simulationData.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-[400px] text-gray-400">
                <span className="text-sm">
                  No simulation data available. Add workout intervals below.
                </span>
              </div>
            ) : (
              <div className="w-full h-[400px]">
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart
                    data={simulationData}
                    margin={{ top: 15, right: 20, left: -20, bottom: 5 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="#e5e7eb"
                    />
                    <XAxis
                      dataKey="time"
                      tick={{ fontSize: 12 }}
                      stroke="#9ca3af"
                      label={{
                        value: "Time (s)",
                        position: "insideBottomRight",
                        offset: -5,
                        fontSize: 10,
                        fill: "#9ca3af",
                      }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#ffffff",
                        borderColor: "#e5e7eb",
                        borderRadius: "0.75rem",
                        boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                        fontSize: "12px",
                      }}
                    />
                    <Legend
                      wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }}
                    />
                    <YAxis
                      yAxisId="left"
                      orientation="left"
                      tick={{ fontSize: 12 }}
                      stroke="#6b7280"
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      tick={{ fontSize: 12 }}
                      stroke="#6b7280"
                    />

                    {/* Zone background reference shading */}
                    {zoneAreas.map((area, index) => (
                      <ReferenceArea
                        key={area.id ?? index}
                        x1={area.start}
                        x2={area.end}
                        fill={area.color}
                        fillOpacity={0.3}
                      />
                    ))}

                    {/* Vertical reference line at the exact moment of failure */}
                    {blowupPoint && (
                      <ReferenceLine
                        x={blowupPoint.time}
                        stroke="red"
                        strokeWidth={2}
                        strokeDasharray="3 3"
                        label={{
                          position: "top",
                          value: "Failure",
                          fill: "red",
                          fontSize: 12,
                        }}
                      />
                    )}

                    {toggles.showWatts && (
                      <Line
                        isAnimationActive={false}
                        type="monotone"
                        dataKey="watts"
                        name="Watts"
                        yAxisId="left"
                        stroke="#9ca3af"
                        strokeDasharray="5 5"
                        dot={false}
                        strokeWidth={2}
                      />
                    )}
                    {toggles.showHR && (
                      <Line
                        isAnimationActive={false}
                        type="monotone"
                        dataKey="hr"
                        name="Heart Rate (bpm)"
                        yAxisId="left"
                        stroke="#ef4444"
                        dot={false}
                        strokeWidth={2}
                        connectNulls={false}
                      />
                    )}
                    {toggles.showMuscleH && (
                      <Line
                        isAnimationActive={false}
                        type="monotone"
                        dataKey="la_muscle"
                        name="Muscle Lactate (mmol/L)"
                        yAxisId="right"
                        stroke="#8b5cf6"
                        dot={false}
                        strokeWidth={2}
                        connectNulls={false}
                      />
                    )}
                    {toggles.showBloodH && (
                      <Line
                        isAnimationActive={false}
                        type="monotone"
                        dataKey="la_blood"
                        name="Blood Lactate (mmol/L)"
                        yAxisId="right"
                        stroke="#3b82f6"
                        dot={false}
                        strokeWidth={2}
                        connectNulls={false}
                      />
                    )}
                    {toggles.showPCr1 && (
                      <Line
                        isAnimationActive={false}
                        type="monotone"
                        dataKey="pcr1"
                        name="Type 1 PCr"
                        yAxisId="right"
                        stroke="#10b981"
                        dot={false}
                        strokeWidth={2}
                        connectNulls={false}
                      />
                    )}
                    {toggles.showPCr2 && (
                      <Line
                        isAnimationActive={false}
                        type="monotone"
                        dataKey="pcr2"
                        name="Type 2 PCr"
                        yAxisId="right"
                        stroke="#f59e0b"
                        dot={false}
                        strokeWidth={2}
                        connectNulls={false}
                      />
                    )}
                    {toggles.showEpi && (
                      <Line
                        isAnimationActive={false}
                        type="monotone"
                        dataKey="epi"
                        name="Epinephrine"
                        yAxisId="right"
                        stroke="#f97316"
                        dot={false}
                        strokeWidth={2}
                        connectNulls={false}
                      />
                    )}
                    {toggles.showGlycogen && (
                      <Line
                        isAnimationActive={false}
                        type="monotone"
                        dataKey="glycogen"
                        name="Glycogen (%)"
                        yAxisId="right"
                        stroke="#06b6d4"
                        dot={false}
                        strokeWidth={2}
                        connectNulls={false}
                      />
                    )}
                    {toggles.showPi && (
                      <Line
                        isAnimationActive={false}
                        type="monotone"
                        dataKey="pi"
                        name="Inorganic Pi"
                        yAxisId="right"
                        stroke="#ec4899"
                        dot={false}
                        strokeWidth={2}
                        connectNulls={false}
                      />
                    )}
                    {toggles.showGutIschemia && (
                      <Line
                        isAnimationActive={false}
                        type="monotone"
                        dataKey="gut_ischemia"
                        name="Gut Ischemia (%)"
                        yAxisId="right"
                        stroke="#dc2626"
                        dot={false}
                        strokeWidth={2}
                        connectNulls={false}
                      />
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </main>

        {/* Bottom Pane: Workout Builder (Full 12 Cols) */}
        <section className="lg:col-span-12 bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-gray-100 pb-3">
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                Workout Intervals
              </h2>
              <p className="text-xs text-gray-500">
                Drag blocks to reorder • Define power profiles and interval durations
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setShowIntervalsForm(!showIntervalsForm)}
                className={`inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl border transition-all ${
                  showIntervalsForm
                    ? "bg-indigo-50 border-indigo-300 text-indigo-700 shadow-xs"
                    : "bg-white border-gray-300 hover:bg-gray-50 text-gray-700"
                }`}
              >
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h7"
                  />
                </svg>
                {showIntervalsForm ? "Hide Interval Generator" : "Add Intervals"}
              </button>

              <button
                type="button"
                onClick={() =>
                  addWorkoutBlock({ watts: 200, durationSeconds: 60 })
                }
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                Add Block
              </button>
            </div>
          </div>

          {/* Expandable "Add Intervals" Generator Form */}
          {showIntervalsForm && (
            <div className="bg-indigo-50/70 border border-indigo-200/80 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-900">
                  Interval Set Generator
                </span>
                <span className="text-[11px] text-indigo-700">
                  Generates {intervalRepeats * 2} alternating work/recovery blocks
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 items-end">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                    Power 1 (W)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="2000"
                    step="5"
                    value={intervalPower1}
                    onChange={(e) => setIntervalPower1(Number(e.target.value))}
                    className="w-full bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-gray-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                    Duration 1 (s)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="36000"
                    step="5"
                    value={intervalDuration1}
                    onChange={(e) => setIntervalDuration1(Number(e.target.value))}
                    className="w-full bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-gray-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                    Power 2 (W)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="2000"
                    step="5"
                    value={intervalPower2}
                    onChange={(e) => setIntervalPower2(Number(e.target.value))}
                    className="w-full bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-gray-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                    Duration 2 (s)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="36000"
                    step="5"
                    value={intervalDuration2}
                    onChange={(e) => setIntervalDuration2(Number(e.target.value))}
                    className="w-full bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-gray-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                    Repeats
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    step="1"
                    value={intervalRepeats}
                    onChange={(e) => setIntervalRepeats(Number(e.target.value))}
                    className="w-full bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-gray-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowIntervalsForm(false)}
                  className="px-3 py-1.5 bg-white hover:bg-gray-100 text-gray-600 text-xs font-medium rounded-lg border border-gray-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleGenerateIntervals}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
                >
                  Generate Intervals
                </button>
              </div>
            </div>
          )}

          {workout.length === 0 ? (
            <div className="text-center py-8 text-sm text-gray-400">
              No workout intervals defined. Click "Add Block" or "Add Intervals" to start.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
              {workout.map((block, index) => (
                <div
                  key={block.id}
                  draggable={true}
                  onDragStart={(e) => {
                    e.dataTransfer.effectAllowed = "move";
                    setDraggedIndex(index);
                  }}
                  onDragEnter={() => setDragOverIndex(index)}
                  onDragEnd={() => {
                    setDraggedIndex(null);
                    setDragOverIndex(null);
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (
                      draggedIndex !== null &&
                      dragOverIndex !== null &&
                      draggedIndex !== dragOverIndex
                    ) {
                      reorderWorkoutBlocks(draggedIndex, dragOverIndex);
                    }
                    setDraggedIndex(null);
                    setDragOverIndex(null);
                  }}
                  className={`bg-gray-50 border border-gray-200 rounded-xl p-3.5 space-y-3 relative group cursor-move transition-all ${
                    draggedIndex === index ? "opacity-50" : ""
                  } ${
                    dragOverIndex === index
                      ? "scale-105 border-indigo-500 ring-2 ring-indigo-200 shadow-md"
                      : ""
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      {/* 6-dot grip indicator */}
                      <svg
                        className="w-3.5 h-3.5 text-gray-400 group-hover:text-indigo-600 transition-colors"
                        viewBox="0 0 16 16"
                        fill="currentColor"
                      >
                        <circle cx="5" cy="4" r="1.5" />
                        <circle cx="11" cy="4" r="1.5" />
                        <circle cx="5" cy="8" r="1.5" />
                        <circle cx="11" cy="8" r="1.5" />
                        <circle cx="5" cy="12" r="1.5" />
                        <circle cx="11" cy="12" r="1.5" />
                      </svg>
                      <span className="text-xs font-bold text-gray-700 bg-white border border-gray-200 px-2 py-0.5 rounded-md">
                        Block #{index + 1}
                      </span>
                    </div>
                    <button
                      onClick={() => removeWorkoutBlock(block.id)}
                      className="text-xs font-medium text-red-500 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded transition-colors"
                      title="Remove block"
                    >
                      Remove
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-medium text-gray-500 mb-1">
                        Power (Watts)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="2000"
                        step="5"
                        value={block.watts}
                        onChange={(e) =>
                          updateWorkoutBlock(block.id, {
                            watts: Math.max(0, Number(e.target.value) || 0),
                          })
                        }
                        className="w-full bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-gray-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-gray-500 mb-1">
                        Duration (s)
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="36000"
                        step="5"
                        value={block.durationSeconds}
                        onChange={(e) =>
                          updateWorkoutBlock(block.id, {
                            durationSeconds: Math.max(
                              1,
                              Number(e.target.value) || 1
                            ),
                          })
                        }
                        className="w-full bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-gray-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
