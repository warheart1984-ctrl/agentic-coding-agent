import { execSync } from "child_process";

export interface SandboxResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
}

/**
 * Run a command with optional sandboxing.
 * When Docker is available, runs in an ephemeral container.
 * Falls back to direct execution on the host.
 */
export async function runInSandbox(
  repoPath: string,
  command: string,
  options?: { timeout?: number; useDocker?: boolean }
): Promise<SandboxResult> {
  const useDocker = options?.useDocker ?? false;

  if (useDocker) {
    return runInDocker(repoPath, command, options?.timeout ?? 60000);
  }

  return runDirect(repoPath, command, options?.timeout ?? 60000);
}

async function runDirect(repoPath: string, command: string, timeout: number): Promise<SandboxResult> {
  try {
    const stdout = execSync(command, {
      cwd: repoPath,
      encoding: "utf-8",
      timeout,
      maxBuffer: 10 * 1024 * 1024,
    });
    return { stdout, stderr: "", exitCode: 0 };
  } catch (err) {
    if (err instanceof Error) {
      return {
        stdout: (err as { stdout?: string }).stdout?.toString() ?? "",
        stderr: (err as { stderr?: string }).stderr?.toString() ?? err.message,
        exitCode: (err as { status?: number }).status ?? 1,
      };
    }
    return { stdout: "", stderr: String(err), exitCode: 1 };
  }
}

async function runInDocker(repoPath: string, command: string, timeout: number): Promise<SandboxResult> {
  const { spawn } = await import("child_process");
  const args = [
    "run", "--rm",
    "-v", `${repoPath}:/workspace`,
    "-w", "/workspace",
    "--network", "none",
    "node:20-alpine",
    "sh", "-c", command,
  ];

  return new Promise((resolve) => {
    const proc = spawn("docker", args, { timeout });
    let stdout = "", stderr = "";
    proc.stdout?.on("data", (d: Buffer) => (stdout += d.toString()));
    proc.stderr?.on("data", (d: Buffer) => (stderr += d.toString()));
    proc.on("close", (code: number | null) => resolve({ stdout, stderr, exitCode: code }));
    proc.on("error", () => resolve({ stdout, stderr, exitCode: 1 }));
  });
}
