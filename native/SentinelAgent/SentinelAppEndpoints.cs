using System;

namespace SentinelAgent;

/// <summary>
/// Public API and web URLs for the agent. Override at runtime with SENTINEL_API_BASE_URL,
/// or build with <c>/p:SentinelStaging=true</c> to default to the staging host.
/// </summary>
internal static class SentinelAppEndpoints
{
    private static readonly string ApiBase = ResolveApiBase();

    private static string ResolveApiBase()
    {
        var env = Environment.GetEnvironmentVariable("SENTINEL_API_BASE_URL");
        if (!string.IsNullOrWhiteSpace(env))
            return env.Trim().TrimEnd('/');

#if SENTINEL_STAGING
        return "https://staging.sentinelapp.io";
#else
        return "https://sentinelapp.io";
#endif
    }

    public static string DevicePairUrl => $"{ApiBase}/api/devices/pair";

    public static string PairPageUrl(string pairToken) =>
        $"{ApiBase}/pair?token={Uri.EscapeDataString(pairToken)}";

    public static string VersionUrl => $"{ApiBase}/api/version";

    public static string GetStartedUrl => $"{ApiBase}/get-started";
}
