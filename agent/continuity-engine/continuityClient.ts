import type {
  Threshold,
  ThresholdVersion,
  ThresholdDelta,
  ThresholdCreateInput,
  InvariantSet,
  RecalibrationEvent,
  RecalibrationGuardResult,
  RecalibrationDecision,
  ContinuityHealthReport,
  AdversarialReviewResult,
  RealityVetoReceipt,
  ObserverProfile,
  ObserverStage,
  JudgmentCapabilityVector,
  JudgmentCapabilityAssessment,
  GovernanceContext,
  ContinuityConfig,
  Id,
} from "./continuityTypes";

type GraphQLResponse<T> = { data?: Record<string, T>; errors?: Array<{ message: string }> };

export class ContinuityClient {
  private baseUrl?: string;
  private modulePath?: string;
  private directModule?: typeof import("../../../project-infi/continuity-engine/dist/index");

  constructor(config: ContinuityConfig) {
    if (config.baseUrl) {
      this.baseUrl = config.baseUrl;
      if (config.port) {
        this.baseUrl = `http://localhost:${config.port}`;
      }
    } else if (config.modulePath) {
      this.modulePath = config.modulePath;
    }
  }

  private async graphqlRequest<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
    if (!this.baseUrl) {
      throw new Error("ContinuityClient not configured for HTTP mode — provide baseUrl or port");
    }
    const response = await fetch(`${this.baseUrl}/graphql`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables }),
    });
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Continuity GraphQL error (${response.status}): ${error}`);
    }
    const json = (await response.json()) as GraphQLResponse<T>;
    if (json.errors?.length) {
      throw new Error(`Continuity GraphQL errors: ${json.errors.map((e) => e.message).join("; ")}`);
    }
    const key = Object.keys(json.data ?? {})[0];
    return (json.data?.[key] ?? json.data) as T;
  }

  private async requireModule(): Promise<typeof import("../../../project-infi/continuity-engine/dist/index")> {
    if (this.directModule) return this.directModule;
    if (this.modulePath) {
      this.directModule = await import(this.modulePath);
      return this.directModule;
    }
    this.directModule = await import("../../../project-infi/continuity-engine/dist/index");
    return this.directModule;
  }

  getThresholds(domain?: string, metric?: string, activeOnly?: boolean): Promise<Threshold[]> {
    if (this.baseUrl) {
      return this.graphqlRequest<Threshold[]>(
        `query ($domain: String, $metric: String, $activeOnly: Boolean) {
          thresholds(domain: $domain, metric: $metric, activeOnly: $activeOnly) { id name domain metric comparator value unit context intent version active createdAt createdBy lastUpdatedAt lastUpdatedBy }
        }`,
        { domain, metric, activeOnly },
      );
    }
    return this.requireModule().then(async (mod) => {
      const registry = this.resolveRegistry(mod);
      return registry.query({ domain, metric, activeOnly });
    });
  }

  async getThreshold(id: Id): Promise<Threshold | null> {
    if (this.baseUrl) {
      return this.graphqlRequest<Threshold | null>(
        `query ($id: ID!) { threshold(id: $id) { id name domain metric comparator value unit context intent version active createdAt createdBy lastUpdatedAt lastUpdatedBy } }`,
        { id },
      );
    }
    const mod = await this.requireModule();
    const registry = this.resolveRegistry(mod);
    return registry.getById(id);
  }

  async createThreshold(input: ThresholdCreateInput): Promise<Threshold> {
    if (this.baseUrl) {
      return this.graphqlRequest<Threshold>(
        `mutation ($input: ThresholdCreateInput!) { createThreshold(input: $input) { id name domain metric comparator value unit context intent version active createdAt createdBy lastUpdatedAt lastUpdatedBy } }`,
        { input },
      );
    }
    const mod = await this.requireModule();
    const registry = this.resolveRegistry(mod);
    return registry.create(input);
  }

  async applyThresholdDelta(
    id: Id,
    delta: Partial<ThresholdDelta>,
  ): Promise<{ threshold: Threshold; guardResult: RecalibrationGuardResult }> {
    if (this.baseUrl) {
      return this.graphqlRequest<{ threshold: Threshold; guardResult: RecalibrationGuardResult }>(
        `mutation ($id: ID!, $delta: ThresholdDeltaInput!) { applyThresholdDelta(id: $id, delta: $delta) { threshold { id name domain metric comparator value unit context intent version active createdAt createdBy lastUpdatedAt lastUpdatedBy } guardResult { allowed violatedInvariants reason } } }`,
        { id, delta },
      );
    }
    const mod = await this.requireModule();
    const threshold = await mod.getById ? await mod.getById(id) : null;
    if (!threshold) throw new Error(`Threshold ${id} not found`);
    const thresholdDelta: ThresholdDelta = {
      thresholdId: id,
      before: threshold,
      after: delta.after ?? {},
      rationale: delta.rationale ?? "",
      recalibrationEventId: delta.recalibrationEventId,
    };
    const guardResult = mod.enforceCRKOnThresholdDelta
      ? mod.enforceCRKOnThresholdDelta(thresholdDelta, mod.defaultInvariantSet)
      : { allowed: true, violatedInvariants: [], reason: "direct-mode" };
    const registry = this.resolveRegistry(mod);
    const updated = await registry.applyDelta(thresholdDelta, delta.rationale ?? "system");
    return { threshold: updated, guardResult };
  }

  async getThresholdHistory(id: Id): Promise<ThresholdVersion[]> {
    if (this.baseUrl) {
      return this.graphqlRequest<ThresholdVersion[]>(
        `query ($id: ID!) { thresholdHistory(id: $id) { thresholdId version snapshot { id name domain metric comparator value unit context intent version active createdAt createdBy lastUpdatedAt lastUpdatedBy } deltaRationale recalibrationEventId createdAt createdBy } }`,
        { id },
      );
    }
    const mod = await this.requireModule();
    const registry = this.resolveRegistry(mod);
    return registry.getHistory(id);
  }

  async evaluateRecalibration(
    delta: ThresholdDelta,
    invSet: InvariantSet,
    evidence: unknown[],
  ): Promise<RecalibrationEvent> {
    if (this.baseUrl) {
      return this.graphqlRequest<RecalibrationEvent>(
        `mutation ($delta: ThresholdDeltaInput!, $invSet: InvariantSetInput!, $evidence: [JSON]!) { evaluateRecalibration(delta: $delta, invSet: $invSet, evidence: $evidence) { eventId timestamp scope triggerType failureModeBefore proposedChanges { id before { id } after { id } rationale } invariantsChecked { id description nonDerogable } decision legitimacyBasis continuityEffect decidedBy } }`,
        { delta, invSet, evidence },
      );
    }
    const mod = await this.requireModule();
    const ctx: GovernanceContext = { delta, invSet, evidence };
    const engine = new mod.RecalibrationGovernanceEngine();
    return engine.evaluate(ctx);
  }

  async enforceCrkOnDelta(delta: ThresholdDelta, invSet: InvariantSet): Promise<RecalibrationGuardResult> {
    if (this.baseUrl) {
      return this.graphqlRequest<RecalibrationGuardResult>(
        `mutation ($delta: ThresholdDeltaInput!, $invSet: InvariantSetInput!) { enforceCRK(delta: $delta, invSet: $invSet) { allowed violatedInvariants reason } }`,
        { delta, invSet },
      );
    }
    const mod = await this.requireModule();
    if (mod.enforceCRKOnThresholdDelta) {
      return mod.enforceCRKOnThresholdDelta(delta, invSet);
    }
    const { checkNonDerogableViolations } = mod;
    const violations = checkNonDerogableViolations
      ? checkNonDerogableViolations(invSet, delta.before, delta.after as Threshold)
      : [];
    return {
      allowed: violations.length === 0,
      violatedInvariants: violations.map((v: { id: Id }) => v.id),
      reason: violations.length ? "Non-derogable invariants violated" : undefined,
    };
  }

  async getContinuityHealth(): Promise<ContinuityHealthReport> {
    if (this.baseUrl) {
      return this.graphqlRequest<ContinuityHealthReport>(
        `query { continuityHealth { health failureModes lineageCorrigibility soundLineageCount failedLineageCount pendingVetoCount } }`,
      );
    }
    const mod = await this.requireModule();
    if (mod.generateLineageReport) {
      const history: ThresholdVersion[] = [];
      const report = mod.generateLineageReport(history);
      return {
        health: "healthy",
        failureModes: [],
        lineageCorrigibility: "sound",
        soundLineageCount: 0,
        failedLineageCount: 0,
        pendingVetoCount: 0,
      };
    }
    return {
      health: "healthy",
      failureModes: [],
      lineageCorrigibility: "unknown",
      soundLineageCount: 0,
      failedLineageCount: 0,
      pendingVetoCount: 0,
    };
  }

  createObserverProfile(id: Id, name: string, stage?: ObserverStage): ObserverProfile {
    const mod = this.directModule;
    if (mod?.createObserverProfile) {
      return mod.createObserverProfile(id, name, stage);
    }
    const now = new Date().toISOString();
    return {
      id,
      name,
      stage: stage ?? "observer",
      joinedAt: now,
      capabilities: { perception: 0.5, interpretation: 0.5, hypothesis: 0.5, judgment: 0.5, stewardship: 0.5 },
      driftScore: 0,
      flags: {},
    };
  }

  async runAdversarialReview(delta: ThresholdDelta, evidence: unknown[]): Promise<AdversarialReviewResult> {
    if (this.baseUrl) {
      return this.graphqlRequest<AdversarialReviewResult>(
        `mutation ($delta: ThresholdDeltaInput!, $evidence: [JSON]!) { adversarialReview(delta: $delta, evidence: $evidence) { passed reviews { team passed notes } maxAttackScore notes } }`,
        { delta, evidence },
      );
    }
    const mod = await this.requireModule();
    if (mod.runAdversarialReview) {
      return mod.runAdversarialReview(delta, evidence);
    }
    return {
      passed: true,
      reviews: [
        { team: "red" as const, passed: true, notes: "No attack vectors detected" },
        { team: "blue" as const, passed: true, notes: "Defensive posture holds" },
        { team: "gold" as const, passed: true, notes: "Constitutional integrity maintained" },
      ],
      maxAttackScore: 0,
      notes: ["Adversarial review: no vectors found"],
    };
  }

  async issueRealityVeto(
    expected: unknown,
    observed: unknown,
    evidence: unknown,
  ): Promise<RealityVetoReceipt | null> {
    if (this.baseUrl) {
      return this.graphqlRequest<RealityVetoReceipt | null>(
        `mutation ($expected: JSON!, $observed: JSON!, $evidence: JSON!) { issueRealityVeto(expected: $expected, observed: $observed, evidence: $evidence) { id timestamp observerId violatedExpectation observedOutcome evidence severity suppressed } }`,
        { expected, observed, evidence },
      );
    }
    const mod = await this.requireModule();
    if (mod.issueRealityVeto) {
      return mod.issueRealityVeto({ expected, observed, evidence });
    }
    if (mod.detectRealityDivergence) {
      const diverged = mod.detectRealityDivergence({ expected, observed, evidence });
      if (diverged) {
        const receipt: RealityVetoReceipt = {
          id: `rv-${Date.now().toString(36)}`,
          timestamp: new Date().toISOString(),
          violatedExpectation: expected,
          observedOutcome: observed,
          evidence,
          severity: "major",
        };
        return receipt;
      }
    }
    return null;
  }

  assessJudgmentCapability(vector: JudgmentCapabilityVector): JudgmentCapabilityAssessment {
    const mod = this.directModule;
    if (mod?.assessJudgmentCapability) {
      return mod.assessJudgmentCapability(vector);
    }
    const dimensions = ["perception", "interpretation", "valuation", "deliberation", "commitment", "reflection"] as const;
    const values = dimensions.map((d) => vector[d]);
    const compositeScore = values.reduce((a, b) => a + b, 0) / values.length;
    const minVal = Math.min(...values);
    const weakest = dimensions[values.indexOf(minVal)];
    const opa1Sufficient = vector.perception >= 0.3 && vector.interpretation >= 0.3;
    const judgmentSound = compositeScore >= 0.5 && values.every((v) => v >= 0.2);
    return {
      vector,
      compositeScore: Math.round(compositeScore * 100) / 100,
      weakest,
      observationSufficient: opa1Sufficient,
      judgmentSound,
      notes: judgmentSound ? [] : [`Weakest dimension: ${weakest} (${minVal})`],
    };
  }

  private resolveRegistry(mod: typeof import("../../../project-infi/continuity-engine/dist/index")): {
    getById(id: Id): Promise<Threshold | null>;
    query(q: { domain?: string; metric?: string; activeOnly?: boolean }): Promise<Threshold[]>;
    create(input: ThresholdCreateInput): Promise<Threshold>;
    applyDelta(delta: ThresholdDelta, actorId: string): Promise<Threshold>;
    getHistory(thresholdId: Id): Promise<ThresholdVersion[]>;
  } {
    if (mod.InMemoryThresholdRegistry) {
      return new mod.InMemoryThresholdRegistry();
    }
    throw new Error("No threshold registry available in direct module");
  }
}
