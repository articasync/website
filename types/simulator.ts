export interface WorkoutBlock {
  id: string;
  watts: number;
  durationSeconds: number;
}

export interface Hardware {
  /** Mitochondrial density (0 - 1) */
  mitoDensity: number;
  /** MCT1 monocarboxylate transporter density (0 - 1) */
  mct1Density: number;
  /** MCT4 monocarboxylate transporter density (0 - 1) */
  mct4Density: number;
  /** Intracellular buffering capacity (0 - 1) */
  bufferCapacity: number;
  /** Slow-twitch Type 1 muscle fiber fraction (0 - 1) */
  fiberType1: number;
  /** Thermoregulatory cooling efficiency (0 - 1) */
  coolingEfficiency: number;
}

export interface ChartToggles {
  showHR: boolean;
  showMuscleH: boolean;
  showBloodH: boolean;
  showPCr1: boolean;
  showPCr2: boolean;
  showEpi: boolean;
  showWatts: boolean;
}

export interface SimulationPoint {
  time: number;
  watts: number;
  hr: number;
  la_muscle: number;
  la_blood: number;
  pcr1: number;
  pcr2: number;
  core_temp: number;
  epi: number;
  blown_up: boolean;
}
