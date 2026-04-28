using Ledgerra.Api.Contracts;
using Ledgerra.Api.Extensions;
using Ledgerra.Domain.Accounts;
using Ledgerra.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Ledgerra.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/accounts")]
public sealed class AccountsController : ControllerBase
{
    private readonly LedgerraDbContext _dbContext;

    public AccountsController(LedgerraDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<AccountResponse>>> GetAll(CancellationToken cancellationToken)
    {
        var userId = User.GetRequiredUserId();
        var accounts = await _dbContext.Accounts
            .Where(account => account.UserId == userId)
            .Include(account => account.Transactions)
            .OrderBy(account => account.Name)
            .ToListAsync(cancellationToken);

        return Ok(accounts.Select(MapAccount));
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<AccountResponse>> GetById(Guid id, CancellationToken cancellationToken)
    {
        var userId = User.GetRequiredUserId();
        var account = await _dbContext.Accounts
            .Where(item => item.UserId == userId && item.Id == id)
            .Include(item => item.Transactions)
            .SingleOrDefaultAsync(cancellationToken);

        return account is null ? NotFound() : Ok(MapAccount(account));
    }

    [HttpPost]
    public async Task<ActionResult<AccountResponse>> Create(CreateAccountRequest request, CancellationToken cancellationToken)
    {
        if (!EnumParsingExtensions.TryParseAccountType(request.Type, out var accountType))
        {
            return this.ValidationError(new Dictionary<string, string[]>
            {
                ["type"] = ["Unsupported account type."]
            });
        }

        var account = new Account
        {
            Id = Guid.NewGuid(),
            UserId = User.GetRequiredUserId(),
            Name = request.Name.Trim(),
            Type = accountType,
            CurrencyCode = request.CurrencyCode.ToUpperInvariant(),
            OpeningBalance = request.OpeningBalance
        };

        _dbContext.Accounts.Add(account);
        await _dbContext.SaveChangesAsync(cancellationToken);

        return CreatedAtAction(nameof(GetById), new { id = account.Id }, MapAccount(account));
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<AccountResponse>> Update(Guid id, UpdateAccountRequest request, CancellationToken cancellationToken)
    {
        if (!EnumParsingExtensions.TryParseAccountType(request.Type, out var accountType))
        {
            return this.ValidationError(new Dictionary<string, string[]>
            {
                ["type"] = ["Unsupported account type."]
            });
        }

        var userId = User.GetRequiredUserId();
        var account = await _dbContext.Accounts.SingleOrDefaultAsync(item => item.UserId == userId && item.Id == id, cancellationToken);
        if (account is null)
        {
            return NotFound();
        }

        account.Name = request.Name.Trim();
        account.Type = accountType;
        account.CurrencyCode = request.CurrencyCode.ToUpperInvariant();
        account.OpeningBalance = request.OpeningBalance;
        account.IsActive = request.IsActive;

        await _dbContext.SaveChangesAsync(cancellationToken);

        var refreshed = await _dbContext.Accounts.Include(item => item.Transactions).SingleAsync(item => item.Id == id, cancellationToken);
        return Ok(MapAccount(refreshed));
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        var userId = User.GetRequiredUserId();
        var account = await _dbContext.Accounts
            .Include(item => item.Transactions)
            .SingleOrDefaultAsync(item => item.UserId == userId && item.Id == id, cancellationToken);

        if (account is null)
        {
            return NotFound();
        }

        if (account.Transactions.Count > 0)
        {
            return Conflict(new ProblemDetails
            {
                Title = "Account has transactions",
                Detail = "Delete or move transactions before removing the account."
            });
        }

        _dbContext.Accounts.Remove(account);
        await _dbContext.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    private static AccountResponse MapAccount(Account account)
    {
        return new AccountResponse(
            account.Id,
            account.Name,
            account.Type.ToString(),
            account.CurrencyCode,
            account.OpeningBalance,
            AccountBalanceCalculator.Calculate(account, account.Transactions),
            account.IsActive);
    }
}
