using Microsoft.Win32;
using System;
using System.Security.AccessControl;
using System.Security.Cryptography;
using System.Security.Principal;
using System.Text;

namespace SentinelAgent;

public static class RegistryState
{
    private const string KeyPath = @"Software\Sentinel";
    private static readonly byte[] Entropy = Encoding.UTF8.GetBytes("Sentinel.DPAPI.Entropy.v1");

    public static string? DeviceToken
    {
        get
        {
            var enc = GetValue("DeviceTokenEncrypted");
            if (!string.IsNullOrEmpty(enc))
            {
                try
                {
                    var bytes = Convert.FromBase64String(enc);
                    // 1. Primary: Unprotect with LocalMachine scope and application entropy
                    var unprotected = ProtectedData.Unprotect(bytes, Entropy, DataProtectionScope.LocalMachine);
                    return Encoding.UTF8.GetString(unprotected);
                }
                catch
                {
                    // 2. Legacy migration fallback: Unprotect with CurrentUser scope
                    try
                    {
                        var bytes = Convert.FromBase64String(enc);
                        var unprotected = ProtectedData.Unprotect(bytes, null, DataProtectionScope.CurrentUser);
                        var token = Encoding.UTF8.GetString(unprotected);
                        // Seamlessly upgrade in place to LocalMachine scope
                        DeviceToken = token;
                        return token;
                    }
                    catch { }
                }
            }
            // Fallback for legacy plaintext migration
            var plaintext = GetValue("DeviceToken");
            if (!string.IsNullOrEmpty(plaintext))
            {
                // Upgrade plaintext to encrypted LocalMachine storage
                DeviceToken = plaintext;
                return plaintext;
            }
            return null;
        }
        set
        {
            if (string.IsNullOrEmpty(value))
            {
                DeleteValue("DeviceTokenEncrypted");
                DeleteValue("DeviceToken");
                return;
            }
            try
            {
                var bytes = Encoding.UTF8.GetBytes(value);
                var protectedBytes = ProtectedData.Protect(bytes, Entropy, DataProtectionScope.LocalMachine);
                SetValue("DeviceTokenEncrypted", Convert.ToBase64String(protectedBytes));
                DeleteValue("DeviceToken"); // Purge legacy plaintext
            }
            catch
            {
                // Fallback to unencrypted only if DPAPI is completely unavailable
                SetValue("DeviceToken", value);
            }
        }
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

    private static void SetAclForSystemAndAdmins(RegistryKey key)
    {
        try
        {
            var rs = new RegistrySecurity();
            var systemSid = new SecurityIdentifier(WellKnownSidType.LocalSystemSid, null);
            var adminsSid = new SecurityIdentifier(WellKnownSidType.BuiltinAdministratorsSid, null);

            rs.AddAccessRule(new RegistryAccessRule(systemSid, RegistryRights.FullControl, InheritanceFlags.ContainerInherit | InheritanceFlags.ObjectInherit, PropagationFlags.None, AccessControlType.Allow));
            rs.AddAccessRule(new RegistryAccessRule(adminsSid, RegistryRights.FullControl, InheritanceFlags.ContainerInherit | InheritanceFlags.ObjectInherit, PropagationFlags.None, AccessControlType.Allow));

            key.SetAccessControl(rs);
        }
        catch { }
    }

    private static string? GetValue(string name)
    {
        try
        {
            // Check HKLM first (machine-wide service config)
            using var hklmKey = Registry.LocalMachine.OpenSubKey(KeyPath);
            var val = hklmKey?.GetValue(name) as string;
            if (!string.IsNullOrEmpty(val)) return val;

            // Fallback to HKCU
            using var hkcuKey = Registry.CurrentUser.OpenSubKey(KeyPath);
            return hkcuKey?.GetValue(name) as string;
        }
        catch { return null; }
    }

    private static void SetValue(string name, string? value)
    {
        if (value == null) { DeleteValue(name); return; }

        // Attempt HKLM write first (elevated CLI or SYSTEM service)
        try
        {
            using var hklmKey = Registry.LocalMachine.CreateSubKey(KeyPath, RegistryKeyPermissionCheck.ReadWriteSubTree);
            if (hklmKey != null)
            {
                SetAclForSystemAndAdmins(hklmKey);
                hklmKey.SetValue(name, value);
                return;
            }
        }
        catch { }

        // Fallback to HKCU for unprivileged user executions
        try
        {
            using var hkcuKey = Registry.CurrentUser.CreateSubKey(KeyPath);
            hkcuKey?.SetValue(name, value);
        }
        catch { }
    }

    private static void DeleteValue(string name)
    {
        try
        {
            using var hklmKey = Registry.LocalMachine.OpenSubKey(KeyPath, true);
            hklmKey?.DeleteValue(name, false);
        }
        catch { }

        try
        {
            using var hkcuKey = Registry.CurrentUser.OpenSubKey(KeyPath, true);
            hkcuKey?.DeleteValue(name, false);
        }
        catch { }
    }
}
