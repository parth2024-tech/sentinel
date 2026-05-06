/**
 * @file forecast.ts
 * @description Track 2C: Per-device trend forecasting and telemetry analysis.
 * 
 * Implements two distinct forecasting models:
 * 1. Phase 2B: Population-fitted battery health curve using an exponential decay model
 *    calibrated with published OEM battery aging data.
 * 2. Phase 2C: Warm-start linear regression analysis on user-specific diagnostic scan history,
 *    providing real-time degradation forecasting along with a 95% confidence interval (CI).
 * 
 * Cold-start fallback (< 3 scans) informs users of population curve projections, transitioning
 * automatically to regression analysis once sufficient datapoints are accumulated.
 */

/**
 * ScanPoint defines a single historical telemetry payload capture.
 */
export interface ScanPoint {
  /** The offset in fractional/integer days from the first registered device scan. */
  daysFromFirst: number;
  /** Battery health percentage remaining (e.g. 0 to 100). */
  batteryHealth?: number;
  /** Maximum registered component temperature in Celsius. */
  maxTempC?: number;
  /** Solid State Drive (SSD) remaining wear level percentage. */
  ssdWearPct?: number;
}

/**
 * Forecast describes the projection metrics computed for a device telemetry trend.
 */
export interface Forecast {
  /** The hardware performance metric targeted by the projection engine. */
  metric: "battery_health" | "ssd_wear" | "max_temp";
  /** The current value of the performance metric recorded in the latest scan. */
  currentValue: number;
  /** Estimated degradation rate per calendar month (negative values indicate decline). */
  ratePerMonth: number;
  /** Projection indicating estimated months until metric hits a critical warning threshold. */
  monthsUntilThreshold: { value: number; ci95: [number, number] };
  /** The mathematical projection model employed (population curve or regression). */
  model: "population_curve" | "linear_regression";
  /** Total number of data samples utilized in the forecast calculation. */
  sampleSize: number;
  /** Human-readable explanation and accuracy indicators for the UI. */
  label: string;
}

// ── Population curve (Phase 2B) ───────────────────────────────────────────────
// Exponential decay: health = 100 * exp(-k * cycles)
// k fitted from published Dell/Lenovo battery aging data.
const BATTERY_DECAY_K = 0.00042;

export function populationBatteryHealth(cycles: number): number {
  return Math.max(0, 100 * Math.exp(-BATTERY_DECAY_K * cycles));
}

// ── Simple linear regression helper ──────────────────────────────────────────
function linearRegression(xs: number[], ys: number[]): {
  slope: number;
  intercept: number;
  stdErr: number;
  r2: number;
} {
  const n = xs.length;
  if (n < 2) return { slope: 0, intercept: ys[0] ?? 0, stdErr: Infinity, r2: 0 };

  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;

  let ssXX = 0, ssXY = 0, ssYY = 0;
  for (let i = 0; i < n; i++) {
    ssXX += (xs[i] - meanX) ** 2;
    ssXY += (xs[i] - meanX) * (ys[i] - meanY);
    ssYY += (ys[i] - meanY) ** 2;
  }

  const slope = ssXX === 0 ? 0 : ssXY / ssXX;
  const intercept = meanY - slope * meanX;

  // Residual std error
  let sse = 0;
  for (let i = 0; i < n; i++) {
    sse += (ys[i] - (intercept + slope * xs[i])) ** 2;
  }
  const stdErr = n > 2 ? Math.sqrt(sse / (n - 2)) / (Math.sqrt(ssXX) || 1) : Infinity;
  const r2 = ssYY === 0 ? 1 : 1 - sse / ssYY;

  return { slope, intercept, stdErr, r2 };
}

// ── Battery health forecast ───────────────────────────────────────────────────

const BATTERY_THRESHOLD = 60; // % — warn when below this
const DAYS_PER_MONTH = 30.44;

