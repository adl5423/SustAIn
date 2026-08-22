# Contributing

## Development setup

Requirements:

- Node.js 22.13 or newer.
- Corepack.
- pnpm version declared in the root `package.json`.

```bash
corepack enable
corepack pnpm install --frozen-lockfile
corepack pnpm run typecheck
corepack pnpm run test
corepack pnpm run build
```

Do not commit `.env` files, API keys, tokens, cookies, local scan reports, generated credentials, or private provider responses. Use `.env.example` for names and empty placeholders only.

## Pull requests

Keep each pull request narrow enough to review. Describe the trust boundaries and environmental assumptions it changes.

Every change should include:

- A clear reason and implementation summary.
- Tests for new behavior and failure paths.
- Updated documentation for public API or methodology changes.
- Migration notes for a breaking contract.
- Source links for model metadata or research constants.
- Security analysis for auth, URLs, headers, model output, file handling, workflows, and dependencies.

Do not use `pull_request_target` for code from forks. Pull-request jobs must not receive repository or provider secrets. Do not weaken action pinning, workflow permissions, strict peer dependencies, the dependency release-age policy, or endpoint validation to make a check pass.

## Research and model metadata

Environmental constants and model facts must come from government, standards, peer-reviewed, or vendor-owned primary sources. A catalog update must record the source and verification date.

Do not present:

- A modeled multiplier as measured provider telemetry.
- A direct-water value as combined operational water.
- Water withdrawal as water consumption.
- An equal-weight catalog mean as a production workload mean.
- A point estimate without its boundary and assumptions.

If the evidence is incomplete, leave the field unset and document the uncertainty.

## Code standards

- Keep TypeScript strict and preserve public types.
- Validate external input at the trust boundary.
- Bound network time, response size, and retries.
- Attach credentials only to an explicit trusted origin.
- Reject redirects for credentialed provider requests.
- Keep model output as untrusted data until schema validation.
- Add comments for non-obvious invariants and security decisions, not line-by-line narration.
- Use direct prose in documentation and comments. Remove vague claims, filler, false precision, and unsupported benchmarks.

## Tests

At minimum, run:

```bash
corepack pnpm run typecheck
corepack pnpm run test
corepack pnpm run build
```

Network-bound tests must use controlled fixtures or explicit test credentials. Never make a live paid provider call in the default test suite.

Security-sensitive changes should cover negative cases such as:

- Private and link-local provider hosts.
- HTTP endpoints outside loopback.
- Redirects and oversized responses.
- Credentialed cross-origin requests.
- Malformed headers and invalid JSON.
- Missing, negative, or non-finite usage values.
- Rate-limit and request-size enforcement.

## Generated files

Review generated output before committing it. Treat specifications, prompts, issue text, and code-generation inputs from a pull request as untrusted. A generator must not read secrets or write outside its declared output directories.

## Security reports

Use the private process in [SECURITY.md](SECURITY.md). Do not put vulnerability details or credentials in a public issue or pull request.
