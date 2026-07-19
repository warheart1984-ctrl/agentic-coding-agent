#!/usr/bin/env node
import { program } from "commander";
import { AgentRuntime, governance, continuity } from "./index";
import { getContext } from "./runtime/workspace";
import { invariants } from "../config/nova.config";
import { refineCode } from "./core/agentLoop";
import { GenerationBlockedError } from "./core/agent";
import { registerSpineObserve } from "./governance/observe";

async function bootstrapGovernance(): Promise<void> {
  for (const inv of invariants) {
    await governance.requireInvariant(inv);
  }
  // When NOVA_OBSERVE=1 or NOVA_SPINE_URL / NOVA_SPINE_INGEST_URL is set, forward receipts to spine
  registerSpineObserve();
}

/** Spinner with elapsed time tracking. */
function withSpinner<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  let i = 0;
  const start = Date.now();
  const interval = setInterval(() => {
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    process.stdout.write(`\r${frames[i % frames.length]} ${label}... ${elapsed}s`);
    i++;
  }, 80);
  return fn().finally(() => {
    clearInterval(interval);
    process.stdout.write("\r\x1b[K");
  });
}

/** Spinner that can update its label for multi-phase operations. */
function createPhaseSpinner() {
  const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  let i = 0;
  const start = Date.now();
  const interval = setInterval(() => {
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    process.stdout.write(`\r${frames[i % frames.length]} ${currentPhase}... ${elapsed}s`);
    i++;
  }, 120);
  let currentPhase = "Working";
  return {
    setPhase(phase: string) { currentPhase = phase; },
    done() {
      clearInterval(interval);
      process.stdout.write("\r\x1b[K");
    },
  };
}

program.name("nova").description("Nova SDK CLI — constitutional coding agent");

const KNOWN_PROVIDERS = [
  { key: "openai", name: "OpenAI", defaultModel: "gpt-4o", apiKeyEnv: "LLM_API_KEY", freeTier: false, desc: "Standard OpenAI API (paid)" },
  { key: "ollama", name: "Ollama (Local)", defaultModel: "codellama:7b", apiKeyEnv: "N/A", freeTier: true, desc: "Local LLMs via Ollama (offline)" },
  { key: "custom", name: "Custom", defaultModel: "custom-model", apiKeyEnv: "LLM_API_KEY", freeTier: true, desc: "Any OpenAI-compatible endpoint" },
  { key: "gemini", name: "Google Gemini", defaultModel: "gemini-2.0-flash", apiKeyEnv: "GEMINI_API_KEY", freeTier: true, desc: "Free via AI Studio. 60 req/min." },
  { key: "groq", name: "Groq LPU", defaultModel: "mixtral-8x7b-32768", apiKeyEnv: "GROQ_API_KEY", freeTier: true, desc: "Free tier. Extremely fast inference." },
  { key: "deepseek", name: "DeepSeek", defaultModel: "deepseek-chat", apiKeyEnv: "DEEPSEEK_API_KEY", freeTier: true, desc: "Free trial credits. Strong coding model." },
  { key: "huggingface", name: "Hugging Face", defaultModel: "HuggingFaceH4/zephyr-7b-beta", apiKeyEnv: "HF_API_KEY", freeTier: true, desc: "Free tier. Many open models." },
  { key: "openrouter", name: "OpenRouter", defaultModel: "meta-llama/llama-3.1-70b-instruct:free", apiKeyEnv: "OPENROUTER_API_KEY", freeTier: true, desc: "200+ models, free models tagged :free." },
  { key: "mistral", name: "Mistral AI", defaultModel: "mistral-small-latest", apiKeyEnv: "MISTRAL_API_KEY", freeTier: true, desc: "Free tier. 500k tokens/month." },
];

program
  .command("init")
  .description("Initialize a Nova-governed project")
  .action(async () => {
    console.log("Nova project initialized (config + invariants).");
    console.log("Edit config/nova.config.ts to register custom invariants.");
  });