export function forecastBatteryHealth(
  history: ScanPoint[],
  currentCycles?: number,
): Forecast {
  const points = history
    .filter((p) => p.batteryHealth !== undefined)
    .map((p) => ({ x: p.daysFromFirst, y: p.batteryHealth as number }));

  const current = points.at(-1)?.y ?? 100;

  if (points.length < 3) {
    // Cold start — use population curve
    const degradationPerMonth = populationBatteryHealth(0) - populationBatteryHealth(DAYS_PER_MONTH);
    const monthsLeft = current <= BATTERY_THRESHOLD ? 0
      : (current - BATTERY_THRESHOLD) / degradationPerMonth;

    return {
      metric: "battery_health",
      currentValue: current,
      ratePerMonth: -degradationPerMonth,
      monthsUntilThreshold: {
        value: Math.round(monthsLeft),
        ci95: [Math.round(monthsLeft * 0.7), Math.round(monthsLeft * 1.4)],
      },
      model: "population_curve",
      sampleSize: points.length,
      label: `Forecast based on population data — accuracy improves after ${3 - points.length} more scan${3 - points.length === 1 ? "" : "s"}.`,
    };
  }

  // Warm — use the user's own degradation rate
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const { slope, stdErr } = linearRegression(xs, ys);

  const ratePerMonth = slope * DAYS_PER_MONTH; // negative = degrading
  const daysUntilThreshold =
    slope >= 0 ? Infinity : (current - BATTERY_THRESHOLD) / (-slope);
  const monthsUntil = daysUntilThreshold / DAYS_PER_MONTH;

  // 95% CI: ±2 std errors on slope
  const slopeLow = slope - 2 * stdErr;
  const slopeHigh = slope + 2 * stdErr;
  const daysLow = slopeLow >= 0 ? Infinity : (current - BATTERY_THRESHOLD) / (-slopeLow);
  const daysHigh = slopeHigh >= 0 ? Infinity : (current - BATTERY_THRESHOLD) / (-slopeHigh);

  return {
    metric: "battery_health",
    currentValue: current,
    ratePerMonth,
    monthsUntilThreshold: {
      value: Math.round(monthsUntil),
      ci95: [Math.round(daysHigh / DAYS_PER_MONTH), Math.round(daysLow / DAYS_PER_MONTH)],
    },
    model: "linear_regression",
    sampleSize: points.length,
    label: `Forecast based on your device's own degradation trend (${points.length} scans).`,
  };
}

// ── SSD wear forecast ─────────────────────────────────────────────────────────

const SSD_THRESHOLD = 20; // % wear remaining — warn below

export function forecastSsdWear(history: ScanPoint[]): Forecast {
  const points = history
    .filter((p) => p.ssdWearPct !== undefined)
    .map((p) => ({ x: p.daysFromFirst, y: p.ssdWearPct as number }));

  const current = points.at(-1)?.y ?? 100;

  if (points.length < 3) {
    return {
      metric: "ssd_wear",
      currentValue: current,
      ratePerMonth: -0.5,
      monthsUntilThreshold: {
        value: Math.round((current - SSD_THRESHOLD) / 0.5),
        ci95: [
          Math.round((current - SSD_THRESHOLD) / 0.7),
          Math.round((current - SSD_THRESHOLD) / 0.3),
        ],
      },
      model: "population_curve",
      sampleSize: points.length,
      label: `Forecast based on population data — accuracy improves after ${3 - points.length} more scan${3 - points.length === 1 ? "" : "s"}.`,
    };
  }

  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const { slope, stdErr } = linearRegression(xs, ys);
  const ratePerMonth = slope * DAYS_PER_MONTH;
  const daysUntil = slope >= 0 ? Infinity : (current - SSD_THRESHOLD) / (-slope);
  const monthsUntil = daysUntil / DAYS_PER_MONTH;
  const slopeLow = slope - 2 * stdErr;
  const slopeHigh = slope + 2 * stdErr;

  return {
    metric: "ssd_wear",
    currentValue: current,
    ratePerMonth,
    monthsUntilThreshold: {
      value: Math.round(monthsUntil),
      ci95: [
        Math.round((slopeHigh >= 0 ? Infinity : (current - SSD_THRESHOLD) / (-slopeHigh)) / DAYS_PER_MONTH),
        Math.round((slopeLow >= 0 ? Infinity : (current - SSD_THRESHOLD) / (-slopeLow)) / DAYS_PER_MONTH),
      ],
    },
    model: "linear_regression",
    sampleSize: points.length,
    label: `Forecast based on your device's own wear trend (${points.length} scans).`,
  };
}
