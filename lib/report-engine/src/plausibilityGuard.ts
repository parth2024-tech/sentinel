import { SentinelReport } from "./schema";

export interface PlausibilityResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validates the raw hardware metrics in a report against physical and logical sanity bounds.
 * Prevents spoofed, corrupted, or malfunctioning sensor payloads from polluting database aggregates.
 */
export function validatePlausibility(report: SentinelReport): PlausibilityResult {
  const errors: string[] = [];

  // 1. Battery checks
  if (report.battery) {
    const b = report.battery;
    if (b.health != null && (b.health < 0 || b.health > 100)) {
      errors.push(`battery.health must be between 0 and 100 (got ${b.health})`);
    }
    if (b.batteryTempC != null && (b.batteryTempC < -20 || b.batteryTempC > 100)) {
      errors.push(`battery.batteryTempC must be between -20 and 100 (got ${b.batteryTempC})`);
    }
    if (b.batteryVoltageV != null && (b.batteryVoltageV < 0 || b.batteryVoltageV > 30)) {
      errors.push(`battery.batteryVoltageV must be between 0 and 30 (got ${b.batteryVoltageV})`);
    }
    if (b.cycleCount != null && b.cycleCount < 0) {
      errors.push(`battery.cycleCount cannot be negative (got ${b.cycleCount})`);
    }
  }

  // 2. Thermals checks
  if (report.thermals) {
    const t = report.thermals;
    if (t.maxTempC != null && (t.maxTempC < -20 || t.maxTempC > 125)) {
      errors.push(`thermals.maxTempC must be between -20 and 125 (got ${t.maxTempC})`);
    }
    if (t.throttleEvents30min != null && t.throttleEvents30min < 0) {
      errors.push(`thermals.throttleEvents30min cannot be negative (got ${t.throttleEvents30min})`);
    }
    if (t.zones) {
      for (let i = 0; i < t.zones.length; i++) {
        // Non-null assertion safe: i is bounded by zones.length
        const zone = t.zones[i]!;
        if (zone.tempC < -20 || zone.tempC > 125) {
          errors.push(`thermals.zones[${i}].tempC must be between -20 and 125 (got ${zone.tempC})`);
        }
      }
    }
  }

  // 3. Storage checks
  if (report.storage) {
    for (let i = 0; i < report.storage.length; i++) {
      // Non-null assertion safe: i is bounded by storage.length
      const s = report.storage[i]!;
      if (s.healthPct != null && (s.healthPct < 0 || s.healthPct > 100)) {
        errors.push(`storage[${i}].healthPct must be between 0 and 100 (got ${s.healthPct})`);
      }
      if (s.wearLevelPct != null && (s.wearLevelPct < 0 || s.wearLevelPct > 100)) {
        errors.push(`storage[${i}].wearLevelPct must be between 0 and 100 (got ${s.wearLevelPct})`);
      }
      if (s.freeSpacePct != null && (s.freeSpacePct < 0 || s.freeSpacePct > 100)) {
        errors.push(`storage[${i}].freeSpacePct must be between 0 and 100 (got ${s.freeSpacePct})`);
      }
      if (s.reallocatedSectors != null && s.reallocatedSectors < 0) {
        errors.push(`storage[${i}].reallocatedSectors cannot be negative (got ${s.reallocatedSectors})`);
      }
    }
  }

  // 4. Memory checks
  if (report.memory) {
    const m = report.memory;
    if (m.totalGB != null && m.totalGB <= 0) {
      errors.push(`memory.totalGB must be greater than 0 (got ${m.totalGB})`);
    }
    if (m.usedPct != null && (m.usedPct < 0 || m.usedPct > 100)) {
      errors.push(`memory.usedPct must be between 0 and 100 (got ${m.usedPct})`);
    }
  }

  // 5. CPU checks
  if (report.cpu) {
    const c = report.cpu;
    if (c.cores != null && c.cores <= 0) {
      errors.push(`cpu.cores must be greater than 0 (got ${c.cores})`);
    }
    if (c.threads != null && c.threads <= 0) {
      errors.push(`cpu.threads must be greater than 0 (got ${c.threads})`);
    }
    if (c.avgLoadPct != null && (c.avgLoadPct < 0 || c.avgLoadPct > 100)) {
      errors.push(`cpu.avgLoadPct must be between 0 and 100 (got ${c.avgLoadPct})`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
