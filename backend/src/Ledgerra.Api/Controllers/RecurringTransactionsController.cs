using Ledgerra.Api.Contracts;
using Ledgerra.Api.Extensions;
using Ledgerra.Application.Transactions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Ledgerra.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/recurring-transactions")]
public sealed class RecurringTransactionsController : ControllerBase
{
    private readonly RecurringTransactionUseCases _useCases;
    public RecurringTransactionsController(RecurringTransactionUseCases useCases) => _useCases = useCases;

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<RecurringTransactionTemplateResponse>>> GetAll(CancellationToken cancellationToken)
    {
        var items = await _useCases.GetAllAsync(User.GetRequiredUserId(), cancellationToken);
        return Ok(items.Select(Map));
    }

    [HttpPost]
    public async Task<ActionResult<RecurringTransactionTemplateResponse>> Create(CreateRecurringTransactionTemplateRequest request, CancellationToken cancellationToken)
    {
        try
        {
            var item = await _useCases.CreateAsync(User.GetRequiredUserId(), request.AccountId, request.CategoryId, request.Amount, request.Type, request.Interval, request.StartOnUtc, request.Note, cancellationToken);
            return Ok(Map(item));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpPost("generate")]
    public async Task<ActionResult<object>> Generate(CancellationToken cancellationToken)
    {
        var count = await _useCases.GenerateDueAsync(User.GetRequiredUserId(), DateTime.UtcNow, cancellationToken);
        return Ok(new { generated = count });
    }

    private static RecurringTransactionTemplateResponse Map(Ledgerra.Domain.Transactions.RecurringTransactionTemplate item)
        => new(item.Id, item.AccountId, item.CategoryId, item.Amount, item.Type.ToString(), item.Interval.ToString(), item.StartOnUtc, item.LastGeneratedOnUtc, item.IsActive, item.Note);
}
