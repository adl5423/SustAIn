import {
  SustainAI,
  SustainAIError,
  compareModels,
  generateInlineFootnote,
  type ProviderAdapter,
} from "./src/index.js";

const paced = process.argv.includes("--paced");

async function pause(milliseconds = 1_100): Promise<void> {
  if (paced) {
    await new Promise((resolve) => setTimeout(resolve, milliseconds));
  }
}

function section(title: string): void {
  console.log(`\n${title}`);
  console.log("─".repeat(title.length));
}

const mockProvider: ProviderAdapter = {
  async generate() {
    return {
      text: "Latent heat is energy absorbed or released during a phase change without changing temperature. In data-center cooling, evaporating water carries heat away because vaporization requires substantial energy.",
      usage: {
        prompt_tokens: 100,
        completion_tokens: 300,
        total_tokens: 400,
      },
    };
  },
};

async function main(): Promise<void> {
  console.clear();
  console.log("SustAIn 2.0 — transparent AI resource estimates");
  console.log("Reference data verified 2026-08-21");
  await pause();

  section("1. Compare the same 100-input / 300-output-token workload");

  const rows = compareModels(
    [
      "gpt-5.6-sol",
      "gpt-5.6-terra",
      "gpt-oss-20b",
      "qwen3:30b-a3b",
      "deepseek-v4-pro",
    ],
    {
      baselineModel: "gpt-5.6-sol",
      workload: { inputTokens: 100, outputTokens: 300 },
      waterAccounting: { scope: "direct+electricity" },
    },
  );

  console.table(
    rows.map((row) => ({
      model: row.model,
      provider: row.provider,
      "energy Wh": row.energy_wh.toFixed(3),
      "direct mL": row.direct_water_ml.toFixed(3),
      "electricity mL": row.electricity_water_ml.toFixed(3),
      "combined mL": row.water_ml.toFixed(3),
      "saved vs Sol": `${row.water_saved_vs_baseline_percent.toFixed(1)}%`,
    })),
  );

  const averageSavings =
    rows.reduce((sum, row) => sum + row.water_saved_vs_baseline_percent, 0) /
    rows.length;
  console.log(
    `Illustrative equal-weight average: ${averageSavings.toFixed(1)}% modeled savings.`,
  );
  console.log("This is a scenario comparison, not provider utility telemetry.");
  await pause(1_600);

  section("2. Estimate one provider response from its reported token usage");

  const ai = new SustainAI({
    baselineModel: "gpt-5.6-sol",
    enableCache: true,
    waterAccounting: {
      pue: 1.4,
      siteWueLitersPerKwhIt: 0.36,
      electricityWaterLitersPerKwh: 4.52,
      scope: "direct+electricity",
    },
  }).registerProvider("demo", mockProvider);

  const request = {
    provider: "demo",
    model: "gpt-5.6-terra",
    cacheNamespace: "quick-demo",
    expectedOutputTokens: 300,
    messages: [
      {
        role: "user" as const,
        content: "Explain latent heat in two sentences.",
      },
    ],
  };

  console.log(`Prompt: ${request.messages[0].content}`);
  const response = await ai.chat(request);
  console.log(`Response: ${response.output}`);
  console.log(
    `Tokens: ${response.metrics.token_usage.prompt_tokens} input + ${response.metrics.token_usage.completion_tokens} output (${response.metrics.token_source})`,
  );
  console.log(
    `Energy: ${response.metrics.energy_wh.toFixed(3)} Wh ` +
      `(range ${response.metrics.energy_low_wh.toFixed(3)}–${response.metrics.energy_high_wh.toFixed(3)} Wh)`,
  );
  console.log(
    `Water: ${response.metrics.direct_water_ml.toFixed(3)} mL direct + ` +
      `${response.metrics.electricity_water_ml.toFixed(3)} mL electricity = ` +
      `${response.metrics.water_ml.toFixed(3)} mL combined`,
  );
  console.log(
    `Modeled savings vs ${response.metrics.baseline_model}: ` +
      `${response.metrics.water_saved_percent.toFixed(1)}%`,
  );
  await pause(1_800);

  section("3. Avoid a second inference with the exact cache");
  const cached = await ai.chat(request);
  console.log(`First call:  ${generateInlineFootnote(response.metrics)}`);
  console.log(`Cached call: ${generateInlineFootnote(cached.metrics)}`);
  console.log(
    `Cache hit: ${String(cached.metrics.cache_hit)}; reported inference water: ` +
      `${cached.metrics.water_ml.toFixed(3)} mL`,
  );
  await pause(1_600);

  section("4. Reject a request that exceeds a resource budget");
  try {
    await ai.chat({
      ...request,
      model: "gpt-5.6-sol",
      cacheNamespace: "constraint-demo",
      constraints: { max_water_ml: 0.1 },
    });
  } catch (error) {
    if (error instanceof SustainAIError) {
      console.log(`${error.sdkError.code}: request blocked before inference.`);
      console.log("Configured limit: 0.100 mL combined operational water.");
    } else {
      throw error;
    }
  }

  console.log(
    "\nDemo complete — methodology and assumptions are included in the README.",
  );
}

await main();
