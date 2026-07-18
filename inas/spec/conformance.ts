/** Conformance contract — required, optional, and forbidden behaviors with conformance test suites. */
import type { UUID, Authority } from "./core";
import type { EvidencePrimitive } from "./evidence";
import type { AssuranceLevel } from "./assurance";

/** Conformance requirement category. */
export type ConformanceCategory = "required" | "optional" | "forbidden";

/** A single conformance requirement. */
export interface ConformanceRequirement {
  id: string;
  category: ConformanceCategory;
  description: string;
  standard: string;
  testCases: string[];
}

/** Conformance contract — the full set of requirements a runtime must satisfy. */
export interface ConformanceContract {
  id: UUID;
  version: string;
  inasVersion: string;
  requirements: ConformanceRequirement[];
  authority: Authority;
}

/** Result of running a conformance test case. */
export interface ConformanceTestResult {
  testId: string;
  requirementId: string;
  passed: boolean;
  detail?: string;
  evidence?: EvidencePrimitive[];
}

/** Full conformance validation result for a runtime. */
export interface ConformanceValidation {
  runtime: string;
  runtimeVersion: string;
  contract: UUID;
  results: ConformanceTestResult[];
  overall: "pass" | "fail" | "conditional";
  summary: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
  };
  assuranceLevel: AssuranceLevel;
}

/** Default INAS conformance contract. */
export const DEFAULT_CONFORMANCE_CONTRACT: ConformanceContract = {
  id: "00000000-0000-0000-0000-000000000001" as UUID,
  version: "1.0.0",
  inasVersion: "1.0.0",
  authority: "INAS",
  requirements: [
    // ---- Required Behaviors ----
    {
      id: "R-001",
      category: "required",
      description: "Must interpret intents via ISL semantics",
      standard: "INAS Interoperability Article 2",
      testCases: ["INTENT-01", "INTENT-02"],
    },
    {
      id: "R-002",
      category: "required",
      description: "Must validate evidence before execution",
      standard: "INAS Evidence Article 2",
      testCases: ["EVIDENCE-01", "EVIDENCE-02"],
    },
    {
      id: "R-003",
      category: "required",
      description: "Must produce CSR lineage for all state changes",
      standard: "INAS Lineage Article 1",
      testCases: ["CSR-01", "CSR-02"],
    },
    {
      id: "R-004",
      category: "required",
      description: "Must uphold INAS assurance invariants",
      standard: "INAS Assurance Article 3",
      testCases: ["ASSURANCE-01", "ASSURANCE-02"],
    },
    {
      id: "R-005",
      category: "required",
      description: "Must support CCR exchange for cross-runtime interoperability",
      standard: "INAS Interoperability Article 1",
      testCases: ["CCR-01", "CCR-02"],
    },
    {
      id: "R-006",
      category: "required",
      description: "Must support deterministic replay of intents and state transitions",
      standard: "INAS Evidence Article 3",
      testCases: ["REPLAY-01", "REPLAY-02"],
    },
    {
      id: "R-007",
      category: "required",
      description: "Must implement CIC for inference governance",
      standard: "INAS Interoperability Article 3",
      testCases: ["CIC-01"],
    },
    {
      id: "R-008",
      category: "required",
      description: "Must implement CCC for continuity governance",
      standard: "INAS Interoperability Article 3",
      testCases: ["CCC-01"],
    },
    // ---- Optional Behaviors ----
    {
      id: "O-001",
      category: "optional",
      description: "Performance optimizations are permitted if they do not alter constitutional semantics",
      standard: "INAS Conformance Article 2",
      testCases: [],
    },
    {
      id: "O-002",
      category: "optional",
      description: "Hardware acceleration is permitted if replay remains deterministic",
      standard: "INAS Conformance Article 2",
      testCases: ["REPLAY-03"],
    },
    {
      id: "O-003",
      category: "optional",
      description: "Distributed execution is permitted if lineage is preserved",
      standard: "INAS Conformance Article 2",
      testCases: ["CSR-03"],
    },
    // ---- Forbidden Behaviors ----
    {
      id: "F-001",
      category: "forbidden",
      description: "Evidence suppression — must not hide or delete evidence records",
      standard: "INAS Conformance Article 3",
      testCases: ["EVIDENCE-03"],
    },
    {
      id: "F-002",
      category: "forbidden",
      description: "Evidence mutation — must not alter evidence after recording",
      standard: "INAS Conformance Article 3",
      testCases: ["EVIDENCE-04"],
    },
    {
      id: "F-003",
      category: "forbidden",
      description: "Non-deterministic replay — replay of same input must produce same output",
      standard: "INAS Conformance Article 3",
      testCases: ["REPLAY-04"],
    },
    {
      id: "F-004",
      category: "forbidden",
      description: "Authority spoofing — must not falsify authority claims",
      standard: "INAS Conformance Article 3",
      testCases: ["AUTH-01"],
    },
    {
      id: "F-005",
      category: "forbidden",
      description: "Lineage erasure — must not remove or truncate lineage records",
      standard: "INAS Conformance Article 3",
      testCases: ["CSR-04"],
    },
  ],
};

/** Conformance test suite definition. */
export interface ConformanceTestSuite {
  id: string;
  name: string;
  description: string;
  tests: ConformanceTestCase[];
}

export interface ConformanceTestCase {
  id: string;
  name: string;
  description: string;
  input: unknown;
  expectedOutput: unknown;
  category: ConformanceCategory;
}
