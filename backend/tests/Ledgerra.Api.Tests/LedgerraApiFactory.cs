using Ledgerra.Api.Services.Ai;
using Ledgerra.Api.Tests.Fakes;
using Ledgerra.Domain.Ai;
using Ledgerra.Infrastructure.Persistence;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Ledgerra.Api.Tests;

public sealed class LedgerraApiFactory : WebApplicationFactory<Program>
{
    private readonly string _databaseName = $"ledgerra-tests-{Guid.NewGuid():N}";

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");

        builder.ConfigureServices(services =>
        {
            var descriptor = services.SingleOrDefault(service => service.ServiceType == typeof(DbContextOptions<LedgerraDbContext>));
            if (descriptor is not null)
            {
                services.Remove(descriptor);
            }

            foreach (var aiClientDescriptor in services.Where(service => service.ServiceType == typeof(IAiReportAnalysisClient)).ToList())
            {
                services.Remove(aiClientDescriptor);
            }

            services.AddDbContext<LedgerraDbContext>(options =>
            {
                options.UseInMemoryDatabase(_databaseName);
            });

            services.AddScoped<IAiReportAnalysisClient>(_ => new FakeAiReportAnalysisClient(AiProvider.OpenAi));
            services.AddScoped<IAiReportAnalysisClient>(_ => new FakeAiReportAnalysisClient(AiProvider.Anthropic));
            services.AddScoped<IAiReportAnalysisClient>(_ => new FakeAiReportAnalysisClient(AiProvider.OpenAiCompatible));
        });
    }
}
