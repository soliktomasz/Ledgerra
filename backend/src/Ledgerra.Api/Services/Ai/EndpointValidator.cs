using System.Net;
using System.Net.Sockets;

namespace Ledgerra.Api.Services.Ai;

internal static class EndpointValidator
{
    public static bool IsBlockedHost(Uri uri)
    {
        if (string.Equals(uri.Host, "localhost", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(uri.Host, "metadata.google.internal", StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }

        if (IPAddress.TryParse(uri.Host, out var ip))
        {
            return IsPrivateOrReserved(ip);
        }

        return false;
    }

    public static async Task<bool> ResolvesToBlockedAddressAsync(Uri uri)
    {
        if (IPAddress.TryParse(uri.Host, out var ip))
        {
            return IsPrivateOrReserved(ip);
        }

        if (IsBlockedHost(uri))
        {
            return true;
        }

        try
        {
            var addresses = await Dns.GetHostAddressesAsync(uri.Host);
            return addresses.Any(IsPrivateOrReserved);
        }
        catch
        {
            return true;
        }
    }

    private static bool IsPrivateOrReserved(IPAddress address)
    {
        if (IPAddress.IsLoopback(address))
        {
            return true;
        }

        if (address.IsIPv4MappedToIPv6)
        {
            address = address.MapToIPv4();
        }

        var bytes = address.GetAddressBytes();

        if (address.AddressFamily == AddressFamily.InterNetwork)
        {
            return bytes[0] switch
            {
                10 => true,                                               // 10.0.0.0/8
                127 => true,                                              // 127.0.0.0/8
                169 when bytes[1] == 254 => true,                         // 169.254.0.0/16
                172 when bytes[1] >= 16 && bytes[1] <= 31 => true,        // 172.16.0.0/12
                192 when bytes[1] == 168 => true,                         // 192.168.0.0/16
                0 => true,                                                // 0.0.0.0/8
                _ => false
            };
        }

        if (address.AddressFamily == AddressFamily.InterNetworkV6)
        {
            if (address.Equals(IPAddress.IPv6Loopback) || address.Equals(IPAddress.IPv6Any))
            {
                return true;
            }

            // fe80::/10 link-local
            if (bytes[0] == 0xfe && (bytes[1] & 0xc0) == 0x80)
            {
                return true;
            }

            // fc00::/7 unique local
            if ((bytes[0] & 0xfe) == 0xfc)
            {
                return true;
            }
        }

        return false;
    }
}
