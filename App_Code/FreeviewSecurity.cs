using System;
using System.Configuration;
using System.Net;
using System.Web;
using System.Web.Script.Serialization;

public static class FreeviewSecurity
{
    public static void Json(HttpContext context, int status, object value)
    {
        context.Response.TrySkipIisCustomErrors = true;
        context.Response.StatusCode = status;
        context.Response.ContentType = "application/json";
        context.Response.Cache.SetCacheability(HttpCacheability.NoCache);
        context.Response.Cache.SetNoStore();
        context.Response.Write(new JavaScriptSerializer().Serialize(value));
    }

    public static bool IsAppPost(HttpContext context)
    {
        if (context.Request.HttpMethod != "POST")
        {
            context.Response.AddHeader("Allow", "POST");
            Json(context, 405, new { error = "Use POST for this request." });
            return false;
        }
        string origin = context.Request.Headers["Origin"];
        Uri originUri;
        if (context.Request.Headers["X-Freeview-Request"] != "1" ||
            (!String.IsNullOrEmpty(origin) &&
             (!Uri.TryCreate(origin, UriKind.Absolute, out originUri) ||
              !String.Equals(originUri.GetLeftPart(UriPartial.Authority), context.Request.Url.GetLeftPart(UriPartial.Authority), StringComparison.OrdinalIgnoreCase))))
        {
            Json(context, 403, new { error = "Request origin is not allowed." });
            return false;
        }
        return true;
    }

    public static Uri AllowedProxyUri(string value)
    {
        Uri uri;
        if (!Uri.TryCreate(value, UriKind.Absolute, out uri) || uri.Scheme != "https" ||
            !uri.IsDefaultPort || !String.IsNullOrEmpty(uri.UserInfo))
            throw new HttpException(403, "Proxy destination is not allowed.");
        string[] allowed = (ConfigurationManager.AppSettings["FreeviewProxyHosts"] ?? "i.mjh.nz;c.mjh.nz;*.tvnz.co.nz").Split(';');
        bool match = false;
        foreach (string entry in allowed)
        {
            string host = entry.Trim();
            if (host.StartsWith("*."))
                match |= uri.DnsSafeHost.EndsWith(host.Substring(1), StringComparison.OrdinalIgnoreCase);
            else
                match |= String.Equals(uri.DnsSafeHost, host, StringComparison.OrdinalIgnoreCase);
        }
        if (!match) throw new HttpException(403, "Proxy destination is not allowed.");
        IPAddress[] addresses = Dns.GetHostAddresses(uri.DnsSafeHost);
        if (addresses.Length == 0) throw new HttpException(403, "Proxy destination is unavailable.");
        foreach (IPAddress address in addresses)
        {
            IPAddress actual = address.IsIPv4MappedToIPv6 ? address.MapToIPv4() : address;
            byte[] bytes = actual.GetAddressBytes();
            bool blocked = IPAddress.IsLoopback(actual);
            if (bytes.Length == 4)
                blocked |= bytes[0] == 0 || bytes[0] == 10 || bytes[0] == 127 || bytes[0] >= 224 ||
                    (bytes[0] == 169 && bytes[1] == 254) || (bytes[0] == 172 && bytes[1] >= 16 && bytes[1] <= 31) ||
                    (bytes[0] == 192 && bytes[1] == 168) || (bytes[0] == 100 && bytes[1] >= 64 && bytes[1] <= 127);
            else
                blocked |= bytes[0] < 0x20 || bytes[0] > 0x3f;
            if (blocked) throw new HttpException(403, "Private proxy destinations are not allowed.");
        }
        return uri;
    }

    public static HttpWebResponse OpenProxy(string value, string method, byte[] body, string contentType)
    {
        Uri uri = AllowedProxyUri(value);
        for (int attempt = 0; attempt < 6; attempt++)
        {
            ServicePointManager.SecurityProtocol = SecurityProtocolType.Tls12;
            HttpWebRequest request = (HttpWebRequest)WebRequest.Create(uri);
            request.AllowAutoRedirect = false;
            request.Proxy = null;
            request.Method = method;
            request.Timeout = 15000;
            request.ReadWriteTimeout = 15000;
            request.AutomaticDecompression = DecompressionMethods.GZip | DecompressionMethods.Deflate;
            request.UserAgent = "Mozilla/5.0 FreeviewPWA";
            if (body != null)
            {
                request.ContentType = String.IsNullOrEmpty(contentType) ? "application/octet-stream" : contentType;
                request.ContentLength = body.Length;
                using (var stream = request.GetRequestStream()) stream.Write(body, 0, body.Length);
            }
            HttpWebResponse response;
            try { response = (HttpWebResponse)request.GetResponse(); }
            catch (WebException error)
            {
                response = error.Response as HttpWebResponse;
                if (response == null) throw;
            }
            int status = (int)response.StatusCode;
            if (status >= 300 && status <= 399 && !String.IsNullOrEmpty(response.Headers["Location"]))
            {
                string next = new Uri(uri, response.Headers["Location"]).AbsoluteUri;
                response.Close();
                uri = AllowedProxyUri(next);
                // Licence wrappers expect the same POST body at the final destination.
                continue;
            }
            return response;
        }
        throw new HttpException(502, "Too many upstream redirects.");
    }
}
