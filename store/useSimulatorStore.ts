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
  addWorkoutBlocks: (blocks: Array<Partial<Omit<WorkoutBlock, "id">>>) => void;
  removeWorkoutBlock: (id: string) => void;
  reorderWorkoutBlocks: (startIndex: number, endIndex: number) => void;
  clearWorkout: () => void;
  setToggle: (key: keyof ChartToggles, value?: boolean) => void;
  setSimulationResults: (results: SimulationPoint[]) => void;
  resetToDefaults: () => void;
}

export const DEFAULT_HARDWARE: Hardware = {
  mitoDensity: 0.5,
  mct1Density: 0.5,
  mct4Density: 0.5,
  bufferCapacity: 0.5,
  fiberType1: 0.6,
  coolingEfficiency: 0.5,
  sweatRate: 0.5,
  svMax: 120,
};

export const DEFAULT_WORKOUT: WorkoutBlock[] = [
  { id: "block-1", watts: 150, durationSeconds: 300 },
  { id: "block-2", watts: 450, durationSeconds: 60 },
  { id: "block-3", watts: 200, durationSeconds: 240 },
];

export const DEFAULT_TOGGLES: ChartToggles = {
  showWatts: true,
  showHR: true,
  showMuscleH: true,
  showBloodH: false,
  showPCr1: true,
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
      };
      return { workout: [...state.workout, newBlock] };
    }),

  addWorkoutBlocks: (blocks) =>
    set((state) => {
      const newBlocks: WorkoutBlock[] = blocks.map((block) => ({
        id: generateUniqueId(),
        watts: block?.watts ?? 200,
        durationSeconds: block?.durationSeconds ?? 60,
      }));
      return { workout: [...state.workout, ...newBlocks] };
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
