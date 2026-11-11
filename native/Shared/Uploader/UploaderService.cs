using System;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using Sentinel.Shared;

namespace Sentinel.Uploader;

public class UploaderService
{
    private static readonly HttpClient _httpClient = new HttpClient();
    private const string BaseUrl = "https://sentinelapp.io";

    // Track calibrated server clock offset to survive client CMOS drift / NTP desync
    private static long _serverClockOffsetSeconds = 0;

    private static readonly JsonSerializerOptions JsonOptions = new JsonSerializerOptions
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull
    };

    public static async Task<(bool success, string? reportId, string? claimToken)> UploadDirectAsync(SentinelReport report, string? deviceToken = null)
    {
        var payload = new { rawJson = report };
        var jsonContent = JsonSerializer.Serialize(payload, JsonOptions);

        return await UploadWithRetryAsync(async () =>
        {
            var result = await AttemptUploadAsync(jsonContent, deviceToken);
            return result;
        }, jsonContent);
    }

    public static async Task<(bool success, string? reportId)> UploadDeviceTokenAsync(string deviceToken, SentinelReport report)
    {
        var (success, reportId, _) = await UploadDirectAsync(report, deviceToken);
        return (success, reportId);
    }

    private static async Task<(bool, string?, string?)> AttemptUploadAsync(string jsonContent, string? deviceToken)
    {
        for (int attempt = 0; attempt < 2; attempt++)
        {
            var content = new StringContent(jsonContent, Encoding.UTF8, "application/json");

            // Calibrated timestamp
            long timestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds() + _serverClockOffsetSeconds;
            string signaturePayload = $"{timestamp}.{jsonContent}";

            string signature;
            if (!string.IsNullOrEmpty(deviceToken))
            {
                // Paired agent: Keyed HMAC-SHA256 bound to deviceToken
                using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(deviceToken));
                byte[] hashBytes = hmac.ComputeHash(Encoding.UTF8.GetBytes(signaturePayload));
                signature = Convert.ToHexString(hashBytes).ToLowerInvariant();
                content.Headers.Add("Authorization", $"Bearer {deviceToken}");
            }
            else
            {
                // OneShot: Digest attestation over wire bytes
                using var sha256 = SHA256.Create();
                byte[] hashBytes = sha256.ComputeHash(Encoding.UTF8.GetBytes(signaturePayload));
                signature = Convert.ToHexString(hashBytes).ToLowerInvariant();
            }

            content.Headers.Add("X-Sentinel-Timestamp", timestamp.ToString());
            content.Headers.Add("X-Sentinel-Signature", signature);

            var response = await _httpClient.PostAsync($"{BaseUrl}/api/reports", content);

            // Handle clock skew recovery
            if ((response.StatusCode == System.Net.HttpStatusCode.Unauthorized ||
                 (int)response.StatusCode == 422) &&
                attempt == 0)
            {
                if (response.Headers.TryGetValues("X-Sentinel-Server-Time", out var serverTimeVals))
                {
                    string? sTimeStr = serverTimeVals.FirstOrDefault();
                    if (long.TryParse(sTimeStr, out long serverTime))
                    {
                        _serverClockOffsetSeconds = serverTime - DateTimeOffset.UtcNow.ToUnixTimeSeconds();
                        continue; // Re-attempt with calibrated server offset
                    }
                }
            }

            if (!response.IsSuccessStatusCode)
            {
                throw new Exception($"Upload failed with status code {response.StatusCode}");
            }

            var responseString = await response.Content.ReadAsStringAsync();
            using var doc = JsonDocument.Parse(responseString);
            var root = doc.RootElement;

            string? reportId = root.TryGetProperty("id", out var idElem) ? idElem.GetString() : null;
            string? claimToken = root.TryGetProperty("claimToken", out var cToken) ? cToken.GetString() : null;

            return (reportId != null, reportId, claimToken);
        }

        return (false, null, null);
    }

    private static async Task<(bool, string?, string?)> UploadWithRetryAsync(Func<Task<(bool, string?, string?)>> uploadAction, string rawJson)
    {
        int[] delays = { 2000, 4000, 8000 };
        for (int i = 0; i <= delays.Length; i++)
        {
            try
            {
                return await uploadAction();
            }
            catch (Exception)
            {
                if (i < delays.Length)
                {
                    await Task.Delay(delays[i]);
                }
            }
        }

        // If all retries fail, write to %APPDATA%\Sentinel\pending-report.json
        try
        {
            var appData = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
            var sentinelDir = Path.Combine(appData, "Sentinel");
            Directory.CreateDirectory(sentinelDir);
            
            var pendingFile = Path.Combine(sentinelDir, "pending-report.json");
            File.WriteAllText(pendingFile, rawJson);
        }
        catch { }

        return (false, null, null);
    }
}
