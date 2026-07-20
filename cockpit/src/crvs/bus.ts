/**
 * CRVS panel evidence bus — reveal only; never creates authority.
 */
import type { PanelBindingContext, PanelId } from "./types";

type Handler = (data: unknown) => void;

const latest = new Map<PanelId, unknown>();
const listeners = new Map<PanelId, Set<Handler>>();

export function createPanelBindingContext(): PanelBindingContext {
  return {
    emit(panelId, data) {
      latest.set(panelId, data);
      const set = listeners.get(panelId);
      if (set) {
        for (const h of set) h(data);
      }
    },
    subscribe(panelId, handler) {
      let set = listeners.get(panelId);
      if (!set) {
        set = new Set();
        listeners.set(panelId, set);
      }
      set.add(handler);
      const existing = latest.get(panelId);
      if (existing !== undefined) handler(existing);
      return () => {
        set!.delete(handler);
      };
    },
    get(panelId) {
      return latest.get(panelId);
    },
  };
}

/** Singleton context used by the cockpit visualization layer. */
export const panelBus: PanelBindingContext = createPanelBindingContext();
