using System;
using System.Diagnostics;
using System.Net.Http;
using System.Text.Json;
using System.Threading.Tasks;
using System.Windows.Forms;
using Sentinel.Shared;
using Sentinel.Uploader;

namespace SentinelAgent;

static class Program
{
    private const string CurrentVersion = "1.0.0";
    
    [STAThread]
    static void Main(string[] args)
    {
        Application.SetCompatibleTextRenderingDefault(false);
        Application.EnableVisualStyles();

        if (args.Length > 0 && args[0] == "--run-scheduled")
        {
            // Run collection and exit
            RunCollectionAsync(showNotification: false, null).GetAwaiter().GetResult();
            return;
        }
        else if (args.Length > 0 && args[0] == "--post-install")
        {
            PostInstallAsync().GetAwaiter().GetResult();
            return;
        }

        Application.Run(new TrayApp());
    }

    private static async Task PostInstallAsync()
    {
        try
        {
            // 1. Get pair token from API
            using var client = new HttpClient();
            var res = await client.PostAsync(SentinelAppEndpoints.DevicePairUrl, new StringContent("{}", System.Text.Encoding.UTF8, "application/json"));
            
            if (res.IsSuccessStatusCode)
            {
                var body = await res.Content.ReadAsStringAsync();
                using var doc = JsonDocument.Parse(body);
                var root = doc.RootElement;
                
                string? deviceToken = root.TryGetProperty("deviceToken", out var d) ? d.GetString() : null;
                string? pairToken = root.TryGetProperty("pairToken", out var p) ? p.GetString() : null;

                if (!string.IsNullOrEmpty(deviceToken) && !string.IsNullOrEmpty(pairToken))
                {
                    // 2. Save device token
                    RegistryState.DeviceToken = deviceToken;

                    // 3. Open browser to pair
                    Process.Start(new ProcessStartInfo(SentinelAppEndpoints.PairPageUrl(pairToken!)) { UseShellExecute = true });
                    
                    // 4. Run first collection
                    await RunCollectionAsync(showNotification: false, null);
                }
            }

            // 5. Register scheduled task
            RegisterScheduledTask();
        }
        catch { }
    }

    private static void RegisterScheduledTask()
    {
        try
        {
            string exePath = Process.GetCurrentProcess().MainModule?.FileName ?? "";
            if (string.IsNullOrEmpty(exePath)) return;

            string taskName = "SentinelAgentScan";
            string xmlPath = System.IO.Path.Combine(System.IO.Path.GetTempPath(), "SentinelTask.xml");

            string xml = $@"<?xml version=""1.0"" encoding=""UTF-16""?>
<Task version=""1.2"" xmlns=""http://schemas.microsoft.com/windows/2004/02/mit/task"">
  <RegistrationInfo>
    <Date>{DateTime.Now:yyyy-MM-ddTHH:mm:ss}</Date>
    <Author>Sentinel</Author>
    <Description>Runs the weekly Sentinel hardware scan.</Description>
  </RegistrationInfo>
  <Triggers>
    <TimeTrigger>
      <StartBoundary>{DateTime.Now:yyyy-MM-ddTHH:mm:ss}</StartBoundary>
      <Enabled>true</Enabled>
      <Repetition>
        <Interval>PT168H</Interval>
        <StopAtDurationEnd>false</StopAtDurationEnd>
      </Repetition>
    </TimeTrigger>
  </Triggers>
  <Settings>
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <AllowHardTerminate>true</AllowHardTerminate>
    <StartWhenAvailable>true</StartWhenAvailable>
    <RunOnlyIfNetworkAvailable>true</RunOnlyIfNetworkAvailable>
    <IdleSettings>
      <StopOnIdleEnd>false</StopOnIdleEnd>
      <RestartOnIdle>false</RestartOnIdle>
    </IdleSettings>
    <AllowStartOnDemand>true</AllowStartOnDemand>
    <Enabled>true</Enabled>
    <Hidden>false</Hidden>
    <RunOnlyIfIdle>false</RunOnlyIfIdle>
    <WakeToRun>false</WakeToRun>
    <ExecutionTimeLimit>PT2H</ExecutionTimeLimit>
    <Priority>7</Priority>
  </Settings>
  <Actions Context=""Author"">
    <Exec>
      <Command>""{exePath}""</Command>
      <Arguments>--run-scheduled</Arguments>
    </Exec>
  </Actions>
</Task>";

            System.IO.File.WriteAllText(xmlPath, xml, System.Text.Encoding.Unicode);

            var startInfo = new ProcessStartInfo
            {
                FileName = "schtasks.exe",
                Arguments = $"/Create /F /TN \"{taskName}\" /XML \"{xmlPath}\"",
                CreateNoWindow = true,
                WindowStyle = ProcessWindowStyle.Hidden
            };
            var proc = Process.Start(startInfo);
            proc?.WaitForExit();
            
            try { System.IO.File.Delete(xmlPath); } catch { }
        }
        catch { }
    }

    public static async Task RunCollectionAsync(bool showNotification, NotifyIcon? trayIcon)
    {
        if (RegistryState.Paused) return;

        // Auto-update check
        var (needsUpdate, hasNewVersion, downloadUrl) = await CheckForUpdatesAsync();
        if (needsUpdate)
        {
            if (showNotification) MessageBox.Show("A critical update is required.", "Sentinel", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            if (!string.IsNullOrEmpty(downloadUrl)) 
            {
                try { Process.Start(new ProcessStartInfo(downloadUrl) { UseShellExecute = true }); } catch { }
            }
            return;
        }

        if (hasNewVersion && trayIcon != null)
        {
            trayIcon.ShowBalloonTip(3000, "Sentinel Update", "A new version of Sentinel is available.", ToolTipIcon.Info);
        }

        var token = RegistryState.DeviceToken;
        // In Tier 1 dev mode or testing, we might need a dummy token if uninstalled. 
        // We will just return if not paired yet.
        if (string.IsNullOrEmpty(token)) return;

        try
        {
            var report = CollectorService.Collect();
            var (success, reportId) = await UploaderService.UploadDeviceTokenAsync(token, report);

            if (success && !string.IsNullOrEmpty(reportId))
            {
                RegistryState.LastReportId = reportId;
                RegistryState.LastRunAt = DateTime.UtcNow;
                
                if (showNotification && trayIcon != null)
                {
                    trayIcon.ShowBalloonTip(3000, "Scan Complete", "Your hardware scan was successful.", ToolTipIcon.Info);
                }
            }
        }
        catch { }
    }

    private static async Task<(bool needsUpdate, bool hasNewVersion, string? downloadUrl)> CheckForUpdatesAsync()
    {
        try
        {
            using var client = new HttpClient();
            var res = await client.GetStringAsync(SentinelAppEndpoints.VersionUrl);
            using var doc = JsonDocument.Parse(res);
            
            var root = doc.RootElement;
            string minStr = root.TryGetProperty("minVersion", out var min) ? min.GetString() ?? "0.0.0" : "0.0.0";
            string latestStr = root.TryGetProperty("latestVersion", out var lat) ? lat.GetString() ?? "0.0.0" : "0.0.0";
            string url = root.TryGetProperty("downloadUrl", out var dl)
                ? (dl.GetString() ?? SentinelAppEndpoints.GetStartedUrl)
                : SentinelAppEndpoints.GetStartedUrl;

            var current = new Version(CurrentVersion);
            var minV = new Version(minStr);
            var latestV = new Version(latestStr);

            if (current < minV) return (true, true, url);
            if (current < latestV) return (false, true, url);
        }
        catch { }

        return (false, false, null);
    }
}
