using System.Text;
using UglyToad.PdfPig;

namespace Ledgerra.Api.Services.Imports;

public sealed class PdfReportContentExtractor
{
    public async Task<ExtractedReport> ExtractAsync(IFormFile file, CancellationToken cancellationToken)
    {
        await using var stream = file.OpenReadStream();
        using var memory = new MemoryStream();
        await stream.CopyToAsync(memory, cancellationToken);
        using var document = PdfDocument.Open(memory.ToArray());
        var builder = new StringBuilder();

        foreach (var page in document.GetPages())
        {
            builder.AppendLine(page.Text);
        }

        var text = builder.ToString().Trim();
        if (text.Length == 0)
        {
            throw new InvalidOperationException("The PDF did not contain readable text.");
        }

        return new ExtractedReport(file.FileName, "application/pdf", text);
    }
}
