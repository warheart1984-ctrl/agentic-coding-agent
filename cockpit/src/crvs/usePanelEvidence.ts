import { useEffect, useState } from "react";
import { panelBus } from "./bus";
import type { PanelId } from "./types";

/** Subscribe to CRVS panel bus — reveals evidence only, never invents it. */
export function usePanelEvidence<T = Record<string, unknown>>(panelId: PanelId): T | null {
  const [data, setData] = useState<T | null>(() => (panelBus.get(panelId) as T) ?? null);

  useEffect(() => {
    return panelBus.subscribe(panelId, (next) => {
      setData((next as T) ?? null);
    });
  }, [panelId]);

  return data;
}
