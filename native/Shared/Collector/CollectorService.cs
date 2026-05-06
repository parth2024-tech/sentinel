using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Management;
using System.Linq;

namespace Sentinel.Shared;

public class CollectorService
{
    public static SentinelReport Collect()
    {
        var report = new SentinelReport
        {
            GeneratedAt = DateTime.UtcNow.ToString("o")
        };

        CollectSystemAndCpu(report);
        CollectMemory(report);
        CollectBattery(report);
        CollectThermals(report);
        CollectStorage(report);
        CollectStartup(report);
        CollectStartupPrograms(report);
        CollectSecurity(report);

        return report;
    }

    private static void CollectSystemAndCpu(SentinelReport report)
    {
        try
        {
            using var csSearcher = new ManagementObjectSearcher("SELECT Manufacturer, Model FROM Win32_ComputerSystem");
            foreach (var obj in csSearcher.Get())
            {
                report.System.Manufacturer = obj["Manufacturer"]?.ToString() ?? "";
                report.System.Model = obj["Model"]?.ToString() ?? "";
            }

            using var osSearcher = new ManagementObjectSearcher("SELECT Caption, Version FROM Win32_OperatingSystem");
            foreach (var obj in osSearcher.Get())
            {
                report.System.Os = obj["Caption"]?.ToString();
                report.System.OsVersion = obj["Version"]?.ToString();
            }

            using var biosSearcher = new ManagementObjectSearcher("SELECT SMBIOSBIOSVersion FROM Win32_BIOS");
            foreach (var obj in biosSearcher.Get())
            {
                report.System.BiosVersion = obj["SMBIOSBIOSVersion"]?.ToString();
            }

            report.System.Hostname = Environment.MachineName;

            using var procSearcher = new ManagementObjectSearcher("SELECT Name, NumberOfCores, NumberOfLogicalProcessors, MaxClockSpeed FROM Win32_Processor");
            report.Cpu = new CpuInfo();

            foreach (var obj in procSearcher.Get())
            {
                report.Cpu.Name = obj["Name"]?.ToString()?.Trim();
                if (int.TryParse(obj["NumberOfCores"]?.ToString(), out int cores)) report.Cpu.Cores = cores;
                if (int.TryParse(obj["NumberOfLogicalProcessors"]?.ToString(), out int threads)) report.Cpu.Threads = threads;
                if (int.TryParse(obj["MaxClockSpeed"]?.ToString(), out int clock)) report.Cpu.MaxClockMhz = clock;
                break; // Only need first physical CPU
            }

            // Sample CPU load twice with a 2-second gap to get a real average
            // (single WMI snapshot is unreliable — captures load at one instant only)
            double load1 = GetCpuLoadPct();
            System.Threading.Thread.Sleep(2000);
            double load2 = GetCpuLoadPct();
            report.Cpu.AvgLoadPct = Math.Round((load1 + load2) / 2.0, 1);

            // Collect CPU thermal throttle events from the last 30 minutes
            // via Windows Event Log (Event ID 37 = CPU throttle due to thermal)
            report.Cpu.ThrottleEvents30min = GetCpuThrottleEvents30Min();
        }
        catch (Exception ex) { Debug.WriteLine($"Collection error: {ex.Message}"); }
    }

    private static double GetCpuLoadPct()
    {
        try
        {
            using var searcher = new ManagementObjectSearcher("SELECT LoadPercentage FROM Win32_Processor");
            double total = 0; int count = 0;
            foreach (var obj in searcher.Get())
            {
                if (double.TryParse(obj["LoadPercentage"]?.ToString(), out double l)) { total += l; count++; }
            }
            return count > 0 ? total / count : 0;
        }
        catch { return 0; }
    }

    private static int GetCpuThrottleEvents30Min()
    {
        // Event 37 in Microsoft-Windows-Kernel-Processor-Power/Operational
        // = processor performance reduced due to thermal/power constraint.
        // Event 19 in System = power source changed (used as secondary signal).
        int count = 0;
        try
        {
            var cutoff = DateTime.UtcNow.AddMinutes(-30);
            var query = new System.Diagnostics.Eventing.Reader.EventLogQuery(
                "Microsoft-Windows-Kernel-Processor-Power/Operational",
                System.Diagnostics.Eventing.Reader.PathType.LogName,
                "*[System[(EventID=37) and TimeCreated[@SystemTime >= '" + cutoff.ToString("o") + "']]]")
            {
                ReverseDirection = false
            };
            using var reader = new System.Diagnostics.Eventing.Reader.EventLogReader(query);
            System.Diagnostics.Eventing.Reader.EventRecord? ev;
            while ((ev = reader.ReadEvent()) != null) { count++; ev.Dispose(); }
        }
        catch { /* Event log unavailable or access denied — return 0 */ }
        return count;
    }

