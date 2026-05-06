# Sentinel — Deterministic Hardware Diagnostics & Telemetry

Sentinel is a precision-engineered diagnostics platform designed to monitor, score, and forecast Windows laptop hardware health. By running lightweight, local telemetry collectors, users obtain transparent, deterministic diagnostic reports that are securely processed and stored. 

Every hardware score and failure forecast is fully deterministic and publicly documented — eliminating black-box algorithms and ensuring total transparency for power users and enterprise fleet administrators.

---

## Key Features

### 💻 Local Telemetry Collectors
* **Tier 1: Enterprise Agent (`SentinelAgent`)** — A lightweight C# background service that runs silently without taskbar icons or user interruptions. Auto-registers systems using tenant-level organization tokens and is deployable via MSI (`SentinelSetup.msi`) through GPO, SCCM, or Intune.
* **Tier 2: 1-Click GUI (`SentinelOneShot`)** — A standalone C# executable that performs a one-time hardware diagnostic run and opens the resulting report in the browser instantly upon completion.
* **Tier 3: PowerShell & Python Scripts** — Open-source scripts that scrape system parameters using WMI, CIM, and low-level hardware IOCTL queries (for NVMe SMART health parameters) with robust fallback levels.

### 📊 Transparent Diagnostic Engine
* **Deterministic Scoring Model** — Computes a weighted overall health score (Battery 30%, Thermals 25%, Storage 25%, Memory 10%, CPU 10%) based on open formulas. Reports are stamped with the active algorithm version.
* **Worked Math Verification** — The scoring methodology page (`/scoring`) documents all thresholds and weights. Reports include an interactive score console displaying the raw parameters, rules, and mathematical formulas used to derive the grades.
* **Anomaly & Trend Forecasting** — Projects system health and battery capacity using linear regression models with 95% confidence intervals once device history accumulates.
* **Data Quality Assurances** — Excludes suspicious firmware data (e.g., fixed ACPI static thermal zones) and warns users via a Data Quality Banner when sensor fidelity is compromised.

### 🌐 Web Platform & Real-Time Telemetry
* **Real-Time Global Feed (`/live`)** — A real-time telemetry feed and monitoring dashboard powered by Server-Sent Events (SSE). It streams diagnostic counts, grade distributions, and incoming scan alerts directly from the database to active sessions.
* **Secured Ingestion** — Paste-based or agent-paired JSON ingestion built with CodeMirror, validating payloads against a strict schema in real time.
* **Calibrated Habit Audits** — An interactive audit flow connecting user charging habits, vent clearance, and rest patterns directly to final component scores.
* **Troubleshooting Assistant** — An automated troubleshooting database linking specific failure patterns (thermal throttling, excessive battery wear) to step-by-step remediation procedures.
* **Magic-Link Authentication** — Passwordless authentication initiating a secure 15-minute token verified via a 30-day session cookie.

---

## Tech Stack

* **Monorepo Management** — Coordinated with `pnpm` workspaces (Node.js 24+, TypeScript 5.9).
* **Frontend** — React 19, Vite, Tailwind CSS v4, `wouter` router, `@tanstack/react-query`, `framer-motion` animations, and Radix UI primitives.
* **Backend API** — Express 5, `cookie-parser`, `cors`, and `pino` logger.
* **Database & ORM** — PostgreSQL managed via Drizzle ORM. Optimized for multi-tenant SaaS architecture (explicit separation of `users`, `organizations`, `organizationMembers`, `devices`, and `reports`).
* **Validation & Code Generation** — Zod schema validation integrated with OpenAPI contracts (`@workspace/api-spec`) and `orval` client hook generation.
* **Testing & Linting** — Vitest test runner orchestrated via `vitest.workspace.ts`. Code guidelines enforced through ESLint.

---

## Project Structure

