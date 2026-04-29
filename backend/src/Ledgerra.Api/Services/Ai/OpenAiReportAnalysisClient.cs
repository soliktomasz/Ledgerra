using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Ledgerra.Domain.Ai;

namespace Ledgerra.Api.Services.Ai;

public sealed class OpenAiReportAnalysisClient : IAiReportAnalysisClient
{
    private readonly HttpClient _httpClient;

    public OpenAiReportAnalysisClient(HttpClient httpClient)
    {
        _httpClient = httpClient;
    }

    public AiProvider Provider => AiProvider.OpenAi;

    public async Task<AiReportAnalysisResult> AnalyzeAsync(AiReportAnalysisRequest request, CancellationToken cancellationToken)
    {
        using var httpRequest = new HttpRequestMessage(HttpMethod.Post, "https://api.openai.com/v1/responses");
        httpRequest.Headers.Authorization = new AuthenticationHeaderValue("Bearer", request.ProviderApiKey);
        httpRequest.Content = JsonContent.Create(new
        {
            model = "gpt-5.5",
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

        using var response = await _httpClient.SendAsync(httpRequest, cancellationToken);
        response.EnsureSuccessStatusCode();
        var json = await response.Content.ReadFromJsonAsync<JsonElement>(cancellationToken);
        var outputText = json.GetProperty("output")
            .EnumerateArray()
            .SelectMany(item => item.GetProperty("content").EnumerateArray())
            .First(item => item.GetProperty("type").GetString() == "output_text")
            .GetProperty("text")
            .GetString();

        return JsonSerializer.Deserialize<AiReportAnalysisResult>(outputText!, JsonSerializerOptions.Web)
            ?? new AiReportAnalysisResult([], ["OpenAI returned an empty analysis."]);
    }
}