    private static void CollectMemory(SentinelReport report)
    {
        try
        {
            using var searcher = new ManagementObjectSearcher("SELECT TotalVisibleMemorySize, FreePhysicalMemory FROM Win32_OperatingSystem");
            foreach (var obj in searcher.Get())
            {
                if (double.TryParse(obj["TotalVisibleMemorySize"]?.ToString(), out double totalKb) &&
                    double.TryParse(obj["FreePhysicalMemory"]?.ToString(), out double freeKb1))
                {
                    // Sample twice, 2 seconds apart, to get a representative used %
                    // (a single snapshot can catch a brief idle dip and report 30% when
                    //  the machine actually runs at 70% under normal usage)
                    System.Threading.Thread.Sleep(2000);
                    double freeKb2 = freeKb1;
                    using var searcher2 = new ManagementObjectSearcher("SELECT FreePhysicalMemory FROM Win32_OperatingSystem");
                    foreach (var obj2 in searcher2.Get())
                    {
                        if (double.TryParse(obj2["FreePhysicalMemory"]?.ToString(), out double f)) freeKb2 = f;
                        break;
                    }
                    // Use the LOWER free value (more conservative / more accurate peak)
                    double freeKb = Math.Min(freeKb1, freeKb2);
                    double totalGb = totalKb / (1024.0 * 1024.0);
                    double usedPct = ((totalKb - freeKb) / totalKb) * 100.0;

                    // Measure page faults per second via Performance Counter
                    int? pageFaultsPerSec = null;
                    try
                    {
                        var pc = new PerformanceCounter("Memory", "Page Faults/sec");
                        _ = pc.NextValue(); // first call always 0 — discard
                        System.Threading.Thread.Sleep(1000);
                        pageFaultsPerSec = (int)Math.Round(pc.NextValue());
                    }
                    catch { /* Performance counters unavailable */ }

                    report.Memory = new MemoryInfo
                    {
                        TotalGB = Math.Round(totalGb, 1),
                        UsedPct = Math.Round(usedPct, 1),
                        PageFaultsPerSec = pageFaultsPerSec
                    };
                }
                break;
            }
        }
        catch (Exception ex) { Debug.WriteLine($"Collection error: {ex.Message}"); }
    }

    private static void CollectBattery(SentinelReport report)
    {
        try
        {
            int? designCap = null;
            int? fullCap = null;
            int? cycleCount = null;
            object? status = null;
            int? dischargeRateMw = null;

            try
            {
                using var battWmi = new ManagementObjectSearcher("SELECT DesignCapacity, FullChargeCapacity, BatteryStatus FROM Win32_Battery");
                foreach (var obj in battWmi.Get())
                {
                    if (int.TryParse(obj["DesignCapacity"]?.ToString(), out int d)) designCap = d;
                    if (int.TryParse(obj["FullChargeCapacity"]?.ToString(), out int f)) fullCap = f;
                    if (int.TryParse(obj["BatteryStatus"]?.ToString(), out int s)) status = s;
                    break;
                }
            }
            catch (Exception ex) { Debug.WriteLine($"Collection error: {ex.Message}"); }

            try
            {
                using var battFull = new ManagementObjectSearcher(@"root\wmi", "SELECT FullChargedCapacity FROM BatteryFullChargedCapacity");
                foreach (var obj in battFull.Get()) { if (int.TryParse(obj["FullChargedCapacity"]?.ToString(), out int f)) fullCap = f; break; }
            }
            catch (Exception ex) { Debug.WriteLine($"Collection error: {ex.Message}"); }

            try
            {
                using var battDesign = new ManagementObjectSearcher(@"root\wmi", "SELECT DesignedCapacity FROM BatteryStaticData");
                foreach (var obj in battDesign.Get()) { if (int.TryParse(obj["DesignedCapacity"]?.ToString(), out int d)) designCap = d; break; }
            }
            catch (Exception ex) { Debug.WriteLine($"Collection error: {ex.Message}"); }

            try
            {
                using var battCycles = new ManagementObjectSearcher(@"root\wmi", "SELECT CycleCount FROM BatteryCycleCount");
                foreach (var obj in battCycles.Get()) { if (int.TryParse(obj["CycleCount"]?.ToString(), out int c)) cycleCount = c; break; }
            }
            catch (Exception ex) { Debug.WriteLine($"Collection error: {ex.Message}"); }

            try
            {
                using var battStatus = new ManagementObjectSearcher(@"root\wmi", "SELECT DischargeRate FROM BatteryStatus");
                foreach (var obj in battStatus.Get()) { if (int.TryParse(obj["DischargeRate"]?.ToString(), out int dr)) dischargeRateMw = dr; break; }
            }
            catch (Exception ex) { Debug.WriteLine($"Collection error: {ex.Message}"); }

            if (designCap != null || fullCap != null || cycleCount != null || status != null)
            {
                report.Battery = new BatteryInfo
                {
                    DesignCapacity = designCap,
                    FullChargeCapacity = fullCap,
                    CycleCount = cycleCount,
                    Status = status,
                    DischargeRateMw = dischargeRateMw
                };

                if (designCap > 0 && fullCap != null)
                {
                    report.Battery.Health = Math.Round(((double)fullCap / designCap.Value) * 100.0, 1);
                }
            }
        }
        catch (Exception ex) { Debug.WriteLine($"Collection error: {ex.Message}"); }
    }

