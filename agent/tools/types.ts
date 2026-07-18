/**
 * Tool system — governed tools that Nova can use to read, write, search,
 * and run commands in the workspace. Every tool invocation goes through
 * governance (validation + receipt) just like any other agent action.
 */

export interface ToolInputSchema {
  type: "string" | "number" | "boolean" | "array" | "object";
  description: string;
  required?: boolean;
  properties?: Record<string, ToolInputSchema>;
}

export interface Tool {
  name: string;
  description: string;
  inputSchema: Record<string, ToolInputSchema>;
  execute(args: Record<string, unknown>): Promise<ToolResult>;
}

export interface ToolResult {
  success: boolean;
  output?: string;
  error?: string;
  meta?: Record<string, unknown>;
}

export interface ToolCall {
  tool: string;
  args: Record<string, unknown>;
  result?: ToolResult;
}

export interface AgentTaskStep {
  id: string;
  description: string;
  toolCalls: ToolCall[];
  status: "pending" | "running" | "done" | "failed";
  result?: string;
}

export interface AgentTaskPlan {
  task: string;
  steps: AgentTaskStep[];
}

export type MessageRole = "user" | "assistant" | "tool";

export interface ConversationMessage {
  role: MessageRole;
  content: string;
  toolCalls?: ToolCall[];
  timestamp: number;
}
