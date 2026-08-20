"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
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
}

const HARDWARE_SLIDERS: SliderConfig[] = [
  {
    key: "mitoDensity",
    label: "Mitochondrial Density",
    description: "Oxidative phosphorylation & aerobic clearance",
  },
  {
    key: "mct1Density",
    label: "MCT1 Density",
    description: "Lactate influx into oxidative fibers & heart",
  },
  {
    key: "mct4Density",
    label: "MCT4 Density",
    description: "Lactate efflux from glycolytic muscle to blood",
  },
  {
    key: "bufferCapacity",
    label: "Buffering Capacity",
    description: "Intracellular acidosis resistance (pH buffering)",
  },
  {
    key: "fiberType1",
    label: "Type 1 Slow-Twitch Fiber",
    description: "Fatigue-resistant aerobic motor unit fraction",
  },
  {
    key: "coolingEfficiency",
    label: "Cooling Efficiency",
    description: "Thermoregulation, sweating & heat dissipation",
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
];

export default function SimulatorClient() {
  const {
    hardware,
    setHardware,
    workout,
    updateWorkoutBlock,
    addWorkoutBlock,
    removeWorkoutBlock,
    toggles,
    setToggle,
  } = useSimulatorStore();

  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

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

  return (
    <div className="w-full space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-gray-200 pb-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">
            Cycling Simulator
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Dynamic computational model of bioenergetics, acid-base balance, and fatigue kinetics.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {blowupPoint && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-right">
              <span className="text-xs uppercase font-bold tracking-wider text-red-600">
                Status
              </span>
              <div className="text-sm font-bold text-red-800">
                Blown Up @ {blowupPoint.time}s
              </div>
            </div>
          )}
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-2 text-right">
            <span className="text-xs uppercase font-bold tracking-wider text-indigo-600">
              Calculated MLSS
            </span>
            <div className="text-2xl font-black text-indigo-950">
              {calculatedMLSS}{" "}
              <span className="text-sm font-semibold text-indigo-600">W</span>
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
              Adjust biological parameters (0.00 – 1.00)
            </p>
          </div>

          <div className="space-y-4">
            {HARDWARE_SLIDERS.map(({ key, label, description }) => {
              const value = hardware[key];
              return (
                <div
                  key={key}
                  className="space-y-1.5 bg-gray-50/70 p-3 rounded-xl border border-gray-100"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-gray-800">{label}</span>
                    <span className="font-mono font-bold text-indigo-600 bg-white px-2 py-0.5 rounded border border-gray-200 shadow-2xs">
                      {value.toFixed(2)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
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
            })}
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
                <span className="text-sm">No simulation data available. Add workout intervals below.</span>
              </div>
            ) : (
              <div className="w-full h-[400px]">
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart
                    data={simulationData}
                    margin={{ top: 5, right: 20, left: -20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
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
                    <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }} />
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
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-gray-100 pb-3">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Workout Intervals</h2>
              <p className="text-xs text-gray-500">
                Define the power profile and interval durations for the Euler loop
              </p>
            </div>
            <button
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
              No workout intervals defined. Click "Add Block" to start.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
              {workout.map((block, index) => (
                <div
                  key={block.id}
                  className="bg-gray-50 border border-gray-200 rounded-xl p-3.5 space-y-3 relative group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-700 bg-white border border-gray-200 px-2 py-0.5 rounded-md">
                      Block #{index + 1}
                    </span>
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
