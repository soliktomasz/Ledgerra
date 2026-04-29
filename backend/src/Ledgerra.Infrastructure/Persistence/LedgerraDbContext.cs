using Ledgerra.Domain.Accounts;
using Ledgerra.Domain.Ai;
using Ledgerra.Domain.Auth;
using Ledgerra.Domain.Budgets;
using Ledgerra.Domain.Categories;
using Ledgerra.Domain.Transactions;
using Microsoft.EntityFrameworkCore;

namespace Ledgerra.Infrastructure.Persistence;

public sealed class LedgerraDbContext : DbContext
{
    public LedgerraDbContext(DbContextOptions<LedgerraDbContext> options)
        : base(options)
    {
    }

    public DbSet<AppUser> Users => Set<AppUser>();

    public DbSet<Account> Accounts => Set<Account>();

    public DbSet<Category> Categories => Set<Category>();

    public DbSet<Transaction> Transactions => Set<Transaction>();

    public DbSet<BudgetPeriod> BudgetPeriods => Set<BudgetPeriod>();

    public DbSet<BudgetCategoryLimit> BudgetCategoryLimits => Set<BudgetCategoryLimit>();

    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();

    public DbSet<AiProviderCredential> AiProviderCredentials => Set<AiProviderCredential>();

    public DbSet<UserAiPreference> UserAiPreferences => Set<UserAiPreference>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<AppUser>(builder =>
        {
            builder.HasKey(user => user.Id);
            builder.HasIndex(user => user.Email).IsUnique();
            builder.Property(user => user.Email).HasMaxLength(320);
            builder.Property(user => user.PasswordHash).HasMaxLength(2048);
            builder.Property(user => user.PreferredCurrencyCode).HasMaxLength(3);
        });

        modelBuilder.Entity<Account>(builder =>
        {
            builder.HasKey(account => account.Id);
            builder.Property(account => account.Name).HasMaxLength(120);
            builder.Property(account => account.CurrencyCode).HasMaxLength(3);
            builder.HasOne<AppUser>()
                .WithMany(user => user.Accounts)
                .HasForeignKey(account => account.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Category>(builder =>
        {
            builder.HasKey(category => category.Id);
            builder.Property(category => category.Name).HasMaxLength(120);
            builder.Property(category => category.Color).HasMaxLength(32);
            builder.HasOne<AppUser>()
                .WithMany(user => user.Categories)
                .HasForeignKey(category => category.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Transaction>(builder =>
        {
            builder.HasKey(transaction => transaction.Id);
            builder.Property(transaction => transaction.Amount).HasPrecision(18, 2);
            builder.Property(transaction => transaction.Note).HasMaxLength(400);
            builder.HasIndex(transaction => new { transaction.UserId, transaction.OccurredOnUtc });
            builder.HasOne<AppUser>()
                .WithMany(user => user.Transactions)
                .HasForeignKey(transaction => transaction.UserId)
                .OnDelete(DeleteBehavior.Cascade);
            builder.HasOne(transaction => transaction.Account)
                .WithMany(account => account.Transactions)
                .HasForeignKey(transaction => transaction.AccountId)
                .OnDelete(DeleteBehavior.Restrict);
            builder.HasOne(transaction => transaction.Category)
                .WithMany(category => category.Transactions)
                .HasForeignKey(transaction => transaction.CategoryId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<BudgetPeriod>(builder =>
        {
            builder.HasKey(period => period.Id);
            builder.HasIndex(period => new { period.UserId, period.Year, period.Month }).IsUnique();
            builder.HasOne<AppUser>()
                .WithMany(user => user.BudgetPeriods)
                .HasForeignKey(period => period.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<BudgetCategoryLimit>(builder =>
        {
            builder.HasKey(limit => limit.Id);
            builder.Property(limit => limit.PlannedAmount).HasPrecision(18, 2);
            builder.HasIndex(limit => new { limit.BudgetPeriodId, limit.CategoryId }).IsUnique();
            builder.HasOne(limit => limit.BudgetPeriod)
                .WithMany(period => period.CategoryLimits)
                .HasForeignKey(limit => limit.BudgetPeriodId)
                .OnDelete(DeleteBehavior.Cascade);
            builder.HasOne(limit => limit.Category)
                .WithMany()
                .HasForeignKey(limit => limit.CategoryId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<RefreshToken>(builder =>
        {
            builder.HasKey(token => token.Id);
            builder.Property(token => token.TokenHash).HasMaxLength(128);
            builder.HasIndex(token => token.TokenHash).IsUnique();
            builder.HasOne(token => token.User)
                .WithMany(user => user.RefreshTokens)
                .HasForeignKey(token => token.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<AiProviderCredential>(builder =>
        {
            builder.HasKey(credential => credential.Id);
            builder.HasIndex(credential => new { credential.UserId, credential.Provider }).IsUnique();
            builder.Property(credential => credential.Provider).HasConversion<string>().HasMaxLength(32);
            builder.Property(credential => credential.EncryptedApiKey).HasMaxLength(4096);
            builder.Property(credential => credential.MaskedKey).HasMaxLength(32);
            builder.HasOne<AppUser>()
                .WithMany(user => user.AiProviderCredentials)
                .HasForeignKey(credential => credential.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<UserAiPreference>(builder =>
        {
            builder.HasKey(preference => preference.UserId);
            builder.Property(preference => preference.DefaultProvider).HasConversion<string>().HasMaxLength(32);
            builder.HasOne<AppUser>()
                .WithOne(user => user.AiPreference)
                .HasForeignKey<UserAiPreference>(preference => preference.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });
    }
}
