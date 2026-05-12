using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Ledgerra.Domain.Ai;

namespace Ledgerra.Api.Services.Ai;

public sealed class OpenAiCompatibleReportAnalysisClient : IAiReportAnalysisClient
{
    private readonly HttpClient _httpClient;

    public OpenAiCompatibleReportAnalysisClient(HttpClient httpClient)
    {
        _httpClient = httpClient;
        _httpClient.Timeout = TimeSpan.FromSeconds(60);
    }

    public AiProvider Provider => AiProvider.OpenAiCompatible;

    public async Task<AiReportAnalysisResult> AnalyzeAsync(AiReportAnalysisRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.ProviderBaseUrl))
        {
            throw new InvalidOperationException("OpenAI-compatible provider requires a base URL.");
        }

        if (string.IsNullOrWhiteSpace(request.Model))
        {
            throw new InvalidOperationException("OpenAI-compatible provider requires a selected model.");
        }

        var endpoint = BuildEndpoint(request.ProviderBaseUrl);
        if (await EndpointValidator.ResolvesToBlockedAddressAsync(endpoint))
        {
            throw new InvalidOperationException("OpenAI-compatible base URL resolves to a blocked address.");
        }

        using var httpRequest = new HttpRequestMessage(HttpMethod.Post, endpoint);
        httpRequest.Headers.Authorization = new AuthenticationHeaderValue("Bearer", request.ProviderApiKey);
        httpRequest.Content = JsonContent.Create(new
        {
            model = request.Model.Trim(),
            messages = new object[]
            {
                new { role = "system", content = "Extract reviewed transaction draft data from financial reports." },
                new { role = "user", content = AiReportSchema.BuildPrompt(request) }
            },
            response_format = new
            {
                type = "json_schema",
                json_schema = new
                {
                    name = "ledgerra_monthly_report",
                    strict = true,
                    schema = AiReportSchema.CreateJsonSchema()
                }
            }
        });

        using var response = await SendAsync(httpRequest, cancellationToken);
        if (response.StatusCode == HttpStatusCode.Unauthorized)
        {
            throw new InvalidOperationException("OpenAI-compatible provider rejected the saved API key.");
        }

        if (response.StatusCode == HttpStatusCode.TooManyRequests)
        {
            throw new InvalidOperationException("OpenAI-compatible provider rate limit exceeded. Try again later.");
        }

        if (!response.IsSuccessStatusCode)
        {
            throw new InvalidOperationException($"OpenAI-compatible analysis request failed with status {(int)response.StatusCode}.");
        }

        var json = await response.Content.ReadFromJsonAsync<JsonElement>(cancellationToken);
        var outputText = ExtractOutputText(json);

        try
        {
            return JsonSerializer.Deserialize<AiReportAnalysisResult>(outputText, JsonSerializerOptions.Web)
                ?? new AiReportAnalysisResult([], ["OpenAI-compatible provider returned an empty analysis."]);
        }
        catch (JsonException exception)
        {
            throw new InvalidDataException("OpenAI-compatible provider returned analysis JSON that could not be parsed.", exception);
        }
    }

    private async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        try
        {
            return await _httpClient.SendAsync(request, cancellationToken);
        }
        catch (TaskCanceledException exception) when (!cancellationToken.IsCancellationRequested)
        {
            throw new TimeoutException("OpenAI-compatible analysis request timed out.", exception);
        }
        catch (HttpRequestException exception)
        {
            throw new InvalidOperationException("OpenAI-compatible analysis request failed before a response was received.", exception);
        }
    }

    private static Uri BuildEndpoint(string baseUrl)
    {
        return new Uri($"{baseUrl.Trim().TrimEnd('/')}/chat/completions", UriKind.Absolute);
    }

    private static string ExtractOutputText(JsonElement json)
    {
        if (!json.TryGetProperty("choices", out var choices) || choices.ValueKind != JsonValueKind.Array)
        {
            throw new InvalidDataException("OpenAI-compatible response did not include choices.");
        }

        foreach (var choice in choices.EnumerateArray())
        {
            if (!choice.TryGetProperty("message", out var message) ||
                !message.TryGetProperty("content", out var content))
            {
                continue;
            }

            var outputText = content.GetString();
            if (!string.IsNullOrWhiteSpace(outputText))
            {
                return outputText;
            }
        }

        throw new InvalidDataException("OpenAI-compatible response did not include message content.");
    }
}
