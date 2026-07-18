#!/usr/bin/env node
/**
 * Nova CLI — full agentic coding loop.
 * Usage: nova <task>
 *   nova "add sorting to src/utils.ts"
 *   nova --interactive
 */
import readline from "readline";
import { buildSemanticIndex } from "../code/semanticIndex";
import { planTask } from "../core/planner";
import { executePlan } from "../core/executor";
import { debugCommand } from "../core/debugger";
import { GitClient } from "../runtime/gitClient";
import { createPR } from "../runtime/github";
import { rememberFact } from "../core/memory";
import { addMessage } from "../core/conversation";

function promptUser(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (a) => { rl.close(); resolve(a.trim()); }));
}

async function main() {
  const args = process.argv.slice(2);
  const interactive = args.includes("--interactive") || args.includes("-i");
  const showModels = args.includes("--show-models") || args.includes("--models") || args.some((a) => ["models", "model-list"].includes(a));
  const task = args.filter((a) => !a.startsWith("-")).join(" ");

  if (showModels) {
    const { formatTaskTable } = await import("../model/router");
    console.log(formatTaskTable());
    return;
  }

  if (!task && !interactive) {
    console.error("Usage: nova <task description>");
    console.error("       nova --interactive");
    console.error("       nova --show-models");
    process.exit(1);
  }

  const repoPath = process.cwd();

  if (interactive) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, prompt: "\x1b[36mNova> \x1b[0m" });
    console.log("Nova interactive. Type a task, 'remember <fact>', or 'exit'.");
    rl.prompt();
    rl.on("line", async (line: string) => {
      const trimmed = line.trim();
      if (!trimmed) { rl.prompt(); return; }
      if (trimmed === "exit" || trimmed === "quit") { rl.close(); return; }
      if (trimmed.startsWith("remember ")) {
        rememberFact(trimmed.slice(9));
        console.log("Remembered.");
        rl.prompt();
        return;
      }
      addMessage({ role: "user", content: trimmed });
      try {
        const result = await runTask(trimmed, repoPath);
        console.log(result ? "\x1b[32m✓\x1b[0m Done." : "\x1b[31m✖\x1b[0m Failed.");
      } catch (err) {
        console.error("Error:", err instanceof Error ? err.message : String(err));
      }
      rl.prompt();
    });
    rl.on("close", () => { console.log("\nGoodbye."); process.exit(0); });
    return;
  }

  const result = await runTask(task, repoPath);
  if (!result) process.exit(1);
}

async function runTask(task: string, repoPath: string): Promise<boolean> {
  const git = new GitClient(repoPath);
  const branchName = `nova/${task.replace(/[^a-z0-9]+/gi, "-").toLowerCase().slice(0, 60)}`;

  console.log("Building semantic index...");
  await buildSemanticIndex(repoPath);

  console.log("Planning...");
  const fileTree = git.listFiles();
  const plan = await planTask(task, fileTree);

  console.log(`Plan: ${plan.edits.length} edit(s), ${plan.tests.length} test(s)`);

  if (plan.edits.length > 0) {
    git.createBranch(branchName);
    console.log(`Branch: ${branchName}`);
  }

  await executePlan(plan, {
    repoPath,
    git: plan.edits.length > 0 ? git : undefined,
    onProgress: (phase, msg) => process.stderr.write(`[${phase}] ${msg}\n`),
  });

  for (const cmd of plan.tests) {
    const result = await debugCommand(cmd, {
      repoPath,
      maxIterations: 5,
      onProgress: (phase, msg) => process.stderr.write(`[${phase}] ${msg}\n`),
    });
    if (!result.success) {
      console.log("Tests failing after debugging. Continuing...");
    }
  }

  const diff = plan.edits.length > 0 ? git.diffAgainstMain(branchName) : "(no changes)";
  if (diff !== "(no changes)" && diff) {
    console.log("\n── Diff ──\n" + diff);
    const answer = await promptUser("\nAccept changes? [y/n/pr]: ");
    if (answer === "pr") {
      const token = process.env.GITHUB_TOKEN;
      if (!token) { console.log("Set GITHUB_TOKEN env var for PR creation."); return true; }
      const owner = await promptUser("GitHub owner: ");
      const repo = await promptUser("Repo name: ");
      const pr = await createPR({
        owner, repo,
        title: `Nova: ${task}`,
        body: `## Nova Changes\n\n${diff}`,
        head: branchName, base: "main", token,
      });
      console.log("PR created:", pr.html_url);
    } else if (answer !== "y") {
      console.log("Resetting branch...");
      git.resetBranch(branchName);
      return false;
    }
  }

  addMessage({ role: "assistant", content: `Completed: ${task}` });
  return true;
}

main().catch((err) => {
  console.error("Nova error:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
