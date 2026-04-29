using Ledgerra.Domain.Ai;

namespace Ledgerra.Api.Services.Ai;

public sealed class AiReportAnalysisClientFactory
{
    private readonly IEnumerable<IAiReportAnalysisClient> _clients;

    public AiReportAnalysisClientFactory(IEnumerable<IAiReportAnalysisClient> clients)
    {
        _clients = clients;
    }

    public IAiReportAnalysisClient GetClient(AiProvider provider)
    {
        return _clients.SingleOrDefault(client => client.Provider == provider)
            ?? throw new InvalidOperationException($"No AI report analysis client registered for provider '{provider}'.");
    }
}
