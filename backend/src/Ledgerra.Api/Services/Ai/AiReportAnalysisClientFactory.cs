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
        return _clients.Single(client => client.Provider == provider);
    }
}