    private static void CollectThermals(SentinelReport report)
    {
        try
        {
            var zones = new List<ThermalZone>();
            string source = "unavailable";

            // Tier 1: Performance Counter
            try
            {
                var pc = new PerformanceCounterCategory("Thermal Zone Information");
                var instances = pc.GetInstanceNames();
                if (instances.Length > 0)
                {
                    bool suspectStatic = true;
                    foreach (var instance in instances)
                    {
                        var counter = new PerformanceCounter("Thermal Zone Information", "Temperature", instance);
                        float val1 = counter.NextValue();
                        System.Threading.Thread.Sleep(1000);
                        float val2 = counter.NextValue();

                        if (Math.Abs(val1 - val2) > 0.01) suspectStatic = false;
                        if (val1 < 295 || val1 > 303) suspectStatic = false;

                        double tempC = Math.Round(val2 - 273.15, 1);
                        zones.Add(new ThermalZone { Name = instance, TempC = tempC });
                    }
                    if (zones.Count > 0)
                    {
                        source = suspectStatic ? "acpi_static_suspect" : "performance_counter";
                    }
                }
            }
            catch (Exception ex) { Debug.WriteLine($"Collection error: {ex.Message}"); }

            if (zones.Count == 0)
            {
                // Tier 2: MSAcpi_ThermalZoneTemp
                try
                {
                    using var searcher1 = new ManagementObjectSearcher(@"root\wmi", "SELECT CurrentTemperature, InstanceName FROM MSAcpi_ThermalZoneTemp");
                    var res1 = searcher1.Get().Cast<ManagementObject>().ToList();
                    System.Threading.Thread.Sleep(1000);
                    using var searcher2 = new ManagementObjectSearcher(@"root\wmi", "SELECT CurrentTemperature, InstanceName FROM MSAcpi_ThermalZoneTemp");
                    var res2 = searcher2.Get().Cast<ManagementObject>().ToList();

                    bool suspectStatic = true;
                    for (int i = 0; i < res1.Count; i++)
                    {
                        double t1 = Convert.ToDouble(res1[i]["CurrentTemperature"]);
                        double t2 = res2.Count > i ? Convert.ToDouble(res2[i]["CurrentTemperature"]) : t1;

                        if (t1 != t2) suspectStatic = false;
                        if (t1 < 2950 || t1 > 3030) suspectStatic = false;

                        double tempC = Math.Round((t1 / 10.0) - 273.15, 1);
                        zones.Add(new ThermalZone { Name = res1[i]["InstanceName"]?.ToString() ?? "Zone", TempC = tempC });
                    }

                    if (zones.Count > 0)
                    {
                        source = suspectStatic ? "acpi_static_suspect" : "acpi_wmi";
                    }
                }
                catch (Exception ex) { Debug.WriteLine($"Collection error: {ex.Message}"); }
            }

            if (zones.Count == 0)
            {
                // Tier 3: OpenHardwareMonitor
                try
                {
                    using var searcher = new ManagementObjectSearcher(@"root\OpenHardwareMonitor", "SELECT Name, Value FROM Sensor WHERE SensorType='Temperature'");
                    var results = searcher.Get().Cast<ManagementObject>().ToList();
                    var cpuSensors = results.Where(s => s["Name"]?.ToString()?.Contains("CPU") == true).ToList();
                    var targetSensors = cpuSensors.Count > 0 ? cpuSensors : results;

                    foreach (var obj in targetSensors)
                    {
                        string name = obj["Name"]?.ToString() ?? "Unknown";
                        double tempC = Math.Round(Convert.ToDouble(obj["Value"]), 1);
                        zones.Add(new ThermalZone { Name = name, TempC = tempC });
                    }

                    if (zones.Count > 0) source = "ohm";
                }
                catch (Exception ex) { Debug.WriteLine($"Collection error: {ex.Message}"); }
            }

            if (zones.Count == 0)
            {
                // Tier 4: LibreHardwareMonitor
                try
                {
                    using var searcher = new ManagementObjectSearcher(@"root\LibreHardwareMonitor", "SELECT Name, Value FROM Sensor WHERE SensorType='Temperature'");
                    var results = searcher.Get().Cast<ManagementObject>().ToList();
                    var cpuSensors = results.Where(s => s["Name"]?.ToString()?.Contains("CPU") == true).ToList();
                    var targetSensors = cpuSensors.Count > 0 ? cpuSensors : results;

                    foreach (var obj in targetSensors)
                    {
                        string name = obj["Name"]?.ToString() ?? "Unknown";
                        double tempC = Math.Round(Convert.ToDouble(obj["Value"]), 1);
                        zones.Add(new ThermalZone { Name = name, TempC = tempC });
                    }

                    if (zones.Count > 0) source = "lhm";
                }
                catch (Exception ex) { Debug.WriteLine($"Collection error: {ex.Message}"); }
            }

            report.Thermals = new ThermalsInfo
            {
                Zones = zones,
                ZoneCount = zones.Count,
                ThermalSource = source,
                ThermalSamples = zones.Count
            };

            if (zones.Count > 0 && source != "unavailable" && source != "acpi_static_suspect")
            {
                report.Thermals.MaxTempC = zones.Max(z => z.TempC);
            }
        }
        catch (Exception ex) { Debug.WriteLine($"Collection error: {ex.Message}"); }
    }

