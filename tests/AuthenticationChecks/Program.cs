using System;
using System.IO;
using System.Web;
using System.Web.Hosting;
using System.Web.SessionState;

public static class Program
{
    public static int Main()
    {
        string root = Path.Combine(Path.GetTempPath(), "freeview-auth-checks-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(Path.Combine(root, "bin"));
        string assembly = typeof(Program).Assembly.Location;
        File.Copy(assembly, Path.Combine(root, "bin", Path.GetFileName(assembly)));
        File.WriteAllText(Path.Combine(root, "web.config"), "<configuration />");
        try
        {
            var checks = (HostedChecks)ApplicationHost.CreateApplicationHost(typeof(HostedChecks), "/freeview-auth-checks", root);
            Console.WriteLine(checks.Run(root));
            return 0;
        }
        catch (Exception error) { Console.Error.WriteLine(error); return 1; }
    }
}

public class HostedChecks : MarshalByRefObject
{
    private static HttpContext NewContext(string token)
    {
        var context = new HttpContext(new HttpRequest("", "https://localhost/", ""), new HttpResponse(new StringWriter()));
        HttpContext.Current = context;
        var session = new HttpSessionStateContainer(Guid.NewGuid().ToString("N"), new SessionStateItemCollection(), new HttpStaticObjectsCollection(), 20, true, HttpCookieMode.UseCookies, SessionStateMode.InProc, false);
        SessionStateUtility.AddHttpSessionStateToContext(context, session);
        if (token != null) context.Request.Cookies.Add(new HttpCookie(FreeviewAuthentication.CookieName, token));
        return context;
    }

    private static void Check(bool condition, string description)
    {
        if (!condition) throw new InvalidOperationException(description);
    }

    public string Run(string root)
    {
        string file = Path.Combine(root, "test-users.txt");
        const string accounts = "# temporary fixture\nFamily:correct horse\nOther,another password\n";
        File.WriteAllText(file, accounts);
        DateTime now = DateTime.UtcNow;
        var login = NewContext(null);
        Check(FreeviewAuthentication.TrySignIn(login, "family", "correct horse", file, now), "fixture login failed");
        var cookie = login.Response.Cookies[FreeviewAuthentication.CookieName];
        string token = cookie.Value;
        Check(cookie.HttpOnly && cookie.Secure && cookie.SameSite == SameSiteMode.Lax && cookie.Path == "/", "cookie security attributes");
        Check(cookie.Expires == now.AddDays(30), "cookie must expire after 30 days");
        Check(!token.Contains("correct horse"), "cookie exposes password");

        var reopened = NewContext(token);
        Check(reopened.Session["IsLoggedIn"] == null, "new context should have no session login");
        Check(FreeviewAuthentication.IsAuthenticated(reopened, file, now.AddDays(10)), "persistent cookie did not restore login");
        Check((bool)reopened.Session["IsLoggedIn"], "session was not restored");
        Check(reopened.Response.Cookies.Count == 0, "session check extended cookie lifetime");

        var wrong = NewContext(null);
        Check(!FreeviewAuthentication.TrySignIn(wrong, "Family", "wrong", file, now) && wrong.Response.Cookies.Count == 0, "bad password created login");
        var noCookie = NewContext(null);
        noCookie.Session["IsLoggedIn"] = true;
        Check(!FreeviewAuthentication.IsAuthenticated(noCookie, file, now), "session flag bypassed missing login cookie");

        string changed = (token[0] == 'A' ? "B" : "A") + token.Substring(1);
        var tampered = NewContext(changed);
        Check(!FreeviewAuthentication.IsAuthenticated(tampered, file, now), "tampered token accepted");
        Check(tampered.Response.Cookies[FreeviewAuthentication.CookieName].Expires < now, "invalid cookie was not removed");
        Check(!FreeviewAuthentication.IsAuthenticated(NewContext(token), file, now.AddDays(31)), "expired token accepted");
        Check(!FreeviewAuthentication.IsAuthenticated(NewContext("bad-token"), file, now), "malformed token accepted");

        File.WriteAllText(file, accounts.Replace("correct horse", "new password"));
        Check(!FreeviewAuthentication.IsAuthenticated(NewContext(token), file, now), "account update did not invalidate remembered login");
        File.WriteAllText(file, accounts);

        var logout = NewContext(token);
        Check(FreeviewAuthentication.IsAuthenticated(logout, file, now), "logout fixture invalid");
        FreeviewAuthentication.SignOut(logout);
        Check(logout.Session["IsLoggedIn"] == null, "logout kept server session login");
        var deleted = logout.Response.Cookies[FreeviewAuthentication.CookieName];
        Check(deleted.Value == "" && deleted.Expires < now && deleted.Secure && deleted.HttpOnly, "logout did not expire secure cookie");
        Check(!FreeviewAuthentication.IsAuthenticated(NewContext(null), file, now), "login persisted after cookie removal");
        return "10 remembered-login checks passed (temporary users only; real ASP.NET MachineKey protection).";
    }
}
