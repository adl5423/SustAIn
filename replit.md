# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Packages

### `resource-aware-ai` (`packages/resource-aware-ai`)

A provider-agnostic Node.js/TypeScript SDK that wraps any LLM call and returns energy + water usage metrics with a human-readable sustainability footnote.

- **7 built-in providers:** OpenAI, Anthropic, Google Gemini, Mistral, Cohere, Ollama, Generic HTTP
- **60+ latest model profiles** across all providers (auto-infers unknown models)
- **Core modules:** estimator, calculator, footnote, cache, model registry
- **Features:** caching, constraint policies, custom providers, custom estimators, observability stats
- **Dual output:** ESM + CJS with TypeScript declarations
- **Test coverage:** 47 unit tests (5 test files)

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
