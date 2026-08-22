# Security policy

## Supported versions

| Version                | Security fixes   |
| ---------------------- | ---------------- |
| Current `main` branch  | Yes              |
| Latest published major | Yes              |
| Older majors           | Best effort only |

## Reporting a vulnerability

Do not open a public issue for a suspected vulnerability.

Use the repository’s **Security** tab and select **Report a vulnerability** to open a private GitHub Security Advisory. Include:

- Affected package, version, commit, and configuration.
- Reproduction steps or a minimal proof of concept.
- Expected and observed behavior.
- Security impact and the trust boundary crossed.
- Whether credentials, personal data, or production systems were accessed.
- Any temporary mitigation already applied.

Do not include real API keys, tokens, cookies, private customer data, or unnecessary exploit data. Revoke any credential that may have been exposed before sending the report.

Maintainers should acknowledge a complete report within five business days. Validation, remediation, disclosure timing, and credit will be coordinated through the private advisory. This is a response target, not a warranty.

## Scope

High-priority areas include:

- Credential attachment to attacker-controlled origins.
- Server-side request forgery through provider or universal endpoints.
- Authorization bypass in API or client libraries.
- Prompt or tool-output injection that reaches privileged execution.
- Cross-origin data exposure.
- Secret disclosure in logs, builds, packages, source maps, or workflows.
- Dependency or GitHub Actions supply-chain compromise.
- Denial of service that bypasses request, response, or time limits.

Provider model behavior, factual accuracy, and environmental-estimate disagreement without a security boundary violation are not vulnerabilities. Report calculation defects through a normal issue without sensitive data.

## Safe-harbor expectations

Use test accounts and the minimum access needed to demonstrate impact. Do not access other users’ data, persist after validation, disrupt service, perform social engineering, or publish details before remediation coordination. Good-faith research that follows these limits will be handled constructively.

## Credential response

If a secret is committed or printed:

1. Revoke or rotate it immediately. Removing the Git commit is not sufficient.
2. Review provider audit logs and scope for unauthorized use.
3. Remove the secret from current files and, when necessary, coordinate history rewriting.
4. Invalidate derived sessions or tokens.
5. Record the incident without copying the secret into tickets or chat.
6. Add a regression rule or test that detects the exposure path.

## Maintainer release checklist

- Required pull-request and Code Owner reviews passed.
- CI, dependency review, CodeQL, and secret scanning passed.
- Actions remain pinned to commit SHAs.
- Package contents were inspected with `pnpm pack --dry-run`.
- No `.env`, key, credential, scan-evidence, or machine-local files are included.
- Dependency changes and lifecycle scripts were reviewed.
- Provider endpoints, redirects, auth origins, and log redaction were tested.
- Release provenance and protected npm publishing are enabled when publishing.
