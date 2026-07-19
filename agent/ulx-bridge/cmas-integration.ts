import { ULXClient } from "./ulxClient";
import { ULXCompiler } from "./ulxCompiler";
import type {
  ULXConfig,
  ULXSubstrateDescriptor,
  ULXSubstrateRecord,
  ULXSubstrateStatusValue,
  ULXDecision,
  ULXDecisionResult,
  ULXHarmonicSignal,
  ULXContinuityState,
  ULXContinuityDelta,
  ULXChainValidationReport,
} from "./ulxTypes";

export type ULXSubstrateRoute =
  | "agentic-coding-agent"
  | "lawful-nova-shell"
  | "project-infi-aais"
  | "project-infi-aios-node"
  | "project-infi-directx-os"
  | "project-infi-sovereign-ide"
  | "project-infi-sovereignx-router"
  | "project-infi-veilthorn"
  | "project-infi"
  | "project-infinity-main-aais"
  | "project-infinity-main-app"
  | "project-infinity-main"
  | "skillzmcgee";

export interface CMASULXSession {
  client: ULXClient;
  compiler: ULXCompiler;
  activeSubstrates: Map<ULXSubstrateRoute, ULXSubstrateRecord>;
}

export function createULXSession(config?: ULXConfig): CMASULXSession {
  return {
    client: new ULXClient(config),
    compiler: new ULXCompiler(config),
    activeSubstrates: new Map(),
  };
}

export async function registerSubstrateWithULX(
  session: CMASULXSession,
  route: ULXSubstrateRoute,
  descriptor: Omit<ULXSubstrateDescriptor, "substrateId">,
): Promise<ULXSubstrateDescriptor> {
  const full: ULXSubstrateDescriptor = {
    substrateId: route,
    ...descriptor,
  };
  const registered = await session.client.registerSubstrate(full);
  session.activeSubstrates.set(route, {
    id: registered.substrateId,
    name: registered.substrateId.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    domain: "unknown",
    layer: "execution",
    status: "raw",
    path: `substrates/${registered.substrateId}`,
  });
  return registered;
}

export async function routeCMASAction(
  session: CMASULXSession,
  actionType: "compile" | "governance" | "continuity" | "promote",
  targetSubstrate: ULXSubstrateRoute,
  payload: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  switch (actionType) {
    case "compile": {
      const source = payload.source as string ?? "";
      const result = await session.compiler.compileConstitution(source);
      return { ok: result.ok, ast: result.ast, diagnostics: result.diagnostics };
    }
    case "governance": {
      const decision = payload.decision as ULXDecision;
      const result = await session.client.submitDecision(targetSubstrate, decision);
      return { ok: result.result === "approved", result: result.result, promotion: result.promotion };
    }
    case "continuity": {
      const localState = payload.localState as ULXContinuityState;
      const delta = await session.client.compareContinuity(targetSubstrate, localState);
      return { ok: !delta.requiresReconciliation, delta };
    }
    case "promote": {
      const toStatus = payload.toStatus as ULXSubstrateStatusValue;
      const result = await session.client.promoteSubstrate(targetSubstrate, toStatus);
      return { ok: result.allowed, allowed: result.allowed, error: result.error };
    }
  }
}

export async function governAcrossSubstrates(
  session: CMASULXSession,
  decisions: Array<{ substrateId: ULXSubstrateRoute; decision: ULXDecision }>,
): Promise<{ results: Array<{ substrateId: string; result: string; error?: string }> }> {
  const results: Array<{ substrateId: string; result: string; error?: string }> = [];
  for (const { substrateId, decision } of decisions) {
    try {
      const res = await session.client.submitDecision(substrateId, decision);
      results.push({ substrateId, result: res.result });
    } catch (err) {
      results.push({ substrateId, result: "error", error: err instanceof Error ? err.message : String(err) });
    }
  }
  return { results };
}

export async function synchronizeContinuity(
  session: CMASULXSession,
  substrateIds: ULXSubstrateRoute[],
): Promise<{ states: Array<{ substrateId: string; delta: ULXContinuityDelta | null; state: ULXContinuityState | null }> }> {
  const states: Array<{ substrateId: string; delta: ULXContinuityDelta | null; state: ULXContinuityState | null }> = [];
  for (const id of substrateIds) {
    try {
      const state = await session.client.getContinuityState(id);
      const delta = await session.client.compareContinuity(id, state);
      states.push({ substrateId: id, delta, state });
    } catch {
      states.push({ substrateId: id, delta: null, state: null });
    }
  }
  return { states };
}

export async function emitCrossSubstrateSignal(
  session: CMASULXSession,
  signal: ULXHarmonicSignal,
  targets: ULXSubstrateRoute[],
): Promise<{ applied: string[]; errors: string[] }> {
  const applied: string[] = [];
  const errors: string[] = [];
  for (const target of targets) {
    try {
      await session.client.emitHarmonicSignal(signal);
      await session.client.applyHarmonicSignal(target, signal);
      applied.push(target);
    } catch (err) {
      errors.push(`[${target}] ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return { applied, errors };
}
