using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Ledgerra.Api.Services.Ai;

namespace Ledgerra.Api.Tests;

public sealed class OpenAiCompatibleReportAnalysisClientTests
{
    [Fact]
    public void Constructor_AllowsSlowProviderAnalysis()
    {
        using var handler = new CaptureRequestHandler();
        using var httpClient = new HttpClient(handler);

        _ = new OpenAiCompatibleReportAnalysisClient(httpClient);

        Assert.Equal(Timeout.InfiniteTimeSpan, httpClient.Timeout);
    }

    [Fact]
    public async Task AnalyzeAsync_DoesNotSendProviderSpecificResponseFormat()
    {
        using var handler = new CaptureRequestHandler();
        using var httpClient = new HttpClient(handler);
        var client = new OpenAiCompatibleReportAnalysisClient(httpClient);

        await client.AnalyzeAsync(new AiReportAnalysisRequest(
            "test-key",
            "https://93.184.216.34/v1",
            "deepseek-chat",
            "Date,Description,Amount\n2026-05-01,Coffee,-4.50",
            "2026-05",
            [new AiAccountContext(Guid.NewGuid(), "Checking", "USD")],
            []), CancellationToken.None);

        Assert.NotNull(handler.RequestBody);
        using var body = JsonDocument.Parse(handler.RequestBody);
        Assert.False(body.RootElement.TryGetProperty("response_format", out _));
        Assert.True(body.RootElement.GetProperty("stream").GetBoolean());
        Assert.True(body.RootElement.GetProperty("stream_options").GetProperty("include_usage").GetBoolean());
        Assert.Equal("deepseek-chat", body.RootElement.GetProperty("model").GetString());
    }

    [Fact]
    public async Task AnalyzeAsync_ReadsStreamingProgressAndUsage()
    {
        using var handler = new CaptureRequestHandler();
        using var httpClient = new HttpClient(handler);
        var client = new OpenAiCompatibleReportAnalysisClient(httpClient);
        var progress = new List<AiReportAnalysisProgress>();

        var result = await client.AnalyzeAsync(new AiReportAnalysisRequest(
            "test-key",
            "https://93.184.216.34/v1",
            "deepseek-chat",
            "Date,Description,Amount\n2026-05-01,Coffee,-4.50",
            "2026-05",
            [new AiAccountContext(Guid.NewGuid(), "Checking", "USD")],
            []), CancellationToken.None, new ImmediateProgress(progress.Add));

        Assert.Empty(result.Transactions);
        Assert.NotNull(result.Usage);
        Assert.Equal(20, result.Usage.TotalTokens);
        Assert.Contains(progress, item => item.GeneratedOutputCharacters > 0);
        Assert.Contains(progress, item => item.Usage?.TotalTokens == 20);
    }

    [Theory]
    [InlineData("```json\n{\"transactions\":[],\"warnings\":[]}\n```")]
    [InlineData("Here is the JSON:\n{\"transactions\":[],\"warnings\":[]}")]
    [InlineData("[{\"transactions\":[],\"warnings\":[]}]")]
    public async Task AnalyzeAsync_ParsesJsonObjectFromCommonModelWrappers(string streamedOutput)
    {
        using var handler = new CaptureRequestHandler(streamedOutput);
        using var httpClient = new HttpClient(handler);
        var client = new OpenAiCompatibleReportAnalysisClient(httpClient);

        var result = await client.AnalyzeAsync(new AiReportAnalysisRequest(
            "test-key",
            "https://93.184.216.34/v1",
            "deepseek-chat",
            "Date,Description,Amount\n2026-05-01,Coffee,-4.50",
            "2026-05",
            [new AiAccountContext(Guid.NewGuid(), "Checking", "USD")],
            []), CancellationToken.None);

        Assert.Empty(result.Transactions);
        Assert.Empty(result.Warnings);
    }

    private sealed class CaptureRequestHandler : HttpMessageHandler
    {
        private readonly string? _streamedOutput;

        public CaptureRequestHandler(string? streamedOutput = null)
        {
            _streamedOutput = streamedOutput;
        }

        public string? RequestBody { get; private set; }

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            RequestBody = request.Content is null
                ? null
                : await request.Content.ReadAsStringAsync(cancellationToken);

            return new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(BuildStream(_streamedOutput ?? "{\"transactions\":[],\"warnings\":[]}"))
            };
        }

        private static string BuildStream(string output)
        {
            return $"""
                data: {JsonSerializer.Serialize(new { choices = new[] { new { delta = new { content = output } } }, usage = (object?)null })}
                data: {JsonSerializer.Serialize(new { choices = Array.Empty<object>(), usage = new { prompt_tokens = 12, completion_tokens = 8, total_tokens = 20 } })}
                data: [DONE]

                """;
        }
    }

    private sealed class ImmediateProgress : IProgress<AiReportAnalysisProgress>
    {
        private readonly Action<AiReportAnalysisProgress> _handler;

        public ImmediateProgress(Action<AiReportAnalysisProgress> handler)
        {
            _handler = handler;
        }

        public void Report(AiReportAnalysisProgress value)
        {
            _handler(value);
        }
    }
}
