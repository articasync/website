"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  calculateBaselineMLSS,
  findMaxPowerForDuration,
  runSimulation,
} from "@/lib/physics";
import { useSimulatorStore } from "@/store/useSimulatorStore";
import {
  ChartToggles,
  Hardware,
  SimulationPoint,
  WorkoutBlock,
} from "@/types/simulator";

interface SliderConfig {
  key: keyof Hardware;
  label: string;
  description: string;
  min: number;
  max: number;
  step: number;
  unit: string;
}

const HARDWARE_SLIDERS: SliderConfig[] = [
  {
    key: "mitoDensity",
    label: "Mito Density",
    description: "Mitochondrial volume fraction (oxidative phosphorylation capacity)",
    min: 2,
    max: 15,
    step: 0.5,
    unit: "% vol",
  },
  {
    key: "mct1Density",
    label: "MCT1 Density",
    description: "Lactate influx into oxidative fibers & cardiac myocytes",
    min: 50,
    max: 300,
    step: 5,
    unit: "pmol/mg",
  },
  {
    key: "mct4Density",
    label: "MCT4 Density",
    description: "Lactate efflux from glycolytic muscle into blood",
    min: 50,
    max: 300,
    step: 5,
    unit: "pmol/mg",
  },
  {
    key: "bufferCapacity",
    label: "Buffer Capacity",
    description: "Intracellular acidosis resistance (pH buffering in slykes)",
    min: 40,
    max: 100,
    step: 1,
    unit: "slykes",
  },
  {
    key: "fiberType1",
    label: "Type 1 Fiber",
    description: "Fatigue-resistant slow-twitch motor unit percentage",
    min: 10,
    max: 90,
    step: 1,
    unit: "%",
  },
  {
    key: "coolingEfficiency",
    label: "Cooling Rate",
    description: "Thermoregulation heat dissipation efficiency",
    min: 10,
    max: 50,
    step: 1,
    unit: "W/°C",
  },
  {
    key: "sweatRate",
    label: "Sweat Rate",
    description: "Fluid loss rate driving dehydration & plasma volume reduction",
    min: 0,
    max: 3,
    step: 0.1,
    unit: "L/hr",
  },
  {
    key: "svMax",
    label: "Max SV",
    description: "Peak ventricular stroke volume (cardiac pumping limit)",
    min: 80,
    max: 200,
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
    key: "showHR",
    label: "Heart Rate",
    color: "#ef4444",
    activeClass: "bg-red-500 text-white border-red-500 shadow-2xs",
  },
  {
    key: "showMuscleH",
    label: "Muscle Lactate",
    color: "#8b5cf6",
    activeClass: "bg-purple-600 text-white border-purple-600 shadow-2xs",
  },
  {
    key: "showBloodH",
    label: "Blood Lactate",
    color: "#3b82f6",
    activeClass: "bg-blue-600 text-white border-blue-600 shadow-2xs",
  },
  {
    key: "showPCr1",
    label: "Type 1 PCr",
    color: "#10b981",
    activeClass: "bg-emerald-600 text-white border-emerald-600 shadow-2xs",
  },
  {
    key: "showPCr2",
    label: "Type 2 PCr",
    color: "#f59e0b",
    activeClass: "bg-amber-500 text-white border-amber-500 shadow-2xs",
  },
  {
    key: "showEpi",
    label: "Epinephrine",
    color: "#f97316",
    activeClass: "bg-orange-500 text-white border-orange-500 shadow-2xs",
  },
  {
    key: "showGlycogen",
    label: "Glycogen",
    color: "#06b6d4",
    activeClass: "bg-cyan-600 text-white border-cyan-600 shadow-2xs",
  },
  {
    key: "showPi",
    label: "Inorganic Pi",
    color: "#ec4899",
    activeClass: "bg-pink-600 text-white border-pink-600 shadow-2xs",
  },
  {
    key: "showGutIschemia",
    label: "Gut Ischemia",
    color: "#dc2626",
    activeClass: "bg-rose-700 text-white border-rose-700 shadow-2xs",
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
  return "#fecaca"; // Z6+ (120%+ MLSS): red
}

/**
 * Unrolls complex workout blocks (repeats, secondary intervals) into a flat sequential array.
 */
function unrollWorkout(
  workout: WorkoutBlock[]
): { watts: number; durationSeconds: number }[] {
  const flatWorkout: { watts: number; durationSeconds: number }[] = [];
  for (const block of workout) {
    const repeats = block.repeats && block.repeats > 0 ? block.repeats : 1;
    for (let i = 0; i < repeats; i++) {
      flatWorkout.push({
        watts: block.watts,
        durationSeconds: block.durationSeconds,
      });
      if (block.watts2 !== undefined && block.durationSeconds2 !== undefined) {
        flatWorkout.push({
          watts: block.watts2,
          durationSeconds: block.durationSeconds2,
        });
      }
    }
  }
  return flatWorkout;
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

  // Unrolled workout array for physics simulation and zone rendering
  const flatWorkout = useMemo(() => unrollWorkout(workout), [workout]);
  const simulationData = useMemo(
    () => runSimulation(hardware, flatWorkout as any),
    [hardware, flatWorkout]
  );

  // Normalized simulation data for unified 0-100 plotting scale
  const normalizedSimulationData = useMemo(() => {
    const BOUNDS: Record<string, [number, number]> = {
      watts: [0, 1000],
      hr: [40, 200],
      la_muscle: [1, 20],
      la_blood: [1, 20],
      pcr1: [0, 1],
      pcr2: [0, 1],
      epi: [0, 1],
      glycogen: [0, 100],
      pi: [0, 1.5],
      gut_ischemia: [0, 100],
    };

    return simulationData.map((pt) => {
      const normPt: Record<string, any> = { ...pt };
      for (const [key, [min, max]] of Object.entries(BOUNDS)) {
        const rawVal = pt[key as keyof SimulationPoint];
        if (rawVal !== null && rawVal !== undefined) {
          const val = Number(rawVal);
          normPt[`norm_${key}`] = Math.max(
            0,
            Math.min(100, ((val - min) / (max - min)) * 100)
          );
        } else {
          normPt[`norm_${key}`] = null;
        }
      }
      return normPt;
    });
  }, [simulationData]);

  // Check if simulation triggered failure
  const blowupPoint = useMemo(
    () => simulationData.find((p) => p.blown_up),
    [simulationData]
  );

  // Simulation-based binary search for power-duration profile and baseline MLSS
  const { mlss, ftp, p5m, p1m, p5s } = useMemo(() => {
    const mlssVal = Math.round(calculateBaselineMLSS(hardware));
    return {
      mlss: mlssVal,
      ftp: findMaxPowerForDuration(hardware, 3600), // 1 hour
      p5m: findMaxPowerForDuration(hardware, 300), // 5 mins
      p1m: findMaxPowerForDuration(hardware, 60), // 1 min
      p5s: findMaxPowerForDuration(hardware, 5), // 5 secs
    };
  }, [hardware]);

  // Power zone shading areas mapped over unrolled flatWorkout
  const zoneAreas = useMemo(() => {
    let currentStart = 1;
    return flatWorkout.map((block, index) => {
      const start = currentStart;
      const end = currentStart + block.durationSeconds - 1;
      currentStart = end + 1;
      return {
        id: `zone-${index}`,
        start,
        end,
        watts: block.watts,
        color: getZoneColor(block.watts, mlss),
      };
    });
  }, [flatWorkout, mlss]);

  return (
    <div className="w-full space-y-6">
      {/* Clean Page Header with Horizontally Aligned 5 Stat Cards */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-200 pb-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">
            Cycling Simulator
          </h1>
        </div>

        {/* 5 Stats Cards in a clean, uniform horizontal row */}
        <div className="flex flex-row items-center gap-2 flex-wrap sm:justify-end">
          {/* 1. 5s Power */}
          <div className="bg-amber-50/80 border border-amber-200 rounded-xl px-3 py-1.5 text-center min-w-[70px]">
            <span className="text-[10px] uppercase font-bold tracking-wider text-amber-700 block">
              5s Power
            </span>
            <div className="text-base font-bold text-amber-950">
              {p5s} <span className="text-xs font-semibold text-amber-700">W</span>
            </div>
          </div>

          {/* 2. 1m Power */}
          <div className="bg-orange-50/80 border border-orange-200 rounded-xl px-3 py-1.5 text-center min-w-[70px]">
            <span className="text-[10px] uppercase font-bold tracking-wider text-orange-700 block">
              1m Power
            </span>
            <div className="text-base font-bold text-orange-950">
              {p1m} <span className="text-xs font-semibold text-orange-700">W</span>
            </div>
          </div>

          {/* 3. 5m Power */}
          <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl px-3 py-1.5 text-center min-w-[70px]">
            <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-700 block">
              5m Power
            </span>
            <div className="text-base font-bold text-emerald-950">
              {p5m} <span className="text-xs font-semibold text-emerald-700">W</span>
            </div>
          </div>

          {/* 4. 1h Power (FTP) */}
          <div className="bg-blue-50/90 border border-blue-200 rounded-xl px-3 py-1.5 text-center min-w-[70px]">
            <span className="text-[10px] uppercase font-bold tracking-wider text-blue-700 block">
              1h (FTP)
            </span>
            <div className="text-base font-bold text-blue-950">
              {ftp} <span className="text-xs font-semibold text-blue-700">W</span>
            </div>
          </div>

          {/* 5. Calculated MLSS */}
          <div className="bg-indigo-50/90 border border-indigo-200 rounded-xl px-3 py-1.5 text-center min-w-[70px]">
            <span className="text-[10px] uppercase font-bold tracking-wider text-indigo-700 block">
              MLSS
            </span>
            <div className="text-base font-bold text-indigo-950">
              {mlss} <span className="text-xs font-semibold text-indigo-700">W</span>
            </div>
          </div>
        </div>
      </div>

      {/* Grid Layout: Sidebar (Hardware) + Main (Recharts Graph & Toggles) + Bottom (Workout Builder) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Sidebar: Compact Physiology Hardware Sliders (4 Cols on lg) */}
        <aside className="lg:col-span-4 bg-white border border-gray-200 rounded-2xl p-4 shadow-sm space-y-2.5">
          <div className="border-b border-gray-100 pb-2 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-gray-900">Physiology Hardware</h2>
              <p className="text-[11px] text-gray-500">Biological constraints & kinetics</p>
            </div>
          </div>

          <div className="space-y-1.5">
            {HARDWARE_SLIDERS.map(
              ({ key, label, description, min, max, step, unit }) => {
                const value = hardware[key];
                const displayVal = `${value.toFixed(step < 1 ? 1 : 0)} ${unit}`.trim();
                return (
                  <div
                    key={key}
                    className="p-2 bg-gray-50/80 hover:bg-gray-50 rounded-lg border border-gray-100 space-y-1 transition-colors"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1 min-w-0">
                        <span className="font-semibold text-gray-800 text-[11px] truncate">
                          {label}
                        </span>
                        {/* Native tooltip info icon */}
                        <span
                          title={description}
                          className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-gray-200 hover:bg-indigo-100 text-[9px] font-bold text-gray-500 hover:text-indigo-600 cursor-help flex-shrink-0 transition-colors"
                        >
                          i
                        </span>
                      </div>
                      <span className="font-mono font-bold text-[10px] text-indigo-600 bg-white px-1.5 py-0.5 rounded border border-gray-200 shadow-2xs flex-shrink-0">
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
                      className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600 focus:outline-none"
                    />
                  </div>
                );
              }
            )}
          </div>
        </aside>

        {/* Main Center Area: Left-Aligned Toggles & Normalized Recharts Graph (8 Cols on lg) */}
        <main className="lg:col-span-8 bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-gray-100 pb-2">
            <h2 className="text-base font-bold text-gray-900">Physiological Dynamics</h2>
            <span className="text-[11px] text-gray-400">
              Normalized 0–100% relative plot scale
            </span>
          </div>

          <div className="flex flex-col md:flex-row gap-4 items-stretch">
            {/* Left Side: Vertical Toggles Column */}
            <div className="flex flex-row md:flex-col gap-1.5 w-full md:w-36 flex-wrap md:flex-nowrap flex-shrink-0">
              <span className="hidden md:block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">
                Chart Traces
              </span>
              {TOGGLE_CONFIGS.map(({ key, label, activeClass, color }) => {
                const isActive = toggles[key];
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setToggle(key)}
                    className={`w-full text-left px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition-all flex items-center justify-between gap-1.5 ${
                      isActive
                        ? activeClass
                        : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"
                    }`}
                  >
                    <span className="truncate">{label}</span>
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: color }}
                    />
                  </button>
                );
              })}
            </div>

            {/* Right Side: Recharts Graph */}
            <div className="flex-1 w-full min-w-0 min-h-[400px] flex items-center justify-center">
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
                      data={normalizedSimulationData}
                      margin={{ top: 15, right: 10, left: 10, bottom: 5 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke="#f0f0f0"
                      />
                      <XAxis
                        dataKey="time"
                        type="number"
                        domain={["dataMin", "dataMax"]}
                        tick={{ fontSize: 11 }}
                        stroke="#9ca3af"
                        label={{
                          value: "Time (s)",
                          position: "insideBottomRight",
                          offset: -5,
                          fontSize: 10,
                          fill: "#9ca3af",
                        }}
                      />
                      {/* Left Axis: Visible, scales to Watts */}
                      <YAxis
                        yAxisId="left"
                        orientation="left"
                        tick={{ fontSize: 12 }}
                        stroke="#9ca3af"
                        domain={[0, "dataMax + 100"]}
                      />
                      {/* Right Axis: Hidden, fixed 0-100 scale for normalized biological traces */}
                      <YAxis
                        yAxisId="right"
                        orientation="right"
                        hide={true}
                        domain={[0, 100]}
                      />

                      <Tooltip
                        formatter={(value: any, name: any, props: any) => {
                          const rawKey = props?.dataKey
                            ? String(props.dataKey).replace("norm_", "")
                            : "";
                          const rawVal = props?.payload ? props.payload[rawKey] : value;
                          return [
                            typeof rawVal === "number"
                              ? rawVal.toFixed(2)
                              : rawVal,
                            name ?? "",
                          ];
                        }}
                        contentStyle={{
                          backgroundColor: "#ffffff",
                          borderRadius: "0.5rem",
                          fontSize: "12px",
                          boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                          border: "1px solid #e5e7eb",
                        }}
                      />

                      {/* Stepped power zone background reference shading */}
                      {zoneAreas.map((area, index) => (
                        <ReferenceArea
                          key={area.id ?? index}
                          x1={area.start}
                          x2={area.end}
                          y1={0}
                          y2={area.watts}
                          yAxisId="left"
                          fill={area.color}
                          fillOpacity={0.6}
                          strokeOpacity={0}
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

                      {/* Watts always rendered unconditionally on left axis */}
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

                      {toggles.showHR && (
                        <Line
                          isAnimationActive={false}
                          type="monotone"
                          dataKey="norm_hr"
                          name="Heart Rate (bpm)"
                          yAxisId="right"
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
                          dataKey="norm_la_muscle"
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
                          dataKey="norm_la_blood"
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
                          dataKey="norm_pcr1"
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
                          dataKey="norm_pcr2"
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
                          dataKey="norm_epi"
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
                          dataKey="norm_glycogen"
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
                          dataKey="norm_pi"
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
                          dataKey="norm_gut_ischemia"
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
          </div>
        </main>

        {/* Bottom Pane: Redesigned Horizontal Rows Workout Builder (Full 12 Cols) */}
        <section className="lg:col-span-12 bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-gray-100 pb-3">
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                Workout Builder
              </h2>
              <p className="text-xs text-gray-500">
                Drag blocks to reorder • Configure target efforts and optional interval loops
              </p>
            </div>
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

          {workout.length === 0 ? (
            <div className="text-center py-8 text-sm text-gray-400">
              No workout intervals defined. Click "Add Block" to start building your workout.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
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
                  className={`bg-gray-50 border border-gray-200 rounded-xl p-3 flex flex-col md:flex-row md:items-center gap-3 relative group cursor-move transition-all ${
                    draggedIndex === index ? "opacity-50" : ""
                  } ${
                    dragOverIndex === index
                      ? "scale-[1.01] border-indigo-500 ring-2 ring-indigo-200 shadow-md"
                      : ""
                  }`}
                >
                  {/* Left Controls: Grip & Block ID */}
                  <div className="flex items-center gap-1.5 flex-shrink-0">
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
                    <span className="text-xs font-bold text-gray-700 bg-white border border-gray-200 px-2 py-1 rounded-md min-w-[76px] text-center shadow-2xs">
                      Block #{index + 1}
                    </span>
                  </div>

                  {/* Main Effort Inputs: Power (W) and Duration (s) side-by-side */}
                  <div className="flex items-center gap-2.5 flex-shrink-0">
                    <div className="w-28">
                      <label className="block text-[11px] font-semibold text-gray-600 mb-0.5">
                        Power (W)
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

                    <div className="w-28">
                      <label className="block text-[11px] font-semibold text-gray-600 mb-0.5">
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

                  {/* Secondary Interval Subsection: Shaded box with Power 2, Duration 2, Repeats */}
                  <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 bg-indigo-50/50 border border-indigo-100 rounded-lg p-2 flex-1 min-w-0">
                    <div className="flex-1 min-w-[100px]">
                      <label className="block text-[10px] font-medium text-gray-600 mb-0.5 truncate">
                        Power 2 (W)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="2000"
                        step="5"
                        placeholder="Optional"
                        value={block.watts2 ?? ""}
                        onChange={(e) =>
                          updateWorkoutBlock(block.id, {
                            watts2:
                              e.target.value === ""
                                ? undefined
                                : Math.max(0, Number(e.target.value)),
                          })
                        }
                        className="w-full bg-white border border-gray-300 rounded-md px-2 py-1 text-xs font-medium text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      />
                    </div>

                    <div className="flex-1 min-w-[100px]">
                      <label className="block text-[10px] font-medium text-gray-600 mb-0.5 truncate">
                        Duration 2 (s)
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="36000"
                        step="5"
                        placeholder="Optional"
                        value={block.durationSeconds2 ?? ""}
                        onChange={(e) =>
                          updateWorkoutBlock(block.id, {
                            durationSeconds2:
                              e.target.value === ""
                                ? undefined
                                : Math.max(1, Number(e.target.value)),
                          })
                        }
                        className="w-full bg-white border border-gray-300 rounded-md px-2 py-1 text-xs font-medium text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      />
                    </div>

                    <div className="w-20 min-w-[70px]">
                      <label className="block text-[10px] font-medium text-gray-600 mb-0.5 truncate">
                        Repeats
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="50"
                        step="1"
                        placeholder="1"
                        value={block.repeats ?? ""}
                        onChange={(e) =>
                          updateWorkoutBlock(block.id, {
                            repeats:
                              e.target.value === ""
                                ? undefined
                                : Math.max(1, Number(e.target.value)),
                          })
                        }
                        className="w-full bg-white border border-gray-300 rounded-md px-2 py-1 text-xs font-medium text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Right Controls: Remove Button */}
                  <button
                    onClick={() => removeWorkoutBlock(block.id)}
                    className="text-xs font-medium text-red-500 hover:text-red-700 hover:bg-red-50 px-2.5 py-1.5 rounded-lg border border-transparent hover:border-red-200 transition-colors flex-shrink-0 self-end md:self-center"
                    title="Remove block"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
