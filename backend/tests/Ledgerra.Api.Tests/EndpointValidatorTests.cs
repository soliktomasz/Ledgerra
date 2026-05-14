using Ledgerra.Api.Services.Ai;

namespace Ledgerra.Api.Tests;

public sealed class EndpointValidatorTests
{
    [Theory]
    [InlineData("http://10.0.0.1")]
    [InlineData("http://192.168.1.10")]
    [InlineData("http://172.16.0.1")]
    [InlineData("http://127.0.0.1")]
    [InlineData("http://localhost")]
    [InlineData("http://0.0.0.0")]
    public void IsBlockedHost_BlocksPrivateAndReservedIPv4(string url)
    {
        Assert.True(EndpointValidator.IsBlockedHost(new Uri(url)));
    }

    [Theory]
    [InlineData("http://[::ffff:10.0.0.1]")]
    [InlineData("http://[::ffff:192.168.1.10]")]
    [InlineData("http://[::ffff:172.16.0.1]")]
    [InlineData("http://[::ffff:127.0.0.1]")]
    [InlineData("http://[::ffff:169.254.1.1]")]
    [InlineData("http://[::ffff:0.0.0.0]")]
    public void IsBlockedHost_BlocksIPv4MappedIPv6Addresses(string url)
    {
        Assert.True(EndpointValidator.IsBlockedHost(new Uri(url)));
    }

    [Theory]
    [InlineData("http://[::1]")]
    [InlineData("http://[fe80::1]")]
    [InlineData("http://[fc00::1]")]
    [InlineData("http://[fd12:3456::1]")]
    public void IsBlockedHost_BlocksNativeIPv6PrivateAddresses(string url)
    {
        Assert.True(EndpointValidator.IsBlockedHost(new Uri(url)));
    }

    [Theory]
    [InlineData("http://8.8.8.8")]
    [InlineData("https://api.openai.com")]
    public void IsBlockedHost_AllowsPublicAddresses(string url)
    {
        Assert.False(EndpointValidator.IsBlockedHost(new Uri(url)));
    }

    [Theory]
    [InlineData("http://[::ffff:10.0.0.1]")]
    [InlineData("http://[::ffff:192.168.1.10]")]
    [InlineData("http://[::ffff:172.16.0.1]")]
    [InlineData("http://[::ffff:127.0.0.1]")]
    public async Task ResolvesToBlockedAddressAsync_BlocksIPv4MappedIPv6(string url)
    {
        Assert.True(await EndpointValidator.ResolvesToBlockedAddressAsync(new Uri(url)));
    }

    [Fact]
    public void IsBlockedHost_BlocksMetadataEndpoint()
    {
        Assert.True(EndpointValidator.IsBlockedHost(new Uri("http://metadata.google.internal")));
    }
}
