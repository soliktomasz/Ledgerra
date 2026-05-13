using System.Text;
using Ledgerra.Application.Budgets;
using Ledgerra.Application.Accounts;
using Ledgerra.Application.Categories;
using Ledgerra.Application.Dashboard;
using Ledgerra.Application.Imports;
using Ledgerra.Application.Reporting;
using Ledgerra.Application.Settings;
using Ledgerra.Application.Transactions;
using Ledgerra.Api.Services.Ai;
using Ledgerra.Api.Services.Imports;
using Ledgerra.Infrastructure.Authentication;
using Ledgerra.Infrastructure.Persistence;
using Ledgerra.Infrastructure.Security;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddProblemDetails();
builder.Services.AddDataProtection();
builder.Services.AddScoped<ISecretProtector, DataProtectionSecretProtector>();
builder.Services.AddScoped<CsvReportContentExtractor>();
builder.Services.AddScoped<PdfReportContentExtractor>();
builder.Services.AddScoped<IReportContentExtractor, ReportContentExtractor>();
builder.Services.AddHttpClient<OpenAiReportAnalysisClient>();
builder.Services.AddHttpClient<AnthropicReportAnalysisClient>();
builder.Services.AddHttpClient<OpenAiCompatibleReportAnalysisClient>();
builder.Services.AddScoped<IAiReportAnalysisClient>(provider => provider.GetRequiredService<OpenAiReportAnalysisClient>());
builder.Services.AddScoped<IAiReportAnalysisClient>(provider => provider.GetRequiredService<AnthropicReportAnalysisClient>());
builder.Services.AddScoped<IAiReportAnalysisClient>(provider => provider.GetRequiredService<OpenAiCompatibleReportAnalysisClient>());
builder.Services.AddScoped<AiReportAnalysisClientFactory>();
builder.Services.AddScoped<AiReportAnalysisService>();
builder.Services.AddScoped<IImportCategorizationRuleMatcher, ImportCategorizationRuleMatcher>();
builder.Services.AddScoped<IImportDuplicateDetector, ImportDuplicateDetector>();
builder.Services.AddScoped<AnalyzeMonthlyReportCommandHandler>();
builder.Services.AddScoped<GetDashboardSummaryQueryHandler>();
builder.Services.AddScoped<GetReportingOverviewQueryHandler>();
builder.Services.AddScoped<IAccountStore, AccountStore>();
builder.Services.AddScoped<ICategoryStore, CategoryStore>();
builder.Services.AddScoped<CreateAccountCommandHandler>();
builder.Services.AddScoped<CreateCategoryCommandHandler>();
builder.Services.AddScoped<DeleteAccountCommandHandler>();
builder.Services.AddScoped<DeleteCategoryCommandHandler>();
builder.Services.AddScoped<GetBudgetSummaryQueryHandler>();
builder.Services.AddScoped<GetAccountByIdQueryHandler>();
builder.Services.AddScoped<GetCategoryByIdQueryHandler>();
builder.Services.AddScoped<GetAccountsQueryHandler>();
builder.Services.AddScoped<GetCategoriesQueryHandler>();
builder.Services.AddScoped<CommitMonthlyReportDraftsCommandHandler>();
builder.Services.AddScoped<IMonthlyReportAnalyzer, MonthlyReportAnalysisAdapter>();
builder.Services.AddScoped<IMonthlyReportDuplicateMarker, MonthlyReportDuplicateMarkerAdapter>();
builder.Services.AddScoped<CreateTransactionCommandHandler>();
builder.Services.AddScoped<DeleteTransactionCommandHandler>();
builder.Services.AddScoped<MoveTransactionAccountCommandHandler>();
builder.Services.AddScoped<GetProfileQueryHandler>();
builder.Services.AddScoped<IMonthlyReportDuplicateReviewer, MonthlyReportDuplicateReviewerAdapter>();
builder.Services.AddScoped<IMonthlyReportImportCommitStore, MonthlyReportImportCommitStore>();
builder.Services.AddScoped<IMonthlyReportRuleMatcher, MonthlyReportRuleMatcherAdapter>();
builder.Services.AddScoped<ITransactionCommandStore, TransactionCommandStore>();
builder.Services.AddScoped<ITransactionQueryStore, TransactionQueryStore>();
builder.Services.AddScoped<UpdateBudgetCommandHandler>();
builder.Services.AddScoped<UpdateAccountCommandHandler>();
builder.Services.AddScoped<UpdateCategoryCommandHandler>();
builder.Services.AddScoped<UpdateProfileCommandHandler>();
builder.Services.AddScoped<UpdateTransactionCommandHandler>();
builder.Services.AddScoped<GetTransactionByIdQueryHandler>();
builder.Services.AddScoped<GetTransactionsQueryHandler>();
builder.Services.AddScoped<IRecurringTransactionRepository, RecurringTransactionRepository>();
builder.Services.AddScoped<RecurringTransactionUseCases>();
builder.Services.AddScoped<IBudgetSummaryStore, BudgetSummaryStore>();
builder.Services.AddScoped<IDashboardSummaryDataProvider, DashboardSummaryDataProvider>();
builder.Services.AddScoped<IReportingDataProvider, ReportingDataProvider>();
builder.Services.AddScoped<IMonthlyAccountBalanceSnapshotService, MonthlyAccountBalanceSnapshotService>();
builder.Services.AddScoped<IUserProfileStore, UserProfileStore>();

