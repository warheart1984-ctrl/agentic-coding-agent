import { execSync, exec } from "child_process";
import { promisify } from "util";
import * as path from "path";
import type {
  WindowsCommand,
  WindowsAction,
  WindowsSkillConfig,
  CLIConfig,
} from "./windowsSkillTypes";

const execAsync = promisify(exec);
const DEFAULT_NODE_DIR = "G:\\windows-skill";

export class WindowsSkillClient {
  private skillDir: string;
  private config: CLIConfig | null;

  constructor(config?: WindowsSkillConfig) {
    this.skillDir = config?.skillModulePath ?? DEFAULT_NODE_DIR;
    this.config = null;
  }

  async initialize(): Promise<void> {
    try {
      const result = execSync(
        `node -e "const c = require(${JSON.stringify(path.join(this.skillDir, "dist", "index.js"))}); process.exit(0)"`,
        { encoding: "utf-8", timeout: 10000 },
      );
    } catch {
      // fallback: try source
    }
  }

  async executeCommand(command: string): Promise<{ output: string; errors: string[] }> {
    try {
      const result = execSync(
        `node ${JSON.stringify(path.join(this.skillDir, "dist", "cli.js"))} ${command}`,
        { encoding: "utf-8", timeout: 30000 },
      );
      return { output: result.trim(), errors: [] };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { output: "", errors: [message] };
    }
  }

  async launch(appName: string): Promise<string> {
    const { output, errors } = await this.executeCommand(`launch ${appName}`);
    return errors.length > 0 ? `Error: ${errors[0]}` : output;
  }

  async typeText(windowName: string, text: string): Promise<string> {
    const { output, errors } = await this.executeCommand(`type ${windowName} "${text}"`);
    return errors.length > 0 ? `Error: ${errors[0]}` : output;
  }

  async click(windowName: string, element: string): Promise<string> {
    const { output, errors } = await this.executeCommand(`click ${windowName} ${element}`);
    return errors.length > 0 ? `Error: ${errors[0]}` : output;
  }

  async listWindows(): Promise<string> {
    const { output, errors } = await this.executeCommand("list");
    return errors.length > 0 ? `Error: ${errors[0]}` : output;
  }

  async focusWindow(windowName: string): Promise<string> {
    const { output, errors } = await this.executeCommand(`focus ${windowName}`);
    return errors.length > 0 ? `Error: ${errors[0]}` : output;
  }

  async closeWindow(windowName: string): Promise<string> {
    const { output, errors } = await this.executeCommand(`close ${windowName}`);
    return errors.length > 0 ? `Error: ${errors[0]}` : output;
  }

  async processNaturalLanguage(command: string): Promise<string> {
    const { output, errors } = await this.executeCommand(`ask ${command}`);
    return errors.length > 0 ? `Error: ${errors[0]}` : output;
  }

  async shutdown(): Promise<void> {
  }
}
