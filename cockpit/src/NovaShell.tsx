import { SovereignHud } from "./hud/SovereignHud";

/**
 * Shell entry — Sovereign X HUD (CRVS v1.0) is the primary cockpit surface.
 * Bindings activate inside SovereignHud; cockpit never creates authority.
 */
export function NovaShell() {
  return <SovereignHud />;
}
