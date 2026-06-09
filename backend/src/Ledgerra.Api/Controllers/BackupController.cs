using System.Globalization;
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

        var savingsGoals = await _dbContext.SavingsGoals.Where(x => x.UserId == userId).OrderBy(x => x.CreatedAtUtc).ToListAsync(cancellationToken);

        return Ok(new BackupArchiveResponse(
            3,
            DateTimeOffset.UtcNow.ToString("O"),
            accounts.Select(x => new BackupAccountResponse(x.Id, x.Name, x.Type.ToString(), x.CurrencyCode, x.OpeningBalance, x.IsActive, x.InstitutionName, x.AccountNumberMasked, x.IconKind.ToString(), x.ExcludeFromBudget, x.ExcludeFromNetWorth)).ToList(),
            categories.Select(x => new BackupCategoryResponse(x.Id, x.Name, x.Kind.ToString(), x.Color)).ToList(),
            transactions.Select(x => new BackupTransactionResponse(x.Id, x.AccountId, x.CategoryId, x.Amount, x.Type.ToString(), x.OccurredOnUtc.ToString("O"), x.Note, x.TransferGroupId, x.SplitGroupId, x.ParentTransactionId, x.SavingsGoalId)).ToList(),
            budgetPeriods.Select(x => new BackupBudgetPeriodResponse(
                x.Id,
                x.Year,
                x.Month,
                x.CategoryLimits.Select(limit => new BackupBudgetCategoryLimitResponse(limit.Id, limit.CategoryId, limit.PlannedAmount, limit.CarryOverUnspent)).ToList())).ToList(),
            savingsGoals.Select(x => new BackupSavingsGoalResponse(x.Id, x.Name, x.TargetAmount, x.DeadlineUtc?.ToString("O"), x.CreatedAtUtc.ToString("O"), x.UpdatedAtUtc.ToString("O"))).ToList()));
    }

    [HttpPost("restore")]
    public async Task<ActionResult> Restore([FromBody] BackupArchiveResponse archive, CancellationToken cancellationToken)
    {
        var userId = User.GetRequiredUserId();

        if (archive.Version is < 2 or > 3)
        {
            return BadRequest(new ProblemDetails { Title = "Unsupported backup archive version." });
        }

        var referenceError = ValidateArchiveReferences(archive);
        if (referenceError is not null)
        {
            return BadRequest(new ProblemDetails { Title = referenceError });
        }

        var shapeError = ValidateArchiveShape(archive);
        if (shapeError is not null)
        {
            return BadRequest(new ProblemDetails { Title = shapeError });
        }

        await using var tx = await _dbContext.Database.BeginTransactionAsync(cancellationToken);
        var budgetPeriodIds = _dbContext.BudgetPeriods.Where(x => x.UserId == userId).Select(x => x.Id);
        _dbContext.BudgetCategoryLimits.RemoveRange(_dbContext.BudgetCategoryLimits.Where(x => budgetPeriodIds.Contains(x.BudgetPeriodId)));
        _dbContext.BudgetPeriods.RemoveRange(_dbContext.BudgetPeriods.Where(x => x.UserId == userId));
        _dbContext.Transactions.RemoveRange(_dbContext.Transactions.Where(x => x.UserId == userId));
        _dbContext.Categories.RemoveRange(_dbContext.Categories.Where(x => x.UserId == userId));
        _dbContext.Accounts.RemoveRange(_dbContext.Accounts.Where(x => x.UserId == userId));
        _dbContext.SavingsGoals.RemoveRange(_dbContext.SavingsGoals.Where(x => x.UserId == userId));
        await _dbContext.SaveChangesAsync(cancellationToken);

        var accounts = archive.Accounts.Select(x => new Ledgerra.Domain.Accounts.Account
        {
            Id = x.Id,
            UserId = userId,
            Name = x.Name,
            Type = Enum.Parse<Ledgerra.Domain.Accounts.AccountType>(x.Type, ignoreCase: true),
            CurrencyCode = x.CurrencyCode,
            OpeningBalance = x.OpeningBalance,
            IsActive = x.IsActive,
            ExcludeFromBudget = x.ExcludeFromBudget,
            ExcludeFromNetWorth = x.ExcludeFromNetWorth,
            InstitutionName = x.InstitutionName,
            AccountNumberMasked = x.AccountNumberMasked,
            IconKind = Enum.Parse<Ledgerra.Domain.Accounts.AccountIconKind>(x.IconKind, ignoreCase: true)
        }).ToList();
        var categories = archive.Categories.Select(x => new Ledgerra.Domain.Categories.Category
        {
            Id = x.Id,
            UserId = userId,
            Name = x.Name,
            Kind = Enum.Parse<Ledgerra.Domain.Categories.CategoryKind>(x.Kind, ignoreCase: true),
            Color = x.Color
        }).ToList();
        var transactions = archive.Transactions.Select(x => new Ledgerra.Domain.Transactions.Transaction
        {
            Id = x.Id,
            UserId = userId,
            AccountId = x.AccountId,
            CategoryId = x.CategoryId,
            Amount = x.Amount,
            Type = Enum.Parse<Ledgerra.Domain.Transactions.TransactionType>(x.Type, ignoreCase: true),
            OccurredOnUtc = DateTime.Parse(x.OccurredOnUtc, CultureInfo.InvariantCulture, DateTimeStyles.RoundtripKind),
            Note = x.Note,
            TransferGroupId = x.TransferGroupId,
            SplitGroupId = x.SplitGroupId,
            ParentTransactionId = x.ParentTransactionId,
            SavingsGoalId = x.SavingsGoalId
        }).ToList();
        var savingsGoals = (archive.SavingsGoals ?? []).Select(x => new Ledgerra.Domain.Goals.SavingsGoal
        {
            Id = x.Id,
            UserId = userId,
            Name = x.Name,
            TargetAmount = x.TargetAmount,
            DeadlineUtc = string.IsNullOrWhiteSpace(x.DeadlineUtc) ? null : DateTime.Parse(x.DeadlineUtc, CultureInfo.InvariantCulture, DateTimeStyles.RoundtripKind),
            CreatedAtUtc = string.IsNullOrWhiteSpace(x.CreatedAtUtc) ? DateTime.UtcNow : DateTime.Parse(x.CreatedAtUtc, CultureInfo.InvariantCulture, DateTimeStyles.RoundtripKind),
            UpdatedAtUtc = string.IsNullOrWhiteSpace(x.UpdatedAtUtc) ? DateTime.UtcNow : DateTime.Parse(x.UpdatedAtUtc, CultureInfo.InvariantCulture, DateTimeStyles.RoundtripKind)
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
            PlannedAmount = limit.PlannedAmount,
            CarryOverUnspent = limit.CarryOverUnspent
        })).ToList();

        await _dbContext.Accounts.AddRangeAsync(accounts, cancellationToken);
        await _dbContext.Categories.AddRangeAsync(categories, cancellationToken);
        await _dbContext.SavingsGoals.AddRangeAsync(savingsGoals, cancellationToken);
        await _dbContext.Transactions.AddRangeAsync(transactions, cancellationToken);
        await _dbContext.BudgetPeriods.AddRangeAsync(periods, cancellationToken);
        await _dbContext.BudgetCategoryLimits.AddRangeAsync(limits, cancellationToken);
        await _dbContext.SaveChangesAsync(cancellationToken);
        await tx.CommitAsync(cancellationToken);

        return NoContent();
    }

    private static string? ValidateArchiveReferences(BackupArchiveResponse archive)
    {
        var accountIds = new HashSet<Guid>(archive.Accounts.Select(a => a.Id));
        var categoryIds = new HashSet<Guid>(archive.Categories.Select(c => c.Id));
        var transactionIds = new HashSet<Guid>(archive.Transactions.Select(t => t.Id));
        var savingsGoalIds = new HashSet<Guid>((archive.SavingsGoals ?? []).Select(goal => goal.Id));

        foreach (var transaction in archive.Transactions)
        {
            if (!accountIds.Contains(transaction.AccountId))
            {
                return "Backup contains a transaction referencing an account not present in the archive.";
            }

            if (transaction.CategoryId.HasValue && !categoryIds.Contains(transaction.CategoryId.Value))
            {
                return "Backup contains a transaction referencing a category not present in the archive.";
            }

            if (transaction.ParentTransactionId.HasValue && !transactionIds.Contains(transaction.ParentTransactionId.Value))
            {
                return "Backup contains a transaction referencing a parent transaction not present in the archive.";
            }

            if (transaction.SavingsGoalId.HasValue && !savingsGoalIds.Contains(transaction.SavingsGoalId.Value))
            {
                return "Backup contains a transaction referencing a savings goal not present in the archive.";
            }
        }

        foreach (var period in archive.BudgetPeriods)
        {
            foreach (var limit in period.CategoryLimits)
            {
                if (!categoryIds.Contains(limit.CategoryId))
                {
                    return "Backup contains a budget limit referencing a category not present in the archive.";
                }
            }
        }

        return null;
    }

    private static string? ValidateArchiveShape(BackupArchiveResponse archive)
    {
        foreach (var account in archive.Accounts)
        {
            if (!Enum.TryParse<Ledgerra.Domain.Accounts.AccountType>(account.Type, ignoreCase: true, out _))
            {
                return "Backup contains an account with an unsupported type.";
            }

            if (!Enum.TryParse<Ledgerra.Domain.Accounts.AccountIconKind>(account.IconKind, ignoreCase: true, out _))
            {
                return "Backup contains an account with an unsupported icon kind.";
            }
        }

        foreach (var category in archive.Categories)
        {
            if (!Enum.TryParse<Ledgerra.Domain.Categories.CategoryKind>(category.Kind, ignoreCase: true, out _))
            {
                return "Backup contains a category with an unsupported kind.";
            }
        }

        foreach (var transaction in archive.Transactions)
        {
            if (!Enum.TryParse<Ledgerra.Domain.Transactions.TransactionType>(transaction.Type, ignoreCase: true, out _))
            {
                return "Backup contains a transaction with an unsupported type.";
            }

            if (!TryParseDateTime(transaction.OccurredOnUtc))
            {
                return "Backup contains a transaction with an invalid occurred-on date.";
            }
        }

        foreach (var goal in archive.SavingsGoals ?? [])
        {
            if (!string.IsNullOrWhiteSpace(goal.DeadlineUtc) && !TryParseDateTime(goal.DeadlineUtc))
            {
                return "Backup contains a savings goal with an invalid deadline date.";
            }

            if (!string.IsNullOrWhiteSpace(goal.CreatedAtUtc) && !TryParseDateTime(goal.CreatedAtUtc))
            {
                return "Backup contains a savings goal with an invalid created date.";
            }

            if (!string.IsNullOrWhiteSpace(goal.UpdatedAtUtc) && !TryParseDateTime(goal.UpdatedAtUtc))
            {
                return "Backup contains a savings goal with an invalid updated date.";
            }
        }

        foreach (var period in archive.BudgetPeriods)
        {
            if (period.Month is < 1 or > 12)
            {
                return "Backup contains a budget period with an invalid month.";
            }
        }

        return null;
    }

    private static bool TryParseDateTime(string value)
    {
        return DateTime.TryParse(value, CultureInfo.InvariantCulture, DateTimeStyles.RoundtripKind, out _);
    }
}
