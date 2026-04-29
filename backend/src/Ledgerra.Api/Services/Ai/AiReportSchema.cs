using System.Text.Json;

namespace Ledgerra.Api.Services.Ai;

public static class AiReportSchema
{
    public static JsonElement CreateJsonSchema()
    {
        const string schema = """
        {
          "type": "object",
          "additionalProperties": false,
          "required": ["transactions", "warnings"],
          "properties": {
            "transactions": {
              "type": "array",
              "items": {
                "type": "object",
                "additionalProperties": false,
                "required": ["sourceId", "accountId", "categoryId", "amount", "type", "occurredOnUtc", "note", "confidence", "warnings"],
                "properties": {
                  "sourceId": { "type": "string" },
                  "accountId": { "type": "string" },
                  "categoryId": { "type": ["string", "null"] },
                  "amount": { "type": "number" },
                  "type": { "type": "string", "enum": ["Income", "Expense"] },
                  "occurredOnUtc": { "type": "string" },
                  "note": { "type": ["string", "null"] },
                  "confidence": { "type": "number" },
                  "warnings": { "type": "array", "items": { "type": "string" } }
                }
              }
            },
            "warnings": { "type": "array", "items": { "type": "string" } }
          }
        }
        """;

        return JsonSerializer.Deserialize<JsonElement>(schema);
    }

    public static string BuildPrompt(AiReportAnalysisRequest request)
    {
        return $"""
        You are parsing a financial account monthly report for Ledgerra.
        Return JSON only, matching the provided schema.
        Month: {request.Month}
        Accounts: {JsonSerializer.Serialize(request.Accounts)}
        Categories: {JsonSerializer.Serialize(request.Categories)}
        Rules:
        - Use only accountId and categoryId values from the supplied context.
        - Amounts must be positive numbers.
        - Spending is Expense. Deposits are Income.
        - Use UTC ISO-8601 dates.
        - Put uncertain mapping notes into row warnings.

        Report:
        {request.ReportContent}
        """;
    }
}
