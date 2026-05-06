using System;
using System.Diagnostics;
using System.IO;
using System.Threading.Tasks;
using Sentinel.Shared;
using Sentinel.Uploader;

namespace SentinelOneShot;

static class Program
{
    [STAThread]
    static async Task Main()
    {
        try
        {
            // 1. Collect data synchronously
            var report = CollectorService.Collect();

            // 2. Upload directly to cloud
            var (success, reportId, claimToken) = await UploaderService.UploadDirectAsync(report);
            
            if (success && !string.IsNullOrEmpty(reportId) && !string.IsNullOrEmpty(claimToken))
            {
                // 3. Open report in browser with claim token
                OpenBrowser($"https://sentinelapp.io/r/{reportId}?claim={claimToken}");
            }
        }
        catch (Exception)
        {
            // Fail silently to be completely frictionless, or write to event log
        }
        finally
        {
            // 4. Self-delete
            SelfDelete();
        }
    }

    private static void OpenBrowser(string url)
    {
        try
        {
            Process.Start(new ProcessStartInfo
            {
                FileName = url,
                UseShellExecute = true
            });
        }
        catch { }
    }

    private static void SelfDelete()
    {
        try
        {
            string batchPath = Path.Combine(Path.GetTempPath(), "sentinel_cleanup.bat");
            string exePath = Process.GetCurrentProcess().MainModule?.FileName ?? "";

            if (string.IsNullOrEmpty(exePath)) return;

            string batchCode = $@"
@echo off
ping -n 3 127.0.0.1 > nul
del ""{exePath}""
del ""%~f0""
";
            File.WriteAllText(batchPath, batchCode);

            var psi = new ProcessStartInfo
            {
                FileName = "cmd.exe",
                Arguments = $"/c \"{batchPath}\"",
                WindowStyle = ProcessWindowStyle.Hidden,
                CreateNoWindow = true
            };
            Process.Start(psi);
        }
        catch { }
    }
}
