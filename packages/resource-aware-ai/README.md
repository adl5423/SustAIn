# resource-aware-ai

> A provider-agnostic TypeScript SDK that wraps any LLM call and returns **energy + water usage metrics** with a human-readable sustainability footnote.

[![npm version](https://img.shields.io/npm/v/resource-aware-ai.svg)](https://www.npmjs.com/package/resource-aware-ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)

Wrap any call to OpenAI, Anthropic, Gemini, Mistral, Cohere, Ollama, or any custom HTTP endpoint and get back not just the text, but the **estimated energy used, water used, baseline comparison, and bottles-of-water saved per session** — ready to render as a footnote in your UI.

---

## Table of Contents

- [Why this exists](#why-this-exists)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Integrating each LLM provider](#integrating-each-llm-provider)
- [Using it in a frontend application](#using-it-in-a-frontend-application)
- [Configuration](#configuration)
- [API Reference](#api-reference)
- [How water usage is calculated](#how-water-usage-is-calculated)
- [Understanding AI water consumption — myths vs facts](#understanding-ai-water-consumption--myths-vs-facts)
- [Contributing](#contributing)
- [License](#license)

---

## Why this exists

Every LLM call consumes electricity. That electricity is generated, and the generation + the data center cooling consume water. Most teams never see those numbers.

`resource-aware-ai` makes the cost visible in one line of code: every response comes back with an estimated water and energy footprint, plus a baseline comparison so you can show users (and yourselves) **what the impact would have been on an unoptimized stack** versus what it actually was.

It's not a guilt trip — it's a metrics layer. Use it for transparency dashboards, compliance reports, sustainability-aware routing, or just to show users a small honest footnote under each AI reply.

---

## Installation

```bash
npm install resource-aware-ai
# or
pnpm add resource-aware-ai
# or
yarn add resource-aware-ai
```

Then install only the provider SDKs you actually plan to use — they're optional peer dependencies, so you don't pay the bundle cost for ones you don't need:

```bash
npm install openai                    # for OpenAI
npm install @anthropic-ai/sdk         # for Anthropic
npm install @google/generative-ai     # for Google Gemini
npm install @mistralai/mistralai      # for Mistral
npm install cohere-ai                 # for Cohere
# Ollama and the Generic HTTP provider need no extra packages
```

**Requirements:** Node.js 18+ (uses the global `fetch` API).

---

## Quick Start

```typescript
import { ResourceAwareAI } from "resource-aware-ai";

const ai = new ResourceAwareAI();

const res = await ai.chat({
  model: "gpt-4o-mini",
  provider: "openai",
  messages: [{ role: "user", content: "Explain photosynthesis simply" }],
});

console.log(res.output);    // The AI reply
console.log(res.footnote);  // The sustainability report
```

The footnote you'd render to the user looks like this:

```
Water used:      0.1176 ml
Without system:  0.2646 ml  (worst-case baseline)
Water saved:     0.1470 ml  (−55.6%)
Energy:          0.0588 Wh
Bottles saved:   0.0003 × 500.00 ml bottle  |  session total: 0.0003

You've saved 0.0003 of a 500.00 ml bottle of water in this conversation so far.
```

---

## Integrating each LLM provider

The SDK ships with built-in adapters for the major providers. Each one accepts an API key either from an environment variable or from a config object passed when registering the provider.

### OpenAI

```typescript
import { ResourceAwareAI } from "resource-aware-ai";

// Reads from process.env.OPENAI_API_KEY automatically
const ai = new ResourceAwareAI();

const res = await ai.chat({
  model: "gpt-4o-mini",       // also: gpt-4o, o1, o1-mini, o3, o3-mini, o4-mini, gpt-4-turbo
  provider: "openai",
  messages: [{ role: "user", content: "Hello" }],
});
```

To pass the key explicitly:

```typescript
import { ResourceAwareAI, OpenAIProvider } from "resource-aware-ai";

const ai = new ResourceAwareAI();
ai.registerProvider("openai", new OpenAIProvider({ apiKey: "sk-..." }));
```

### Anthropic

```typescript
import { ResourceAwareAI } from "resource-aware-ai";

// Reads from process.env.ANTHROPIC_API_KEY
const ai = new ResourceAwareAI();

const res = await ai.chat({
  model: "claude-3-5-haiku-20241022",   // or claude-opus-4-5, claude-sonnet-4-5, etc.
  provider: "anthropic",
  messages: [{ role: "user", content: "Hello" }],
});
```

### Google Gemini

```typescript
// Reads from process.env.GEMINI_API_KEY or GOOGLE_API_KEY
const res = await ai.chat({
  model: "gemini-2.0-flash",            // or gemini-2.5-pro, gemini-1.5-flash, etc.
  provider: "gemini",
  messages: [{ role: "user", content: "Hello" }],
});
```

### Mistral

```typescript
// Reads from process.env.MISTRAL_API_KEY
const res = await ai.chat({
  model: "mistral-small-latest",        // or mistral-large-latest, codestral-latest, etc.
  provider: "mistral",
  messages: [{ role: "user", content: "Hello" }],
});
```

### Cohere

```typescript
// Reads from process.env.COHERE_API_KEY
const res = await ai.chat({
  model: "command-r-plus-08-2024",      // or command-a-03-2025, command-r, etc.
  provider: "cohere",
  messages: [{ role: "user", content: "Hello" }],
});
```

### Ollama (local models, no key required)

```typescript
import { ResourceAwareAI, OllamaProvider } from "resource-aware-ai";

const ai = new ResourceAwareAI();
ai.registerProvider("ollama", new OllamaProvider({
  endpoint: "http://localhost:11434",   // default
}));

const res = await ai.chat({
  model: "llama3.2",                    // or phi4, gemma3, qwen2.5, deepseek-r1, etc.
  provider: "ollama",
  messages: [{ role: "user", content: "Hello" }],
});
```

### Custom HTTP endpoint

For self-hosted or proprietary endpoints, use `GenericProvider`:

```typescript
import { ResourceAwareAI, GenericProvider } from "resource-aware-ai";

const ai = new ResourceAwareAI();
ai.registerProvider("my-llm", new GenericProvider({
  endpoint: "https://my-llm.example.com/chat",
  apiKey: process.env.MY_API_KEY,
  headers: { "X-Custom": "value" },
  transformRequest: (model, messages) => ({ model, messages, temperature: 0.7 }),
  transformResponse: (data) => ({ text: data.choices[0].message.content }),
}));

const res = await ai.chat({
  model: "my-model-v1",
  provider: "my-llm",
  messages: [{ role: "user", content: "Hello" }],
});
```

Or implement the full adapter interface yourself for total control:

```typescript
ai.registerProvider("custom", {
  async generate({ model, messages }) {
    const r = await fetch("https://...", { method: "POST", body: JSON.stringify({ model, messages }) });
    const data = await r.json();
    return {
      text: data.output,
      usage: { total_tokens: data.tokens },   // optional but improves accuracy
    };
  },
});
```

---

## Using it in a frontend application

**Important:** The SDK calls LLM provider APIs directly using your API keys. **Never instantiate it in browser code** — your keys would be exposed. Run it on a server (Express, Fastify, Next.js API routes, Hono, Cloudflare Workers, etc.) and have your frontend talk to that server.

### 1. Backend route (Express example)

```typescript
import express from "express";
import { ResourceAwareAI } from "resource-aware-ai";

const app = express();
app.use(express.json());

const ai = new ResourceAwareAI({ unitSystem: "metric" });

app.post("/api/chat", async (req, res) => {
  const { message } = req.body;

  const result = await ai.chat({
    model: "gpt-4o-mini",
    provider: "openai",
    messages: [{ role: "user", content: message }],
  });

  res.json({
    reply:    result.output,
    footnote: result.footnote,
    metrics:  result.metrics,
  });
});

app.listen(3000);
```

### 2. Next.js App Router (server action / route handler)

```typescript
// app/api/chat/route.ts
import { ResourceAwareAI } from "resource-aware-ai";
import { NextResponse } from "next/server";

const ai = new ResourceAwareAI();

export async function POST(req: Request) {
  const { message } = await req.json();
  const result = await ai.chat({
    model: "gpt-4o-mini",
    provider: "openai",
    messages: [{ role: "user", content: message }],
  });
  return NextResponse.json(result);
}
```

### 3. Frontend rendering

The response shape is designed to map cleanly to UI elements:

```tsx
// React example
function ChatBubble({ reply, footnote, metrics }) {
  return (
    <div className="chat-bubble">
      <p className="reply">{reply}</p>

      {/* Footnote — preserve line breaks */}
      <pre className="footnote">{footnote}</pre>

      {/* Or render individual metrics for a custom UI */}
      <div className="sustainability-bar">
        <span>{metrics.water_display.toFixed(2)} {metrics.unit} used</span>
        <span>vs {metrics.baseline_display.toFixed(2)} {metrics.unit} baseline</span>
        <span>{metrics.water_saved_percent.toFixed(1)}% saved</span>
        <span>{metrics.bottles_saved_session.toFixed(4)} bottles saved this session</span>
      </div>
    </div>
  );
}
```

### Exposing each metric

Every field in `metrics` is plain JSON-safe and ready to render:

| Field | Type | What to do with it |
|---|---|---|
| `water_ml` | number | Raw water used (always ml, internal) |
| `water_display` | number | Water used in your chosen unit (ml or fl oz) — **render this** |
| `baseline_water_ml` | number | Worst-case baseline in ml |
| `baseline_display` | number | Baseline in chosen unit — **render this** |
| `water_saved_ml` | number | Water saved vs baseline (ml) |
| `water_saved_display` | number | Saved in chosen unit — **render this** |
| `water_saved_percent` | number | Percentage saved — show in a progress bar |
| `unit` | string | `"ml"` or `"fl oz"` — append to displayed numbers |
| `energy_kwh` | number | Energy used (multiply by 1000 for Wh) |
| `tokens_estimated` | number | Token count used for the estimate |
| `cache_hit` | boolean | Whether served from cache (show a badge) |
| `bottles_saved` | number | Bottles saved by **this single call** |
| `bottles_saved_session` | number | Cumulative bottles saved this session — **show a counter** |
| `bottle_size_display` | number | Bottle size for the label (500 ml or 16.91 fl oz) |

You can also call `ai.getStats()` to get aggregate session statistics — perfect for a dashboard widget showing total impact across an entire user session.

---

## Configuration

```typescript
const ai = new ResourceAwareAI({
  regionFactor:   1800,        // ml of water per kWh — defaults to 2000 (hybrid cooling)
  baselineFactor: 4500,        // ml/kWh for the worst-case baseline — default 4500
  enableCache:    true,        // cache identical requests — default true
  unitSystem:     "metric",    // "metric" | "imperial" — default "metric"
  bottleSizeMl:   500,         // bottle size used in "bottles saved" math — default 500 ml
  customEstimator: (tokens, model) => tokens * 0.000003,   // override the energy math
});
```

### Region factor reference

The `regionFactor` should reflect the cooling profile of the data center your traffic actually lands in:

| Cooling type | ml of water per kWh |
|---|---|
| Air-cooled (efficient) | 0–500 |
| Hybrid cooling (typical) | 500–2,000 |
| Evaporative cooling | 2,000–5,000 |

If you don't know, leave it at the default. You can also set it from your own infra dashboard if you have a reliable PUE + WUE measurement.

### Resource constraints

Reject a request before it runs if it would exceed a budget:

```typescript
await ai.chat({
  model: "gpt-4o",
  provider: "openai",
  messages: [...],
  constraints: { max_water_ml: 50, max_kwh: 0.01 },
});
// Throws ResourceAwareAIError with code "RESOURCE_LIMIT_EXCEEDED"
```

### Caching

Identical requests (same model + same messages) are returned instantly from an in-memory cache, with `0 ml` water charged. Useful for retries, common questions, and demos.

```typescript
const ai = new ResourceAwareAI({ enableCache: true });   // default
ai.clearCache();    // flush manually
```

### Imperial units

```typescript
const ai = new ResourceAwareAI({ unitSystem: "imperial" });
// metrics.unit            === "fl oz"
// metrics.water_display   === water_ml / 29.5735
// metrics.bottle_size_display === 16.91   (standard US bottle)
```

---

## API Reference

### `new ResourceAwareAI(config?)`

Returns a client. All config fields are optional (see [Configuration](#configuration)).

### `ai.chat(options) → Promise<ChatResponse>`

Send a chat completion request. Returns:

```typescript
{
  output:   string;            // The LLM's text reply
  metrics:  ResourceMetrics;   // See the metrics table above
  footnote: string;            // Pre-formatted sustainability summary
}
```

### `ai.registerProvider(name, adapter) → this`

Register a custom provider or override a built-in one.

### `ai.setEstimator(fn) → this`

Replace the energy estimation function.

### `ai.getStats()`

Returns cumulative session statistics:

```typescript
{
  total_requests:            number,
  cache_hits:                number,
  cache_hit_rate:            number,   // %
  total_water_ml:            number,
  total_water_saved_ml:      number,
  total_water_display:       number,   // in chosen unit
  total_water_saved_display: number,
  unit:                      string,   // "ml" | "fl oz"
  avg_water_per_request:     number,
  bottles_saved_session:     number,
  bottle_size_display:       number,
  bottle_size_ml:            number,
  provider_distribution:     Record<string, number>,
}
```

### `ai.resetSession()`

Zero out the session counters (useful when starting a new conversation).

### `ai.clearCache()`

Flush the response cache.

### Helper exports

```typescript
import {
  listModels,
  getModelProfile,
  estimateTokens,
  estimateEnergy,
  computeWaterMetrics,
  generateFootnote,
  generateInlineFootnote,
  mlToDisplay,
  mlToBottles,
} from "resource-aware-ai";
```

---

## How water usage is calculated

The estimate is a transparent two-step calculation. There is no hidden ML model and no telemetry — every number can be reproduced from the inputs.

### Step 1 — Energy

```
tokens  ≈ characters / 4               (or use real token counts when the provider returns them)
kWh     = (tokens / 1000) × model_factor
```

| Model class | kWh per 1,000 tokens |
|---|---|
| Small (≤7B params) | 0.0004 |
| Medium (8B–30B) | 0.0012 |
| Large (≥70B / GPT-4-class) | 0.0025 |

Model class is detected from the registry (`gpt-4o` → large, `gpt-4o-mini` → medium, `phi4` → small, etc.). For unknown model IDs, the SDK infers the class from naming patterns (`mini`, `lite`, `8b`, `70b`, `opus`, `pro`, etc.).

These factors are derived from publicly available benchmarks of LLM inference energy use (see references below). They are **estimates designed to be conservative and comparable**, not exact billing data.

### Step 2 — Water

```
water_ml          = kWh × regionFactor       (default 2,000 ml/kWh — typical hybrid cooling)
baseline_water_ml = kWh × baselineFactor     (default 4,500 ml/kWh — worst-case evaporative cooling)
water_saved_ml    = baseline_water_ml − water_ml
water_saved_%     = water_saved_ml / baseline_water_ml × 100
bottles_saved     = water_saved_ml / bottleSizeMl     (default bottle = 500 ml)
```

The two factors come from peer-reviewed studies of data-center water-usage effectiveness (WUE), which is reported in liters per kWh. Hyperscaler-published WUE numbers cluster between 0.1 and 5 L/kWh depending on cooling tech and climate ([Google 2024 environmental report](https://sustainability.google/reports/), [Microsoft 2024 environmental sustainability report](https://www.microsoft.com/corporate-responsibility/sustainability/report)). The SDK uses the middle of that range as the default and lets you override it with your own infra data.

### What the "baseline" means

The baseline is a **worst-case comparison**, not the global average. It represents what a kWh of inference would cost on an evaporatively cooled data center in a hot region with no efficiency optimizations. The point is to give users a *concrete contrast* — "without the kind of optimization stack we use, this would have cost roughly X" — rather than to claim absolute precision.

### What gets cached

Cache hits are charged **zero water** because the second call doesn't trigger any inference. The original call is fully accounted for; subsequent identical calls are free.

---

## Understanding AI water consumption — myths vs facts

There's a lot of dramatic reporting on AI water use right now. Some of it is grounded; a lot of it conflates very different numbers. Here's a calmer breakdown.

### The truth, in one paragraph

AI inference does use water — primarily through electricity generation (turbines, cooling) and, to a smaller extent, through data-center cooling itself. The amount per query is **small but non-zero**, and it varies wildly by region, cooling system, model size, and time of day. It's worth measuring. It is not a planet-ending crisis per query, but at billion-query scale it adds up enough that transparency matters.

### Common myths

**Myth 1: "ChatGPT uses a bottle of water for every prompt."**
This claim usually traces back to a 2023 University of California Riverside paper that estimated ~500 ml of water per ~20–50 prompts under specific assumptions about training, region, and cooling — not per single prompt, and not for inference alone. A single short inference call with a modern, optimized stack typically uses on the order of **fractions of a milliliter to a few milliliters**, depending on model size and region.

**Myth 2: "AI is poisoning or contaminating the water supply."**
False. Data-center cooling water is typically either:
- Returned to the source at a similar (sometimes slightly warmer) temperature, or
- Evaporated into the atmosphere as part of the water cycle.
It is not chemically polluted by inference workloads. Concerns about *withdrawal* in water-stressed regions are valid; concerns about *contamination* generally are not.

**Myth 3: "Local models use no water."**
Local inference still uses electricity, and that electricity still has a water footprint at the generation source. Running `llama3.2` on a laptop uses less than running `gpt-4o` in a hyperscaler region, but it is not zero. This SDK accounts for that.

**Myth 4: "All providers use the same amount."**
Cooling efficiency varies dramatically: Google reports an average WUE around 1 L/kWh, Microsoft has been improving toward ~0.5 L/kWh, while older or evaporatively cooled facilities can be 4–5× higher. Region factor matters more than provider brand.

**Myth 5: "If I just stop using AI, I save a lot of water."**
Per individual user, the realistic savings are tiny — typically far less than a single shower or a load of laundry per month of normal use. The leverage is at the **infrastructure** layer: choosing efficient regions, using smaller models when appropriate, and caching aggressively. That's exactly what this SDK helps measure and surface.

### What actually moves the needle

| Lever | Approximate impact |
|---|---|
| Choosing a smaller model when adequate | 5–10× less water |
| Routing to an air-cooled region | 3–5× less water |
| Caching repeated queries | Up to 100% less per cache hit |
| Batching short requests | 1.5–3× less overhead per token |
| Avoiding multi-turn re-sending of full history | Linearly less per turn |

The SDK makes the first three measurable. The last two are application-architecture decisions you can validate with `ai.getStats()` over time.

### References

- Li, Yang, Zhao, Ren — *Making AI Less Thirsty* (2023), University of California Riverside
- Google — *2024 Environmental Report* (water-usage effectiveness)
- Microsoft — *2024 Environmental Sustainability Report*
- IEA — *Electricity 2024 — Analysis and forecast to 2026* (data-center energy demand)
- Patterson et al. — *Carbon Emissions and Large Neural Network Training* (Google, 2021)

---

## Contributing

PRs welcome — please open an issue first for non-trivial changes. The SDK is intentionally small and dependency-free at runtime, so changes that add hard dependencies will be discussed carefully.

```bash
git clone <repo>
cd resource-aware-ai
pnpm install
pnpm test
pnpm typecheck
pnpm build
```

---

## License

MIT — see [LICENSE](./LICENSE).
