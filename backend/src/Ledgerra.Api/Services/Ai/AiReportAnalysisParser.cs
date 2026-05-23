using System.Text.Json;

namespace Ledgerra.Api.Services.Ai;

public static class AiReportAnalysisParser
{
    public static AiReportAnalysisResult Parse(string outputText, string providerName, AiTokenUsage? usage = null)
    {
        try
        {
            var result = JsonSerializer.Deserialize<AiReportAnalysisResult>(ExtractJsonObject(outputText), JsonSerializerOptions.Web)
                ?? new AiReportAnalysisResult([], [$"{providerName} returned an empty analysis."]);
            return result with { Usage = usage ?? result.Usage };
        }
        catch (JsonException exception)
        {
            throw new AiReportAnalysisParseException($"{providerName} returned analysis JSON that could not be parsed.", outputText, usage, exception);
        }
    }

    private static string ExtractJsonObject(string outputText)
    {
        var trimmed = outputText.Trim();
        if (IsExpectedAnalysisJsonObject(trimmed))
        {
            return trimmed;
        }

        var unfenced = RemoveMarkdownFence(trimmed);
        if (IsExpectedAnalysisJsonObject(unfenced))
        {
            return unfenced;
        }

        for (var start = 0; start < trimmed.Length; start++)
        {
            if (trimmed[start] != '{')
            {
                continue;
            }

            var candidate = TryReadBalancedJsonObject(trimmed, start);
            if (candidate is not null && IsExpectedAnalysisJsonObject(candidate))
            {
                return candidate;
            }
        }

        return trimmed;
    }

    private static string RemoveMarkdownFence(string text)
    {
        if (!text.StartsWith("```", StringComparison.Ordinal))
        {
            return text;
        }

        var firstLineEnd = text.IndexOf('\n');
        var closingFence = text.LastIndexOf("```", StringComparison.Ordinal);
        if (firstLineEnd < 0 || closingFence <= firstLineEnd)
        {
            return text;
        }

        return text[(firstLineEnd + 1)..closingFence].Trim();
    }

    private static string? TryReadBalancedJsonObject(string text, int start)
    {
        var depth = 0;
        var inString = false;
        var isEscaped = false;

        for (var index = start; index < text.Length; index++)
        {
            var current = text[index];
            if (inString)
            {
                if (isEscaped)
                {
                    isEscaped = false;
                }
                else if (current == '\\')
                {
                    isEscaped = true;
                }
                else if (current == '"')
                {
                    inString = false;
                }

                continue;
            }

            if (current == '"')
            {
                inString = true;
                continue;
            }

            if (current == '{')
            {
                depth++;
            }
            else if (current == '}')
            {
                depth--;
                if (depth == 0)
                {
                    return text[start..(index + 1)];
                }
            }
        }

        return null;
    }

    private static bool IsExpectedAnalysisJsonObject(string text)
    {
        try
        {
            using var document = JsonDocument.Parse(text);
            return document.RootElement.ValueKind == JsonValueKind.Object &&
                document.RootElement.TryGetProperty("transactions", out _) &&
                document.RootElement.TryGetProperty("warnings", out _);
        }
        catch (JsonException)
        {
            return false;
        }
    }
}
