using System;
using System.IO;
using System.Security.Cryptography;
using System.Text;
using System.Web;
using System.Web.Script.Serialization;
using System.Web.Security;

public static class FreeviewAuthentication
{
    internal const string CookieName = "__Host-FreeviewLogin";
    internal const int RememberDays = 30;
    private const string UserFilePath = @"E:\PrivateData\users.txt";
    private const string Purpose = "FreeviewPWA.RememberLogin.v1";

    public static bool TrySignIn(HttpContext context, string username, string password)
    {
        return TrySignIn(context, username, password, UserFilePath, DateTime.UtcNow);
    }

    internal static bool TrySignIn(HttpContext context, string username, string password, string userFile, DateTime now)
    {
        string accounts = File.ReadAllText(userFile);
        foreach (string line in accounts.Split(new char[] { '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries))
        {
            if (String.IsNullOrWhiteSpace(line) || line.TrimStart().StartsWith("#")) continue;
            string[] parts = line.Split(new char[] { ':', ',' }, 2);
            if (parts.Length != 2 || !String.Equals(parts[0].Trim(), username, StringComparison.OrdinalIgnoreCase) || parts[1].Trim() != password) continue;
            var ticket = new RememberTicket { Username = parts[0].Trim(), ExpiresUtcTicks = now.AddDays(RememberDays).Ticks, AccountVersion = AccountVersion(accounts) };
            var serializer = new JavaScriptSerializer();
            byte[] payload = Encoding.UTF8.GetBytes(serializer.Serialize(ticket));
            string value = HttpServerUtility.UrlTokenEncode(MachineKey.Protect(payload, Purpose));
            WriteCookie(context, value, now.AddDays(RememberDays));
            context.Session["IsLoggedIn"] = true;
            return true;
        }
        return false;
    }

    public static bool IsAuthenticated(HttpContext context)
    {
        return IsAuthenticated(context, UserFilePath, DateTime.UtcNow);
    }

    internal static bool IsAuthenticated(HttpContext context, string userFile, DateTime now)
    {
        var cookie = context.Request.Cookies[CookieName];
        RememberTicket ticket = ReadTicket(cookie == null ? null : cookie.Value, now);
        if (ticket != null)
        {
            // The account-file fingerprint invalidates remembered logins after account changes.
            string accounts = File.ReadAllText(userFile);
            if (String.Equals(ticket.AccountVersion, AccountVersion(accounts), StringComparison.Ordinal))
            {
                context.Session["IsLoggedIn"] = true;
                return true;
            }
        }
        context.Session.Remove("IsLoggedIn");
        if (cookie != null) SignOut(context);
        return false;
    }

    private static RememberTicket ReadTicket(string value, DateTime now)
    {
        if (String.IsNullOrEmpty(value) || value.Length > 4096) return null;
        try
        {
            byte[] encoded = HttpServerUtility.UrlTokenDecode(value);
            if (encoded == null) return null;
            byte[] payload = MachineKey.Unprotect(encoded, Purpose);
            if (payload == null) return null;
            var ticket = new JavaScriptSerializer().Deserialize<RememberTicket>(Encoding.UTF8.GetString(payload));
            if (ticket == null || String.IsNullOrEmpty(ticket.Username) || ticket.Username.Length > 128 ||
                ticket.ExpiresUtcTicks <= now.Ticks || ticket.ExpiresUtcTicks > now.AddDays(RememberDays).Ticks || String.IsNullOrEmpty(ticket.AccountVersion)) return null;
            return ticket;
        }
        catch (CryptographicException) { return null; }
        catch (FormatException) { return null; }
        catch (ArgumentException) { return null; }
        catch (InvalidOperationException) { return null; }
    }

    private static string AccountVersion(string accounts)
    {
        using (var hash = SHA256.Create()) return Convert.ToBase64String(hash.ComputeHash(Encoding.UTF8.GetBytes(accounts)));
    }

    private static void WriteCookie(HttpContext context, string value, DateTime expires)
    {
        context.Response.Cookies.Set(new HttpCookie(CookieName, value) {
            HttpOnly = true, Secure = true, SameSite = SameSiteMode.Lax, Path = "/", Expires = expires
        });
    }

    public static void SignOut(HttpContext context)
    {
        context.Session.Remove("IsLoggedIn");
        WriteCookie(context, "", DateTime.UtcNow.AddYears(-1));
    }

    public sealed class RememberTicket
    {
        public string Username { get; set; }
        public long ExpiresUtcTicks { get; set; }
        public string AccountVersion { get; set; }
    }
}