program
  .command("generate")
  .description("Generate code with governance receipts")
  .argument("<prompt>", "Prompt for code generation")
  .option("-f, --files <files>", "Comma-separated file paths to include as context")
  .option("-l, --lang <language>", "Programming language hint (typescript, python, rust, etc.)")
  .option("-r, --refine <iterations>", "Number of refine iterations (generate → test → fix)", "0")
  .option("-p, --provider <provider>", "LLM provider override (gemini, groq, deepseek, etc.)")
  .action(async (prompt: string, options: { files?: string; lang?: string; refine?: string; provider?: string }) => {
    await bootstrapGovernance();

    if (options.provider) {
      process.env.LLM_PROVIDER = options.provider;
    }

    const agent = new AgentRuntime();

    const files = options.files
      ? options.files.split(",").map((s: string) => s.trim())
      : undefined;

    const refineIters = Math.max(0, parseInt(options.refine ?? "0", 10));

    try {
      if (refineIters > 0) {
        type RefineResult = Awaited<ReturnType<typeof refineCode>>;
        const result = await withSpinner(`Generating with ${refineIters} refine iteration(s)`, () =>
          refineCode(prompt, { language: options.lang, files, maxIterations: refineIters })
        ) as RefineResult;
        console.log(result.code);
        if (result.refinements?.length) {
          console.log(`\n${result.refinements.length} refinement(s) applied.`);
        }
        return;
      }

      const result = await withSpinner("Generating code", () =>
        agent.generateCode({
          prompt,
          context: { files, language: options.lang },
        })
      );

      console.log(result.code);
      console.log("\n── Receipts ──");
      console.log(JSON.stringify(result.receipts, null, 2));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("\n✖ BLOCKED:", message);
      if (err instanceof GenerationBlockedError && err.receipts.length > 0) {
        console.log("\nReceipts:");
        console.log(JSON.stringify(err.receipts, null, 2));
      } else {
        const receipts = await governance.listReceipts();
        const last = receipts[receipts.length - 1];
        if (last) {
          console.log("\nReceipts:");
          console.log(JSON.stringify([last], null, 2));
        }
      }
      process.exit(1);
    }
  });

program
  .command("plan")
  .description("Generate a governed plan for a goal")
  .argument("<goal>", "Goal description")
  .action(async (goal: string) => {
    await bootstrapGovernance();
    const agent = new AgentRuntime();
    const ctx = await getContext();
    const result = await agent.plan({ goal, context: ctx });
    console.log(JSON.stringify(result.plan, null, 2));
  });

program
  .command("continuity")
  .description("Show current continuity snapshot")
  .action(async () => {
    const snap = await continuity.snapshot();
    console.log(JSON.stringify(snap, null, 2));
  });

program
  .command("receipts")
  .description("List recent governance receipts")
  .action(async () => {
    const receipts = await governance.listReceipts();
    console.log(JSON.stringify(receipts, null, 2));
  });

program
  .command("invariants")
  .description("List registered invariants")
  .action(async () => {
    await bootstrapGovernance();
    const invs = governance.getInvariants();
    console.log(JSON.stringify(invs.map((i) => ({ id: i.id, description: i.description, severity: i.severity })), null, 2));
  });

program
  .command("models")
  .description("List all LLM providers and their free models")
  .action(async () => {
    console.log("\n\x1b[1mAvailable LLM Providers\x1b[0m\n");
    console.log("  \x1b[2mSet LLM_PROVIDER=<key> to switch. Set the API key env var to authenticate.\x1b[0m\n");
    for (const p of KNOWN_PROVIDERS) {
      const badge = p.freeTier ? "\x1b[32mFREE\x1b[0m" : "\x1b[33mPAID\x1b[0m";
      const key = p.key.padEnd(14);
      console.log(`  ${badge} \x1b[36m${key}\x1b[0m${p.name.padEnd(20)} ${p.desc}`);
      console.log(`       Default model: \x1b[33m${p.defaultModel}\x1b[0m`);
      console.log(`       API key env:   \x1b[33m${p.apiKeyEnv}\x1b[0m`);
      console.log();
    }
  });