```text
├── artifacts/
│   ├── api-server/         # Express API server (routes, auth, pairings, live feeds)
│   ├── sentinel-site/      # React/Vite marketing and web application frontend
│   │   └── public/scripts/ # Telemetry diagnostic collectors (collect.ps1, HP.py)
│   ├── novasentinel/       # Nova Dashboard interface redesign (React/Vite)
│   └── mockup-sandbox/     # UI/UX design mockups and staging prototypes
├── native/                 # C#/.NET native Windows tools
│   ├── SentinelAgent/      # Tier 1 background collector service ( tray app + MSI installer)
│   ├── SentinelOneShot/    # Tier 2 one-click diagnostic GUI utility
│   ├── SentinelTestHarness/# Native testing utilities for developer verification
│   └── Shared/             # Shared system query (WMI/CIM/IOCTL) and upload modules
├── lib/
│   ├── db/                 # Drizzle database schemas and PostgreSQL client
│   ├── report-engine/      # Shared scoring, grading, and validation logic
│   ├── api-spec/           # OpenAPI specifications and schema generation config
│   ├── api-zod/            # Zod validation schemas compiled from OpenAPI spec
│   └── api-client-react/   # Type-safe React query hooks generated from API spec
├── start_api.sh            # Runs the Express API server (Port 5000)
├── start_site.sh           # Runs the Vite frontend server (Port 3000)
└── pnpm-workspace.yaml
```

---

## Native Binaries & Downloads

The `/get-started` page polls release information dynamically. Instead of hard-linking download buttons to GitHub, the Vite client calls the API server, which resolves files using the following resolution chain:

1. **Environment Variables** — `SENTINEL_DOWNLOAD_URL_SETUP`, `SENTINEL_DOWNLOAD_URL_ONESHOT`, or `SENTINEL_DOWNLOAD_URL_AGENT`.
2. **Local Assets** — Serves files directly from the local `artifacts/downloads/` directory.
3. **GitHub Releases** — Fetches release assets matching the configured `SENTINEL_GITHUB_REPO` repository target.

If no binaries are found, the API returns a `503 Service Unavailable` error, allowing the UI to display a user-friendly download troubleshooting tip.

---

## Getting Started

### Prerequisites
* **Node.js** v24 or higher
* **pnpm** package manager
* **PostgreSQL** database instance

### 1. Installation
Clone the repository and install all dependencies:
```bash
git clone https://github.com/parth2024-tech/Marketing-Website-Plan.git
cd Marketing-Website-Plan
pnpm install
```

### 2. Environment Configuration
Create a `.env` file in `artifacts/api-server/` containing your PostgreSQL connection string:
```env
DATABASE_URL="postgres://user:password@localhost:5432/sentinel"
```

### 3. Database Migration
Ensure your PostgreSQL instance is running, and push the relational schema:
```bash
pnpm --filter @workspace/db run push
```
*Note: During database provisioning, `drizzle-kit` will prompt to map columns. Confirm the schema changes to create the relational multi-tenant SaaS tables.*

### 4. Running the Development Servers
Start the API backend:
```bash
./start_api.sh
```

Start the React web application:
```bash
./start_site.sh
```

The frontend application will be available at `http://localhost:3000/`, automatically proxying API queries to port `5000`.

---

## Core Development Commands

```bash
pnpm run lint               # Run ESLint validation across all workspace modules
pnpm run typecheck          # Verify TypeScript compilation monorepo-wide
pnpm run build              # Compile all shared libraries and artifacts
pnpm run test               # Run the Vitest unit test suite
pnpm --filter @workspace/api-spec run codegen # Recompile OpenAPI specs to React hooks
```

---

## Remote Diagnostics Verification

To test the direct script upload mechanism from an external system:

1. **Expose Local API**: Route public traffic to your local port 5000 (e.g. using ngrok):
   ```bash
   ngrok http 5000
   ```
2. **Update Telemetry Endpoint**: Edit the telemetry script (`sentinel-collect.ps1`) and set `$SENTINEL_BASE_URL` to your tunnel URL.
3. **Execute Telemetry Upload**:
   Run the collector script with the direct upload switch:
   ```powershell
   .\sentinel-collect.ps1 -DirectUpload
   ```
   Upon successful transmission, the script will fetch the report's `claimToken` and open your default browser directly to:
   ```text
   http://localhost:3000/r/{reportId}?claim={claimToken}
   ```
