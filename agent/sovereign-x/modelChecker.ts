export type PredicateResult = { passed: boolean; counterexample?: string };

export interface StatePredicate {
  id: string;
  description: string;
  check: (state: Record<string, unknown>) => PredicateResult;
}

export interface ModelState {
  label: string;
  values: Record<string, unknown>;
}

export interface VerificationResult {
  predicateId: string;
  description: string;
  passed: boolean;
  statesChecked: number;
  counterexample?: string;
}

const CONSTITUTIONAL_PREDICATES: StatePredicate[] = [
  {
    id: "P-I001", description: "No execution without evidence — every 'executing' intent must have evidenceIds.length > 0",
    check: (s) => {
      if (s.status === "executing" && Array.isArray(s.evidenceIds) && s.evidenceIds.length === 0) {
        return { passed: false, counterexample: `Intent ${s.intentId} is executing but has zero evidence` };
      }
      return { passed: true };
    },
  },
  {
    id: "P-I002", description: "All state transitions are forward-only — intent status never regresses",
    check: (s) => {
      const ORDER = ["proposed", "evidenced", "authorized", "executing", "validating", "completed", "rejected", "reverted"];
      const prevIdx = ORDER.indexOf(s.prevStatus as string);
      const currIdx = ORDER.indexOf(s.status as string);
      if (prevIdx !== -1 && currIdx !== -1 && currIdx < prevIdx) {
        return { passed: false, counterexample: `Status regression: ${s.prevStatus} -> ${s.status}` };
      }
      return { passed: true };
    },
  },
  {
    id: "P-I003", description: "Every completed intent was once authorized — status chain integrity",
    check: (s) => {
      if (s.status === "completed" && s.history && !(s.history as string[]).includes("authorized")) {
        return { passed: false, counterexample: "Completed intent never passed through authorized state" };
      }
      return { passed: true };
    },
  },
  {
    id: "P-I004", description: "Evidence verified before authorization — all evidence for authorized intents is verified",
    check: (s) => {
      if (s.status === "authorized" && Array.isArray(s.evidenceVerified)) {
        const allVerified = (s.evidenceVerified as boolean[]).every((v) => v === true);
        if (!allVerified) return { passed: false, counterexample: "Intent authorized with unverified evidence" };
      }
      return { passed: true };
    },
  },
  {
    id: "P-I005", description: "CSR entries form a valid hash chain — each entry's previousHash matches prior entry's hash",
    check: (s) => {
      if (s.csrChain) {
        const chain = s.csrChain as Array<{ previousHash: string; hash: string }>;
        for (let i = 1; i < chain.length; i++) {
          if (chain[i].previousHash !== chain[i - 1].hash) {
            return { passed: false, counterexample: `CSR hash chain broken at index ${i}` };
          }
        }
      }
      return { passed: true };
    },
  },
  {
    id: "P-I006", description: "Agent actions respect governance boundaries — no action outside allowed set",
    check: (s) => {
      if (s.action && s.allowedActions) {
        const actionType = s.action as string;
        const allowed = s.allowedActions as string[];
        if (!allowed.includes(actionType)) {
          return { passed: false, counterexample: `Action '${actionType}' not in allowed set [${allowed.join(", ")}]` };
        }
      }
      return { passed: true };
    },
  },
  {
    id: "P-I007", description: "Federated actions require an active treaty between worlds",
    check: (s) => {
      if (s.federatedAction && s.treaties) {
        const action = s.federatedAction as { sourceWorld: string; targetWorld: string };
        const treaties = s.treaties as Array<{ worlds: string[]; active: boolean }>;
        const hasTreaty = treaties.some((t) => t.active && t.worlds.includes(action.sourceWorld) && t.worlds.includes(action.targetWorld));
        if (!hasTreaty) {
          return { passed: false, counterexample: `No active treaty between ${action.sourceWorld} and ${action.targetWorld}` };
        }
      }
      return { passed: true };
    },
  },
  {
    id: "P-I008", description: "Resource consumption never exceeds budget limits",
    check: (s) => {
      if (s.unit && s.consumed !== undefined && s.limit !== undefined) {
        if ((s.consumed as number) > (s.limit as number)) {
          return { passed: false, counterexample: `${s.unit} consumption ${s.consumed} exceeds limit ${s.limit}` };
        }
      }
      return { passed: true };
    },
  },
];

export function registerPredicate(predicate: StatePredicate): void {
  CONSTITUTIONAL_PREDICATES.push(predicate);
}

export function getPredicates(): readonly StatePredicate[] {
  return CONSTITUTIONAL_PREDICATES;
}

export function verifyPredicate(predicateId: string, states: ModelState[]): VerificationResult {
  const predicate = CONSTITUTIONAL_PREDICATES.find((p) => p.id === predicateId);
  if (!predicate) return { predicateId, description: "Unknown", passed: false, statesChecked: 0, counterexample: "Predicate not found" };

  for (const state of states) {
    const result = predicate.check(state.values);
    if (!result.passed) {
      return {
        predicateId, description: predicate.description, passed: false,
        statesChecked: states.indexOf(state) + 1, counterexample: `State '${state.label}': ${result.counterexample}`,
      };
    }
  }
  return { predicateId, description: predicate.description, passed: true, statesChecked: states.length };
}

export function verifyAllPredicates(states: ModelState[]): VerificationResult[] {
  return CONSTITUTIONAL_PREDICATES.map((p) => verifyPredicate(p.id, states));
}

export function generateModelStates(
  statuses: string[],
  actionTypes: string[],
  roles: string[],
): ModelState[] {
  const states: ModelState[] = [];
  for (const status of statuses) {
    for (const action of actionTypes) {
      for (const role of roles) {
        states.push({
          label: `status=${status},action=${action},role=${role}`,
          values: {
            status,
            prevStatus: "proposed",
            action,
            allowedActions: ["edit", "plan", "review", "validate"],
            role,
            evidenceIds: status === "proposed" ? [] : ["ev-1"],
            evidenceVerified: [true],
            history: ["proposed", "evidenced", "authorized", "executing", "validating"],
            intentId: `model-intent-${Math.random().toString(36).slice(2, 6)}`,
            csrChain: [
              { previousHash: "genesis", hash: "abc" },
              { previousHash: "abc", hash: "def" },
            ],
          },
        });
      }
    }
  }
  return states;
}

export function getModelCheckerStatus(): { predicateCount: number; lastRun: string | null } {
  return { predicateCount: CONSTITUTIONAL_PREDICATES.length, lastRun: null };
}
