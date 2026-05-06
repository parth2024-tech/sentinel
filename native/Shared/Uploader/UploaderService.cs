using System;
using System.IO;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using Sentinel.Shared;

namespace Sentinel.Uploader;

public class UploaderService
{
    private static readonly HttpClient _httpClient = new HttpClient();
    private const string BaseUrl = "https://sentinelapp.io";

    private static readonly JsonSerializerOptions JsonOptions = new JsonSerializerOptions
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull
    };

    public static async Task<(bool success, string? reportId, string? claimToken)> UploadDirectAsync(SentinelReport report)
    {
        var payload = new { rawJson = report };
        var jsonContent = JsonSerializer.Serialize(payload, JsonOptions);

        return await UploadWithRetryAsync(async () =>
        {
            var content = new StringContent(jsonContent, Encoding.UTF8, "application/json");
            var response = await _httpClient.PostAsync($"{BaseUrl}/api/reports", content);
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
        }, jsonContent);
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
