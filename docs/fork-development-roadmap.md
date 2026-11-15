# Personal fork roadmap: decisions, MCP Studio, browser and computers

Status: design backlog. No item in this document is represented as implemented.

## Goals and guardrails

- Keep the upstream `agentes-chat/agentes-chat` remote and sync changes without rewriting upstream's `main`.
- Land isolated features in narrow, testable branches; merge them into this fork's `main` only after CI and manual QA.
- Preserve existing organization, users, agents, PostgreSQL data, and the paired Nexus VPS runner. Never change runner authentication to work around provider integration.
- Keep providers pluggable, with per-organization configuration, audit, permission boundaries, and backwards-compatible migration defaults.
- Keep a functional web + mobile experience and a documented rollback path.

## Workstream A — Typed decision providers

**Problem**: the Jev / TypeSafe decision path is provider-specific, yet the product needs interchangeable text choices, yes/no routing, scores, and optional image judgments.

**Implementation design**:

1. Define an internal `DecisionProvider` contract for `noul`, `choice`, `score`, and a capability-checked vision operation. Separate provider adapters from the router, memory judge, and image path.
2. Retain the installed TypeSafe integration and its existing behavior as the default; introduce providers via a registry rather than conditionals across three subsystems.
3. Introduce feature flags and organization-scoped configuration with an additive database migration. Encrypt credentials using existing key wrappers and redact all secrets from logs.
4. Support provider capability negotiation, request timeout, quotas, circuit breaker, and deterministic fallback to the existing implementation.
5. Attribute token usage and cost to the selected provider and organization, including zero-cost decisions and fractional token units.
6. Add a UI for selecting provider, credential, text model, optional vision model, and a `Test and save` operation that verifies all supported decision operations before persisting.

**Upstream references to examine, not blindly cherry-pick**: #206 (OpenRouter workspace decision models), #259 (OpenCode Jev provider), #396 (Microsoft Decisions proposal). Assess licensing and code drift before reuse.

**Gemini Decision**: do not assume it uses the standard Gemini generative API. Require a verified endpoint schema, availability, billing and terms before implementing its adapter.

**Acceptance**: typed response and schema tests, provider switch without data loss, failure fallback, key revocation, role authorization, text+vision capability tests, real API smoke test behind opt-in CI.

## Workstream B — MCP Studio integration

The name `MSA Studio` in the feature request may refer to `MCP Studio` or another vendor. Resolve the exact product and API contract before writing a vendor-specific adapter.

**Transport-independent baseline**:

1. Reuse the existing custom MCP connector path: remote Streamable HTTP, OAuth or bearer API key, encrypted secrets, and per-agent permissions.
2. Support connection listing, `tools/list` refresh, tool enable/disable, argument-schema validation, permission prompts, timeout/retry diagnostics, and detailed invocation logs without leaking secrets.
3. For local `stdio` servers, introduce an opt-in bridge tied to a selected runner and its OS user; do not execute arbitrary client-supplied shell commands in the public server container.
4. Disallow loopback/private-address SSRF through the public connector route; validate URL and redirects against existing network guard.
5. If the specific Studio offers API-driven provisioning, add that as a connector-specific adapter rather than making it a prerequisite for all MCP use.

**Acceptance**: end-to-end remote MCP connect/disconnect, OAuth refresh, auth failure recovery, tool permissions, local bridge sandboxing, per-agent tool visibility and audit.

## Workstream C — Browser manager

**Start from existing code**, not a replacement browser subsystem:
- `apps/server/runner/browser.ts`, `browser-views.ts`, `desktop-browser.ts`.
- `apps/server/src/routes/app/browser-profiles.ts`.
- `apps/web/src/components/browser/BrowserProfiles.tsx`, `MachineBrowserCard.tsx`.
- Mobile browser profile and computer screens.

**Target UX**: per-runner browser enable/disable, executable/installation health, profile inventory, launch/stop/restart, active-tab overview, screenshot/stream status, interactive takeover and release, profile isolation and cleanup. Support headless/headed modes and troubleshoot ARM64 Chromium.

**Security**: never share browser cookies across agents; require owner/admin approval before accessing existing human browser profiles; bind profiles to agent/runner and enforce URL/network policy.

**Acceptance**: launch Chrome/Chromium on amd64/arm64, multiple isolated profiles, close and restore, live control hand-off, inaccessible runner behavior, permission regression tests, desktop/mobile views.

## Workstream D — Easy Computer / multi-computer management

Clarify whether `Easy Computer` names a particular project or a desired easy-computer-use experience. Do not invent external SDK integration.

**Target**: clearer per-agent assignment, online/offline/health reports, terminal/browser/desktop capability probes, runner-version compatibility, one-click diagnostics, and optional secondary VM support while retaining Nexus VPS.

Use the existing pairing and machine protocol. Preserve scope approvals, filesystem separation, and independent per-computer logins. Do not automatically grant sudo or Docker socket access.

## Workstream E — Model catalog + reasoning effort

**Observed bug**: `apps/server/runner/brain-antigravity.ts` treats `-low`, `-medium` and `-high` suffixes as preset reasoning levels but previously omitted `-xhigh`. See fork PR #1.

**Next changes**:
1. Normalize model entries into `{ family, variant, embeddedEffort, supportsExternalEffort }` using the CLI's discovered model list rather than a hard-coded product list.
2. When an ID already encodes effort, never send a second `--effort`.
3. UI: show effort already encoded by the selected variant and either switch to an available sibling variant when the user changes effort or disable a redundant slider; never display a false independent setting.
4. Preserve provider-specific effort ranges and represent `xhigh` distinctly from `high` in storage/protocol where supported.
5. Apply consistent behavior in model picker, advanced settings, Android app, and runner. Ensure the request contains exactly one effective selection.
6. Add tests for all model suffixes, missing variants, default/automatic models, stale model discovery and CLI version changes.

**Acceptance**: selecting Hydrogen Low/Medium/High/XHigh yields precisely the intended `agy` argument sequence, never two contradictory settings; web/mobile stay synchronized across reloads.

## Delivery sequence and maintenance

1. Merge the minimal runner regression fix only after real CLI + Bun tests pass.
2. Add the model/effort metadata and coherent web/mobile UI behavior as a separate PR.
3. Add a browser/computer capability dashboard without duplicating existing profile management.
4. Strengthen generic MCP management, then add optional vendor-specific Studio support once its API is confirmed.
5. Introduce decision-provider abstraction, followed by separately testable provider adapters.

CI gates: `bun test` for changed packages, lint, typecheck, production server/web builds, migration compatibility where needed, Android build/QA for mobile changes, security tests, and a scoped live smoke test.

Deployment: build a tagged ARM64 image from the fork in CI; back up Postgres and keep the previous digest. Update the isolated fork staging stack first, then production after smoke tests. Avoid `latest` for a customized production image. Never replace the existing production Docker Compose or its secrets as part of a feature PR.
