async function main() {
  const notion = await fetch("https://api.notion.com/v1/users/me", {
    headers: {
      Authorization: `Bearer ${process.env.NOTION_API_KEY || ""}`,
      "Notion-Version": "2022-06-28",
    },
  });
  const notionSearch = await fetch("https://api.notion.com/v1/search", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.NOTION_API_KEY || ""}`, "Notion-Version": "2022-06-28", "Content-Type": "application/json" },
    body: JSON.stringify({ page_size: 5, sort: { direction: "descending", timestamp: "last_edited_time" } }),
  });

  const tokenResponse = await fetch(process.env.GOOGLE_TOKEN_URI || "https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID || "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
      refresh_token: process.env.GOOGLE_WORKSPACE_REFRESH_TOKEN || "",
      grant_type: "refresh_token",
    }),
  });

  const google: Record<string, unknown> = { token: tokenResponse.ok };
  if (tokenResponse.ok) {
    const token = await tokenResponse.json() as { access_token?: string; scope?: string };
    const headers = { Authorization: `Bearer ${token.access_token || ""}` };
    const checks = await Promise.all([
      fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", { headers }),
      fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?maxResults=1&singleEvents=true&orderBy=startTime&timeMin=${encodeURIComponent(new Date().toISOString())}`, { headers }),
      fetch("https://www.googleapis.com/drive/v3/files?pageSize=1&orderBy=modifiedTime%20desc&fields=files(id,name,modifiedTime,webViewLink)&q=trashed%20%3D%20false", { headers }),
    ]);
    google.gmail = checks[0].ok;
    google.gmailStatus = checks[0].status;
    google.calendar = checks[1].ok;
    google.calendarStatus = checks[1].status;
    if (!checks[1].ok) {
      const error = await checks[1].json().catch(() => ({})) as { error?: { message?: string; errors?: Array<{ reason?: string }> } };
      google.calendarError = String(error.error?.errors?.[0]?.reason || error.error?.message || "unknown");
    }
    google.drive = checks[2].ok;
    google.driveStatus = checks[2].status;
    const grantedScopes = String(token.scope || "").split(/\s+/).filter(Boolean);
    google.scopeCount = grantedScopes.length;
    google.grantedScopes = grantedScopes;
  } else {
    google.status = tokenResponse.status;
  }

  console.log(JSON.stringify({
    notion: { healthy: notion.ok, status: notion.status, search: notionSearch.ok, searchStatus: notionSearch.status },
    google,
  }));
  if (!notion.ok || !notionSearch.ok || !tokenResponse.ok || google.gmail !== true || google.calendar !== true || google.drive !== true) process.exitCode = 1;
}

main().catch(() => {
  console.log(JSON.stringify({ providerProbe: false }));
  process.exitCode = 1;
});