    private static void CollectStorage(SentinelReport report)
    {
        var storageList = new List<StorageDevice>();
        try
        {
            using var physSearcher = new ManagementObjectSearcher(@"root\Microsoft\Windows\Storage", "SELECT DeviceId, FriendlyName, MediaType, Size, BusType FROM MSFT_PhysicalDisk");
            foreach (var obj in physSearcher.Get())
            {
                var device = new StorageDevice
                {
                    Model = obj["FriendlyName"]?.ToString(),
                    DataSource = "unavailable"
                };

                if (int.TryParse(obj["MediaType"]?.ToString(), out int mt)) device.Type = mt.ToString();
                if (double.TryParse(obj["Size"]?.ToString(), out double size)) device.TotalGB = Math.Round(size / (1024.0 * 1024.0 * 1024.0), 0);

                string? deviceId = obj["DeviceId"]?.ToString();
                int? busType = null;
                if (int.TryParse(obj["BusType"]?.ToString(), out int bt)) busType = bt;

                // FreeSpacePct and StorageReliabilityCounter
                if (deviceId != null)
                {
                    try
                    {
                        using var partSearcher = new ManagementObjectSearcher(@"root\Microsoft\Windows\Storage", $"SELECT DriveLetter FROM MSFT_Partition WHERE DiskNumber='{deviceId}'");
                        foreach (var part in partSearcher.Get())
                        {
                            string? letter = part["DriveLetter"]?.ToString();
                            if (!string.IsNullOrWhiteSpace(letter))
                            {
                                var drive = new System.IO.DriveInfo(letter);
                                if (drive.IsReady && drive.TotalSize > 0)
                                {
                                    device.FreeSpacePct = Math.Round((double)drive.TotalFreeSpace / drive.TotalSize * 100.0, 1);
                                    break;
                                }
                            }
                        }
                    }
                    catch (Exception ex) { Debug.WriteLine($"Collection error: {ex.Message}"); }

                    try
                    {
                        using var relSearcher = new ManagementObjectSearcher(@"root\Microsoft\Windows\Storage", $"SELECT PowerOnHours, Wear, ReadErrorsUncorrected FROM MSFT_StorageReliabilityCounter WHERE DeviceId='{deviceId}'");
                        foreach (var rel in relSearcher.Get())
                        {
                            if (int.TryParse(rel["PowerOnHours"]?.ToString(), out int poh)) device.PowerOnHours = poh;
                            if (int.TryParse(rel["ReadErrorsUncorrected"]?.ToString(), out int reu)) device.ReallocatedSectors = reu;

                            if (int.TryParse(rel["Wear"]?.ToString(), out int wear))
                            {
                                bool isNvme = busType == 17;
                                bool wearSeemsMissing = (wear == 0) && isNvme;

                                if (wearSeemsMissing)
                                {
                                    // NVMe: try SMART ioctl first
                                    if (int.TryParse(deviceId, out int driveNumber))
                                    {
                                        var smart = NvmeSmart.GetSmartInfo(driveNumber);
                                        if (smart != null)
                                        {
                                            device.WearLevelPct = smart.PercentageUsed > 100 ? 0 : 100 - smart.PercentageUsed;
                                            device.DataSource = "nvme_smart_ioctl";
                                        }
                                        else
                                        {
                                            // Cannot read NVMe wear — mark unavailable so engine excludes it
                                            device.WearLevelPct = null;
                                            device.DataSource = "unavailable";
                                        }
                                    }
                                }
                                else if (wear > 0)
                                {
                                    // Reliability counter returned real wear data
                                    device.DataSource = "reliability_counter";
                                    device.WearLevelPct = wear;
                                }
                                else if (!isNvme && wear == 0)
                                {
                                    // SATA SSD: Wear=0 means brand new or counter not incremented yet.
                                    // Set to 99 (effectively full health) and use healthPct as fallback.
                                    device.WearLevelPct = 99;
                                    device.DataSource = "reliability_counter";
                                }
                                else
                                {
                                    device.DataSource = "reliability_counter";
                                    device.WearLevelPct = wear;
                                }
                            }
                        }
                    }
                    catch (Exception ex) { Debug.WriteLine($"Collection error: {ex.Message}"); }
                }

                storageList.Add(device);
            }
        }
        catch (Exception ex) { Debug.WriteLine($"Collection error: {ex.Message}"); }

        report.Storage = storageList;
    }

