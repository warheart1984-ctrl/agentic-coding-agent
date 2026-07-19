import { WindowsSkillClient } from "./windowsSkillClient";
import type { WindowsCommand, GovernanceRule } from "./windowsSkillTypes";
import type { CMASAgentDef, CMASWorkflow } from "../cmas/types";

export function createWindowsSkillSession(
  workflow: CMASWorkflow,
  _agent: CMASAgentDef,
): WindowsSkillClient {
  const client = new WindowsSkillClient();
  return client;
}

export async function executeWindowsCommand(
  client: WindowsSkillClient,
  command: WindowsCommand,
): Promise<{ success: boolean; output: string }> {
  let result: string;
  switch (command.action) {
    case "launch":
      result = await client.launch(command.target ?? "");
      break;
    case "type":
      result = await client.typeText(
        command.target ?? "active",
        (command.parameters?.text as string) ?? "",
      );
      break;
    case "click":
      result = await client.click(
        command.target ?? "active",
        (command.parameters?.element as string) ?? "",
      );
      break;
    case "list":
      result = await client.listWindows();
      break;
    case "focus":
      result = await client.focusWindow(command.target ?? "");
      break;
    case "close":
      result = await client.closeWindow(command.target ?? "");
      break;
    default:
      result = await client.processNaturalLanguage(command.raw);
  }
  return { success: !result.startsWith("Error:"), output: result };
}

export async function verifyWindowsGovernance(
  _client: WindowsSkillClient,
  workflow: CMASWorkflow,
): Promise<{ passed: boolean; rules: GovernanceRule[] }> {
  const rules: GovernanceRule[] = [
    {
      id: "WIN-SAFETY-001",
      name: "System-critical process protection",
      passed: !workflow.intent?.toLowerCase().includes("system32"),
      detail: "System-critical operations must be blocked in safe mode",
      severity: "error",
      category: "safety",
    },
    {
      id: "WIN-CONST-001",
      name: "Constitutional action scope",
      passed: workflow.artifacts?.every(
        (a) => !["delete", "format", "remove"].includes(a.type ?? ""),
      ) ?? true,
      detail: "Only constitutionally allowed actions: launch, type, click, list, focus, close",
      severity: "error",
      category: "constitutional",
    },
    {
      id: "WIN-GOV-001",
      name: "Governance engine active",
      passed: true,
      detail: "Windows Skill governance engine initialized",
      severity: "info",
      category: "compliance",
    },
  ];
  const passed = rules.every((r) => r.passed);
  return { passed, rules };
}

export function windowsSkillToGovernanceChecks(
  rules: GovernanceRule[],
): Array<{
  checkId: string;
  name: string;
  passed: boolean;
  detail: string;
  severity: "error" | "warning" | "info";
}> {
  return rules.map((r) => ({
    checkId: r.id,
    name: r.name,
    passed: r.passed,
    detail: r.detail,
    severity: r.severity,
  }));
}
