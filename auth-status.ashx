<%@ WebHandler Language="C#" Class="AuthStatusHandler" %>
using System;
using System.Web;

public class AuthStatusHandler : IHttpHandler, System.Web.SessionState.IRequiresSessionState
{
    public void ProcessRequest(HttpContext context)
    {
        if (context.Request.HttpMethod != "GET") { FreeviewSecurity.Json(context, 405, new { error = "Use GET for session status." }); return; }
        try
        {
            FreeviewSecurity.Json(context, 200, new { isLoggedIn = FreeviewAuthentication.IsAuthenticated(context) });
        }
        catch (Exception error)
        {
            System.Diagnostics.Trace.TraceError("Freeview session status: {0}", error.Message);
            FreeviewSecurity.Json(context, 503, new { error = "Session status is temporarily unavailable. Please try again." });
        }
    }
    public bool IsReusable { get { return false; } }
}
