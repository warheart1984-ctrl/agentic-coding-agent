/**
 * Conversation memory — sliding window + LLM summarization.
 */
import { completeText } from "../model/llmClient";

export interface Message {
  role: "user" | "assistant";
  content: string;
}

const MAX_RECENT = 12;
const recentMessages: Message[] = [];
let summary = "";

export function addMessage(msg: Message): void {
  recentMessages.push(msg);
  if (recentMessages.length > MAX_RECENT * 2) {
    summarize();
    recentMessages.splice(0, recentMessages.length - MAX_RECENT);
  }
}

async function summarize(): Promise<void> {
  const text = recentMessages.map((m) => `${m.role}: ${m.content}`).join("\n");
  try {
      const s = await completeText(`Summarize this conversation compactly:\n${text}`, { maxTokens: 200 });
    summary = s.trim();
  } catch {
    summary = "(summary unavailable)";
  }
}

export function getConversationSummary(): string {
  return summary || "(no prior conversation)";
}

export function getRecentMessages(): Message[] {
  return [...recentMessages];
}
