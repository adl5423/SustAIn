# resource-aware-ai

A provider-agnostic Node.js/TypeScript SDK that wraps any LLM call and returns **energy + water usage metrics** with a human-readable sustainability footnote.

Works with OpenAI, Anthropic, Google Gemini, Mistral, Cohere, Ollama (local), or any custom HTTP endpoint — out of the box.

---

## Installation

```bash
npm install resource-aware-ai
# or
pnpm add resource-aware-ai
```

Install only the provider SDK(s) you need:

```bash
npm install openai                    # OpenAI
npm install @anthropic-ai/sdk         # Anthropic
npm install @google/generative-ai     # Google Gemini
npm install @mistralai/mistralai      # Mistral
npm install cohere-ai                 # Cohere
# Ollama and Generic HTTP need no extra packages
```

---

## Quick Start (5 lines)

```typescript
import { ResourceAwareAI } from "resource-aware-ai";

const ai = new ResourceAwareAI();

const res = await ai.chat({
  model: "gpt-4o",
  provider: "openai",
  messages: [{ role: "user", content: "Explain AI simply" }],
});

console.log(res.output);
console.log(res.footnote);
// → "This response used ~5.63 ml of water and 3.125 Wh of energy (−55.6% vs baseline of 12.66 ml)."
```

---

## Supported Providers

| Provider | Built-in key | Required env var |
|----------|-------------|------------------|
| OpenAI | `"openai"` | `OPENAI_API_KEY` |
| Anthropic | `"anthropic"` | `ANTHROPIC_API_KEY` |
| Google Gemini | `"gemini"` | `GEMINI_API_KEY` or `GOOGLE_API_KEY` |
| Mistral | `"mistral"` | `MISTRAL_API_KEY` |
| Cohere | `"cohere"` | `COHERE_API_KEY` |
| Ollama (local) | `"ollama"` | — |
| Custom HTTP | via `registerProvider()` | — |

---

## Latest Supported Models

### OpenAI
`gpt-4o`, `gpt-4o-mini`, `o1`, `o1-mini`, `o3`, `o3-mini`, `o4-mini`, `gpt-4-turbo`, `gpt-3.5-turbo`

### Anthropic
`claude-opus-4-5`, `claude-sonnet-4-5`, `claude-3-5-sonnet-20241022`, `claude-3-5-haiku-20241022`, `claude-3-opus-20240229`

### Google Gemini
`gemini-2.5-pro`, `gemini-2.5-flash`, `gemini-2.0-flash`, `gemini-2.0-pro`, `gemini-1.5-pro`, `gemini-1.5-flash`

### Mistral
`mistral-large-latest`, `mixtral-8x22b-instruct`, `codestral-latest`, `pixtral-large-latest`, `mistral-small-latest`

### Cohere
`command-a-03-2025`, `command-r-plus-08-2024`, `command-r-08-2024`, `command-r-plus`

### Ollama (local)
`llama3.3`, `llama3.2`, `llama3.1:70b`, `phi4`, `gemma3`, `qwen2.5:72b`, `deepseek-r1`

> Unknown model IDs are supported — the SDK infers the model class from name patterns.

---

## Response Schema

```typescript
{
  output: string;            // The LLM's text response
  metrics: {
    energy_kwh: number;          // Estimated energy used
    water_ml: number;            // Estimated water used (ml)
    baseline_water_ml: number;   // Worst-case baseline water (ml)
    water_saved_percent: number; // % savings vs baseline
    tokens_estimated: number;    // Token count used for estimation
    cache_hit: boolean;          // Whether result came from cache
  };
  footnote: string;          // Human-readable sustainability summary
}
```

---

## Configuration

```typescript
const ai = new ResourceAwareAI({
  regionFactor: 1800,        // ml water per kWh — default: 2000 (hybrid cooling)
  baselineFactor: 4500,      // ml water per kWh for worst-case — default: 4500
  enableCache: true,         // Cache identical requests — default: true
  customEstimator: (tokens, model) => tokens * 0.000003, // Override energy math
});
```

### Region Factor Guide

