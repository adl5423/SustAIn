import { ResourceAwareAI, listModels, getModelProfile, ResourceAwareAIError } from "./src/index.js";
import type { Message, ProviderAdapter } from "./src/index.js";

(async () => {
  // ─── Demo 1: Basic usage with a mock provider (no API key needed) ────────────
  console.log("=== Demo 1: Basic chat ===\n");

  const ai = new ResourceAwareAI({
    regionFactor: 1800,    // ml water per kWh (hybrid-cooled data center)
    baselineFactor: 4500,  // worst-case baseline
    enableCache: true,
  });

  ai.registerProvider("mock", {
    async generate({ model, messages }) {
      const last = messages.at(-1)?.content ?? "";
      return {
        text: `[${model}] Simulated response to: "${last}"`,
        usage: { prompt_tokens: 12, completion_tokens: 28, total_tokens: 40 },
      };
    },
  });

  const res1 = await ai.chat({
    model: "gpt-4o",
    provider: "mock",
    messages: [{ role: "user", content: "Explain AI in one sentence" }],
  });

  console.log("Output:  ", res1.output);
  console.log("Footnote:", res1.footnote);
  console.log("Metrics: ", res1.metrics);

  // ─── Demo 2: Comparing model classes (large vs medium vs small) ──────────────
  console.log("\n=== Demo 2: Water usage by model size ===\n");

  const models = [
    "gpt-4o",              // large
    "gpt-4o-mini",         // medium
    "gemini-2.0-flash-lite", // small
    "claude-3-5-sonnet-20241022", // large
    "mistral-small-latest",       // small
    "command-r-plus",             // large
  ];

  for (const model of models) {
    const res = await ai.chat({
      model,
      provider: "mock",
      messages: [{ role: "user", content: "Hello" }],
    });
    const profile = getModelProfile(model);
    console.log(
      `  ${model.padEnd(34)} [${(profile?.class ?? "?").padEnd(6)}]  ` +
      `${res.metrics.water_ml.toFixed(4).padStart(8)} ml water  |  ${res.metrics.water_saved_percent.toFixed(1)}% saved`
    );
  }

  // ─── Demo 3: Caching — zero water for repeated queries ───────────────────────
  console.log("\n=== Demo 3: Cache hit (0 ml water) ===\n");

  const q = {
    model: "gpt-4o",
    provider: "mock",
    messages: [{ role: "user" as const, content: "Same question every time" }],
  };

  const first = await ai.chat(q);
  const second = await ai.chat(q);

  console.log("First call  — cache_hit:", first.metrics.cache_hit, " | water:", first.metrics.water_ml.toFixed(4), "ml");
  console.log("Second call — cache_hit:", second.metrics.cache_hit);
  console.log("Footnote:   ", second.footnote);

  // ─── Demo 4: Resource constraints ────────────────────────────────────────────
  console.log("\n=== Demo 4: Resource constraint rejection ===\n");

  try {
    await ai.chat({
      model: "gpt-4o",
      provider: "mock",
      messages: [{ role: "user", content: "A".repeat(5000) }],
      constraints: { max_water_ml: 0.001 },  // absurdly tight limit
    });
  } catch (err) {
    if (err instanceof ResourceAwareAIError) {
      console.log("Caught error code:", err.sdkError.code);
      console.log("Details:", err.sdkError);
    }
  }

  // ─── Demo 5: Custom estimator ─────────────────────────────────────────────────
  console.log("\n=== Demo 5: Custom estimator ===\n");

  const aiCustom = new ResourceAwareAI({ enableCache: false });
  aiCustom.registerProvider("mock", {
    async generate({ model, messages }) {
      return { text: "Custom estimator test", usage: { total_tokens: 100 } };
    },
  });
  aiCustom.setEstimator((tokens, _model) => (tokens / 1000) * 0.0018);

  const res5 = await aiCustom.chat({
    model: "mistral-large-latest",
    provider: "mock",
    messages: [{ role: "user", content: "Test" }],
  });
  console.log("energy_kwh with custom estimator:", res5.metrics.energy_kwh);
  console.log("Footnote:", res5.footnote);

  // ─── Demo 6: Unknown provider error ──────────────────────────────────────────
  console.log("\n=== Demo 6: Unknown provider error ===\n");

  try {
    await ai.chat({ model: "gpt-4o", provider: "xyz-unknown", messages: [{ role: "user", content: "Hi" }] });
  } catch (err) {
    if (err instanceof ResourceAwareAIError) {
      console.log("Error code:", err.sdkError.code);
      console.log("Message:", err.message);
    }
  }

  // ─── Demo 7: Model registry ───────────────────────────────────────────────────
  console.log("\n=== Demo 7: Model registry ===\n");

  const profile = getModelProfile("claude-3-5-sonnet-20241022");
  console.log("claude-3-5-sonnet-20241022 profile:", profile);

  const allProviders = ["openai", "anthropic", "gemini", "mistral", "cohere", "ollama"];
  for (const p of allProviders) {
    console.log(`  ${p.padEnd(10)} → ${listModels(p).length} models registered`);
  }

  // ─── Demo 8: Observability stats ─────────────────────────────────────────────
  console.log("\n=== Demo 8: Observability stats ===\n");
  console.log(ai.getStats());

  console.log("\nAll demos complete.");
})();
