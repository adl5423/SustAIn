import { ResourceAwareAI, ResourceAwareAIError, generateInlineFootnote } from "./src/index.js";

const mockProvider = {
  async generate({ model, messages }: { model: string; messages: Array<{ content: string }> }) {
    const last = messages.at(-1)?.content ?? "";
    return {
      text: `[${model}] Simulated response to: "${last}"`,
      usage: { prompt_tokens: 20, completion_tokens: 55, total_tokens: 75 },
    };
  },
};

(async () => {
  // ─── Demo 1: Full comparison footnote (metric) ────────────────────────────────
  console.log("=== Demo 1: Full comparison footnote (metric) ===\n");

  const ai = new ResourceAwareAI({
    regionFactor: 1800,
    baselineFactor: 4500,
    enableCache: true,
  });
  ai.registerProvider("mock", mockProvider);

  const res1 = await ai.chat({
    model: "gpt-4o",
    provider: "mock",
    messages: [{ role: "user", content: "Explain climate change in 3 sentences" }],
  });

  console.log("Response:", res1.output);
  console.log("\n--- Sustainability Report ---");
  console.log(res1.footnote);
  console.log("\nRaw metrics:", res1.metrics);

  // ─── Demo 2: Imperial units ───────────────────────────────────────────────────
  console.log("\n\n=== Demo 2: Imperial units (fl oz) ===\n");

  const aiImperial = new ResourceAwareAI({
    regionFactor: 1800,
    baselineFactor: 4500,
    enableCache: false,
    unitSystem: "imperial",
  });
  aiImperial.registerProvider("mock", mockProvider);

  const res2 = await aiImperial.chat({
    model: "gpt-4o",
    provider: "mock",
    messages: [{ role: "user", content: "Explain climate change in 3 sentences" }],
  });

  console.log("--- Sustainability Report (Imperial) ---");
  console.log(res2.footnote);

  // ─── Demo 3: Inline single-line footnote ──────────────────────────────────────
  console.log("\n\n=== Demo 3: Inline single-line footnote ===\n");
  console.log("Inline:", generateInlineFootnote(res1.metrics));

  // ─── Demo 4: Model comparison — water used vs baseline ───────────────────────
  console.log("\n\n=== Demo 4: Model comparison — used vs baseline ===\n");

  const aiComp = new ResourceAwareAI({ regionFactor: 1800, baselineFactor: 4500, enableCache: false });
  aiComp.registerProvider("mock", mockProvider);

  const models = [
    { id: "gpt-4o",                    label: "GPT-4o (large)" },
    { id: "gpt-4o-mini",               label: "GPT-4o-mini (medium)" },
    { id: "gemini-2.0-flash-lite",     label: "Gemini Flash Lite (small)" },
    { id: "claude-3-5-sonnet-20241022",label: "Claude 3.5 Sonnet (large)" },
    { id: "mistral-small-latest",      label: "Mistral Small (small)" },
  ];

  console.log(
    "  Model".padEnd(36) +
    "Used (ml)".padStart(12) +
    "Baseline (ml)".padStart(15) +
    "Saved (ml)".padStart(12) +
    "Saved %".padStart(10) +
    "Bottles".padStart(10)
  );
  console.log("  " + "─".repeat(95));

  for (const { id, label } of models) {
    const r = await aiComp.chat({ model: id, provider: "mock", messages: [{ role: "user", content: "Hi" }] });
    const m = r.metrics;
    console.log(
      `  ${label.padEnd(34)}` +
      `${m.water_display.toFixed(4).padStart(12)}` +
      `${m.baseline_display.toFixed(4).padStart(15)}` +
      `${m.water_saved_display.toFixed(4).padStart(12)}` +
      `${m.water_saved_percent.toFixed(1).padStart(9)}%` +
      `${m.bottles_saved.toFixed(5).padStart(10)}`
    );
  }

  // ─── Demo 5: Caching — zero water ─────────────────────────────────────────────
  console.log("\n\n=== Demo 5: Cache hit — 0 ml water used ===\n");

  const q = { model: "gpt-4o", provider: "mock", messages: [{ role: "user" as const, content: "Same question" }] };
  const first = await ai.chat(q);
  const cached = await ai.chat(q);

  console.log("First call  →", generateInlineFootnote(first.metrics));
  console.log("Cached call →", generateInlineFootnote(cached.metrics));

  // ─── Demo 6: Session accumulation ─────────────────────────────────────────────
  console.log("\n\n=== Demo 6: Session water savings accumulation ===\n");

  const aiSession = new ResourceAwareAI({ enableCache: false });
  aiSession.registerProvider("mock", mockProvider);

  const prompts = [
    "Write a haiku about water",
    "Summarize the water cycle",
    "What is evaporation?",
    "How much water does a tree absorb?",
    "Explain ocean currents",
  ];

  for (const prompt of prompts) {
    const r = await aiSession.chat({
      model: "gpt-4o-mini",
      provider: "mock",
      messages: [{ role: "user", content: prompt }],
    });
    console.log(
      `  "${prompt.slice(0, 35).padEnd(35)}"` +
      `  used ${r.metrics.water_display.toFixed(4)} ml` +
      `  │  session bottles saved so far: ${r.metrics.bottles_saved_session.toFixed(5)}`
    );
  }

  console.log("\n  ─── Session Summary ───");
  const stats = aiSession.getStats();
  console.log(`  Total water used:    ${stats.total_water_display} ${stats.unit}`);
  console.log(`  Total water saved:   ${stats.total_water_saved_display} ${stats.unit}`);
  console.log(`  Bottles saved:       ${stats.bottles_saved_session.toFixed(5)} × ${stats.bottle_size_display.toFixed(0)} ml bottles`);
  console.log(`  Total requests:      ${stats.total_requests}`);

  // ─── Demo 7: Imperial session ─────────────────────────────────────────────────
  console.log("\n\n=== Demo 7: Imperial session summary ===\n");

  const aiImpSession = new ResourceAwareAI({ enableCache: false, unitSystem: "imperial" });
  aiImpSession.registerProvider("mock", mockProvider);

  for (const prompt of prompts.slice(0, 3)) {
    await aiImpSession.chat({
      model: "gpt-4o",
      provider: "mock",
      messages: [{ role: "user", content: prompt }],
    });
  }

  const impStats = aiImpSession.getStats();
  console.log(`  Unit system:         imperial`);
  console.log(`  Total water used:    ${impStats.total_water_display.toFixed(6)} ${impStats.unit}`);
  console.log(`  Total water saved:   ${impStats.total_water_saved_display.toFixed(6)} ${impStats.unit}`);
  console.log(`  Bottles saved:       ${impStats.bottles_saved_session.toFixed(5)} × ${impStats.bottle_size_display.toFixed(2)} fl oz bottles`);

  // ─── Demo 8: Constraint rejection ─────────────────────────────────────────────
  console.log("\n\n=== Demo 8: Resource constraint rejection ===\n");

  try {
    await ai.chat({
      model: "gpt-4o",
      provider: "mock",
      messages: [{ role: "user", content: "A".repeat(5000) }],
      constraints: { max_water_ml: 0.001 },
    });
  } catch (err) {
    if (err instanceof ResourceAwareAIError) {
      console.log("Caught:", err.sdkError.code, "─", err.message);
    }
  }

  console.log("\nAll demos complete.");
})();
