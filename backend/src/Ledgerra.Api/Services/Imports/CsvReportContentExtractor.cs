using System.Text;

namespace Ledgerra.Api.Services.Imports;

public sealed class CsvReportContentExtractor
{
    public async Task<ExtractedReport> ExtractAsync(IFormFile file, CancellationToken cancellationToken)
    {
        await using var stream = file.OpenReadStream();
        using var reader = new StreamReader(stream, Encoding.UTF8, detectEncodingFromByteOrderMarks: true);
        var content = await reader.ReadToEndAsync(cancellationToken);
        var rows = ParseCsv(content);
        var normalized = string.Join(Environment.NewLine, rows.Select(row => string.Join(" | ", row.Select(cell => cell.Trim()))));
        if (rows.Count == 0 || string.IsNullOrWhiteSpace(normalized))
        {
            throw new InvalidOperationException("CSV report did not contain any readable rows.");
        }

        return new ExtractedReport(file.FileName, "text/csv", normalized);
    }

    private static IReadOnlyList<IReadOnlyList<string>> ParseCsv(string content)
    {
        var rows = new List<IReadOnlyList<string>>();
        var row = new List<string>();
        var cell = new StringBuilder();
        var inQuotes = false;

        for (var index = 0; index < content.Length; index++)
        {
            var current = content[index];
            if (current == '"')
            {
                if (inQuotes && index + 1 < content.Length && content[index + 1] == '"')
                {
                    cell.Append('"');
                    index++;
                    continue;
                }

                inQuotes = !inQuotes;
                continue;
            }

            if (current == ',' && !inQuotes)
            {
                row.Add(cell.ToString());
                cell.Clear();
                continue;
            }

            if ((current == '\r' || current == '\n') && !inQuotes)
            {
                if (current == '\r' && index + 1 < content.Length && content[index + 1] == '\n')
                {
                    index++;
                }

                row.Add(cell.ToString());
                cell.Clear();
                rows.Add(row);
                row = [];
                continue;
            }

            cell.Append(current);
        }

        if (cell.Length > 0 || row.Count > 0)
        {
            row.Add(cell.ToString());
            rows.Add(row);
        }

        return rows.Where(item => item.Any(cellValue => !string.IsNullOrWhiteSpace(cellValue))).ToList();
    }
}
