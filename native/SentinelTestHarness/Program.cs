using System;
using System.Text.Json;
using Sentinel.Shared;

namespace SentinelTestHarness;

/// <summary>
/// Headless test harness for CI.
/// Runs the Collector, serializes the report to JSON, and writes it to stdout.
/// Exit code 0 = collection succeeded and produced valid JSON.
/// Exit code 1 = collection threw or produced a null/empty report.
///
/// Usage:
///   SentinelTestHarness.exe                → prints JSON to stdout
///   SentinelTestHarness.exe --output file  → writes JSON to file AND stdout
/// </summary>
static class Program
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull,
        WriteIndented = true
    };

    static int Main(string[] args)
    {
        try
        {
            Console.Error.WriteLine("[harness] Starting collection...");
            var report = CollectorService.Collect();

            if (report == null)
            {
                Console.Error.WriteLine("[harness] ERROR: CollectorService.Collect() returned null.");
                return 1;
            }

            // Basic sanity checks before serialization
            if (report.SentinelSchema != 1)
            {
                Console.Error.WriteLine($"[harness] ERROR: sentinelSchema is {report.SentinelSchema}, expected 1.");
                return 1;
            }

            if (string.IsNullOrEmpty(report.System.Hostname))
            {
                Console.Error.WriteLine("[harness] ERROR: system.hostname is empty.");
                return 1;
            }

            var json = JsonSerializer.Serialize(report, JsonOptions);

            // Write to stdout for piping to the schema validator
            Console.WriteLine(json);

            // Optionally write to file
            string? outputPath = null;
            for (int i = 0; i < args.Length - 1; i++)
            {
                if (args[i] == "--output")
                {
                    outputPath = args[i + 1];
                    break;
                }
            }

            if (!string.IsNullOrEmpty(outputPath))
            {
                System.IO.File.WriteAllText(outputPath, json);
                Console.Error.WriteLine($"[harness] Report written to {outputPath}");
            }

            Console.Error.WriteLine("[harness] Collection complete.");
            Console.Error.WriteLine($"[harness] System: {report.System.Hostname} / {report.System.Model}");
            Console.Error.WriteLine($"[harness] CPU: {report.Cpu?.Name ?? "N/A"}");
            Console.Error.WriteLine($"[harness] Memory: {report.Memory?.TotalGB ?? 0} GB");
            Console.Error.WriteLine($"[harness] Storage devices: {report.Storage?.Count ?? 0}");
            Console.Error.WriteLine($"[harness] Thermal source: {report.Thermals?.ThermalSource ?? "N/A"}");
            Console.Error.WriteLine($"[harness] Battery: {(report.Battery != null ? "present" : "none")}");

            return 0;
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine($"[harness] FATAL: {ex}");
            return 1;
        }
    }
}
