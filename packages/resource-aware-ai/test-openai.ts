import { ResourceAwareAI } from "./src/index.js";

const USAGE = `
Usage:
  pnpm --filter resource-aware-ai run test:openai -- [model] [provider] "your prompt" [--imperial]

Examples:
  pnpm --filter resource-aware-ai run test:openai -- gpt-4o-mini openai "What is the water cycle?"
  pnpm --filter resource-aware-ai run test:openai -- gpt-4o openai "Explain black holes" --imperial
  pnpm --filter resource-aware-ai run test:openai -- gemini-2.0-flash gemini "Write a haiku about rain" --imperial

Defaults (if no args given):
  model:    gpt-4o-mini
  provider: openai
  prompt:   "What is the water cycle? One sentence."
  units:    metric (ml)
`.trim();

const rawArgs = process.argv.slice(2).filter((a) => a !== "--");

const imperial = rawArgs.includes("--imperial");
const positional = rawArgs.filter((a) => a !== "--imperial");
const [argModel, argProvider, ...rest] = positional;
const prompt = rest.join(" ");

const model = argModel || "gpt-4o-mini";
const provider = argProvider || "openai";
const message = prompt || "What is the water cycle? One sentence.";

if (argModel === "--help" || argModel === "-h") {
  console.log(USAGE);
  process.exit(0);
}

const KEY_MAP: Record<string, string> = {
  openai: "OPENAI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
  gemini: "GEMINI_API_KEY",
  mistral: "MISTRAL_API_KEY",
  cohere: "COHERE_API_KEY",
};

const requiredKey = KEY_MAP[provider.toLowerCase()];
if (requiredKey && !process.env[requiredKey]) {
  console.error(
    `Missing ${requiredKey}. Add it to the server-side secret store.`,
  );
  process.exit(1);
}

(async () => {
  console.log(`Model:    ${model}`);
  console.log(`Provider: ${provider}`);
  console.log(`Units:    ${imperial ? "imperial (fl oz)" : "metric (ml)"}`);
  console.log(`Prompt:   "${message}"\n`);

  const ai = new ResourceAwareAI({
    unitSystem: imperial ? "imperial" : "metric",
  });

  const res = await ai.chat({
    model,
    provider,
    messages: [{ role: "user", content: message }],
  });

  console.log("─── Response ───────────────────────────────────────");
  console.log(res.output);
  console.log("\n─── Sustainability Report ──────────────────────────");
  console.log(res.footnote);
})();
