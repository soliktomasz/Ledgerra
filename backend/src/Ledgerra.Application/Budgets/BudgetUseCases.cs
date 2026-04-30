using Ledgerra.Domain.Budgets;

namespace Ledgerra.Application.Budgets;

public sealed record GetBudgetSummaryQuery(Guid UserId, int Year, int Month);

public sealed record UpdateBudgetCommand(Guid UserId, int Year, int Month, IReadOnlyList<BudgetCategoryLimitInput> CategoryLimits);

public sealed record BudgetCategoryLimitInput(Guid CategoryId, decimal PlannedAmount);

public interface IBudgetSummaryStore
{
    Task<BudgetSummary> GetSummaryAsync(Guid userId, int year, int month, CancellationToken cancellationToken);

    Task<bool> CategoriesExistAsync(Guid userId, IReadOnlyCollection<Guid> categoryIds, CancellationToken cancellationToken);

    Task<BudgetSummary> UpdateAsync(Guid userId, int year, int month, IReadOnlyList<BudgetCategoryLimitInput> categoryLimits, CancellationToken cancellationToken);
}

public sealed class GetBudgetSummaryQueryHandler
{
    private readonly IBudgetSummaryStore _budgetSummaryStore;

    public GetBudgetSummaryQueryHandler(IBudgetSummaryStore budgetSummaryStore)
    {
        _budgetSummaryStore = budgetSummaryStore;
    }

    public Task<BudgetSummary> HandleAsync(GetBudgetSummaryQuery query, CancellationToken cancellationToken)
    {
        return _budgetSummaryStore.GetSummaryAsync(query.UserId, query.Year, query.Month, cancellationToken);
    }
}

public sealed class UpdateBudgetCommandHandler
{
    private readonly IBudgetSummaryStore _budgetSummaryStore;

    public UpdateBudgetCommandHandler(IBudgetSummaryStore budgetSummaryStore)
    {
        _budgetSummaryStore = budgetSummaryStore;
    }

    public async Task<UpdateBudgetResult> HandleAsync(UpdateBudgetCommand command, CancellationToken cancellationToken)
    {
        var categoryIds = command.CategoryLimits.Select(item => item.CategoryId).ToArray();
        var categoriesExist = await _budgetSummaryStore.CategoriesExistAsync(command.UserId, categoryIds, cancellationToken);
        if (!categoriesExist)
        {
            return UpdateBudgetResult.WithValidationError("One or more categories could not be found for this user.");
        }

        var summary = await _budgetSummaryStore.UpdateAsync(
            command.UserId,
            command.Year,
            command.Month,
            command.CategoryLimits,
            cancellationToken);

        return UpdateBudgetResult.Success(summary);
    }
}

public sealed class UpdateBudgetResult
{
    private UpdateBudgetResult(BudgetSummary? summary, string? validationError)
    {
        Summary = summary;
        ValidationError = validationError;
    }

    public BudgetSummary? Summary { get; }

    public string? ValidationError { get; }

    public bool HasValidationError => ValidationError is not null;

    public static UpdateBudgetResult Success(BudgetSummary summary) => new(summary, null);

    public static UpdateBudgetResult WithValidationError(string error) => new(null, error);
}