    private static void CollectStartup(SentinelReport report)
    {
        try
        {
            using var searcher = new ManagementObjectSearcher("SELECT LastBootUpTime FROM Win32_OperatingSystem");
            foreach (var obj in searcher.Get())
            {
                string? bootTimeStr = obj["LastBootUpTime"]?.ToString();
                if (!string.IsNullOrEmpty(bootTimeStr))
                {
                    var bootTime = ManagementDateTimeConverter.ToDateTime(bootTimeStr);
                    var uptimeSec = (int)(DateTime.Now - bootTime).TotalSeconds;
                    report.Startup = new StartupInfo
                    {
                        LastBootTime = bootTime.ToUniversalTime().ToString("o"),
                        LastBootSec = uptimeSec
                    };
                }
                break;
            }
        }
        catch (Exception ex) { Debug.WriteLine($"Collection error: {ex.Message}"); }
    }

    private static void CollectStartupPrograms(SentinelReport report)
    {
        // Collect startup programs from WMI and registry Run keys.
        // Used by the engine to flag excessive startup items in findings.
        var items = new List<StartupItem>();
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        try
        {
            // WMI: Win32_StartupCommand covers HKLM/HKCU Run and Startup folders
            using var searcher = new ManagementObjectSearcher("SELECT Name, Command FROM Win32_StartupCommand");
            foreach (var obj in searcher.Get())
            {
                string? name = obj["Name"]?.ToString();
                string? command = obj["Command"]?.ToString();
                if (name != null && seen.Add(name))
                    items.Add(new StartupItem { Name = name, Command = command });
            }
        }
        catch (Exception ex) { Debug.WriteLine($"Collection error (startupPrograms WMI): {ex.Message}"); }

        try
        {
            // Supplement with direct registry read to catch entries WMI misses
            string[] runKeys = [
                @"SOFTWARE\Microsoft\Windows\CurrentVersion\Run",
                @"SOFTWARE\Microsoft\Windows\CurrentVersion\RunOnce",
            ];
            var hives = new[] { Microsoft.Win32.Registry.CurrentUser, Microsoft.Win32.Registry.LocalMachine };
            foreach (var hive in hives)
            {
                foreach (var keyPath in runKeys)
                {
                    using var key = hive.OpenSubKey(keyPath);
                    if (key == null) continue;
                    foreach (string valueName in key.GetValueNames())
                    {
                        if (seen.Add(valueName))
                        {
                            string? val = key.GetValue(valueName)?.ToString();
                            items.Add(new StartupItem { Name = valueName, Command = val });
                        }
                    }
                }
            }
        }
        catch (Exception ex) { Debug.WriteLine($"Collection error (startupPrograms registry): {ex.Message}"); }

        if (items.Count > 0)
            report.StartupList = items;
    }

