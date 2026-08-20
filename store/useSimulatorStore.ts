import { create } from "zustand";
import {
  ChartToggles,
  Hardware,
  SimulationPoint,
  WorkoutBlock,
} from "@/types/simulator";

export interface SimulatorState {
  hardware: Hardware;
  workout: WorkoutBlock[];
  toggles: ChartToggles;
  simulationResults: SimulationPoint[];

  // Actions
  setHardware: (updates: Partial<Hardware>) => void;
  setWorkout: (workout: WorkoutBlock[]) => void;
  updateWorkoutBlock: (
    id: string,
    updates: Partial<Omit<WorkoutBlock, "id">>
  ) => void;
  addWorkoutBlock: (block?: Partial<Omit<WorkoutBlock, "id">>) => void;
  removeWorkoutBlock: (id: string) => void;
  reorderWorkoutBlocks: (startIndex: number, endIndex: number) => void;
  clearWorkout: () => void;
  setToggle: (key: keyof ChartToggles, value?: boolean) => void;
  setSimulationResults: (results: SimulationPoint[]) => void;
  resetToDefaults: () => void;
}

export const DEFAULT_HARDWARE: Hardware = {
  mitoDensity: 8.0, // % vol
  mct1Density: 150.0, // pmol/mg
  mct4Density: 150.0, // pmol/mg
  bufferCapacity: 65.0, // slykes
  fiberType1: 60.0, // %
  coolingEfficiency: 25.0, // W/°C
  sweatRate: 1.5, // L/hr
  svMax: 120, // mL
};

export const DEFAULT_WORKOUT: WorkoutBlock[] = [
  { id: "block-1", watts: 150, durationSeconds: 300 },
  { id: "block-2", watts: 450, durationSeconds: 60 },
  { id: "block-3", watts: 200, durationSeconds: 240 },
];

export const DEFAULT_TOGGLES: ChartToggles = {
  showHR: true,
  showMuscleH: false,
  showBloodH: false,
  showPCr1: false,
  showPCr2: false,
  showEpi: false,
  showGlycogen: false,
  showPi: false,
  showGutIschemia: false,
};

function generateUniqueId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `block-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export const useSimulatorStore = create<SimulatorState>((set) => ({
  hardware: DEFAULT_HARDWARE,
  workout: DEFAULT_WORKOUT,
  toggles: DEFAULT_TOGGLES,
  simulationResults: [],

  setHardware: (updates) =>
    set((state) => ({
      hardware: {
        ...state.hardware,
        ...updates,
      },
    })),

  setWorkout: (workout) => set({ workout }),

  updateWorkoutBlock: (id, updates) =>
    set((state) => ({
      workout: state.workout.map((block) =>
        block.id === id ? { ...block, ...updates } : block
      ),
    })),

  addWorkoutBlock: (block) =>
    set((state) => {
      const newBlock: WorkoutBlock = {
        id: generateUniqueId(),
        watts: block?.watts ?? 200,
        durationSeconds: block?.durationSeconds ?? 60,
        watts2: block?.watts2,
        durationSeconds2: block?.durationSeconds2,
        repeats: block?.repeats,
      };
      return { workout: [...state.workout, newBlock] };
    }),

  removeWorkoutBlock: (id) =>
    set((state) => ({
      workout: state.workout.filter((block) => block.id !== id),
    })),

  reorderWorkoutBlocks: (startIndex, endIndex) =>
    set((state) => {
      const newWorkout = Array.from(state.workout);
      const [removed] = newWorkout.splice(startIndex, 1);
      newWorkout.splice(endIndex, 0, removed);
      return { workout: newWorkout };
    }),

  clearWorkout: () => set({ workout: [] }),

  setToggle: (key, value) =>
    set((state) => ({
      toggles: {
        ...state.toggles,
        [key]: typeof value === "boolean" ? value : !state.toggles[key],
      },
    })),

  setSimulationResults: (results) => set({ simulationResults: results }),

  resetToDefaults: () =>
    set({
      hardware: DEFAULT_HARDWARE,
      workout: DEFAULT_WORKOUT,
      toggles: DEFAULT_TOGGLES,
      simulationResults: [],
    }),
}));
