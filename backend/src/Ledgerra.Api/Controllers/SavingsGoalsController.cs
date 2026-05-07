using Ledgerra.Api.Contracts;
using Ledgerra.Api.Extensions;
using Ledgerra.Domain.Goals;
using Ledgerra.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Ledgerra.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/savings-goals")]
public sealed class SavingsGoalsController : ControllerBase
{
    private readonly LedgerraDbContext _dbContext;

    public SavingsGoalsController(LedgerraDbContext dbContext) => _dbContext = dbContext;

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<SavingsGoalResponse>>> GetAll(CancellationToken cancellationToken)
    {
        var userId = User.GetRequiredUserId();
        var goals = await _dbContext.SavingsGoals.Where(g => g.UserId == userId).OrderBy(g => g.CreatedAtUtc).ToListAsync(cancellationToken);
        var progressByGoal = await GetProgressByGoalAsync(userId, cancellationToken);
        return Ok(goals.Select(goal => Map(goal, progressByGoal.GetValueOrDefault(goal.Id))).ToList());
    }

    [HttpPost]
    public async Task<ActionResult<SavingsGoalResponse>> Create(CreateSavingsGoalRequest request, CancellationToken cancellationToken)
    {
        var userId = User.GetRequiredUserId();
        var trimmedName = request.Name.Trim();
        var existing = await _dbContext.SavingsGoals.FirstOrDefaultAsync(g => g.UserId == userId && g.Name == trimmedName, cancellationToken);
        if (existing is not null)
        {
            return Conflict(new { error = "A savings goal with this name already exists." });
        }
        var goal = new SavingsGoal { Id = Guid.NewGuid(), UserId = userId, Name = trimmedName, TargetAmount = request.TargetAmount, DeadlineUtc = request.DeadlineUtc };
        _dbContext.SavingsGoals.Add(goal);
        try
        {
            await _dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException)
        {
            return Conflict(new { error = "Unable to create savings goal due to a conflict." });
        }
        return CreatedAtAction(nameof(GetAll), new { id = goal.Id }, Map(goal, 0));
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<SavingsGoalResponse>> Update(Guid id, UpdateSavingsGoalRequest request, CancellationToken cancellationToken)
    {
        var userId = User.GetRequiredUserId();
        var goal = await _dbContext.SavingsGoals.FirstOrDefaultAsync(g => g.UserId == userId && g.Id == id, cancellationToken);
        if (goal is null) return NotFound();
        var trimmedName = request.Name.Trim();
        var existing = await _dbContext.SavingsGoals.FirstOrDefaultAsync(g => g.UserId == userId && g.Name == trimmedName && g.Id != id, cancellationToken);
        if (existing is not null)
        {
            return Conflict(new { error = "A savings goal with this name already exists." });
        }
        goal.Name = trimmedName;
        goal.TargetAmount = request.TargetAmount;
        goal.DeadlineUtc = request.DeadlineUtc;
        goal.UpdatedAtUtc = DateTime.UtcNow;
        try
        {
            await _dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException)
        {
            return Conflict(new { error = "Unable to update savings goal due to a conflict." });
        }
        var progressByGoal = await GetProgressByGoalAsync(userId, cancellationToken);
        return Ok(Map(goal, progressByGoal.GetValueOrDefault(goal.Id)));
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        var userId = User.GetRequiredUserId();
        var goal = await _dbContext.SavingsGoals.FirstOrDefaultAsync(g => g.UserId == userId && g.Id == id, cancellationToken);
        if (goal is null) return NotFound();
        var linkedTransactions = _dbContext.Transactions.Where(t => t.UserId == userId && t.SavingsGoalId == id);
        await linkedTransactions.ForEachAsync(t => t.SavingsGoalId = null, cancellationToken);
        _dbContext.SavingsGoals.Remove(goal);
        await _dbContext.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    private async Task<Dictionary<Guid, decimal>> GetProgressByGoalAsync(Guid userId, CancellationToken cancellationToken)
    {
        return await _dbContext.Transactions
            .Where(t => t.UserId == userId && t.SavingsGoalId != null && t.Type == Domain.Transactions.TransactionType.TransferOut)
            .GroupBy(t => t.SavingsGoalId!.Value)
            .Select(group => new { GoalId = group.Key, Amount = group.Sum(t => t.Amount) })
            .ToDictionaryAsync(item => item.GoalId, item => item.Amount, cancellationToken);
    }

    private static SavingsGoalResponse Map(SavingsGoal goal, decimal savedAmount)
    {
        var progress = goal.TargetAmount <= 0 ? 0 : Math.Clamp(savedAmount / goal.TargetAmount * 100m, 0, 100);
        return new SavingsGoalResponse(goal.Id, goal.Name, goal.TargetAmount, savedAmount, progress, goal.DeadlineUtc);
    }
}