    private static void CollectSecurity(SentinelReport report)
    {
        // Collect antivirus/security posture from SecurityCenter2 WMI namespace.
        // productState is a 3-byte integer packed as 0xXXYYZZ where:
        //   XX = product type  (0x10 = AV, 0x20 = antispyware)
        //   YY = real-time protection state  (0x10 = ON, 0x00 = OFF)
        //   ZZ = signature/definition state  (0x00 = up-to-date, 0x10 = out-of-date)
        try
        {
            var secInfo = new SecurityInfo();
            bool hasAv = false;

            try
            {
                using var avSearcher = new ManagementObjectSearcher(
                    @"root\SecurityCenter2",
                    "SELECT displayName, productState, timestamp FROM AntiVirusProduct");

                foreach (var obj in avSearcher.Get())
                {
                    if (!uint.TryParse(obj["productState"]?.ToString(), out uint state)) continue;

                    // Extract the three bytes correctly:
                    // productState is stored as a uint32 with the three status bytes in the low 3 bytes
                    byte zzByte = (byte)(state & 0xFF);         // definition state
                    byte yyByte = (byte)((state >> 8) & 0xFF);  // real-time protection state
                    // byte xxByte = (byte)((state >> 16) & 0xFF); // product type (not needed here)

                    // YY byte: 0x10 = real-time protection ON, 0x00 = OFF
                    bool rtpEnabled = yyByte == 0x10;
                    // ZZ byte: 0x00 = definitions up-to-date, 0x10 = outdated
                    bool defsOutdated = zzByte == 0x10;

                    secInfo.AntivirusEnabled = rtpEnabled;
                    secInfo.RealTimeProtection = rtpEnabled;

                    // Timestamp field format: "20240101120000.000000+000" (WMI DateTime)
                    string? ts = obj["timestamp"]?.ToString();
                    if (!string.IsNullOrEmpty(ts))
                    {
                        try
                        {
                            var sigDate = ManagementDateTimeConverter.ToDateTime(ts);
                            secInfo.AntivirusSignatureDate = sigDate.ToUniversalTime().ToString("o");
                        }
                        catch { /* ignore parse errors */ }
                    }

                    hasAv = true;
                    break; // Use first registered AV product
                }
            }
            catch (Exception ex) { Debug.WriteLine($"Collection error (SecurityCenter2 AV): {ex.Message}"); }

            if (!hasAv)
            {
                // No AV registered in SecurityCenter2 — significant finding
                secInfo.AntivirusEnabled = false;
                secInfo.RealTimeProtection = false;
            }

            // Windows Firewall: check all three profiles and report which are enabled.
            // Registry layout:
            //   HKLM\SYSTEM\CurrentControlSet\Services\SharedAccess\Parameters\FirewallPolicy\
            //     DomainProfile\EnableFirewall
            //     StandardProfile\EnableFirewall     (Private profile in the UI)
            //     PublicProfile\EnableFirewall
            try
            {
                var profileKeyMap = new Dictionary<string, string>
                {
                    ["Domain"]  = @"SYSTEM\CurrentControlSet\Services\SharedAccess\Parameters\FirewallPolicy\DomainProfile",
                    ["Private"] = @"SYSTEM\CurrentControlSet\Services\SharedAccess\Parameters\FirewallPolicy\StandardProfile",
                    ["Public"]  = @"SYSTEM\CurrentControlSet\Services\SharedAccess\Parameters\FirewallPolicy\PublicProfile",
                };

                var activeProfiles = new List<string>();
                foreach (var (profileName, regPath) in profileKeyMap)
                {
                    using var key = Microsoft.Win32.Registry.LocalMachine.OpenSubKey(regPath);
                    if (key == null) continue;
                    int enabled = (int)(key.GetValue("EnableFirewall") ?? 0);
                    if (enabled == 1) activeProfiles.Add(profileName);
                }

                secInfo.FirewallProfilesActive = activeProfiles.Count > 0
                    ? string.Join(", ", activeProfiles)
                    : "None (Firewall disabled on all profiles)";
            }
            catch (Exception ex) { Debug.WriteLine($"Collection error (firewall profiles): {ex.Message}"); }

            report.Security = secInfo;
        }
        catch (Exception ex) { Debug.WriteLine($"Collection error (security): {ex.Message}"); }
    }
}
