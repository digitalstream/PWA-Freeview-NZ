<%@ WebHandler Language="C#" Class="LicenseProxyHandler" %>
using System;
using System.IO;
using System.Web;

public class LicenseProxyHandler : IHttpHandler
{
    public void ProcessRequest(HttpContext context)
    {
        if (!FreeviewSecurity.IsAppPost(context)) return;
        if (context.Request.ContentLength > 1048576) { context.Response.StatusCode = 413; return; }
        try
        {
            byte[] body;
            using (var buffer = new MemoryStream()) { context.Request.InputStream.CopyTo(buffer); body = buffer.ToArray(); }
            using (var response = FreeviewSecurity.OpenProxy(context.Request.QueryString["url"], "POST", body, context.Request.ContentType))
            {
                context.Response.StatusCode = (int)response.StatusCode;
                context.Response.ContentType = response.ContentType;
                context.Response.Cache.SetNoStore();
                using (var stream = response.GetResponseStream()) stream.CopyTo(context.Response.OutputStream);
            }
        }
        catch (Exception error)
        {
            context.Response.TrySkipIisCustomErrors = true;
            context.Response.StatusCode = error is HttpException ? ((HttpException)error).GetHttpCode() : 502;
            context.Response.Write("The licence request could not be completed.");
        }
    }
    public bool IsReusable { get { return false; } }
}