builder.Services.Configure<AuthOptions>(builder.Configuration.GetSection(AuthOptions.SectionName));
var authOptions = builder.Configuration.GetSection(AuthOptions.SectionName).Get<AuthOptions>() ?? new AuthOptions();

builder.Services.AddDbContext<LedgerraDbContext>(options =>
{
    var connectionString = builder.Configuration.GetConnectionString("Ledgerra");

    if (builder.Environment.IsEnvironment("Testing"))
    {
        options.UseInMemoryDatabase("ledgerra-testing");
        return;
    }

    options.UseNpgsql(connectionString);
});

builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateIssuerSigningKey = true,
            ValidateLifetime = true,
            ValidIssuer = authOptions.Issuer,
            ValidAudience = authOptions.Audience,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(authOptions.SigningKey)),
            ClockSkew = TimeSpan.FromSeconds(30)
        };
        options.Events = new JwtBearerEvents
        {
            OnTokenValidated = async context =>
            {
                var patId = context.Principal?.FindFirst("pat_id")?.Value;
                if (string.IsNullOrWhiteSpace(patId) || !Guid.TryParse(patId, out var parsedPatId))
                {
                    return;
                }

                var dbContext = context.HttpContext.RequestServices.GetRequiredService<LedgerraDbContext>();
                var token = await dbContext.PersonalAccessTokens.SingleOrDefaultAsync(item => item.Id == parsedPatId);
                if (token is null || token.RevokedAtUtc is not null)
                {
                    context.Fail("Token revoked.");
                    return;
                }

                var now = DateTime.UtcNow;
                if (token.LastUsedAtUtc == null || (now - token.LastUsedAtUtc.Value) > TimeSpan.FromHours(1))
                {
                    token.LastUsedAtUtc = now;
                    _ = Task.Run(async () =>
                    {
                        try
                        {
                            await dbContext.SaveChangesAsync();
                        }
                        catch
                        {
                            // Fail silently - token validation should not fail due to DB save errors
                        }
                    });
                }
            }
        };
    });

builder.Services.AddAuthorization();
builder.Services.AddScoped<IJwtTokenService, JwtTokenService>();
builder.Services.AddScoped<IPasswordService, PasswordService>();
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        var origins = builder.Configuration.GetSection("Cors:Origins").Get<string[]>() ?? [];
        if (origins.Length == 0)
        {
            policy.AllowAnyHeader().AllowAnyMethod().AllowAnyOrigin();
            return;
        }

        policy.WithOrigins(origins).AllowAnyHeader().AllowAnyMethod();
    });
});

var app = builder.Build();

if (app.Environment.IsDevelopment() || app.Environment.IsEnvironment("Testing"))
{
    app.UseDeveloperExceptionPage();
}
else
{
    app.UseExceptionHandler();
}
app.UseCors();
app.UseAuthentication();
app.UseAuthorization();

using (var scope = app.Services.CreateScope())
{
    var dbContext = scope.ServiceProvider.GetRequiredService<LedgerraDbContext>();
    await dbContext.Database.EnsureCreatedAsync();
    await CategorizationRuleSchemaInitializer.InitializeAsync(dbContext);
    await AccountSchemaInitializer.InitializeAsync(dbContext);
}

app.MapGet("/health", () => Results.Ok(new { status = "ok" }));
app.MapControllers();

app.Run();

public partial class Program;
