import { execSync } from "child_process";

export class GitClient {
  constructor(private repoPath: string) {}

  run(cmd: string): string {
    return execSync(cmd, { cwd: this.repoPath, encoding: "utf-8" }).trim();
  }

  createBranch(name: string): void {
    this.run(`git checkout -B "${name}"`);
  }

  commit(files: string[], message: string): void {
    this.run(`git add ${files.map((f) => `"${f}"`).join(" ")}`);
    this.run(`git commit -m "${message.replace(/"/g, '\\"')}"`);
  }

  listFiles(): string[] {
    return this.run("git ls-files").split("\n").filter(Boolean);
  }

  diffAgainstMain(branch: string): string {
    try {
      return this.run(`git diff main...${branch}`);
    } catch {
      return this.run(`git diff HEAD`);
    }
  }

  resetBranch(branch: string): void {
    this.run(`git checkout "${branch}"`);
    this.run("git reset --hard main");
  }

  status(): string {
    return this.run("git status --short");
  }
}
