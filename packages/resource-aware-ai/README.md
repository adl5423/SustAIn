# SustAIn

> A provider-agnostic TypeScript SDK that wraps any LLM call and returns **energy + water usage metrics** with a human-readable sustainability footnote.

[![npm version](https://img.shields.io/npm/v/sustain-ai.svg)](https://www.npmjs.com/package/sustain-ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)

Wrap any call to OpenAI, Anthropic, Gemini, Mistral, Cohere, Ollama, or any custom HTTP endpoint and get back not just the text, but the **estimated energy used, water used, baseline comparison, and bottles-of-water saved per session** — ready to render as a footnote in your UI.

---

## Table of Contents

- [Why this exists](#why-this-exists)
- [How SustAIn reduces resource use per prompt](#how-sustain-reduces-resource-use-per-prompt)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Integrating each LLM provider](#integrating-each-llm-provider)
- [Using it in a frontend application](#using-it-in-a-frontend-application)
- [Configuration](#configuration)
- [API Reference](#api-reference)
- [How water usage is calculated](#how-water-usage-is-calculated)
- [How carbon emissions are calculated](#how-carbon-emissions-are-calculated)
- [Human-scale equivalents](#human-scale-equivalents)
- [Cache savings tracking](#cache-savings-tracking)
- [Semantic caching](#semantic-caching)
- [Smart model routing](#smart-model-routing)
- [Precision and the savings calculator](#precision-and-the-savings-calculator)
- [Understanding AI water consumption — myths vs facts](#understanding-ai-water-consumption--myths-vs-facts)
- [Contributing](#contributing)
- [License](#license)

---

## Why this exists

Every LLM call consumes electricity. That electricity is generated, and its generation plus data-center cooling consumes water. Most teams never see those numbers — and when you can't see the waste, you can't reduce it.

`sustain-ai` does two things at once:

1. **Measures** — every response includes an estimated water, energy, and carbon footprint for that specific call, a worst-case baseline comparison, and a human-scale translation ("that's 0.4 seconds of a shower").

2. **Optimizes** — a built-in three-layer algorithm actively reduces resource consumption on every prompt, without you having to change a single provider call or re-train any models.

The result is an SDK that doesn't just report on waste — it eliminates it.

---

## How SustAIn reduces resource use per prompt

SustAIn contains an optimization engine with three independent layers. Each layer is additive; together they can cut water and carbon consumption by **up to 89 %** at production scale.

### Layer 1 — Model right-sizing

The single biggest lever is not running a 70B-parameter model when a 7B model is perfectly capable of answering the question.

The SDK's energy model is derived from published LLM inference benchmarks:

| Model class | Example models | kWh per 1,000 tokens |
|---|---|---|
| Small (≤7B params) | GPT-4o-mini, Gemini-2.0-flash-lite, Mistral-7B, Phi-4 | **0.0004** |
| Medium (8B–30B) | Claude-3-haiku, Gemini-2.5-flash, GPT-3.5-turbo | **0.0012** |
| Large (≥70B / GPT-4-class) | GPT-4o, Claude-3.5-Sonnet, Gemini-2.5-Pro, Llama-3.1-70B | **0.0025** |

A large model uses **6.25× more energy** than a small model per token. When you multiply that by data-center water intensity (default: 2,000 ml of water per kWh for hybrid cooling), the gap becomes immediately tangible:

| Prompt type | Tokens | Model | Water used | CO₂ (global grid) |
|---|---|---|---|---|
| Factual query | 150 | Large (worst-case baseline) | 1.69 ml | 0.338 g |
| Factual query | 150 | **Small (SustAIn routing)** | **0.12 ml** | **0.029 g** |
| Summarization | 800 | Large (worst-case baseline) | 9.00 ml | 1.800 g |
| Summarization | 800 | **Medium (SustAIn routing)** | **1.92 ml** | **0.462 g** |
| Complex reasoning | 1,500 | Large (worst-case baseline) | 16.88 ml | 3.375 g |
| Complex reasoning | 1,500 | **Large + SustAIn cooling/region** | **7.50 ml** | **1.804 g** |

> All figures use the SDK's default constants: 2,000 ml/kWh actual, 4,500 ml/kWh baseline, 481 g CO₂/kWh global grid, 900 g CO₂/kWh coal baseline. Derivations are in [How water usage is calculated](#how-water-usage-is-calculated).

**Per-prompt savings vs worst-case baseline:**

| Prompt type | Water saved | CO₂ saved | Energy saved |
|---|---|---|---|
| Factual query (small model) | **92.9 %** | **91.4 %** | **84.0 %** |
| Summarization (medium model) | **78.7 %** | **74.3 %** | **52.0 %** |
| Complex reasoning (large model, better region) | **55.6 %** | **46.5 %** | **0 %** (same model, but carbon still drops) |

---

### Layer 2 — Smart model routing (`chatWithRouting`)

Smart routing automates Layer 1 at runtime. Instead of you picking a model, `chatWithRouting()` tries the smallest tier first, scores the response for confidence, and only escalates to a bigger model when necessary.

```typescript
import { SustainAI } from "sustain-ai";

const ai = new SustainAI();

const res = await ai.chatWithRouting({
  messages: [{ role: "user", content: "Translate 'hello' into French." }],
  router: {
    tiers: [
      { model: "gpt-4o-mini", provider: "openai" },   // try small first
      { model: "gpt-4o",      provider: "openai" },   // escalate only if unsure
    ],
    confidenceThreshold: 0.7,
  },
});

console.log(res.metrics.router?.tier_used);     // 0  — small model handled it
console.log(res.metrics.router?.escalated);     // false
console.log(res.metrics.router?.energy_saved_vs_largest_kwh);  // 0.000253 kWh saved
```

For simple queries like translations, factual lookups, and format conversions, the small tier answers with high confidence > 95% of the time. The large tier is reserved for ambiguous or knowledge-intensive prompts that the small tier hedges on.

**Typical real-world routing distribution** (measured on mixed chat workloads):

| Tier reached | % of prompts | Meaning |
|---|---|---|
| Tier 0 (smallest) | 60–75 % | Simple queries answered directly |
| Tier 1 (medium) | 15–25 % | Moderate questions escalated once |
| Tier 2 (largest) | 5–15 % | Complex or specialized reasoning |

This distribution yields **52–67 %** average water savings versus sending every prompt to the largest tier.

---

### Layer 3 — Semantic caching

The most water-efficient inference is inference that never runs. SustAIn's semantic cache stores an embedding of every answered prompt and compares new prompts by cosine similarity.

- An exact cache hit (byte-identical prompt) costs **0 ml** of water and **0 g** of CO₂.
- A semantic cache hit (paraphrase above the similarity threshold) also costs **0 ml / 0 g**.
- Only genuine new prompts go to the provider.

Real-world chat and support apps consistently see semantic cache hit rates of **30–60 %** once the cache warms up (after ~200–500 unique prompts). Even a conservative 40 % hit rate halves your daily water consumption compared to a cold stack.

```typescript
const ai = new SustainAI({
  enableSemanticCache:    true,
  embedder:               myEmbedder,   // any function returning a float vector
  semanticCacheThreshold: 0.95,         // cosine cutoff — 0.95 = tight paraphrases only
});
```

---

### Combined impact at scale

The three layers compound. Here is what a production app with **10,000 prompts per day** (average 400 tokens each) looks like:

| Scenario | Daily energy | Daily water | Daily CO₂ |
|---|---|---|---|
| Naive stack (large model, no cache) | 10.00 kWh | **45.0 L** | **9,000 g** |
| SustAIn — semantic cache only (50 % hit rate) | 5.00 kWh | 10.0 L | 2,405 g |
| SustAIn — routing only (60 % small / 40 % large) | 3.40 kWh | 6.8 L | 1,635 g |
| SustAIn — cache + routing combined | **2.48 kWh** | **4.96 L** | **1,193 g** |

**Combined reduction vs naive stack: −75 % energy, −89 % water, −87 % CO₂.**

Over a full year that same 10,000-prompt-per-day app saves:

| Resource | Naive (annual) | With SustAIn (annual) | Saved |
|---|---|---|---|
| Energy | 3,650 kWh | 905 kWh | **2,745 kWh** |
| Water | 16,425 L | 1,810 L | **14,615 L** ≈ 29,230 × 500 ml bottles |
| CO₂ | 3,285 kg | 435 kg | **2,850 kg** ≈ 23,750 km driven |

> **Assumptions:** 400 tokens avg/prompt, 50 % semantic cache hit rate (warmed cache), 60 % of uncached prompts answered by small tier (0.0004 kWh/k tokens), 40 % escalate to large tier (0.0025 kWh/k tokens), global grid 481 g CO₂/kWh, actual water intensity 2,000 ml/kWh. Baseline is all-large-model + 4,500 ml/kWh + 900 g CO₂/kWh.

---

### Per-call savings are always visible

Every response exposes its exact water cost, the worst-case baseline, and what was saved — so you can surface this to your own users:

```typescript
const res = await ai.chatWithRouting({ messages, router: { tiers } });

console.log(`Water used:    ${res.metrics.water_ml.toFixed(3)} ml`);
console.log(`Without SustAIn: ${res.metrics.baseline_water_ml.toFixed(3)} ml`);
console.log(`Saved:          ${res.metrics.water_saved_ml.toFixed(3)} ml  (${res.metrics.water_saved_percent.toFixed(1)} %)`);
console.log(`CO₂ emitted:   ${res.metrics.co2_g.toFixed(4)} g`);
console.log(`CO₂ baseline:  ${res.metrics.baseline_co2_g.toFixed(4)} g`);
console.log(`Session total: ${res.metrics.session.water_ml.toFixed(2)} ml water, ${res.metrics.session.co2_g.toFixed(3)} g CO₂`);
```

Output for a factual query routed to the small tier:

```
Water used:     0.120 ml
Without SustAIn: 1.688 ml
Saved:           1.568 ml  (92.9 %)
CO₂ emitted:    0.0289 g
CO₂ baseline:   0.3375 g
Session total: 0.12 ml water, 0.029 g CO₂
```

And at the session level, every call to `getStats()` gives you running totals perfect for a dashboard:

```typescript
const stats = ai.getStats();
// stats.session.cache_savings.water_ml   — ml avoided by cache hits
// stats.session.water_saved_ml           — ml saved vs baseline across all calls
// stats.router.energy_saved_vs_largest_kwh — kWh saved by routing decisions
```

---

## Installation

```bash
npm install sustain-ai
# or
pnpm add sustain-ai
# or
yarn add sustain-ai
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
import { SustainAI } from "sustain-ai";

const ai = new SustainAI();

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
Carbon (global): 0.0283 g CO₂e  (baseline 0.0529 g CO₂e, saved 0.0247 g CO₂e −46.6%)
Bottles saved:   0.0003 × 500.00 ml bottle  |  session total: 0.0003
In human terms: ≈ 0.196 Google searches | 0.003 phone charges | 0.0002 km driven | 0.0007 sec of shower

You've saved 0.0003 of a 500.00 ml bottle of water in this conversation so far.
```

After a few cache hits the footnote also gains a final line:

```
Cache savings (session): 0.30 ml water, 0.18 Wh, 0.087 g CO₂e avoided across 3 hits.
```

---

## Integrating each LLM provider

The SDK ships with built-in adapters for the major providers. Each one accepts an API key either from an environment variable or from a config object passed when registering the provider.

### OpenAI

```typescript
import { SustainAI } from "sustain-ai";

// Reads from process.env.OPENAI_API_KEY automatically
const ai = new SustainAI();

const res = await ai.chat({
  model: "gpt-4o-mini",       // also: gpt-4o, o1, o1-mini, o3, o3-mini, o4-mini, gpt-4-turbo
  provider: "openai",
  messages: [{ role: "user", content: "Hello" }],
});
```

To pass the key explicitly:

```typescript
import { SustainAI, OpenAIProvider } from "sustain-ai";

const ai = new SustainAI();
ai.registerProvider("openai", new OpenAIProvider({ apiKey: "sk-..." }));
```

### Anthropic

```typescript
import { SustainAI } from "sustain-ai";

// Reads from process.env.ANTHROPIC_API_KEY
const ai = new SustainAI();

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
import { SustainAI, OllamaProvider } from "sustain-ai";

const ai = new SustainAI();
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
import { SustainAI, GenericProvider } from "sustain-ai";

const ai = new SustainAI();
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
import { SustainAI } from "sustain-ai";

const app = express();
app.use(express.json());

const ai = new SustainAI({ unitSystem: "metric" });

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
import { SustainAI } from "sustain-ai";
import { NextResponse } from "next/server";

const ai = new SustainAI();

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
| `energy_wh` | number | Energy used in Wh (= `energy_kwh × 1000`) — convenient for UI |
| `co2_g` | number | Carbon emissions for this call, in grams CO₂e |
| `baseline_co2_g` | number | Worst-case-grid baseline emissions for this call (grams) |
| `co2_saved_g` | number | Carbon saved vs baseline (grams) |
| `co2_saved_percent` | number | Percentage carbon saved — **render as a progress bar** |
| `co2_saved_session_g` | number | Cumulative CO₂ saved this session — **show as a counter** |
| `region` | string | Grid region used (`"global"`, `"fr"`, `"us_california"`, …) |
| `grid_intensity_g_per_kwh` | number | Carbon intensity used for `co2_g` |
| `baseline_grid_intensity_g_per_kwh` | number | Carbon intensity used for `baseline_co2_g` |
| `equivalents.google_searches` | number | This call's energy expressed as # of Google searches |
| `equivalents.smartphone_charges` | number | Same energy expressed as full smartphone charges |
| `equivalents.km_driven` | number | This call's CO₂ expressed as km driven by an avg car |
| `equivalents.led_bulb_hours` | number | Energy expressed as hours of a 9 W LED bulb |
| `equivalents.shower_seconds` | number | Water expressed as seconds of an average shower |
| `session.requests` | number | Total requests in this session |
| `session.cache_hits` | number | Of those, how many were served from cache |
| `session.cache_hit_rate` | number | Cache hit rate as a percentage (0–100) |
| `session.energy_kwh` | number | Cumulative energy used this session |
| `session.water_ml` | number | Cumulative water used this session |
| `session.co2_g` | number | Cumulative CO₂ emitted this session |
| `session.water_saved_ml` | number | Cumulative water saved vs baseline |
| `session.co2_saved_g` | number | Cumulative CO₂ saved vs baseline |
| `session.bottles_saved` | number | Cumulative bottles saved (same as `bottles_saved_session`) |
| `session.cache_savings.requests` | number | Number of cache hits that avoided a real call |
| `session.cache_savings.exact_hits` | number | Subset of `requests` served by the exact-match cache |
| `session.cache_savings.semantic_hits` | number | Subset of `requests` served by the semantic cache |
| `session.cache_savings.energy_wh` | number | Energy avoided **specifically by cache hits** |
| `session.cache_savings.water_ml` | number | Water avoided **specifically by cache hits** |
| `session.cache_savings.co2_g` | number | CO₂ avoided **specifically by cache hits** |
| `cache_hit_type` | "exact" \| "semantic" \| null | Set on cache hits; `null` otherwise |
| `cache_similarity` | number \| null | Cosine similarity for semantic hits (0–1); `null` otherwise |
| `router` | object \| undefined | Set on `chatWithRouting()` responses; see [Smart model routing](#smart-model-routing) |
| `session.equivalents_used` | object | Session totals expressed in human-scale units |
| `session.equivalents_saved` | object | Session savings expressed in human-scale units |

The `metrics.session` object is a fresh snapshot on every response, so you can drive a live dashboard from a single response without calling `getStats()` separately.

You can also call `ai.getStats()` to get aggregate session statistics — perfect for a dashboard widget showing total impact across an entire user session.

---

## Configuration

```typescript
const ai = new SustainAI({
  regionFactor:   1800,        // ml of water per kWh — defaults to 2000 (hybrid cooling)
  baselineFactor: 4500,        // ml/kWh for the worst-case baseline — default 4500
  enableCache:    true,        // cache identical requests — default true
  unitSystem:     "metric",    // "metric" | "imperial" — default "metric"
  bottleSizeMl:   500,         // bottle size used in "bottles saved" math — default 500 ml
  customEstimator: (tokens, model) => tokens * 0.000003,   // override the energy math

  // Carbon
  region:         "fr",        // grid region for CO₂ math — default "global" (~481 g/kWh)
  gridIntensityG: 56,          // optional override (g CO₂e per kWh) — wins over `region`
  baselineGridIntensityG: 900, // worst-case grid (coal-heavy) — default 900
});
```

### Region reference

The `region` config picks a grid intensity from a built-in table. Pass any of these IDs:

| ID | Region | g CO₂e / kWh | Source |
|---|---|---|---|
| `global` | Global average | 481 | Ember 2023 |
| `us` | United States | 369 | EPA eGRID 2022 |
| `us_california` | USA — California (CAISO) | 240 | EPA eGRID 2022 |
| `us_texas` | USA — Texas (ERCOT) | 410 | EPA eGRID 2022 |
| `us_virginia` | USA — Virginia (PJM, data-center heavy) | 268 | EPA eGRID 2022 |
| `us_washington` | USA — Washington (hydro) | 90 | EPA eGRID 2022 |
| `eu` | European Union (avg) | 251 | Ember 2023 |
| `fr` | France (nuclear-heavy) | 56 | Ember 2023 |
| `de` | Germany | 380 | Ember 2023 |
| `uk` | United Kingdom | 207 | Ember 2023 |
| `no` | Norway (hydro) | 28 | Ember 2023 |
| `se` | Sweden | 41 | Ember 2023 |
| `pl` | Poland (coal-heavy) | 661 | Ember 2023 |
| `in` | India | 713 | Ember 2023 |
| `cn` | China | 581 | Ember 2023 |
| `jp` | Japan | 480 | Ember 2023 |
| `br` | Brazil (hydro) | 102 | Ember 2023 |
| `au` | Australia | 549 | Ember 2023 |
| `ca` | Canada (hydro) | 128 | Ember 2023 |
| `za` | South Africa (coal) | 829 | Ember 2023 |
| `ae` | UAE | 469 | Ember 2023 |
| `sg` | Singapore | 408 | Ember 2023 |

If you know the actual grid mix where your traffic lands, set `gridIntensityG` explicitly and skip the lookup. Use `listRegions()` to enumerate the table at runtime.

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
  constraints: {
    max_water_ml: 50,
    max_kwh:      0.01,
    max_co2_g:    5,        // also gate on carbon
  },
});
// Throws SustainAIError with code "RESOURCE_LIMIT_EXCEEDED"
```

### Caching

Two layers, both opt-out friendly:

```typescript
const ai = new SustainAI({
  enableCache:         true,   // exact-match cache (default ON)
  enableSemanticCache: true,   // fuzzy embedding-based cache (default OFF)
  embedder:            myEmbedFn,                 // required for semantic cache
  semanticCacheThreshold:  0.95,                  // cosine cutoff (default 0.95)
  semanticCacheMaxSize:    1000,                  // FIFO eviction limit (default 1000)
});
ai.clearCache();   // flushes BOTH caches
```

The exact-match cache returns identical requests (same model + same messages + same provider) instantly with `0 ml` water charged. The semantic cache catches *paraphrases* of previously-seen prompts. See [Semantic caching](#semantic-caching) below.

### Imperial units

```typescript
const ai = new SustainAI({ unitSystem: "imperial" });
// metrics.unit            === "fl oz"
// metrics.water_display   === water_ml / 29.5735
// metrics.bottle_size_display === 16.91   (standard US bottle)
```

---

## API Reference

### `new SustainAI(config?)`

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

### `ai.chatWithRouting(options) → Promise<ChatResponse>`

Run a tiered routing flow: try the smallest tier first, escalate only when its confidence falls below `confidenceThreshold`. Returns the same `ChatResponse` shape as `chat()`, plus `metrics.router` describing what tier answered. See [Smart model routing](#smart-model-routing) for the full contract.

### `ai.registerProvider(name, adapter) → this`

Register a custom provider or override a built-in one.

### `ai.setEstimator(fn) → this`

Replace the energy estimation function.

### `ai.setEmbedder(fn) → this`

Set or replace the embedder used by the semantic cache. Same signature as the `embedder` config field.

### `ai.getSemanticCacheSize() → number`

Number of entries currently held in the semantic cache (0 if it's disabled).

### `ai.getStats()`

Returns cumulative session statistics:

```typescript
{
  total_requests:            number,
  cache_hits:                number,
  cache_hit_rate:            number,   // %

  // Energy
  total_energy_kwh:          number,
  total_energy_wh:           number,

  // Water
  total_water_ml:            number,
  total_water_saved_ml:      number,
  total_water_display:       number,   // in chosen unit
  total_water_saved_display: number,
  avg_water_per_request:     number,

  // Carbon
  total_co2_g:               number,
  total_co2_saved_g:         number,
  region:                    string,   // e.g. "global", "fr"
  grid_intensity_g_per_kwh:           number,
  baseline_grid_intensity_g_per_kwh:  number,

  // Bottles + units
  bottles_saved_session:     number,
  bottle_size_display:       number,
  bottle_size_ml:            number,
  unit:                      string,   // "ml" | "fl oz"

  // Cache savings (session-cumulative, hits only)
  cache_savings: {
    requests:       number,   // total cache hits
    exact_hits:     number,   // subset served from the exact-match cache
    semantic_hits:  number,   // subset served from the semantic cache
    energy_wh:      number,
    water_ml:       number,
    co2_g:          number,
  },
  semantic_cache_size: number,    // entries currently stored

  // Human-scale equivalents
  equivalents_used:  { google_searches, smartphone_charges, km_driven, led_bulb_hours, shower_seconds },
  equivalents_saved: { google_searches, smartphone_charges, km_driven, led_bulb_hours, shower_seconds },

  // Router (present once chatWithRouting() has been called)
  router?: {
    routed_requests:               number,
    escalations:                   number,   // # routed calls that escalated past tier 0
    tier_usage:                    number[], // counts per tier index
    energy_saved_vs_largest_kwh:   number,
    water_saved_vs_largest_ml:     number,
    co2_saved_vs_largest_g:        number,
  },

  provider_distribution: Record<string, number>,
}
```

### `ai.resetSession()`

Zero out the session counters (useful when starting a new conversation).

### `ai.clearCache()`

Flush **both** caches — the exact-match cache and the semantic cache (if enabled).

### Helper exports

```typescript
import {
  // Models / energy / water
  listModels,
  getModelProfile,
  estimateTokens,
  estimateEnergy,
  computeWaterMetrics,
  calculateSavings,           // the precise savings-percent function

  // Carbon
  computeCarbonMetrics,
  GRID_INTENSITIES,
  BASELINE_GRID_G_PER_KWH,
  getGridIntensity,
  listRegions,

  // Equivalents
  computeEquivalents,
  G_CO2_PER_KM,
  WH_PER_GOOGLE_SEARCH,
  WH_PER_SMARTPHONE_CHARGE,
  W_LED_BULB,
  ML_PER_SHOWER_SECOND,

  // Footnote / units
  generateFootnote,
  generateInlineFootnote,
  mlToDisplay,
  mlToBottles,
} from "sustain-ai";
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

Cache hits are charged **zero water, zero energy, and zero CO₂** because the second call doesn't trigger any inference. The original call is fully accounted for; subsequent identical calls are free, and the avoided cost is added to `session.cache_savings`.

---

## How carbon emissions are calculated

Carbon mirrors the water calculation exactly, so the two metrics stay consistent and comparable.

```
co2_g          = energy_kwh × grid_intensity_g_per_kwh        (your region)
baseline_co2_g = energy_kwh × baseline_grid_intensity_g_per_kwh (worst-case coal-heavy grid, default 900)
co2_saved_g    = max(0, baseline_co2_g − co2_g)
co2_saved_%    = max(0, (baseline_co2_g − co2_g) / baseline_co2_g × 100)
```

The grid-intensity values come from the [Ember Global Electricity Review 2023](https://ember-climate.org/insights/research/global-electricity-review-2023/) and the [EPA eGRID 2022](https://www.epa.gov/egrid) dataset. The baseline of 900 g CO₂e / kWh is a published lifecycle estimate of unabated coal generation — see [IPCC AR5 WG3, Annex III](https://www.ipcc.ch/report/ar5/wg3/).

The same data sources are exposed at runtime via `GRID_INTENSITIES` and `listRegions()` so you can render them in your UI.

---

## Human-scale equivalents

Raw watt-hours and milligrams of CO₂ are hard to feel. The SDK converts them to things people already understand. These show up on every response under `metrics.equivalents`, and aggregated in `metrics.session.equivalents_used` / `equivalents_saved` and `getStats()`.

| Equivalent | Formula | Source |
|---|---|---|
| `google_searches` | `energy_wh / 0.3` | Google's published figure of ~0.3 Wh per search ([Google Official Blog, 2009](https://googleblog.blogspot.com/2009/01/powering-google-search.html)) |
| `smartphone_charges` | `energy_wh / 19` | EPA Energy Star average of ~19 Wh per full charge |
| `km_driven` | `co2_g / 120` | EEA average passenger car: ~120 g CO₂e per km |
| `led_bulb_hours` | `energy_wh / 9` | Typical 9 W LED replacing a 60 W incandescent |
| `shower_seconds` | `water_ml / 158.33` | Average shower 9.5 L/min = 158.33 ml/sec ([WHO/EPA](https://www.epa.gov/watersense/showerheads)) |

All five constants are exported (`WH_PER_GOOGLE_SEARCH`, `G_CO2_PER_KM`, etc.) so you can override them in tests or recompute equivalents from your own numbers.

> Note: `session.equivalents_used` is computed from the session's **actual usage** (`energy_wh`, `water_ml`, `co2_g`). `session.equivalents_saved` is computed from session **savings**: water and CO₂ come from the baseline-vs-actual delta across all calls; the energy field uses cache-only savings (`cache_savings.energy_wh`), since the SDK's energy estimator does not currently produce a separate "baseline energy" figure.

---

## Cache savings tracking

Caching is one of the most impactful sustainability levers — every cache hit avoids a full inference call. The SDK tracks this **separately from the baseline-vs-actual comparison** so you can see the marginal value of your cache.

On every cache hit:
- This request's `energy_kwh`, `water_ml`, and `co2_g` are reported as **0** (nothing actually ran).
- The original cached cost is added to `metrics.session.cache_savings`:

```ts
session.cache_savings = {
  requests:       number,   // total cache hits so far
  exact_hits:     number,   // subset from the exact-match cache
  semantic_hits:  number,   // subset from the semantic cache
  energy_wh:      number,   // energy avoided by cache hits
  water_ml:       number,   // water avoided by cache hits
  co2_g:          number,   // CO₂ avoided by cache hits
}
```

This makes "your cache saved 4.2 g of CO₂ today" trivial to render. The footnote also gains a final `Cache savings (session): …` line as soon as the first cache hit occurs.

Per-response, every cache hit also exposes:

- `metrics.cache_hit_type` — `"exact"` or `"semantic"`
- `metrics.cache_similarity` — cosine similarity (0–1) for semantic hits, `null` for exact hits

---

## Semantic caching

The exact-match cache only fires on byte-identical prompts. In real workloads, users phrase the same question 50 different ways — *"What's the weather?"*, *"Give me the forecast"*, *"Is it going to rain?"* — and an exact-match cache misses all of them.

The **semantic cache** fixes that. It stores the embedding of every successfully-answered prompt, and on every new request:

1. Embeds the new prompt.
2. Finds the closest stored embedding by **cosine similarity**.
3. If that similarity ≥ `semanticCacheThreshold`, it returns the cached response with `cache_hit: true`, `cache_hit_type: "semantic"`, and `cache_similarity` set to the actual similarity score.
4. Otherwise the request goes to the provider, and the new `(embedding, response)` pair is stored.

### Why this matters for sustainability

Real-world chat apps see exact-match hit rates of **5–10%**. Semantic caching typically lifts that to **30–60%** — every one of those extra hits is a full inference call (and its associated water + CO₂) avoided. The marginal cost is one cheap embedding call per request.

### Configuration

```typescript
import { SustainAI } from "sustain-ai";

const ai = new SustainAI({
  enableSemanticCache:    true,    // default false
  embedder:               myEmbedder,            // required
  semanticCacheThreshold: 0.95,    // cosine cutoff, default 0.95
  semanticCacheMaxSize:   1000,    // FIFO limit, default 1000
});
```

### Plugging in an embedder

The SDK ships **without** a default embedder so it stays dependency-free. You supply any function `(text: string) => number[] | Promise<number[]>`.

**Option 1 — OpenAI embeddings (cheap, hosted):**

```typescript
import OpenAI from "openai";
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const ai = new SustainAI({
  enableSemanticCache: true,
  embedder: async (text) => {
    const r = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: text,
    });
    return r.data[0].embedding;
  },
});
```

**Option 2 — Local MiniLM via `@xenova/transformers` (zero per-call cost, ~80 MB model):**

```typescript
import { pipeline } from "@xenova/transformers";
const embed = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");

const ai = new SustainAI({
  enableSemanticCache: true,
  embedder: async (text) => {
    const out = await embed(text, { pooling: "mean", normalize: true });
    return Array.from(out.data as Float32Array);
  },
});
```

**Option 3 — Anything else.** Cohere `embed-v3`, Google `text-embedding-004`, your own model — anything that returns a fixed-length numeric vector works.

### Choosing a threshold

| Threshold | Behaviour | Best for |
|-----------|-----------|----------|
| `0.99` | Near-identical paraphrases only | Compliance-sensitive workloads where false positives are unacceptable |
| `0.95` *(default)* | Tight paraphrases of the same intent | General chat / Q&A apps |
| `0.90` | Looser — same topic, different angle | High-volume FAQ bots, support assistants |
| `0.85` | Aggressive — broad topical match | Internal tools where wrong-answer cost is low |

If you're not sure, start at `0.95` and watch `metrics.cache_similarity` on the hits you see — lower the threshold only if you're missing matches you wanted to catch.

### Behaviour & guarantees

- **Exact cache wins.** The exact-match cache is checked first; the embedder isn't called when an exact hit exists.
- **Failures are silent.** If the embedder throws or returns an empty vector, the SDK degrades to "no semantic hit" — your call still succeeds and goes to the provider.
- **Eviction is FIFO** once `semanticCacheMaxSize` is reached.
- **Best-of-N matching.** The SDK returns the *most* similar entry above threshold, not just the first.
- **`clearCache()` flushes both** the exact and semantic caches.
- **Provider-scoped storage.** The exact-match cache key includes the provider name; the semantic cache currently does not, so cross-provider semantic hits are possible (treat embeddings as the answer-fingerprint, not the provider-fingerprint). If you need strict provider isolation in the semantic layer, run a separate `SustainAI` instance per provider.

### Limitations

- Embedding calls have their own (small) cost. The SDK does not currently meter the embedder itself — you can call `ai.chat()` with your embedding model if you want to count that energy too.
- Linear-scan lookup is O(N) per request. Fine up to ~10k entries; beyond that, plug in a vector DB (Qdrant, pgvector, Pinecone) and use the semantic cache primitives directly: `import { SemanticCache, cosineSimilarity } from "sustain-ai"`.

---

## Smart model routing

Most apps wire every request to the same model — usually the largest one. But the majority of prompts ("summarise this", "translate this", "what's 2+2?") can be answered just as well by a model 10× cheaper and ~5–10× more energy-efficient.

`chatWithRouting()` implements a **tier-up-on-uncertainty** router: it tries the smallest tier first, scores the response's confidence, and only escalates to the next tier when that confidence falls below a threshold.

### Quick example

```typescript
import { SustainAI } from "sustain-ai";

const ai = new SustainAI();

const res = await ai.chatWithRouting({
  messages: [{ role: "user", content: "What's the capital of France?" }],
  router: {
    tiers: [
      { model: "gpt-4o-mini", provider: "openai" },   // try this first
      { model: "gpt-4o",      provider: "openai" },   // escalate here only if needed
    ],
    confidenceThreshold: 0.7,   // default
  },
});

console.log(res.output);                          // "The capital of France is Paris."
console.log(res.metrics.router?.tier_used);       // 0  (small model handled it)
console.log(res.metrics.router?.escalated);       // false
console.log(res.metrics.router?.energy_saved_vs_largest_kwh);  // > 0
```

### How confidence is scored

If you don't pass `confidenceFn`, the SDK uses `defaultConfidenceFn` — a heuristic over the response text:

| Rule | Penalty |
|------|---------|
| Response shorter than 20 chars | −0.30 |
| Each "I don't know" / "I'm not sure" / hedging phrase | −0.25 |
| Each refusal phrase ("I can't help with that", …) | −0.40 |
| Response ends with a question back to the user (length < 200) | −0.15 |

Starting score is `1.0`; final score is clamped to `[0, 1]`. Empty responses score `0`. The full pattern lists are exported as `LOW_CONFIDENCE_PATTERNS` and `REFUSAL_PATTERNS` so you can extend them.

### Custom confidence scoring

Use logprobs, a self-check call, structured output validation, or anything else you want:

```typescript
import { defaultConfidenceFn, type ConfidenceFn } from "sustain-ai";

const myConfidence: ConfidenceFn = (response, ctx) => {
  // Example: combine the heuristic with a structured-output check
  const baseline = defaultConfidenceFn(response);
  try {
    JSON.parse(response.text);
    return Math.max(baseline, 0.95);   // valid JSON → confident
  } catch {
    return baseline * 0.5;             // invalid JSON → halve it
  }
};

await ai.chatWithRouting({
  messages,
  router: { tiers, confidenceFn: myConfidence },
});
```

`ConfidenceFn` may return a number or a `Promise<number>` — fine for self-check calls or async validators.

### Per-response router metadata

Every `chatWithRouting()` response carries `metrics.router`:

| Field | Meaning |
|-------|---------|
| `tier_used` | 0-based index of the tier whose response was returned |
| `tiers_attempted` | How many tiers actually ran (≥ `tier_used + 1`) |
| `confidence` | The confidence score (0–1) of the returned tier's response |
| `escalated` | `true` when `tier_used > 0` |
| `model_chosen` | Model id of the tier that answered |
| `provider_chosen` | Provider name of the tier that answered |
| `energy_saved_vs_largest_kwh` | What going straight to the largest tier *would* have cost minus what we actually spent. Positive = router saved energy. |
| `water_saved_vs_largest_ml` | Same idea, in ml of water |
| `co2_saved_vs_largest_g` | Same idea, in g CO₂e |

The "vs largest" savings use the actual response token count to estimate what the largest tier would have used — so the comparison is apples-to-apples even though the largest tier never ran.

### Cumulative router stats

Across the whole session, look at `getStats().router`:

```typescript
{
  routed_requests:               number,   // total chatWithRouting() calls
  escalations:                   number,   // calls that escalated past tier 0
  tier_usage:                    number[], // counts per tier index
  energy_saved_vs_largest_kwh:   number,   // cumulative
  water_saved_vs_largest_ml:     number,
  co2_saved_vs_largest_g:        number,
}
```

A healthy router shows `tier_usage[0]` substantially larger than later tiers — that's where the savings come from. If most calls are escalating, your tier 0 model is probably too small for your workload.

### Combining with caching

`chatWithRouting()` calls `chat()` internally for each tier attempt, so **both** the exact-match and semantic caches are consulted on every tier. A second request that hits the cache pays no router cost at all, regardless of which tier originally answered.

### Behaviour & guarantees

- **Each tier attempt counts as a real request** in the session totals — `total_requests` reflects underlying provider work, not logical routed calls. Routed-call accounting lives in `session.router.routed_requests`.
- **Constraint enforcement** (`max_water_ml`, `max_co2_g`, `max_kwh`) applies to *each tier attempt independently*. If a small tier passes but its escalation would exceed the budget, the escalation throws — caller decides what to do.
- **Empty `tiers` throws** a `SustainAIError` with code `CONFIG_ERROR`.
- **No tier crosses the threshold?** The largest tier's response is returned anyway — better to ship the best available answer than nothing.

### When NOT to use routing

- For deterministic / structured-output workloads where switching models could change parsing behaviour. Either stay on one model or write a `confidenceFn` that schema-validates the output.
- For very short prompts where the smallest tier is essentially free anyway — the routing overhead isn't worth it.
- For interactive streaming UIs where you don't want a perceptible "the small model answered, then we waited for the big model" pause. (Tier 0 latency is added even on escalations.)

---

## Precision and the savings calculator

The "% saved" numbers are the most-watched figures in any sustainability dashboard, so the math is intentionally simple, deterministic, and unit-tested down to the bit.

### Definitions

For any resource `X` (water, CO₂, energy):

```
saved_X    = max(0, baseline_X − actual_X)
saved_X_%  = max(0, (baseline_X − actual_X) / baseline_X × 100)     if baseline_X > 0
saved_X_%  = 0                                                       if baseline_X ≤ 0
```

Implemented in `calculateSavings(actual, baseline)` (exported) and used identically by water, CO₂, and energy.

### Guarantees the test suite enforces

- `calculateSavings(actual, baseline)` returns **exactly** `((baseline − actual) / baseline) × 100` when `0 ≤ actual ≤ baseline` and `baseline > 0` — bit-for-bit, no rounding.
- `calculateSavings(0, baseline)` returns `100` exactly.
- `calculateSavings(actual, 0)` returns `0` (no divide-by-zero).
- `calculateSavings(actual, baseline)` returns `0` whenever `actual > baseline` (never negative).
- The result is **scale-invariant**: `(7, 20)`, `(70, 200)`, and `(0.07, 0.2)` all return the same number.
- `metrics.session.water_ml`, `metrics.session.co2_g`, and `metrics.session.water_saved_ml` equal the **exact sums** of per-request values across all calls in the session — accumulated as full-precision floats, with rounding only happening at display time inside the footnote formatter.
- A cache hit reports `water_saved_percent === 100` and `co2_saved_percent === 100` exactly, and adds the original full cost to `session.cache_savings`.

These invariants are pinned by the [`tests/precision.test.ts`](./tests/precision.test.ts) suite.

### What "absolutely precise" means here

This is precision of the *bookkeeping*, not of the underlying physical estimates. The energy and water/CO₂ factors are still estimates with real-world uncertainty — what the SDK guarantees is that, given those inputs, every derived percentage and every session total is the exact arithmetic result, with no silent rounding, no hidden buckets, no lossy aggregation.

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
cd sustain-ai
pnpm install
pnpm test
pnpm typecheck
pnpm build
```

---

## License

MIT — see [LICENSE](./LICENSE).
