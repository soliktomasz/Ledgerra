using Ledgerra.Domain.Imports;
using Ledgerra.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Ledgerra.Api.Services.Imports;

public sealed class ImportCategorizationRuleMatcher : IImportCategorizationRuleMatcher
{
    private readonly LedgerraDbContext _dbContext;

    public ImportCategorizationRuleMatcher(LedgerraDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<IReadOnlyList<ImportDraftReviewItem>> ApplyAsync(
        Guid userId,
        IReadOnlyList<ImportDraftReviewItem> drafts,
        CancellationToken cancellationToken)
    {
        var rules = await _dbContext.CategorizationRules
            .Where(rule => rule.UserId == userId && rule.IsActive)
            .OrderBy(rule => rule.Priority)
            .ThenBy(rule => rule.Name)
            .ToListAsync(cancellationToken);

        if (rules.Count == 0)
        {
            return drafts;
        }

        return drafts.Select(draft => ApplyFirstMatchingRule(draft, rules)).ToList();
    }

    private static ImportDraftReviewItem ApplyFirstMatchingRule(ImportDraftReviewItem draft, IReadOnlyList<CategorizationRule> rules)
    {
        var rule = rules.FirstOrDefault(item => Matches(draft, item));
        if (rule is null)
        {
            return draft;
        }

        return draft with
        {
            CategoryId = rule.AssignCategoryId,
            Type = rule.AssignTransactionType.ToString(),
            AppliedRuleId = rule.Id,
            AppliedRuleName = rule.Name
        };
    }

    private static bool Matches(ImportDraftReviewItem draft, CategorizationRule rule)
    {
        if (rule.MatchField != ImportRuleMatchField.Note || rule.MatchOperator != ImportRuleMatchOperator.Contains)
        {
            return false;
        }

        return !string.IsNullOrWhiteSpace(draft.Note) &&
            draft.Note.Contains(rule.MatchValue, StringComparison.OrdinalIgnoreCase);
    }
}
