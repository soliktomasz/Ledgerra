using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Ledgerra.Domain.Ai;

namespace Ledgerra.Api.Services.Ai;

public sealed class OpenAiReportAnalysisClient : IAiReportAnalysisClient
{
    private const string DefaultBaseUrl = "https://api.openai.com/v1";
    private const string DefaultModel = "gpt-5.5";
    private readonly HttpClient _httpClient;

    public OpenAiReportAnalysisClient(HttpClient httpClient)
    {
        _httpClient = httpClient;
        _httpClient.Timeout = TimeSpan.FromSeconds(60);
    }

    public AiProvider Provider => AiProvider.OpenAi;

    public async Task<AiReportAnalysisResult> AnalyzeAsync(
        AiReportAnalysisRequest request,
        CancellationToken cancellationToken,
        IProgress<AiReportAnalysisProgress>? progress = null)
    {
        using var httpRequest = new HttpRequestMessage(HttpMethod.Post, BuildEndpoint());
        httpRequest.Headers.Authorization = new AuthenticationHeaderValue("Bearer", request.ProviderApiKey);
        httpRequest.Content = JsonContent.Create(new
        {
            model = string.IsNullOrWhiteSpace(request.Model) ? DefaultModel : request.Model.Trim(),
            input = new object[]
            {
                new { role = "system", content = "Extract reviewed transaction draft data from financial reports." },
                new { role = "user", content = AiReportSchema.BuildPrompt(request) }
            },
            text = new
            {
                format = new
                {
                    type = "json_schema",
                    name = "ledgerra_monthly_report",
                    strict = true,
                    schema = AiReportSchema.CreateJsonSchema()
                }
            }
        });

        using var response = await SendAsync(httpRequest, cancellationToken);
        if (response.StatusCode == HttpStatusCode.Unauthorized)
        {
            throw new InvalidOperationException("OpenAI rejected the saved API key.");
        }

        if (response.StatusCode == HttpStatusCode.TooManyRequests)
        {
            throw new InvalidOperationException("OpenAI rate limit exceeded. Try again later.");
        }

        if (!response.IsSuccessStatusCode)
        {
            throw new InvalidOperationException($"OpenAI analysis request failed with status {(int)response.StatusCode}.");
        }

        var json = await response.Content.ReadFromJsonAsync<JsonElement>(cancellationToken);
        var outputText = ExtractOutputText(json);

        return AiReportAnalysisParser.Parse(outputText, "OpenAI");
    }

    private async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        try
        {
            return await _httpClient.SendAsync(request, cancellationToken);
        }
        catch (TaskCanceledException exception) when (!cancellationToken.IsCancellationRequested)
        {
            throw new TimeoutException("OpenAI analysis request timed out.", exception);
        }
        catch (HttpRequestException exception)
        {
            throw new InvalidOperationException("OpenAI analysis request failed before a response was received.", exception);
        }
    }

    private static string ExtractOutputText(JsonElement json)
    {
        if (!json.TryGetProperty("output", out var output) || output.ValueKind != JsonValueKind.Array)
        {
            throw new InvalidDataException("OpenAI response did not include an output array.");
        }

        foreach (var outputItem in output.EnumerateArray())
        {
            if (!outputItem.TryGetProperty("content", out var content) || content.ValueKind != JsonValueKind.Array)
            {
                continue;
            }

            foreach (var contentItem in content.EnumerateArray())
            {
                if (!contentItem.TryGetProperty("type", out var type) ||
                    type.GetString() != "output_text" ||
                    !contentItem.TryGetProperty("text", out var text))
                {
                    continue;
                }

                var outputText = text.GetString();
                if (!string.IsNullOrWhiteSpace(outputText))
                {
                    return outputText;
                }
            }
        }

        throw new InvalidDataException("OpenAI response did not include output_text content.");
    }

    private static Uri BuildEndpoint()
    {
        return new Uri($"{DefaultBaseUrl}/responses", UriKind.Absolute);
    }
}