/**
 * Interactive chat mode — like Cursor/Codex.
 * Reads natural-language tasks and executes them through the agentic loop.
 * Type "exit" or Ctrl+C to quit.
 */
program
  .command("chat")
  .alias("interactive")
  .description("Interactive chat mode — give tasks in natural language, Nova uses tools to execute them")
  .option("-v, --verbose", "Show detailed step output")
  .action(async (options: { verbose?: boolean }) => {
    await bootstrapGovernance();
    const readline = (await import("readline")).default;
    const { runAgenticLoop } = await import("./core/agenticLoop");

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: "\x1b[36mNova> \x1b[0m",
    });

    console.log("\x1b[33mNova interactive mode. Type your task or 'exit' to quit.\x1b[0m");
    console.log("  Examples: 'read package.json', 'find where factorial is defined', 'write a sort function'\n");

    rl.prompt();

    rl.on("line", async (line: string) => {
      const trimmed = line.trim();
      if (!trimmed) { rl.prompt(); return; }
      if (trimmed.toLowerCase() === "exit" || trimmed.toLowerCase() === "quit") {
        rl.close();
        return;
      }

      const phaseSpinner = createPhaseSpinner();
      const result = await runAgenticLoop(trimmed, {
        onProgress: (phase, msg) => {
          phaseSpinner.setPhase(phase);
          if (options.verbose) process.stderr.write(`\r\x1b[K[${phase}] ${msg}\n`);
        },
      });
      phaseSpinner.done();

      if (result.success) {
        console.log("\x1b[32m✓\x1b[0m " + result.summary);
        // Show tool outputs from each step
        for (const step of result.plan.steps) {
          if (step.toolCalls.length === 0) continue;
          for (const tc of step.toolCalls) {
            if (tc.result?.output) {
              const preview = tc.result.output.slice(0, 500);
              console.log(`\x1b[90m  → ${tc.tool}: ${preview}\x1b[0m`);
            }
            if (tc.result?.error) {
              console.log(`\x1b[31m  ✖ ${tc.tool}: ${tc.result.error}\x1b[0m`);
            }
          }
        }
      } else {
        console.log("\x1b[31m✖\x1b[0m " + result.summary);
      }

      rl.prompt();
    });

    rl.on("close", () => {
      console.log("\nGoodbye.");
      process.exit(0);
    });
  });

/**
 * Run a single task through the agentic loop (like Devin one-shot mode).
 */
program
  .command("run")
  .description("Run a single task through the agentic loop")
  .argument("<task>", "Natural language task description")
  .option("-v, --verbose", "Show detailed step output")
  .action(async (task: string, options: { verbose?: boolean }) => {
    await bootstrapGovernance();
    const { runAgenticLoop } = await import("./core/agenticLoop");

    const phaseSpinner = createPhaseSpinner();
    const result = await runAgenticLoop(task, {
      onProgress: (phase, msg) => {
        phaseSpinner.setPhase(phase);
        if (options.verbose) process.stderr.write(`[${phase}] ${msg}\n`);
      },
    });
    phaseSpinner.done();

    if (result.success) {
      console.log("\n\x1b[32m✓\x1b[0m " + result.summary);
      for (const step of result.plan.steps) {
        for (const tc of step.toolCalls) {
          if (tc.result?.output) {
            const preview = tc.result.output.slice(0, 800);
            console.log(`\x1b[90m  → ${tc.tool}: ${preview}\x1b[0m`);
          }
        }
      }
    } else {
      console.log("\n\x1b[31m✖\x1b[0m " + result.summary);
      process.exit(1);
    }
  });

program.parse(process.argv);
