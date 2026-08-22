# Groundhog security audit

Audit date: August 21, 2026

Repository scope: production-default, 156 source and configuration files

Groundhog version: 0.8.0

## Outcome

The final baseline-aware gate passed at the required minimum score of 90.

| Result                          | Value |
| ------------------------------- | ----: |
| Gate                            |  Pass |
| Defense score                   |    98 |
| Raw candidate score             |    96 |
| Active critical findings        |     0 |
| Active high findings            |     0 |
| Blocking findings               |     0 |
| Reviewed suppressions           |     1 |
| Accepted risks                  |     0 |
| Suppressions with an expiration |     1 |

The suppression expires on February 21, 2027. It must be reviewed or removed before that date.

## Findings and remediation

### Credentialed arbitrary-origin request

The first repository scan found that the generated React client could send a bearer token to a caller-selected absolute destination. The adapter now:

- Attaches credentials only to the configured base origin, the browser origin, or an explicit auth-origin allowlist.
- Rejects clear-text remote base URLs by default.
- Rejects redirects when making a request.
- Has regression coverage for trusted and untrusted credential destinations.

This vulnerability was fixed. It is not in the final active findings.

### Generic `fetch(input)` scanner candidate

The final scan continued to match `GH-SSRF-001` at the generic client’s outbound `fetch` call. The match is suppressed as a scanner false positive after code and runtime validation:

- `customFetch` has no server route that accepts a remote user’s URL.
- The exact-origin policy executes before the outbound call.
- Absolute destinations are denied unless they match the configured base URL, current browser origin, explicit request-origin allowlist, or explicit auth-origin allowlist.
- Every redirect is rejected.
- Tests prove that unlisted loopback, RFC1918, IPv6 loopback, and cloud metadata destinations never reach `fetch`.
- Tests also prove that an allowed public request origin does not receive a token unless it is separately trusted for authentication.

The baseline records the finding identifier, path, reason, evidence, and expiration. No accepted-risk entry was created.

## Dependency audit

The first npm advisory scan identified vulnerable transitive releases of `form-data`, `ws`, and `fast-uri`. Workspace overrides now require:

- `form-data@4.0.6`
- `ws@8.21.0`
- `fast-uri@3.1.5`

After lockfile regeneration, `pnpm audit --audit-level moderate` reported no known vulnerabilities. Strict peer validation also passed.

## Verification

The audit used these checks:

```bash
corepack pnpm audit --audit-level moderate
corepack pnpm peers check
corepack pnpm run typecheck
corepack pnpm run test
corepack pnpm run build
python3 <groundhog-plugin>/scripts/groundhog.py review-graph --repo . --fail-on-untriaged
python3 <groundhog-plugin>/scripts/groundhog.py gate --repo . --min-defense-score 90
```

Git ignores raw Groundhog reports because they contain machine paths and source excerpts. The repository keeps the reviewed, expiring baseline at `.groundhog/baseline.json`.

## Residual responsibilities

Groundhog subtracts two points because the example API has route files but no authentication middleware. Its only route is the public, read-only health check. Authentication and authorization are mandatory before adding a non-public route.

DNS resolution and egress policy remain infrastructure controls. Production server-side provider traffic should pass through an egress firewall or proxy that blocks private, link-local, metadata, and unapproved destinations after DNS resolution.
