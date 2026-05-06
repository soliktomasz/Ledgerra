using Ledgerra.Api.Contracts;
using Ledgerra.Api.Extensions;
using Ledgerra.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Ledgerra.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/backup")]
public sealed class BackupController : ControllerBase
{
    private readonly LedgerraDbContext _dbContext;

    public BackupController(LedgerraDbContext dbContext) => _dbContext = dbContext;

    [HttpGet("export")]
    public async Task<ActionResult<BackupArchiveResponse>> Export(CancellationToken cancellationToken)
    {
        var userId = User.GetRequiredUserId();

        var accounts = await _dbContext.Accounts.Where(x => x.UserId == userId).OrderBy(x => x.Name).ToListAsync(cancellationToken);
        var categories = await _dbContext.Categories.Where(x => x.UserId == userId).OrderBy(x => x.Name).ToListAsync(cancellationToken);
        var transactions = await _dbContext.Transactions.Where(x => x.UserId == userId).OrderBy(x => x.OccurredOnUtc).ToListAsync(cancellationToken);
        var budgetPeriods = await _dbContext.BudgetPeriods
            .Where(x => x.UserId == userId)
            .Include(x => x.CategoryLimits)
            .OrderBy(x => x.Year)
            .ThenBy(x => x.Month)
            .ToListAsync(cancellationToken);

        return Ok(new BackupArchiveResponse(
            1,
            DateTimeOffset.UtcNow.ToString("O"),
            accounts.Select(x => new BackupAccountResponse(x.Id, x.Name, x.Type.ToString(), x.CurrencyCode, x.OpeningBalance, x.IsActive)).ToList(),
            categories.Select(x => new BackupCategoryResponse(x.Id, x.Name, x.Kind.ToString(), x.Color)).ToList(),
            transactions.Select(x => new BackupTransactionResponse(x.Id, x.AccountId, x.CategoryId, x.Amount, x.Type.ToString(), x.OccurredOnUtc.ToString("O"), x.Note, x.TransferGroupId)).ToList(),
            budgetPeriods.Select(x => new BackupBudgetPeriodResponse(
                x.Id,
                x.Year,
                x.Month,
                x.CategoryLimits.Select(limit => new BackupBudgetCategoryLimitResponse(limit.Id, limit.CategoryId, limit.PlannedAmount)).ToList())).ToList()));
    }

    [HttpPost("restore")]
    public async Task<ActionResult> Restore([FromBody] BackupArchiveResponse archive, CancellationToken cancellationToken)
    {
        var userId = User.GetRequiredUserId();

        await using var tx = await _dbContext.Database.BeginTransactionAsync(cancellationToken);
        _dbContext.BudgetCategoryLimits.RemoveRange(_dbContext.BudgetCategoryLimits.Where(x => x.BudgetPeriod.UserId == userId));
        _dbContext.BudgetPeriods.RemoveRange(_dbContext.BudgetPeriods.Where(x => x.UserId == userId));
        _dbContext.Transactions.RemoveRange(_dbContext.Transactions.Where(x => x.UserId == userId));
        _dbContext.Categories.RemoveRange(_dbContext.Categories.Where(x => x.UserId == userId));
        _dbContext.Accounts.RemoveRange(_dbContext.Accounts.Where(x => x.UserId == userId));
        await _dbContext.SaveChangesAsync(cancellationToken);

        var accounts = archive.Accounts.Select(x => new Ledgerra.Domain.Accounts.Account
        {
            Id = x.Id,
            UserId = userId,
            Name = x.Name,
            Type = Enum.Parse<Ledgerra.Domain.Accounts.AccountType>(x.Type),
            CurrencyCode = x.CurrencyCode,
            OpeningBalance = x.OpeningBalance,
            IsActive = x.IsActive
        }).ToList();
        var categories = archive.Categories.Select(x => new Ledgerra.Domain.Categories.Category
        {
            Id = x.Id,
            UserId = userId,
            Name = x.Name,
            Kind = Enum.Parse<Ledgerra.Domain.Categories.CategoryKind>(x.Kind),
            Color = x.Color
        }).ToList();
        var transactions = archive.Transactions.Select(x => new Ledgerra.Domain.Transactions.Transaction
        {
            Id = x.Id,
            UserId = userId,
            AccountId = x.AccountId,
            CategoryId = x.CategoryId,
            Amount = x.Amount,
            Type = Enum.Parse<Ledgerra.Domain.Transactions.TransactionType>(x.Type),
            OccurredOnUtc = DateTime.Parse(x.OccurredOnUtc),
            Note = x.Note,
            TransferGroupId = x.TransferGroupId
        }).ToList();
        var periods = archive.BudgetPeriods.Select(x => new Ledgerra.Domain.Budgets.BudgetPeriod
        {
            Id = x.Id,
            UserId = userId,
            Year = x.Year,
            Month = x.Month
        }).ToList();
        var limits = archive.BudgetPeriods.SelectMany(x => x.CategoryLimits.Select(limit => new Ledgerra.Domain.Budgets.BudgetCategoryLimit
        {
            Id = limit.Id,
            BudgetPeriodId = x.Id,
            CategoryId = limit.CategoryId,
            PlannedAmount = limit.PlannedAmount
        })).ToList();

        await _dbContext.Accounts.AddRangeAsync(accounts, cancellationToken);
        await _dbContext.Categories.AddRangeAsync(categories, cancellationToken);
        await _dbContext.Transactions.AddRangeAsync(transactions, cancellationToken);
        await _dbContext.BudgetPeriods.AddRangeAsync(periods, cancellationToken);
        await _dbContext.BudgetCategoryLimits.AddRangeAsync(limits, cancellationToken);
        await _dbContext.SaveChangesAsync(cancellationToken);
        await tx.CommitAsync(cancellationToken);

        return NoContent();
    }
}
