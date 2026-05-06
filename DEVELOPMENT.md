# Sentinel Monorepo Developer Guidelines

Welcome to the Sentinel development guidelines! This document outlines local workspace configurations, strict code guidelines, testing, and continuous integration workflows.

## 1. Monorepo Architecture

This workspace is managed using `pnpm` and incorporates shared libraries that supply core capabilities to the Express backend and React/Vite frontends.

- **`artifacts/api-server/`** — Express 5 core API backend servicing authentication, pairing handshakes, waitlists, and telemetry score ingestion.
- **`artifacts/sentinel-site/`** — Sleek responsive marketing website and device report consumer client.
- **`artifacts/mockup-sandbox/`** — Vite prototyping environment used for isolated UI design iterations.
- **`lib/db/`** — Drizzle ORM schemas mapping multi-tenant hierarchies (`users`, `organizations`, `organizationMembers`).
- **`lib/report-engine/`** — Diagnostic scoring algorithm, wear forecasting, and habit assessments.
- **`lib/api-spec/`** — OpenAPI design contract and code generators.
- **`lib/api-client-react/`** — Type-safe, auto-generated fetch React hooks.

---

## 2. Enforced Standards

### TypeScript Strict Mode
Global type safety is enforced monorepo-wide via `tsconfig.base.json`. The following strict compilation flags are enabled:
- `strictNullChecks`: Prevents runtime crashes from unexpected null pointer references.
- `noImplicitAny`: Disallows typeless declarations.
- `noImplicitThis`: Enforces typed contextual `this`.
- `strictFunctionTypes`: Secures exact parameter assignment compliance.

### ESLint Code Rules
Workspace code conforms to standardized code guidelines specified in `eslint.config.mjs`:
- Standard modern rules for React hooks (`react-hooks/recommended`).
- Correct TypeScript compilation parser patterns.

---

## 3. Workflow Commands

Always execute the following commands to check build integrity before staging your contributions:

```bash
pnpm run lint               # Run ESLint validation across all workspace packages
pnpm run typecheck          # Perform complete TypeScript compiler checks
pnpm run test               # Run Vitest diagnostic suite
pnpm run build              # Compile all packages for production
```

All contributions pushed to the `main` branch are automatically validated against these commands in the GitHub Action pipeline.
