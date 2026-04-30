using Ledgerra.Api.Contracts;
using Ledgerra.Api.Extensions;
using Ledgerra.Domain.Categories;
using Ledgerra.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Ledgerra.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/categories")]
public sealed class CategoriesController : ControllerBase
{
    private readonly LedgerraDbContext _dbContext;

    public CategoriesController(LedgerraDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<CategoryResponse>>> GetAll(CancellationToken cancellationToken)
    {
        var userId = User.GetRequiredUserId();
        var categories = await _dbContext.Categories
            .Where(category => category.UserId == userId)
            .OrderBy(category => category.Kind)
            .ThenBy(category => category.Name)
            .ToListAsync(cancellationToken);

        return Ok(categories.Select(MapCategory));
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<CategoryResponse>> GetById(Guid id, CancellationToken cancellationToken)
    {
        var category = await _dbContext.Categories.SingleOrDefaultAsync(
            item => item.UserId == User.GetRequiredUserId() && item.Id == id,
            cancellationToken);

        return category is null ? NotFound() : Ok(MapCategory(category));
    }

    [HttpPost]
    public async Task<ActionResult<CategoryResponse>> Create(CreateCategoryRequest request, CancellationToken cancellationToken)
    {
        if (!EnumParsingExtensions.TryParseCategoryKind(request.Kind, out var kind))
        {
            return this.ValidationError(new Dictionary<string, string[]>
            {
                ["kind"] = ["Unsupported category kind."]
            });
        }

        var category = new Category
        {
            Id = Guid.NewGuid(),
            UserId = User.GetRequiredUserId(),
            Name = request.Name.Trim(),
            Kind = kind,
            Color = request.Color,
            IsSystem = false
        };

        _dbContext.Categories.Add(category);
        await _dbContext.SaveChangesAsync(cancellationToken);

        return CreatedAtAction(nameof(GetById), new { id = category.Id }, MapCategory(category));
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<CategoryResponse>> Update(Guid id, UpdateCategoryRequest request, CancellationToken cancellationToken)
    {
        if (!EnumParsingExtensions.TryParseCategoryKind(request.Kind, out var kind))
        {
            return this.ValidationError(new Dictionary<string, string[]>
            {
                ["kind"] = ["Unsupported category kind."]
            });
        }

        var category = await _dbContext.Categories.SingleOrDefaultAsync(
            item => item.UserId == User.GetRequiredUserId() && item.Id == id,
            cancellationToken);

        if (category is null)
        {
            return NotFound();
        }

        category.Name = request.Name.Trim();
        category.Kind = kind;
        category.Color = request.Color;
        category.IsSystem = request.IsSystem;

        await _dbContext.SaveChangesAsync(cancellationToken);

        return Ok(MapCategory(category));
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        var userId = User.GetRequiredUserId();
        var category = await _dbContext.Categories.SingleOrDefaultAsync(
            item => item.UserId == userId && item.Id == id,
            cancellationToken);

        if (category is null)
        {
            return NotFound();
        }

        var isUsedByImportRules = await _dbContext.CategorizationRules.AnyAsync(
            rule => rule.UserId == userId && rule.AssignCategoryId == id,
            cancellationToken);

        if (isUsedByImportRules)
        {
            return BadRequest(new ProblemDetails
            {
                Title = "Category is used by import rules",
                Detail = "Delete or move those import rules before deleting this category."
            });
        }

        _dbContext.Categories.Remove(category);
        try
        {
            await _dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException exception) when (IsImportRuleCategoryReferenceViolation(exception))
        {
            return BadRequest(new ProblemDetails
            {
                Title = "Category is used by import rules",
                Detail = "Delete or move those import rules before deleting this category."
            });
        }

        return NoContent();
    }

    private static bool IsImportRuleCategoryReferenceViolation(DbUpdateException exception)
    {
        var innerException = exception.InnerException;
        if (innerException?.GetType().FullName != "Npgsql.PostgresException")
        {
            return false;
        }

        var sqlState = innerException.GetType().GetProperty("SqlState")?.GetValue(innerException) as string;
        var constraintName = innerException.GetType().GetProperty("ConstraintName")?.GetValue(innerException) as string;
        return sqlState == "23503" && constraintName == "FK_CategorizationRules_Categories_AssignCategoryId";
    }

    private static CategoryResponse MapCategory(Category category)
    {
        return new CategoryResponse(category.Id, category.Name, category.Kind.ToString(), category.Color, category.IsSystem);
    }
}
