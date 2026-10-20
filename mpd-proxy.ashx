<%@ WebHandler Language="C#" Class="MpdProxyHandler" %>

using System;
using System.IO;
using System.Net;
using System.Web;
using System.Text.RegularExpressions;

public class MpdProxyHandler : IHttpHandler
{
    public void ProcessRequest(HttpContext context)
    {
        ServicePointManager.SecurityProtocol =
            SecurityProtocolType.Tls12 |
            SecurityProtocolType.Tls11;

        string targetUrl = context.Request.QueryString["url"];

        if (string.IsNullOrEmpty(targetUrl))
        {
            context.Response.StatusCode = 400;
            context.Response.Write("Error: URL parameter is missing.");
            return;
        }

        if (context.Request.HttpMethod != "GET") { context.Response.StatusCode = 405; return; }

        try
        {
            using (HttpWebResponse response = FreeviewSecurity.OpenProxy(targetUrl, "GET", null, null))
            {
                Uri finalUri = response.ResponseUri;
                string contentType = response.ContentType.ToLower();

                context.Response.StatusCode = (int)response.StatusCode;
                context.Response.Cache.SetNoStore();

                bool isMpd =
                    contentType.Contains("dash+xml") ||
                    finalUri.AbsolutePath.ToLower().EndsWith(".mpd");

                if (isMpd)
                {
                    using (StreamReader reader =
                        new StreamReader(response.GetResponseStream()))
                    {
                        string mpdXml = reader.ReadToEnd();

                        string basePath = finalUri.ToString();
                        basePath = basePath.Substring(
                            0,
                            basePath.LastIndexOf('/') + 1
                        );

                        string proxiedBaseUrl =
                            context.Request.Url.GetLeftPart(UriPartial.Authority) +
                            "/mpd-proxy.ashx?url=" +
                            HttpUtility.UrlEncode(basePath);

                        string baseUrlXml =
                            "<BaseURL>" + proxiedBaseUrl + "</BaseURL>";

                     int mpdOpenStart = mpdXml.IndexOf("<MPD");
int mpdOpenEnd = mpdXml.IndexOf(">", mpdOpenStart);

if (mpdOpenStart > -1 && mpdOpenEnd > -1)
{
    mpdXml =
        mpdXml.Substring(0, mpdOpenEnd + 1) +
        baseUrlXml +
        mpdXml.Substring(mpdOpenEnd + 1);
}
// Rewrite DASH segment paths directly through this proxy.
// This avoids dash.js resolving relative paths against the page URL.
mpdXml = mpdXml.Replace(
    "media=\"segment_",
    "media=\"" + proxiedBaseUrl + "segment_"
);

mpdXml = mpdXml.Replace(
    "initialization=\"segment_",
    "initialization=\"" + proxiedBaseUrl + "segment_"
);
                        context.Response.ContentType =
                            "application/dash+xml";

                            // Remove subtitle/caption AdaptationSets.
// We only need video + audio for playback.
mpdXml = System.Text.RegularExpressions.Regex.Replace(
    mpdXml,
    @"<AdaptationSet[^>]*contentType=""application""[\s\S]*?</AdaptationSet>",
    "",
    System.Text.RegularExpressions.RegexOptions.IgnoreCase
);

                        context.Response.Write(mpdXml);
                    }

                    return;
                }

                // Non-MPD requests are init/segment files.
                // Stream them through unchanged.
                context.Response.ContentType = response.ContentType;

                using (Stream stream = response.GetResponseStream())
                {
                    stream.CopyTo(context.Response.OutputStream);
                }
            }
        }
        catch (Exception error)
        {
            context.Response.TrySkipIisCustomErrors = true;
            context.Response.StatusCode = error is HttpException ? ((HttpException)error).GetHttpCode() : 502;
            context.Response.Write("The stream request could not be completed.");
        }
    }

    public bool IsReusable
    {
        get { return false; }
    }
}