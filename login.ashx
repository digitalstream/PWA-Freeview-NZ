<%@ WebHandler Language="C#" Class="LoginHandler" %>
using System;
using System.Web;

public class LoginHandler : IHttpHandler, System.Web.SessionState.IRequiresSessionState
{
    public void ProcessRequest(HttpContext context)
    {
        if (!FreeviewSecurity.IsAppPost(context)) return;
        if (context.Request.ContentLength > 8192) { FreeviewSecurity.Json(context, 413, new { error = "Request is too large." }); return; }
        string username = (context.Request.Unvalidated.Form["username"] ?? "").Trim();
        string password = context.Request.Unvalidated.Form["password"] ?? "";
        if (username.Length == 0 || password.Length == 0 || username.Length > 128 || password.Length > 512)
        {
            FreeviewSecurity.Json(context, 400, new { error = "Enter a valid username and password." });
            return;
        }
        try
        {
            if (FreeviewAuthentication.TrySignIn(context, username, password))
            {
                FreeviewSecurity.Json(context, 200, new { isLoggedIn = true });
                return;
            }
            FreeviewSecurity.Json(context, 401, new { error = "Incorrect username or password." });
        }
        catch (Exception error)
        {
            System.Diagnostics.Trace.TraceError("Freeview login: {0}", error.Message);
            FreeviewSecurity.Json(context, 503, new { error = "Sign-in is temporarily unavailable. Please try again." });
        }
    }
    public bool IsReusable { get { return false; } }
}
