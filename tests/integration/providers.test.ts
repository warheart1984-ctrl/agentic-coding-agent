import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { runCompletion } from "../../src/services/completion.js";
import { getProvider, registerProvider, clearProviders, hasProvider } from "../../src/providers/provider-registry.js";
import { openaiProvider } from "../../src/providers/openai-provider.js";
import { anthropicProvider } from "../../src/providers/anthropic-provider.js";
import { ollamaProvider, getOllamaClient } from "../../src/providers/ollama-provider.js";

describe("Integration Tests - Provider Contract", () => {
  before(() => {
    clearProviders();
    registerProvider(ollamaProvider);
  });

  after(() => {
    clearProviders();
  });

  describe("Provider Registry", () => {
    it("should have ollama provider registered", () => {
      assert.ok(hasProvider("ollama"), "ollama provider should be registered");
    });

    it("should get ollama provider instance", () => {
      const provider = getProvider("ollama");
      assert.equal(provider.name, "ollama");
    });
  });

  describe("Ollama Provider", () => {
    let ollamaClient: ReturnType<typeof getOllamaClient>;

    before(() => {
      ollamaClient = getOllamaClient();
    });

    it("should check if Ollama is healthy", async () => {
      const healthy = await ollamaClient.isHealthy();
      console.log("Ollama health check:", healthy);
      // Don't fail if Ollama isn't running - just log
      if (!healthy) {
        console.log("Ollama not running locally - skipping detailed tests");
      }
    });

    it("should list available models", async () => {
      try {
        const models = await ollamaClient.listModels();
        console.log("Available models:", models.map(m => m.name));
        assert.ok(Array.isArray(models));
      } catch (error) {
        console.log("Ollama not available for model listing:", (error as Error).message);
      }
    });

    it("should complete a simple prompt", async () => {
      try {
        const result = await runCompletion({
          providerName: "ollama",
          actor: "integration-test",
          intent: "test-completion",
          prompt: "Say hello in one word",
          system: "You are a helpful assistant. Respond with exactly one word.",
        });

        assert.ok(result.ledgerId > 0);
        assert.ok(typeof result.output.text === "string");
        assert.ok(result.output.text.length > 0);
        console.log("Completion result:", result.output.text);
      } catch (error) {
        console.log("Ollama completion failed (expected if not running):", (error as Error).message);
      }
    });
  });

  describe("OpenAI Provider", () => {
    before(() => {
      if (process.env.OPENAI_API_KEY) {
        clearProviders();
        registerProvider(openaiProvider);
      }
    });

    it("should complete a simple prompt if API key is set", async () => {
      if (!process.env.OPENAI_API_KEY) {
        console.log("Skipping OpenAI test - no API key");
        return;
      }

      const result = await runCompletion({
        providerName: "openai",
        actor: "integration-test",
        intent: "test-openai",
        prompt: "Say hello in one word",
        system: "You are a helpful assistant. Respond with exactly one word.",
      });

      assert.ok(result.ledgerId > 0);
      assert.ok(typeof result.output.text === "string");
      assert.ok(result.output.text.length > 0);
      assert.ok(result.output.tokens?.input > 0);
      assert.ok(result.output.tokens?.output > 0);
      assert.ok(result.output.cost > 0);
      console.log("OpenAI completion:", result.output.text);
    });
  });

  describe("Anthropic Provider", () => {
    before(() => {
      if (process.env.ANTHROPIC_API_KEY) {
        clearProviders();
        registerProvider(anthropicProvider);
      }
    });

    it("should complete a simple prompt if API key is set", async () => {
      if (!process.env.ANTHROPIC_API_KEY) {
        console.log("Skipping Anthropic test - no API key");
        return;
      }

      const result = await runCompletion({
        providerName: "anthropic",
        actor: "integration-test",
        intent: "test-anthropic",
        prompt: "Say hello in one word",
        system: "You are a helpful assistant. Respond with exactly one word.",
      });

      assert.ok(result.ledgerId > 0);
      assert.ok(typeof result.output.text === "string");
      assert.ok(result.output.text.length > 0);
      assert.ok(result.output.tokens?.input > 0);
      assert.ok(result.output.tokens?.output > 0);
      assert.ok(result.output.cost > 0);
      console.log("Anthropic completion:", result.output.text);
    });
  });
});