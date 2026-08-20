import { Hardware, SimulationPoint, WorkoutBlock } from "@/types/simulator";

export const HR_REST = 50;
export const HR_MAX = 195;
export const GME = 0.22;

export const K_GLYC = 0.004; // Glycolytic rate constant
export const K_OX = 0.003; // Oxidative clearance rate constant
export const K_MCT4 = 0.08; // Efflux constant

/**
 * Runs a 1-second Euler numerical integration simulation of human cycling physiology.
 * Normalizes scientific hardware units to mathematical ODE coefficients.
 * Continues plotting planned workout watts after failure (blow up) while setting biological traces to null.
 *
 * @param hardware Physiological characteristics and biological hardware parameters in scientific units.
 * @param workout Array of workout intervals with target watts and duration in seconds.
 * @returns Array of SimulationPoint records across the entire planned workout duration.
 */
export function runSimulation(
  hardware: Hardware,
  workout: WorkoutBlock[]
): SimulationPoint[] {
  // Normalize biological units to 0.0 - 1.0 mathematical coefficients for the ODEs
  const normMito = hardware.mitoDensity / 15.0;
  const normMct1 = hardware.mct1Density / 300.0;
  const normMct4 = hardware.mct4Density / 300.0;
  const normBuffer = hardware.bufferCapacity / 100.0;
  const normFiber1 = hardware.fiberType1 / 100.0;
  const normCooling = hardware.coolingEfficiency / 50.0;
  const normSweat = hardware.sweatRate / 3.0;
  // svMax is used natively in mL, do not normalize it.

  // Baseline Math (run once before the loop)
  const fiberType2 = 1.0 - normFiber1;
  const MLSS =
    150 +
    300 * normMito * normFiber1 * normMct1 -
    50 * fiberType2 * normMct4;

  // Initialize state variables
  let pcr1 = 1.0;
  let pcr2 = 1.0;
  let la_muscle = 1.0;
  let la_blood = 1.0;
  let core_temp = 37.0;
  let epi = 0.0;
  let hr = HR_REST;
  let fluid_loss = 0.0;
  let glycogen = 100.0;
  let sv = hardware.svMax;
  let pi = 0.0;
  let gut_ischemia = 0.0;

  let hasBlownUp = false;

  const results: SimulationPoint[] = [];
  let currentTime = 0;

  // Guard against divide-by-zero if bufferCapacity is 0
  const bufferCapacityFactor = Math.max(0.001, normBuffer) * 10;

  // Outer loop through workout blocks (completes full workout duration)
  for (const block of workout) {
    const watts = block.watts;

    for (let s = 0; s < block.durationSeconds; s++) {
      currentTime += 1;

      // If athlete has already blown up, preserve time and watts for the X-axis while nulling biology
      if (hasBlownUp) {
        results.push({
          time: currentTime,
          watts,
          hr: null,
          la_muscle: null,
          la_blood: null,
          pcr1: null,
          pcr2: null,
          core_temp: null,
          epi: null,
          blown_up: false,
          glycogen: null,
          pi: null,
          gut_ischemia: null,
          sv: null,
        });
        continue;
      }

      // dpcr1 derivative
      let dpcr1: number;
      if (watts > MLSS) {
        dpcr1 = -0.01 * (watts - MLSS);
      } else {
        dpcr1 = 0.005 * (MLSS - watts) * (1 - pcr1);
      }

      // dpcr2 derivative
      let dpcr2: number;
      if (watts > MLSS * 1.2) {
        dpcr2 = -0.015 * (watts - MLSS * 1.2);
      } else {
        dpcr2 = 0.002 * Math.max(0, MLSS - watts) * (1 - pcr2);
      }

      // v_prod (glycolytic lactate production rate)
      const v_prod =
        watts > MLSS
          ? K_GLYC * Math.pow(watts - MLSS, 1.6) * fiberType2
          : 0.0;

      // flux_mct4 (lactate export from muscle to blood via MCT4)
      const flux_mct4 =
        K_MCT4 * normMct4 * Math.max(0, la_muscle - la_blood);

      // d_la_muscle derivative
      const d_la_muscle = (v_prod - flux_mct4) / bufferCapacityFactor;

      // flux_mct1 (lactate clearance from blood into oxidative fibers/heart via MCT1)
      const flux_mct1 =
        watts < MLSS
          ? K_OX *
            normMct1 *
            normMito *
            la_blood *
            (MLSS - watts)
          : 0.0;

      // d_la_blood derivative
      const d_la_blood = flux_mct4 * 0.2 - flux_mct1;

      // Dynamic GME (VO2 slow component efficiency degradation from intracellular acidosis)
      const current_gme = Math.max(
        0.15,
        GME - 0.005 * Math.max(0, la_muscle - 3.0)
      );

      // Metabolic heat generation and temperature derivative
      const heat_gen = watts * (1 / current_gme - 1);
      const d_temp =
        heat_gen * 0.0001 -
        normCooling * 0.05 * (core_temp - 37.0);

      // Fluid loss & Stroke Volume dynamics (Fick Principle)
      const d_fluid =
        normSweat * 0.001 * Math.max(0, core_temp - 37.0);
      fluid_loss += d_fluid;
      sv = Math.max(
        40,
        hardware.svMax * (1.0 - 0.05 * fluid_loss) -
          0.1 * Math.max(0, hr - 150)
      );

      // Epinephrine derivative
      const d_epi =
        la_blood > 4.0 ? 0.01 * (la_blood - 4.0) : -0.05 * epi;

      // Heart Rate via Fick Principle & Sympathetic Tone
      const o2_demand = watts / current_gme;
      const raw_target_hr = (o2_demand / sv) * 50 + 10 * epi;
      const target_hr = Math.min(HR_MAX, Math.max(HR_REST, raw_target_hr));
      const d_hr = (target_hr - hr) / 40.0;

      // Inorganic Phosphate (Pi) and Glycogen depletion
      pi = 1.0 - pcr1 + (1.0 - pcr2);
      const d_glycogen =
        -0.0001 * watts -
        (watts > MLSS ? 0.001 * Math.pow(watts - MLSS, 1.5) : 0);
      glycogen = Math.max(0, glycogen + d_glycogen);

      // Gut Ischemia (splanchnic hypoperfusion from vasoconstriction & hyperthermia)
      const target_gut = Math.min(
        100,
        50 * epi + 20 * Math.max(0, core_temp - 37.5)
      );
      const d_gut = (target_gut - gut_ischemia) / 60.0;
      gut_ischemia = Math.max(0, Math.min(100, gut_ischemia + d_gut));

      // Integration step (Euler dt = 1s)
      pcr1 += dpcr1;
      pcr2 += dpcr2;
      la_muscle += d_la_muscle;
      la_blood += d_la_blood;
      core_temp += d_temp;
      epi += d_epi;
      hr += d_hr;

      // Clamping state variables
      pcr1 = Math.min(1.0, Math.max(0.0, pcr1));
      pcr2 = Math.min(1.0, Math.max(0.0, pcr2));
      la_muscle = Math.max(1.0, la_muscle);
      la_blood = Math.max(1.0, la_blood);
      epi = Math.max(0.0, epi);

      // Failure check
      const blown_up = la_muscle > 20.0 || pcr2 <= 0 || glycogen <= 0;

      if (blown_up) {
        hasBlownUp = true;
      }

      // Record point
      results.push({
        time: currentTime,
        watts,
        hr,
        la_muscle,
        la_blood,
        pcr1,
        pcr2,
        core_temp,
        epi,
        blown_up,
        glycogen,
        pi,
        gut_ischemia,
        sv,
      });
    }
  }

  return results;
}
