using Ledgerra.Domain.Ai;

namespace Ledgerra.Api.Extensions;

public static class AiProviderParsingExtensions
{
    public static bool TryParseAiProvider(string? value, out AiProvider provider)
    {
        provider = AiProvider.OpenAi;

        if (string.IsNullOrWhiteSpace(value))
        {
            return false;
        }

        return Enum.TryParse(value.Replace("-", string.Empty), ignoreCase: true, out provider);
    }
}
