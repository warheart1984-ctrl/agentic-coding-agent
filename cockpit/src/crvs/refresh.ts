/**
 * Event-driven CRVS evidence refresh.
 * Bindings register push handlers; SSE / store ingest calls requestEvidenceRefresh.
 */
type RefreshHandler = () => void;

const handlers = new Set<RefreshHandler>();
let scheduled: ReturnType<typeof setTimeout> | null = null;

export function registerEvidenceRefresh(handler: RefreshHandler): () => void {
  handlers.add(handler);
  return () => {
    handlers.delete(handler);
  };
}

/** Coalesce bursts (SSE fan-out) into one refresh wave. */
export function requestEvidenceRefresh(_reason?: string): void {
  if (scheduled !== null) return;
  scheduled = setTimeout(() => {
    scheduled = null;
    for (const h of handlers) {
      try {
        h();
      } catch {
        /* binding errors must not break the bus */
      }
    }
  }, 50);
}

export function evidenceRefreshHandlerCount(): number {
  return handlers.size;
}