| Cooling Type | ml per kWh |
|--------------|-----------|
| Air cooled (low) | 0–500 |
| Hybrid cooling | 500–2000 |
| Evaporative cooling | 2000–5000 |

---

## Modes

```typescript
await ai.chat({
  model: "gpt-4o",
  provider: "openai",
  messages: [...],
  mode: "water_saver",   // "performance" | "balanced" | "water_saver"
});
```

---

## Resource Constraints

Reject a request before it runs if it would exceed your water/energy budget:

```typescript
await ai.chat({
  model: "gpt-4o",
  provider: "openai",
  messages: [...],
  constraints: {
    max_water_ml: 50,
    max_kwh: 0.01,
  },
});
// Throws ResourceAwareAIError with code "RESOURCE_LIMIT_EXCEEDED" if exceeded
```

---

## Caching

Identical requests (same model + messages) return instantly from cache with `~0 ml` water usage:

```typescript
const ai = new ResourceAwareAI({ enableCache: true }); // default

await ai.chat({ ... });  // real API call
await ai.chat({ ... });  // served from cache — footnote says "0 ml"

ai.clearCache();  // flush manually
```

---

## Custom Providers

Register any adapter with `registerProvider()`:

```typescript
import { ResourceAwareAI, GenericProvider } from "resource-aware-ai";

const ai = new ResourceAwareAI();

// Using the built-in GenericProvider for any HTTP endpoint
ai.registerProvider("my-api", new GenericProvider({
  endpoint: "https://my-llm.example.com/chat",
  apiKey: process.env.MY_API_KEY,
  headers: { "X-Custom-Header": "value" },
  transformRequest: (model, messages) => ({ model, messages, temperature: 0.7 }),
  transformResponse: (data) => ({ text: (data as any).choices[0].message.content }),
}));

// Or implement the ProviderAdapter interface directly
ai.registerProvider("custom", {
  async generate({ model, messages }) {
    const res = await fetch("https://...", { method: "POST", body: JSON.stringify({ model, messages }) });
    return { text: (await res.json()).output };
  },
});

const res = await ai.chat({ model: "my-model", provider: "my-api", messages: [...] });
```

---

## Custom Estimator

Override the energy math entirely:

```typescript
ai.setEstimator((tokens, model) => {
  // Return kWh
  return (tokens / 1000) * 0.003;
});
```

---

## Observability

```typescript
const stats = ai.getStats();
console.log(stats);
// {
//   total_requests: 42,
//   cache_hits: 17,
//   cache_hit_rate: 40.47,
//   total_water_ml: 183.6,
//   total_water_saved_ml: 412.8,
//   avg_water_ml_per_request: 4.37,
//   provider_distribution: { openai: 30, anthropic: 12 }
// }
```

---

## Error Handling

```typescript
import { ResourceAwareAI, ResourceAwareAIError } from "resource-aware-ai";

try {
  const res = await ai.chat({ ... });
} catch (err) {
  if (err instanceof ResourceAwareAIError) {
    console.log(err.sdkError.code);
    // "PROVIDER_ERROR" | "RESOURCE_LIMIT_EXCEEDED" | "UNKNOWN_PROVIDER"
  }
}
```

---

## List Available Models

```typescript
import { listModels, getModelProfile } from "resource-aware-ai";

listModels();              // all registered models
listModels("openai");      // filter by provider
getModelProfile("gpt-4o"); // → { id, provider, class, contextWindow, ... }
```

---

## Energy + Water Model

```
tokens  ≈ characters / 4
kWh     = (tokens / 1000) × model_factor
water   = kWh × regionFactor
baseline= kWh × baselineFactor
saved%  = (baseline - water) / baseline × 100
```

| Model Class | kWh / 1k tokens |
|-------------|----------------|
| Small (≤7B) | 0.0004 |
| Medium (8B–30B) | 0.0012 |
| Large (≥70B / GPT-4 class) | 0.0025 |

When a provider returns real token counts, those are used for final metric accuracy.

---

## TypeScript

Full TypeScript typings are included — no `@types/resource-aware-ai` needed.

```typescript
import type { ChatOptions, ChatResponse, ResourceMetrics, ProviderAdapter } from "resource-aware-ai";
```

---

## License

MIT
