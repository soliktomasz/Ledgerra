using System.Net.Http.Json;
using System.Text.Json;
using Ledgerra.Domain.Ai;

namespace Ledgerra.Api.Services.Ai;

public sealed class AnthropicReportAnalysisClient : IAiReportAnalysisClient
{
    private const string DefaultModel = "claude-sonnet-4-6";
    private readonly HttpClient _httpClient;

    public AnthropicReportAnalysisClient(HttpClient httpClient)
    {
        _httpClient = httpClient;
    }

    public AiProvider Provider => AiProvider.Anthropic;

    public async Task<AiReportAnalysisResult> AnalyzeAsync(AiReportAnalysisRequest request, CancellationToken cancellationToken)
    {
        using var httpRequest = new HttpRequestMessage(HttpMethod.Post, "https://api.anthropic.com/v1/messages");
        httpRequest.Headers.Add("x-api-key", request.ProviderApiKey);
        httpRequest.Headers.Add("anthropic-version", "2023-06-01");
        httpRequest.Content = JsonContent.Create(new
        {
            model = string.IsNullOrWhiteSpace(request.Model) ? DefaultModel : request.Model.Trim(),
            max_tokens = 4096,
            messages = new[]
            {
                new { role = "user", content = AiReportSchema.BuildPrompt(request) }
            },
            output_config = new
            {
                format = new
                {
                    type = "json_schema",
                    schema = AiReportSchema.CreateJsonSchema()
                }
            }
        });

        using var response = await _httpClient.SendAsync(httpRequest, cancellationToken);
        response.EnsureSuccessStatusCode();
        var json = await response.Content.ReadFromJsonAsync<JsonElement>(cancellationToken);
        var outputText = ExtractOutputText(json);
        if (string.IsNullOrWhiteSpace(outputText))
        {
            return new AiReportAnalysisResult([], ["Anthropic returned an empty analysis."]);
        }

        try
        {
            return JsonSerializer.Deserialize<AiReportAnalysisResult>(outputText, JsonSerializerOptions.Web)
                ?? new AiReportAnalysisResult([], ["Anthropic returned an empty analysis."]);
        }
        catch (JsonException)
        {
            return new AiReportAnalysisResult([], ["Anthropic returned an empty analysis."]);
        }
    }

    private static string? ExtractOutputText(JsonElement json)
    {
        if (!json.TryGetProperty("content", out var content) || content.ValueKind != JsonValueKind.Array)
        {
            return null;
        }

        foreach (var item in content.EnumerateArray())
        {
            if (!item.TryGetProperty("type", out var type) ||
                type.GetString() != "text" ||
                !item.TryGetProperty("text", out var text))
            {
                continue;
            }

            return text.GetString();
        }

        return null;
    }
}
