const NOTION_VERSION = "2022-06-28";

export const NOTION_TOOLS = [
  "notion.workspace.verify",
  "notion.workspace.search",
] as const;

export function isConfigured(): boolean {
  return Boolean(process.env.NOTION_API_KEY?.trim());
}

export async function searchWorkspace(query = "", pageSize = 20): Promise<Array<{ id: string; object: string; title: string; url: string | null; lastEditedTime: string | null }>> {
  if (!isConfigured()) throw new Error("Notion is not configured.");
  const response = await fetch("https://api.notion.com/v1/search", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.NOTION_API_KEY!.trim()}`, "Notion-Version": NOTION_VERSION, "Content-Type": "application/json" },
    body: JSON.stringify({ query, page_size: Math.min(50, Math.max(1, pageSize)), sort: { direction: "descending", timestamp: "last_edited_time" } }),
  });
  if (!response.ok) throw new Error(`Notion search failed with ${response.status}.`);
  const data = await response.json() as any;
  return (data.results || []).map((item: any) => {
    const titleParts = item.object === "page" ? (item.properties?.title?.title || item.properties?.Name?.title || []) : (item.title || []);
    return { id: item.id, object: item.object, title: titleParts.map((part: any) => part.plain_text || "").join("") || "Untitled", url: item.url || null, lastEditedTime: item.last_edited_time || null };
  });
}

export async function verifyConnection(): Promise<{
  configured: boolean;
  connected: boolean;
  healthy: boolean;
}> {
  if (!isConfigured()) return { configured: false, connected: false, healthy: false };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5_000);
  try {
    const response = await fetch("https://api.notion.com/v1/users/me", {
      headers: {
        Authorization: `Bearer ${process.env.NOTION_API_KEY!.trim()}`,
        "Notion-Version": NOTION_VERSION,
      },
      signal: controller.signal,
    });
    return { configured: true, connected: response.ok, healthy: response.ok };
  } catch {
    return { configured: true, connected: false, healthy: false };
  } finally {
    clearTimeout(timeout);
  }
}
