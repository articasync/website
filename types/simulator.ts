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
  /** Sweat rate for dehydration dynamics (0 - 1) */
  sweatRate: number;
  /** Maximum stroke volume in mL (100 - 150) */
  svMax: number;
}

export interface ChartToggles {
  showHR: boolean;
  showMuscleH: boolean;
  showBloodH: boolean;
  showPCr1: boolean;
  showPCr2: boolean;
  showEpi: boolean;
  showWatts: boolean;
  showGlycogen: boolean;
  showPi: boolean;
  showGutIschemia: boolean;
}

export interface SimulationPoint {
  time: number;
  watts: number;
  hr: number | null;
  la_muscle: number | null;
  la_blood: number | null;
  pcr1: number | null;
  pcr2: number | null;
  core_temp: number | null;
  epi: number | null;
  blown_up: boolean;
  glycogen: number | null;
  pi: number | null;
  gut_ischemia: number | null;
  sv: number | null;
}
