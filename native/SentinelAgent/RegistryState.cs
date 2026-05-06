using Microsoft.Win32;
using System;

namespace SentinelAgent;

public static class RegistryState
{
    private const string KeyPath = @"Software\Sentinel";

    public static string? DeviceToken
    {
        get => GetValue("DeviceToken");
        set => SetValue("DeviceToken", value);
    }

    public static string? OrgToken
    {
        get => GetValue("OrgToken");
        // No setter needed, MDM writes this directly
    }

    public static string? LastReportId
    {
        get => GetValue("LastReportId");
        set => SetValue("LastReportId", value);
    }

    public static DateTime? LastRunAt
    {
        get
        {
            var s = GetValue("LastRunAt");
            if (DateTime.TryParse(s, null, System.Globalization.DateTimeStyles.RoundtripKind, out var dt))
                return dt;
            return null;
        }
        set
        {
            if (value.HasValue)
                SetValue("LastRunAt", value.Value.ToString("o"));
            else
                DeleteValue("LastRunAt");
        }
    }

    public static bool Paused
    {
        get
        {
            var s = GetValue("Paused");
            return s == "1" || s?.ToLower() == "true";
        }
        set => SetValue("Paused", value ? "1" : "0");
    }

    private static string? GetValue(string name)
    {
        try
        {
            using var hkcuKey = Registry.CurrentUser.OpenSubKey(KeyPath);
            var val = hkcuKey?.GetValue(name) as string;
            if (!string.IsNullOrEmpty(val)) return val;

            using var hklmKey = Registry.LocalMachine.OpenSubKey(KeyPath);
            return hklmKey?.GetValue(name) as string;
        }
        catch { return null; }
    }

    private static void SetValue(string name, string? value)
    {
        if (value == null) { DeleteValue(name); return; }
        try
        {
            using var key = Registry.CurrentUser.CreateSubKey(KeyPath);
            key.SetValue(name, value);
        }
        catch { }
    }

    private static void DeleteValue(string name)
    {
        try
        {
            using var key = Registry.CurrentUser.CreateSubKey(KeyPath);
            key.DeleteValue(name, false);
        }
        catch { }
    }
}
