export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export type JsonHighlightClassNames = {
  jsonKey: string;
  jsonString: string;
  jsonBool: string;
  jsonNum: string;
  jsonNull: string;
};

/** HTML-escape all JSON text, then wrap tokens in span classes for syntax highlighting. */
export function highlightJSON(obj: unknown, classes: JsonHighlightClassNames): string {
  const raw = JSON.stringify(obj, null, 2);
  const escaped = escapeHtml(raw);
  return escaped
    .replace(/(&quot;(?:\\.|[^&])*?&quot;)\s*:/g, `<span class="${classes.jsonKey}">$1</span>:`)
    .replace(/:\s*(&quot;(?:\\.|[^&])*?&quot;)/g, `: <span class="${classes.jsonString}">$1</span>`)
    .replace(/:\s*(true|false)/g, `: <span class="${classes.jsonBool}">$1</span>`)
    .replace(/:\s*(\d+\.?\d*)/g, `: <span class="${classes.jsonNum}">$1</span>`)
    .replace(/:\s*(null)/g, `: <span class="${classes.jsonNull}">$1</span>`);
}
