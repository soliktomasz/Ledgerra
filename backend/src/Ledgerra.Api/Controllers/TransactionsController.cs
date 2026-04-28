using Ledgerra.Api.Contracts;
using Ledgerra.Api.Extensions;
using Ledgerra.Domain.Transactions;
using Ledgerra.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Ledgerra.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/transactions")]
public sealed class TransactionsController : ControllerBase
{
    private readonly LedgerraDbContext _dbContext;

    public TransactionsController(LedgerraDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<TransactionResponse>>> GetAll(
        Guid? accountId,
        Guid? categoryId,
        string? type,
        DateOnly? from,
        DateOnly? to,
        CancellationToken cancellationToken)
    {
        var query = _dbContext.Transactions.Where(item => item.UserId == User.GetRequiredUserId());

        if (accountId.HasValue)
        {
            query = query.Where(item => item.AccountId == accountId.Value);
        }

        if (categoryId.HasValue)
        {
            query = query.Where(item => item.CategoryId == categoryId.Value);
        }

        if (!string.IsNullOrWhiteSpace(type) && EnumParsingExtensions.TryParseTransactionType(type, out var parsedType))
        {
            query = query.Where(item => item.Type == parsedType);
        }

        if (from.HasValue)
        {
            query = query.Where(item => item.OccurredOnUtc >= from.Value.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc));
        }

        if (to.HasValue)
        {
            query = query.Where(item => item.OccurredOnUtc <= to.Value.ToDateTime(TimeOnly.MaxValue, DateTimeKind.Utc));
        }

        var transactions = await query
            .OrderByDescending(item => item.OccurredOnUtc)
            .ToListAsync(cancellationToken);

        return Ok(transactions.Select(MapTransaction));
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<TransactionResponse>> GetById(Guid id, CancellationToken cancellationToken)
    {
        var transaction = await _dbContext.Transactions.SingleOrDefaultAsync(
            item => item.UserId == User.GetRequiredUserId() && item.Id == id,
            cancellationToken);

        return transaction is null ? NotFound() : Ok(MapTransaction(transaction));
    }

    [HttpPost]
    public async Task<ActionResult<TransactionResponse>> Create(CreateTransactionRequest request, CancellationToken cancellationToken)
    {
        var userId = User.GetRequiredUserId();
        var validation = await ValidateTransactionRequestAsync(userId, request.AccountId, request.CategoryId, request.Type, request.DestinationAccountId, cancellationToken);
        if (validation is not null)
        {
            return validation;
        }

        if (request.Type.Equals("Transfer", StringComparison.OrdinalIgnoreCase))
        {
            var transfer = await CreateTransferAsync(userId, request.AccountId, request.DestinationAccountId!.Value, request.Amount, request.OccurredOnUtc, request.Note, cancellationToken);
            return CreatedAtAction(nameof(GetById), new { id = transfer.Id }, MapTransaction(transfer));
        }

        EnumParsingExtensions.TryParseTransactionType(request.Type, out var transactionType);
        var transaction = new Transaction
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            AccountId = request.AccountId,
            CategoryId = request.CategoryId,
            Amount = request.Amount,
            Type = transactionType,
            Note = request.Note,
            OccurredOnUtc = request.OccurredOnUtc.ToUniversalTime()
        };

        _dbContext.Transactions.Add(transaction);
        await _dbContext.SaveChangesAsync(cancellationToken);

        return CreatedAtAction(nameof(GetById), new { id = transaction.Id }, MapTransaction(transaction));
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<TransactionResponse>> Update(Guid id, UpdateTransactionRequest request, CancellationToken cancellationToken)
    {
        var userId = User.GetRequiredUserId();
        var existing = await _dbContext.Transactions.SingleOrDefaultAsync(item => item.UserId == userId && item.Id == id, cancellationToken);
        if (existing is null)
        {
            return NotFound();
        }

        var validation = await ValidateTransactionRequestAsync(userId, existing.AccountId, request.CategoryId, request.Type, request.DestinationAccountId, cancellationToken);
        if (validation is not null)
        {
            return validation;
        }

        if (existing.TransferGroupId.HasValue)
        {
            var linkedTransactions = await _dbContext.Transactions
                .Where(item => item.UserId == userId && item.TransferGroupId == existing.TransferGroupId)
                .ToListAsync(cancellationToken);
            _dbContext.Transactions.RemoveRange(linkedTransactions);
        }
        else
        {
            _dbContext.Transactions.Remove(existing);
        }

        await _dbContext.SaveChangesAsync(cancellationToken);

        if (request.Type.Equals("Transfer", StringComparison.OrdinalIgnoreCase))
        {
            var transfer = await CreateTransferAsync(userId, existing.AccountId, request.DestinationAccountId!.Value, request.Amount, request.OccurredOnUtc, request.Note, cancellationToken);
            return Ok(MapTransaction(transfer));
        }

        EnumParsingExtensions.TryParseTransactionType(request.Type, out var transactionType);
        var replacement = new Transaction
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            AccountId = existing.AccountId,
            CategoryId = request.CategoryId,
            Amount = request.Amount,
            Type = transactionType,
            Note = request.Note,
            OccurredOnUtc = request.OccurredOnUtc.ToUniversalTime()
        };

        _dbContext.Transactions.Add(replacement);
        await _dbContext.SaveChangesAsync(cancellationToken);
        return Ok(MapTransaction(replacement));
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        var userId = User.GetRequiredUserId();
        var transaction = await _dbContext.Transactions.SingleOrDefaultAsync(item => item.UserId == userId && item.Id == id, cancellationToken);
        if (transaction is null)
        {
            return NotFound();
        }

        if (transaction.TransferGroupId.HasValue)
        {
            var linkedTransactions = await _dbContext.Transactions
                .Where(item => item.UserId == userId && item.TransferGroupId == transaction.TransferGroupId)
                .ToListAsync(cancellationToken);
            _dbContext.Transactions.RemoveRange(linkedTransactions);
        }
        else
        {
            _dbContext.Transactions.Remove(transaction);
        }

        await _dbContext.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    private async Task<ObjectResult?> ValidateTransactionRequestAsync(
        Guid userId,
        Guid accountId,
        Guid? categoryId,
        string type,
        Guid? destinationAccountId,
        CancellationToken cancellationToken)
    {
        var accountExists = await _dbContext.Accounts.AnyAsync(item => item.UserId == userId && item.Id == accountId, cancellationToken);
        if (!accountExists)
        {
                return NotFound(new ProblemDetails
                {
                    Title = "Account not found"
                }) as ObjectResult;
        }

        if (categoryId.HasValue)
        {
            var categoryExists = await _dbContext.Categories.AnyAsync(item => item.UserId == userId && item.Id == categoryId.Value, cancellationToken);
            if (!categoryExists)
            {
                return NotFound(new ProblemDetails
                {
                    Title = "Category not found"
                }) as ObjectResult;
            }
        }

        if (type.Equals("Transfer", StringComparison.OrdinalIgnoreCase))
        {
            if (!destinationAccountId.HasValue || destinationAccountId.Value == accountId)
            {
                return this.ValidationError(new Dictionary<string, string[]>
                {
                    ["destinationAccountId"] = ["Transfers require a different destination account."]
                });
            }

            var destinationExists = await _dbContext.Accounts.AnyAsync(item => item.UserId == userId && item.Id == destinationAccountId.Value, cancellationToken);
            if (!destinationExists)
            {
                return NotFound(new ProblemDetails
                {
                    Title = "Destination account not found"
                }) as ObjectResult;
            }

            return null;
        }

        if (!EnumParsingExtensions.TryParseTransactionType(type, out var parsedType) ||
            (parsedType != TransactionType.Income && parsedType != TransactionType.Expense))
        {
            return this.ValidationError(new Dictionary<string, string[]>
            {
                ["type"] = ["Supported transaction types are Income, Expense, and Transfer."]
            });
        }

        return null;
    }

    private async Task<Transaction> CreateTransferAsync(
        Guid userId,
        Guid sourceAccountId,
        Guid destinationAccountId,
        decimal amount,
        DateTime occurredOnUtc,
        string? note,
        CancellationToken cancellationToken)
    {
        var transferGroupId = Guid.NewGuid();
        var normalizedDate = occurredOnUtc.ToUniversalTime();

        var transferOut = new Transaction
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            AccountId = sourceAccountId,
            Amount = amount,
            Type = TransactionType.TransferOut,
            Note = note,
            OccurredOnUtc = normalizedDate,
            TransferGroupId = transferGroupId
        };

        var transferIn = new Transaction
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            AccountId = destinationAccountId,
            Amount = amount,
            Type = TransactionType.TransferIn,
            Note = note,
            OccurredOnUtc = normalizedDate,
            TransferGroupId = transferGroupId
        };

        _dbContext.Transactions.AddRange(transferOut, transferIn);
        await _dbContext.SaveChangesAsync(cancellationToken);
        return transferOut;
    }

    private static TransactionResponse MapTransaction(Transaction transaction)
    {
        return new TransactionResponse(
            transaction.Id,
            transaction.AccountId,
            transaction.CategoryId,
            transaction.Amount,
            transaction.Type.ToString(),
            transaction.OccurredOnUtc,
            transaction.Note,
            transaction.TransferGroupId);
    }
}
