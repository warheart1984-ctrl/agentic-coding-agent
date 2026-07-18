export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

export async function webSearch(query: string): Promise<SearchResult[]> {
  try {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1`;
    const res = await fetch(url);
    const json = (await res.json()) as { RelatedTopics?: Array<{ Text?: string; FirstURL?: string }> };
    return (json.RelatedTopics || []).slice(0, 5).map((t) => ({
      title: t.Text?.split(" - ")[0] || "",
      url: t.FirstURL || "",
      snippet: t.Text || "",
    }));
  } catch {
    return [];
  }
}

export async function readUrl(url: string): Promise<string> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    const html = await res.text();
    const cleaned = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return cleaned.slice(0, 5000);
  } catch {
    return "(failed to fetch)";
  }
}
