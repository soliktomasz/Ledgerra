using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Ledgerra.Domain.Ai;

namespace Ledgerra.Api.Services.Ai;

public sealed class OpenAiCompatibleReportAnalysisClient : IAiReportAnalysisClient
{
    private readonly HttpClient _httpClient;

    public OpenAiCompatibleReportAnalysisClient(HttpClient httpClient)
    {
        _httpClient = httpClient;
        _httpClient.Timeout = Timeout.InfiniteTimeSpan;
    }

    public AiProvider Provider => AiProvider.OpenAiCompatible;

    public async Task<AiReportAnalysisResult> AnalyzeAsync(
        AiReportAnalysisRequest request,
        CancellationToken cancellationToken,
        IProgress<AiReportAnalysisProgress>? progress = null)
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
            stream = true,
            stream_options = new
            {
                include_usage = true
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
            var providerMessage = await ExtractErrorMessageAsync(response, cancellationToken);
            throw new InvalidOperationException(providerMessage is null
                ? $"OpenAI-compatible analysis request failed with status {(int)response.StatusCode}."
                : $"OpenAI-compatible analysis request failed with status {(int)response.StatusCode}: {providerMessage}");
        }

        var streamed = await ReadStreamingOutputAsync(response, progress, cancellationToken);

        return AiReportAnalysisParser.Parse(streamed.OutputText, "OpenAI-compatible provider", streamed.Usage);
    }

    private async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        try
        {
            return await _httpClient.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, cancellationToken);
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

    private static async Task<StreamingOutput> ReadStreamingOutputAsync(
        HttpResponseMessage response,
        IProgress<AiReportAnalysisProgress>? progress,
        CancellationToken cancellationToken)
    {
        var output = new StringBuilder();
        AiTokenUsage? usage = null;

        await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
        using var reader = new StreamReader(stream);

        while (await reader.ReadLineAsync(cancellationToken) is { } line)
        {
            if (string.IsNullOrWhiteSpace(line) || !line.StartsWith("data:", StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            var payload = line["data:".Length..].Trim();
            if (payload == "[DONE]")
            {
                break;
            }

            using var chunk = JsonDocument.Parse(payload);
            usage = ExtractUsage(chunk.RootElement) ?? usage;

            var contentDelta = ExtractDelta(chunk.RootElement, "content");
            if (!string.IsNullOrEmpty(contentDelta))
            {
                output.Append(contentDelta);
                progress?.Report(new AiReportAnalysisProgress("AI provider is streaming JSON output.", output.Length, usage));
            }

            var reasoningDelta = ExtractDelta(chunk.RootElement, "reasoning_content");
            if (!string.IsNullOrEmpty(reasoningDelta))
            {
                progress?.Report(new AiReportAnalysisProgress("AI provider is reasoning.", output.Length, usage));
            }

            if (usage is not null)
            {
                progress?.Report(new AiReportAnalysisProgress("AI provider reported token usage.", output.Length, usage));
            }
        }

        var outputText = output.ToString();
        if (string.IsNullOrWhiteSpace(outputText))
        {
            throw new InvalidDataException("OpenAI-compatible response did not include streamed message content.");
        }

        return new StreamingOutput(outputText, usage);
    }

    private static string? ExtractDelta(JsonElement json, string propertyName)
    {
        if (!json.TryGetProperty("choices", out var choices) || choices.ValueKind != JsonValueKind.Array)
        {
            return null;
        }

        foreach (var choice in choices.EnumerateArray())
        {
            if (choice.TryGetProperty("delta", out var delta) &&
                delta.TryGetProperty(propertyName, out var property) &&
                property.ValueKind == JsonValueKind.String)
            {
                return property.GetString();
            }
        }

        return null;
    }

    private static AiTokenUsage? ExtractUsage(JsonElement json)
    {
        if (!json.TryGetProperty("usage", out var usage) || usage.ValueKind is JsonValueKind.Null or JsonValueKind.Undefined)
        {
            return null;
        }

        return new AiTokenUsage(
            ReadInt(usage, "prompt_tokens"),
            ReadInt(usage, "completion_tokens"),
            ReadInt(usage, "total_tokens"));
    }

    private static int ReadInt(JsonElement json, string propertyName)
    {
        return json.TryGetProperty(propertyName, out var value) && value.TryGetInt32(out var parsed) ? parsed : 0;
    }

    private static async Task<string?> ExtractErrorMessageAsync(HttpResponseMessage response, CancellationToken cancellationToken)
    {
        try
        {
            var json = await response.Content.ReadFromJsonAsync<JsonElement>(cancellationToken);
            if (json.TryGetProperty("error", out var error) &&
                error.TryGetProperty("message", out var message))
            {
                return message.GetString();
            }
        }
        catch (JsonException)
        {
        }

        return null;
    }

    private sealed record StreamingOutput(string OutputText, AiTokenUsage? Usage);
}
