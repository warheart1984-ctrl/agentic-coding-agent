// ──────────────────────────────────────────────
// v0.1 — Dependency-free compiler types
// ──────────────────────────────────────────────

export interface MytharConfig {
  host: string;
  port: number;
  apiKey?: string;
}

export interface MytharRegistryRef {
  id: string;
  form: string;
  domain?: string;
  meanings?: string[];
}

export type MytharV01Mode = "strict" | "exploratory";

export interface MytharExpression {
  expression: string;
  mode: MytharV01Mode;
}

export interface MytharDAGNode {
  id: string;
  type: "root" | "particle" | "operator" | "composite" | "grammar_lexeme";
  form: string;
  root_id?: string;
  domain?: string;
  meanings?: string[];
  particle_id?: string;
  frame?: string;
  operator_id?: string;
  effect?: string;
  components?: string[];
  function?: string;
}

export interface MytharDAGEdge {
  type: "frame" | "constitutional" | "inheritance" | "operator";
  from: string;
  to: string;
}

export interface SemanticDAG {
  kind: "directed_acyclic_graph";
  nodes: MytharDAGNode[];
  edges: MytharDAGEdge[];
  acyclic: boolean;
}

export interface MytharLineage {
  roots: string[];
  operators: string[];
  particle_frame: string | null;
  reduction_trace: Array<{
    token?: string;
    rule?: string;
    roots?: string[];
    result_node?: string;
    result?: string;
  }>;
}

export interface MytharDiagnosticV01 {
  code: string;
  severity: string;
  message: string;
  token?: string | null;
}

export interface MytharMeaning {
  components: string[];
  interpretation_mode: string;
}

export interface MytharSentenceRole {
  token: string;
  role: string;
}

export interface MytharCompilationResultV01 {
  registry_version: string;
  expression: string;
  mode: MytharV01Mode;
  valid: boolean;
  meaning: MytharMeaning;
  graph: SemanticDAG;
  lineage: MytharLineage;
  sentence_roles: MytharSentenceRole[];
  unresolved_tokens: string[];
  diagnostics: MytharDiagnosticV01[];
}

// ──────────────────────────────────────────────
// v0.2 — Explicit-parser types
// ──────────────────────────────────────────────

export type MytharParseWord =
  | { type: "root"; form: string; surface: string }
  | { type: "grammar_lexeme"; form: string; surface: string }
  | { type: "composite"; surface: string; components: MytharParseWord[] }
  | { type: "operated"; surface: string; operator: Record<string, unknown>; target: MytharParseWord }
  | { type: "unresolved"; form: string; surface: string };

export interface MytharParseTree {
  type: "sentence";
  source: string;
  particles: Array<{ type: "particle"; form: string; particle_id: string }>;
  words: MytharParseWord[];
}

export interface MytharDiagnosticV02 {
  code: string;
  severity: "error" | "warning";
  message: string;
  token?: string;
  location?: { token_index: number | null; span: string | null } | null;
}

export interface MytharAcyclicSemanticGraph {
  kind: "directed_acyclic_graph";
  nodes: MytharDAGNode[];
  edges: MytharDAGEdge[];
  acyclic: boolean;
}

export interface MytharCompilationResultV02 {
  registry_version: string;
  expression: string;
  mode: "strict" | "exploratory";
  valid: boolean;
  parse_tree: MytharParseTree;
  meaning: MytharMeaning;
  graph: MytharAcyclicSemanticGraph;
  lineage: MytharLineage;
  sentence_roles: MytharSentenceRole[];
  unresolved_tokens: string[];
  diagnostics: MytharDiagnosticV02[];
}

// ──────────────────────────────────────────────
// v0.2 — AST-only compilation types (mythar-v0.2)
// ──────────────────────────────────────────────

export interface MytharASTNode {
  kind: "Expression" | "Clause" | "Particle" | "Root" | "Composite" | "TenseLexeme" | "CaseLexeme" | "PronounLexeme" | "OperatorApplication" | "Unknown" | "Experimental";
  surface: string | null;
  token_index: number | null;
  particle_stack?: MytharASTNode[];
  terms?: MytharASTNode[];
  clauses?: MytharASTNode[];
  registry_ref?: string;
  operator_ref?: string;
  operator_form?: string;
  target?: MytharASTNode;
  components?: string[];
  features?: Record<string, string>;
  mode?: string;
  diagnostic?: string;
}

export interface MytharInvariant {
  id: string;
  name: string;
  passed: boolean;
}

export interface MytharDiagnostic {
  error_code: string;
  severity: "error" | "warning";
  message: string;
  location?: {
    token_index: number | null;
    span: string | null;
  } | null;
}

export interface MytharCompilationResult {
  api_version?: string;
  ast: MytharASTNode;
  registry_refs: string[];
  invariants: MytharInvariant[];
  diagnostics: MytharDiagnostic[];
  valid: boolean;
  isf?: Record<string, unknown>;
  translation?: {
    language: string;
    text: string;
  };
}

export interface MytharInvariantDef {
  expression: string;
  description: string;
  mode?: "strict" | "lenient";
  compilation?: MytharCompilationResult;
}

export interface MytharConstitutionalRule {
  id: string;
  color: string;
  invariants: MytharInvariantDef[];
  context: string;
}

export interface MytharGovernedReceipt {
  stage: string;
  color: string;
  invariant_expression: string;
  semantic_dag: MytharASTNode;
  lineage: string[];
  hash: string;
  valid: boolean;
  timestamp: string;
}

// ──────────────────────────────────────────────
// v0.2 REST API /v1/compile and /v2/compile types
// ──────────────────────────────────────────────

export interface MytharCompileRequest {
  expression?: string;
  source?: string;
  mode?: "strict" | "lenient";
  source_language?: string;
  format?: "ast" | "isf" | "english" | "mandarin";
}

export interface MytharCompileV2Request {
  source: string;
  source_language: string;
  format: "ast" | "isf";
  mode: "strict" | "lenient";
}

export interface MytharISFOutput {
  api_version: string;
  ast: MytharASTNode;
  registry_refs: string[];
  invariants: MytharInvariant[];
  diagnostics: MytharDiagnostic[];
  valid: boolean;
  isf: Record<string, unknown>;
}

export interface MytharTranslationOutput {
  language: string;
  text: string;
}

export interface MytharAAESEnvelope {
  aaes_id: string;
  expression: string;
  source_language: string;
  ast: MytharASTNode;
  isf: Record<string, unknown>;
  valid: boolean;
  timestamp: string;
}

// ──────────────────────────────────────────────
// Union type for versioned compilation results
// ──────────────────────────────────────────────

export type MytharAnyCompilationResult =
  | MytharCompilationResultV01
  | MytharCompilationResultV02
  | MytharCompilationResult;
