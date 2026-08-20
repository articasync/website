export interface WorkoutBlock {
  id: string;
  watts: number;
  durationSeconds: number;
}

export interface Hardware {
  /** Mitochondrial density (% vol, 2 - 15) */
  mitoDensity: number;
  /** MCT1 monocarboxylate transporter density (pmol/mg, 50 - 300) */
  mct1Density: number;
  /** MCT4 monocarboxylate transporter density (pmol/mg, 50 - 300) */
  mct4Density: number;
  /** Intracellular buffering capacity (slykes, 40 - 100) */
  bufferCapacity: number;
  /** Slow-twitch Type 1 muscle fiber fraction (%, 10 - 90) */
  fiberType1: number;
  /** Thermoregulatory cooling efficiency (W/°C, 10 - 50) */
  coolingEfficiency: number;
  /** Sweat rate for dehydration dynamics (L/hr, 0 - 3) */
  sweatRate: number;
  /** Maximum stroke volume in mL (80 - 200) */
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
