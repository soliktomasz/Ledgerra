using Ledgerra.Domain.Auth;
using Ledgerra.Domain.Categories;

namespace Ledgerra.Infrastructure.Persistence;

public static class DefaultCategorySeed
{
    public static IReadOnlyList<Category> BuildForUser(AppUser user)
    {
        var expenseNames = new[]
        {
            "Groceries",
            "Rent",
            "Utilities",
            "Transport",
            "Dining",
            "Health"
        };

        var incomeNames = new[]
        {
            "Salary",
            "Freelance",
            "Bonus"
        };

        var expenseCategories = expenseNames.Select(name => new Category
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            Name = name,
            Kind = CategoryKind.Expense,
            IsSystem = true
        });

        var incomeCategories = incomeNames.Select(name => new Category
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            Name = name,
            Kind = CategoryKind.Income,
            IsSystem = true
        });

        return expenseCategories.Concat(incomeCategories).ToList();
    }
}
