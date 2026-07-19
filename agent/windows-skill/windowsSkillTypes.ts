export type WindowsAction = "launch" | "type" | "click" | "list" | "focus" | "close";

export interface WindowsCommand {
  action: WindowsAction | string;
  target?: string;
  parameters?: Record<string, unknown>;
  raw: string;
}

export interface CLIConfig {
  llm: {
    enabled: boolean;
    provider: string;
    apiKey: string;
    model: string;
    maxTokens: number;
  };
  governance: {
    enabled: boolean;
    confirmationRequired: boolean;
    logLevel: string;
    safeMode: boolean;
  };
  windows: {
    uiAutomation: boolean;
    processMonitoring: boolean;
    windowControl: boolean;
  };
}

export interface GovernanceRule {
  id: string;
  name: string;
  passed: boolean;
  detail: string;
  severity: "error" | "warning" | "info";
  category: "safety" | "constitutional" | "compliance";
}

export interface LLMConfig {
  enabled: boolean;
  provider: string;
  apiKey: string;
  model: string;
  maxTokens: number;
}

export interface WindowsSkillConfig {
  cliConfig?: Partial<CLIConfig>;
  pythonPath?: string;
  skillModulePath?: string;
}
