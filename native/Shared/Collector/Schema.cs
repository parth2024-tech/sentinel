using System;
using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace Sentinel.Shared;

public class StorageDevice
{
    public string? Model { get; set; }
    public string? Type { get; set; }
    public int? HealthPct { get; set; }
    public int? ReallocatedSectors { get; set; }
    public int? WearLevelPct { get; set; }
    public double? FreeSpacePct { get; set; }
    public double? TotalGB { get; set; }
    public int? PowerOnHours { get; set; }
    public string? DataSource { get; set; }
}

public class ThermalZone
{
    public string Name { get; set; } = string.Empty;
    public double TempC { get; set; }
}

public class SystemInfo
{
    public string Hostname { get; set; } = string.Empty;
    public string Model { get; set; } = string.Empty;
    public string Manufacturer { get; set; } = string.Empty;
    public string? Os { get; set; }
    public string? OsVersion { get; set; }
    public string? BiosVersion { get; set; }
}

public class BatteryInfo
{
    public int? DesignCapacity { get; set; }
    public int? FullChargeCapacity { get; set; }
    public int? CycleCount { get; set; }
    public double? Health { get; set; }
    public object? Status { get; set; } // string or int
    public int? DischargeRateMw { get; set; }
}

public class ThermalsInfo
{
    public double? MaxTempC { get; set; }
    public List<ThermalZone>? Zones { get; set; }
    public int? ZoneCount { get; set; }
    public int? ThrottleEvents30min { get; set; }
    public string? ThermalSource { get; set; }
    public int? ThermalSamples { get; set; }
}

public class MemoryInfo
{
    public double TotalGB { get; set; }
    public double UsedPct { get; set; }
    public int? PageFaultsPerSec { get; set; }
}

public class CpuInfo
{
    public string? Name { get; set; }
    public int? Cores { get; set; }
    public int? Threads { get; set; }
    public double? AvgLoadPct { get; set; }
    public int? ThrottleEvents30min { get; set; }
    public int? MaxClockMhz { get; set; }
}

public class StartupInfo
{
    public string? LastBootTime { get; set; }
    public int? LastBootSec { get; set; }
}

public class SentinelReport
{
    public int SentinelSchema { get; set; } = 1;
    public string GeneratedAt { get; set; } = string.Empty;
    public SystemInfo System { get; set; } = new();
    public BatteryInfo? Battery { get; set; }
    public ThermalsInfo? Thermals { get; set; }
    public List<StorageDevice>? Storage { get; set; }
    public MemoryInfo? Memory { get; set; }
    public CpuInfo? Cpu { get; set; }
    public StartupInfo? Startup { get; set; }
    public List<StartupItem>? StartupList { get; set; }
    public SecurityInfo? Security { get; set; }
}

public class StartupItem
{
    public string? Name { get; set; }
    public string? Command { get; set; }
}

public class SecurityInfo
{
    public bool? AntivirusEnabled { get; set; }
    public bool? RealTimeProtection { get; set; }
    public string? LastFullScan { get; set; }
    public string? AntivirusSignatureDate { get; set; }
    public string? FirewallProfilesActive { get; set; }
}
