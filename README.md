# SustAIn

> A provider-agnostic TypeScript SDK that wraps any LLM call and returns **energy + water + carbon metrics** with a human-readable sustainability footnote.

[![npm version](https://img.shields.io/npm/v/sustain-ai.svg)](https://www.npmjs.com/package/sustain-ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)

Wrap any call to OpenAI, Anthropic, Gemini, Mistral, Cohere, Ollama, or any custom HTTP endpoint and get back not just the text, but the **estimated energy used, water consumed, CO₂ emitted, and bottles-of-water saved per session** — ready to render as a footnote in your UI.

---

## Package

The SDK lives in [`packages/resource-aware-ai`](./packages/resource-aware-ai).

**[Full documentation →](./packages/resource-aware-ai/README.md)**

---

## Quick look

```typescript
import { SustainAI } from "sustain-ai";

const ai = new SustainAI({ provider: "openai", model: "gpt-4o-mini" });

const { output, metrics, footnote } = await ai.chat({
  messages: [{ role: "user", content: "Explain photosynthesis in one sentence." }],
});

console.log(output);
// "Photosynthesis is the process by which plants convert sunlight, water,
//  and CO₂ into glucose and oxygen."

console.log(footnote);
// ⚡ 0.0041 Wh · 💧 2.1 ml (0.01 bottles) · 🌿 0.0021 g CO₂
// Baseline: 0.0063 Wh / 3.2 ml / 0.0032 g CO₂ (saved 33%)
```

---

## What it does

- **7 built-in providers** — OpenAI, Anthropic, Google Gemini, Mistral, Cohere, Ollama, Generic HTTP
- **60+ model profiles** with auto-inference for unknown models
- **Energy · water · carbon** estimation per request, with session totals
- **Human-scale equivalents** — Google searches, smartphone charges, km driven
- **Exact-match + semantic caching** — avoid redundant inference; track how much was saved
- **Smart model routing** — tier-up-on-uncertainty: try the cheapest model first, escalate only when needed
- **Constraint policies** — throw before exceeding a water, CO₂, or energy budget
- **Zero mandatory dependencies** — only install the provider SDK(s) you actually use

---

## Installation

```bash
npm install sustain-ai
# or
pnpm add sustain-ai
```

---

## Monorepo layout

```
packages/
  resource-aware-ai/    ← the SDK (published to npm as sustain-ai)
    src/
      core/             ← estimator, calculator, cache, router, footnote
      providers/        ← one adapter per LLM provider
    tests/
    dist/               ← built output (ESM + CJS + types)
scripts/                ← internal utility scripts
artifacts/              ← Replit workspace artifacts (not published)
lib/                    ← shared internal libraries
```

---

## License

MIT
