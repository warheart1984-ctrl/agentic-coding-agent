/** Arena Certification Protocol — certification requirements, evidence, and validation procedures. */
import type { UUID, Timestamp, Authority } from "./core";
import type { AssuranceLevel, AssuranceProof } from "./assurance";
import type { ConformanceValidation } from "./conformance";
import type { EvidenceRecord } from "./evidence";
import type { CCR } from "./ccr";
import type { CSR } from "./csr";

/** Arena certification level. */
export type CertificationLevel = "C0" | "C1" | "C2" | "C3";

/** Mapping from assurance levels to certification levels. */
export function assuranceToCertification(assurance: AssuranceLevel): CertificationLevel {
  const map: Record<AssuranceLevel, CertificationLevel> = {
    A0: "C0",
    A1: "C1",
    A2: "C2",
    A3: "C3",
  };
  return map[assurance] ?? "C0";
}

/** Arena — an environment where constitutional computing is certified. */
export interface Arena {
  id: UUID;
  name: string;
  version: string;
  certificationLevel: CertificationLevel;
  runtime: string;
  runtimeVersion: string;
  authority: Authority;
  certifiedAt: Timestamp;
  expiresAt?: Timestamp;
}

/** Certification evidence — proof that a runtime meets arena requirements. */
export interface CertificationEvidence {
  arena: UUID;
  conformanceValidation: ConformanceValidation;
  assuranceProofs: AssuranceProof[];
  evidenceSamples: EvidenceRecord[];
  ccrs: CCR[];
  csrs: CSR[];
  timestamp: Timestamp;
}

/** Arena requirement — what a runtime must demonstrate to be certified. */
export interface ArenaRequirement {
  id: string;
  level: CertificationLevel;
  category: "evidence" | "assurance" | "conformance" | "interoperability" | "lineage";
  description: string;
  testIds: string[];
  mandatory: boolean;
}

/** Certification procedure — steps to certify a runtime. */
export interface CertificationProcedure {
  arena: UUID;
  steps: CertificationStep[];
  estimatedDuration: string;
}

export interface CertificationStep {
  order: number;
  name: string;
  description: string;
  input: unknown;
  expectedOutput: unknown;
  evidenceRequired: boolean;
}

/** Certification result. */
export interface CertificationResult {
  arena: UUID;
  runtime: string;
  runtimeVersion: string;
  level: CertificationLevel;
  passed: boolean;
  procedure: CertificationProcedure;
  evidence: CertificationEvidence;
  issuedAt: Timestamp;
  expiresAt?: Timestamp;
  issuedBy: Authority;
}

/** Predefined arena requirements by certification level. */
export const ARENA_REQUIREMENTS: Record<CertificationLevel, ArenaRequirement[]> = {
  C0: [
    {
      id: "AR-C0-001",
      level: "C0",
      category: "evidence",
      description: "Must produce at least one evidence primitive per operation",
      testIds: ["EVIDENCE-01"],
      mandatory: true,
    },
  ],
  C1: [
    {
      id: "AR-C1-001",
      level: "C1",
      category: "evidence",
      description: "Must produce evidence with provenance for all operations",
      testIds: ["EVIDENCE-01", "EVIDENCE-02"],
      mandatory: true,
    },
    {
      id: "AR-C1-002",
      level: "C1",
      category: "assurance",
      description: "Must meet A1 assurance level requirements",
      testIds: ["ASSURANCE-01"],
      mandatory: true,
    },
    {
      id: "AR-C1-003",
      level: "C1",
      category: "conformance",
      description: "Must pass all required conformance tests",
      testIds: ["R-001", "R-002"],
      mandatory: true,
    },
  ],
  C2: [
    {
      id: "AR-C2-001",
      level: "C2",
      category: "evidence",
      description: "Must produce full evidence chains with cryptographic integrity",
      testIds: ["EVIDENCE-01", "EVIDENCE-02", "EVIDENCE-03"],
      mandatory: true,
    },
    {
      id: "AR-C2-002",
      level: "C2",
      category: "assurance",
      description: "Must meet A2 assurance level requirements",
      testIds: ["ASSURANCE-01", "ASSURANCE-02"],
      mandatory: true,
    },
    {
      id: "AR-C2-003",
      level: "C2",
      category: "conformance",
      description: "Must pass all required conformance tests",
      testIds: ["R-001", "R-002", "R-003", "R-004", "R-006", "R-007", "R-008"],
      mandatory: true,
    },
    {
      id: "AR-C2-004",
      level: "C2",
      category: "interoperability",
      description: "Must support CCR exchange format",
      testIds: ["CCR-01"],
      mandatory: true,
    },
    {
      id: "AR-C2-005",
      level: "C2",
      category: "lineage",
      description: "Must maintain complete CSR lineage",
      testIds: ["CSR-01", "CSR-02"],
      mandatory: true,
    },
  ],
  C3: [
    {
      id: "AR-C3-001",
      level: "C3",
      category: "evidence",
      description: "Must support federated evidence exchange",
      testIds: ["EVIDENCE-01", "EVIDENCE-02", "EVIDENCE-03", "EVIDENCE-04"],
      mandatory: true,
    },
    {
      id: "AR-C3-002",
      level: "C3",
      category: "assurance",
      description: "Must meet A3 assurance level (Federated Assurance)",
      testIds: ["ASSURANCE-01", "ASSURANCE-02", "ASSURANCE-03"],
      mandatory: true,
    },
    {
      id: "AR-C3-003",
      level: "C3",
      category: "conformance",
      description: "Must pass all required conformance tests",
      testIds: ["R-001", "R-002", "R-003", "R-004", "R-005", "R-006", "R-007", "R-008"],
      mandatory: true,
    },
    {
      id: "AR-C3-004",
      level: "C3",
      category: "interoperability",
      description: "Must support full federated CCR exchange across runtimes",
      testIds: ["CCR-01", "CCR-02", "CCR-03"],
      mandatory: true,
    },
    {
      id: "AR-C3-005",
      level: "C3",
      category: "lineage",
      description: "Must support cross-runtime lineage verification",
      testIds: ["CSR-01", "CSR-02", "CSR-03", "CSR-04"],
      mandatory: true,
    },
  ],
};
