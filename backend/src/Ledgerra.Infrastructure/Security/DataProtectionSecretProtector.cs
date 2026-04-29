using Microsoft.AspNetCore.DataProtection;

namespace Ledgerra.Infrastructure.Security;

public sealed class DataProtectionSecretProtector : ISecretProtector
{
    private readonly IDataProtector _protector;

    public DataProtectionSecretProtector(IDataProtectionProvider provider)
    {
        _protector = provider.CreateProtector("Ledgerra.AiProviderCredentials.v1");
    }

    public string Protect(string value)
    {
        return _protector.Protect(value);
    }

    public string Unprotect(string protectedValue)
    {
        return _protector.Unprotect(protectedValue);
    }
}
