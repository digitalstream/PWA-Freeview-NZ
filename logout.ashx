<%@ WebHandler Language="C#" Class="LogoutHandler" %>
using System.Web;

public class LogoutHandler : IHttpHandler, System.Web.SessionState.IRequiresSessionState
{
    public void ProcessRequest(HttpContext context)
    {
        if (!FreeviewSecurity.IsAppPost(context)) return;
        FreeviewAuthentication.SignOut(context);
        context.Session.Clear();
        context.Session.Abandon();
        FreeviewSecurity.Json(context, 200, new { isLoggedIn = false });
    }
    public bool IsReusable { get { return false; } }
}
