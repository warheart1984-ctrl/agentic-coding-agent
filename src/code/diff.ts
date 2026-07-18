/**
 * Unified diff generation for file changes.
 */
export function generateUnifiedDiff(oldContent: string, newContent: string, filePath: string): string {
  const oldLines = oldContent.split("\n");
  const newLines = newContent.split("\n");

  const result: string[] = [`--- a/${filePath}`, `+++ b/${filePath}`];
  let i = 0, j = 0;
  while (i < oldLines.length || j < newLines.length) {
    if (i < oldLines.length && j < newLines.length && oldLines[i] === newLines[j]) {
      i++; j++;
      continue;
    }
    const startOld = i, startNew = j;
    while (i < oldLines.length && (j >= newLines.length || oldLines[i] !== newLines[j])) i++;
    while (j < newLines.length && (i >= oldLines.length || oldLines[i] !== newLines[j])) j++;
    const removed = oldLines.slice(startOld, i);
    const added = newLines.slice(startNew, j);
    result.push(`@@ -${startOld + 1},${removed.length} +${startNew + 1},${added.length} @@`);
    for (const line of removed) result.push(`-${line}`);
    for (const line of added) result.push(`+${line}`);
  }
  return result.join("\n");
}
