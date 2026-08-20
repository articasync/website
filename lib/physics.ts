import { Hardware, SimulationPoint, WorkoutBlock } from "@/types/simulator";

export const HR_REST = 50;
export const HR_MAX = 195;
export const GME = 0.22;

/**
 * Runs a 1-second Euler numerical integration simulation of human cycling physiology.
 *
 * @param hardware Physiological characteristics and biological hardware parameters.
 * @param workout Array of workout intervals with target watts and duration in seconds.
 * @returns Array of SimulationPoint records per second until workout ends or athlete blows up.
 */
export function runSimulation(
  hardware: Hardware,
  workout: WorkoutBlock[]
): SimulationPoint[] {
  // Baseline Math (run once before the loop)
  const fiberType2 = 1.0 - hardware.fiberType1;
  const MLSS =
    150 +
    300 * hardware.mitoDensity * hardware.fiberType1 * hardware.mct1Density -
    50 * fiberType2 * hardware.mct4Density;

  // Initialize state
  let pcr1 = 1.0;
  let pcr2 = 1.0;
  let la_muscle = 1.0;
  let la_blood = 1.0;
  let core_temp = 37.0;
  let epi = 0.0;
  let hr = HR_REST;

  const results: SimulationPoint[] = [];
  let currentTime = 0;

  // Guard against divide-by-zero if bufferCapacity is 0
  const bufferCapacityFactor = Math.max(0.001, hardware.bufferCapacity) * 10;

  // Outer loop through workout blocks
  workoutLoop: for (const block of workout) {
    const watts = block.watts;

    for (let s = 0; s < block.durationSeconds; s++) {
      currentTime += 1;

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
        watts > MLSS ? 0.005 * Math.pow(watts - MLSS, 1.5) : 0.0;

      // flux_mct4 (lactate export from muscle to blood)
      const flux_mct4 =
        hardware.mct4Density * 0.1 * Math.max(0, la_muscle - la_blood);

      // d_la_muscle derivative
      const d_la_muscle = (v_prod - flux_mct4) / bufferCapacityFactor;

      // flux_mct1 (lactate clearance from blood into oxidative fibers/heart)
      const flux_mct1 =
        watts < MLSS
          ? hardware.mct1Density *
            hardware.mitoDensity *
            0.05 *
            la_blood *
            (MLSS - watts)
          : 0.0;

      // d_la_blood derivative
      const d_la_blood = flux_mct4 * 0.2 - flux_mct1;

      // heat_gen and temperature derivative
      const heat_gen = watts * (1 / GME - 1);
      const d_temp =
        heat_gen * 0.0001 -
        hardware.coolingEfficiency * 0.05 * (core_temp - 37.0);

      // d_epi (epinephrine derivative)
      const d_epi =
        la_blood > 4.0 ? 0.01 * (la_blood - 4.0) : -0.05 * epi;

      // target_hr calculation and clamp
      const raw_target_hr =
        HR_REST +
        0.25 * watts +
        10 * Math.max(0, core_temp - 37.0) +
        20 * epi;
      const target_hr = Math.min(HR_MAX, Math.max(HR_REST, raw_target_hr));

      // d_hr derivative
      const d_hr = (target_hr - hr) / 40.0;

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
      const blown_up = la_muscle > 20.0 || pcr2 <= 0;

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
      });

      // Break simulation if athlete blows up
      if (blown_up) {
        break workoutLoop;
      }
    }
  }

  return results;
}
