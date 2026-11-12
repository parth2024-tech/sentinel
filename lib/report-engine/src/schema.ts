import { z } from "zod";

// .nullish() = accepts number | null | undefined
// This is critical: PowerShell and WMI return JSON null (not undefined) for
// unavailable hardware metrics. Zod's plain .optional() only accepts undefined
// and will throw a 422 for any null value. Using .nullish() everywhere a
// hardware field might be missing is the permanent fix.

export const StorageDeviceSchema = z.object({
  model: z.string().max(256).nullish(),
  type: z.string().max(64).nullish(),
  healthPct: z.number().nullish(),
  reallocatedSectors: z.number().nullish(),
  wearLevelPct: z.number().nullish(),
  freeSpacePct: z.number().nullish(),
  totalGB: z.number().nullish(),
  powerOnHours: z.number().nullish(),
  dataSource: z.string().max(64).nullish(),
  mediaErrors: z.number().nullish(),
  dataUnitsRead: z.number().nullish(),
  dataUnitsWritten: z.number().nullish(),
  criticalWarningFlags: z.number().nullish(),
});

export const ThermalZoneSchema = z.object({
  name: z.string().max(128),
  tempC: z.number(),
});

export const GpuDeviceSchema = z.object({
  name: z.string().max(256).nullish(),
  vramGb: z.number().nullish(),
  driverVersion: z.string().max(128).nullish(),
  driverDate: z.string().max(64).nullish(),
  status: z.string().max(64).nullish(),
  tempC: z.number().nullish(),
});

export const NetworkAdapterSchema = z.object({
  name: z.string().max(256).nullish(),
  ip: z.string().max(64).nullish(),
  speed: z.number().nullish(),
  desc: z.string().max(256).nullish(),
});

export const NetworkSchema = z.object({
  adapters: z.array(NetworkAdapterSchema).max(32).nullish(),
  connected: z.boolean().nullish(),
});

export const UpdateSchema = z.object({
  hotFixId: z.string().max(64).nullish(),
  installedOn: z.string().max(64).nullish(),
});

export const ProcessSchema = z.object({
  name: z.string().max(256).nullish(),
  cpuS: z.number().nullish(),
  ramMb: z.number().nullish(),
});

export const TopProcessesSchema = z.object({
  cpuHogs: z.array(ProcessSchema).max(32).nullish(),
  ramHogs: z.array(ProcessSchema).max(32).nullish(),
});

export const StartupItemSchema = z.object({
  name: z.string().max(256).nullish(),
  command: z.string().max(512).nullish(),
});

export const SecuritySchema = z.object({
  antivirusEnabled: z.boolean().nullish(),
  realTimeProtection: z.boolean().nullish(),
  lastFullScan: z.string().max(64).nullish(),
  antivirusSignatureDate: z.string().max(64).nullish(),
  firewallProfilesActive: z.string().max(128).nullish(),
  tpmActive: z.boolean().nullish(),
  tpmVersion: z.string().max(64).nullish(),
  secureBootEnabled: z.boolean().nullish(),
  lsaProtectionEnabled: z.boolean().nullish(),
});

export const RecentSystemErrorSchema = z.object({
  time: z.string().max(64).nullish(),
  source: z.string().max(128).nullish(),
  error: z.string().max(512).nullish(),
});

export const SentinelReportSchema = z.object({
  sentinelSchema: z.literal(1),
  generatedAt: z.string(),
  system: z.object({
    hostname: z.string(),
    model: z.string(),
    manufacturer: z.string(),
    os: z.string().nullish(),
    osVersion: z.string().nullish(),
    biosVersion: z.string().nullish(),
    bootTime: z.string().nullish(),
    uptimeHours: z.number().nullish(),
  }),
  battery: z
    .object({
      designCapacity: z.number().nullish(),
      fullChargeCapacity: z.number().nullish(),
      cycleCount: z.number().nullish(),
      health: z.number().nullish(),
      status: z.union([z.string(), z.number()]).nullish(),
      dischargeRateMw: z.number().nullish(),
      batteryTempC: z.number().nullish(),
      batteryVoltageV: z.number().nullish(),
    })
    .nullish(),
  thermals: z
    .object({
      maxTempC: z.number().nullish(),
      zones: z.array(ThermalZoneSchema).max(32).nullish(),
      zoneCount: z.number().nullish(),
      throttleEvents30min: z.number().nullish(),
      thermalSource: z.string().max(64).nullish(),
      thermalSamples: z.number().nullish(),
    })
    .nullish(),
  storage: z.array(StorageDeviceSchema).max(32).nullish(),
  memory: z
    .object({
      totalGB: z.number(),
      usedPct: z.number(),
      pageFaultsPerSec: z.number().nullish(),
      dpcTimePct: z.number().nullish(),
      interruptTimePct: z.number().nullish(),
      dpcsQueuedPerSec: z.number().nullish(),
    })
    .nullish(),
  cpu: z
    .object({
      name: z.string().max(256).nullish(),
      cores: z.number().nullish(),
      threads: z.number().nullish(),
      avgLoadPct: z.number().nullish(),
      throttleEvents30min: z.number().nullish(),
      maxClockMhz: z.number().nullish(),
      coreTempDeltaC: z.number().nullish(),
      throttleReason: z.string().max(128).nullish(),
    })
    .nullish(),
  startup: z
    .object({
      lastBootTime: z.string().max(64).nullish(),
      lastBootSec: z.number().nullish(),
    })
    .nullish(),
  gpus: z.array(GpuDeviceSchema).max(16).nullish(),
  network: NetworkSchema.nullish(),
  updates: UpdateSchema.nullish(),
  topProcesses: TopProcessesSchema.nullish(),
  startupList: z.array(StartupItemSchema).max(64).nullish(),
  security: SecuritySchema.nullish(),
  recentErrors: z.array(RecentSystemErrorSchema).max(64).nullish(),
  runningOemServicesCount: z.number().nullish(),
});

/**
 * SentinelReport type representing the full validated diagnostic JSON payload.
 */
export type SentinelReport = z.infer<typeof SentinelReportSchema>;

/**
 * StorageDevice type representing a single storage drive unit telemetry model.
 */
export type StorageDevice = z.infer<typeof StorageDeviceSchema>;

/**
 * Parses and validates raw JSON telemetry data submitted by a client diagnostic script.
 * 
 * Verifies structural conformity against SentinelReportSchema (ver. 1) and generates
 * helpful, pinpointed validation errors indicating structural path failures.
 * 
 * @param raw Raw telemetry payload string.
 * @returns An object containing the typed SentinelReport data or a descriptive validation error.
 */
export function parseReport(raw: string): { data: SentinelReport | null; error: string | null } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.trim());
  } catch {
    return {
      data: null,
      error: "Couldn't parse JSON — make sure you copied the full output from the script.",
    };
  }
  const result = SentinelReportSchema.safeParse(parsed);
  if (!result.success) {
    // issues[0] is safe to assert — Zod always populates at least one issue on failure
    const firstIssue = result.error.issues[0]!;
    const path = firstIssue.path.join(".");
    return {
      data: null,
      error: `Schema error at "${path}": ${firstIssue.message}. Your script output may be outdated — download the latest script from this page.`,
    };
  }
  return { data: result.data, error: null };
}
