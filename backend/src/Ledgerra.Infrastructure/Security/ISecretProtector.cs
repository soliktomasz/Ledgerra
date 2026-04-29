namespace Ledgerra.Infrastructure.Security;

public interface ISecretProtector
{
    string Protect(string value);

    string Unprotect(string protectedValue);
}
