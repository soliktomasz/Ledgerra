using System.Text;
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
builder.Services.AddScoped<IAiReportAnalysisClient>(provider => provider.GetRequiredService<OpenAiReportAnalysisClient>());
builder.Services.AddScoped<IAiReportAnalysisClient>(provider => provider.GetRequiredService<AnthropicReportAnalysisClient>());
builder.Services.AddScoped<AiReportAnalysisClientFactory>();
builder.Services.AddScoped<AiReportAnalysisService>();

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
}

app.MapGet("/health", () => Results.Ok(new { status = "ok" }));
app.MapControllers();

app.Run();

public partial class Program;
