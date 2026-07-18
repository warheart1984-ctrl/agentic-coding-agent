export { AgentRuntime } from "./runtime/agent-runtime";
export * as governance from "./governance";
export * as continuity from "./continuity";
export * as events from "./events/lifecycle";
export * as federation from "./federation";
export * from "./types";
export * as inas from "../inas/spec";
export * as cmas from "./cmas";
export * as skills from "./skills";
export type { KernelStatus, KernelHeartbeat } from "./governance/kernelStatus";

/** @deprecated Use AgentRuntime — kept for backward compatibility */
export * as nova from "./core/agent";
/** @deprecated Use AgentRuntime.workspace helpers */
export * as runtime from "./runtime";
