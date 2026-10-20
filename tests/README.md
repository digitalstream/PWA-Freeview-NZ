Run the JavaScript regression checks from the Freeview folder:

```powershell
node --test tests/*.test.cjs
```

Checks cover guide mappings, delayed schedules, retries, schedule gaps, buffering recovery, session status, login/logout, guest previews and static caching.

Access behaviour:
- Guests see 16 channels. Sky Sport 1–4 appear only after sign-in.
- TVNZ 1, TVNZ 2, DUKE and their +1 channels share one two-minute preview window.
- That window starts with actual playback. Switching channels, stopping or refreshing does not reset it.
- A 30-minute cooldown follows the preview. Other guest channels stay available.
- Signing in cancels the preview stop. Signing out stops any restricted channel.
- Preview state is local to the browser and shared across tabs. These are app controls; the upstream stream URLs remain public.

Live browser checks used real TVNZ and sports video with simulated login responses. They verified portrait/landscape sizing, preview expiry, reload persistence, sports visibility and stopping playback on logout. Real Safari screen edges still need a device check.

Use requests.http for manual session checks without putting credentials in URLs. Supply your own account values locally. GuideAPI request examples remain in C:/APIS/myGuideAPI/requests.http.

Remembered login checks (.NET Framework 4.8 on Windows):

```powershell
$authCheckOutput = Join-Path $env:TEMP ("FreeviewAuthChecks-" + [guid]::NewGuid().ToString("N"))
dotnet build tests/AuthenticationChecks/AuthenticationChecks.csproj -c Release -o $authCheckOutput
& (Join-Path $authCheckOutput "AuthenticationChecks.exe")
```

The checks create an isolated temporary ASP.NET application and a fake users file. They use real MachineKey protection to verify fresh-session restoration, the fixed 30-day expiry, cookie attributes, wrong credentials, missing/malformed/tampered/expired cookies, account-file invalidation and logout. They never read or change the real users file.

A successful login now issues a Secure, HttpOnly, SameSite=Lax cookie scoped to this host. Session-status requests validate it and restore the temporary session without extending its expiry. Sign out deletes it. Changing users.txt invalidates remembered logins, so users must sign in again after account changes. Existing users must sign in once after this update to obtain the cookie.
