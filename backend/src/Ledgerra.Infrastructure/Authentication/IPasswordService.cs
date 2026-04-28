namespace Ledgerra.Infrastructure.Authentication;

public interface IPasswordService
{
    string Hash(string password);

    bool Verify(string password, string passwordHash);
}
