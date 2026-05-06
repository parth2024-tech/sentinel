/**
 * validate-report.mjs — CI schema validator
 *
 * Reads a Sentinel report JSON file and validates it against
 * the canonical SentinelReportSchema Zod schema.
 *
 * Usage:
 *   node native/ci/validate-report.mjs <path-to-report.json>
 *
 * Exit codes:
 *   0 — schema validation passed
 *   1 — schema validation failed (details printed to stderr)
 *   2 — file not found or not valid JSON
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import { fileURLToPath } from "url";

// Resolve the schema from the report-engine library
const __dirname = fileURLToPath(new URL(".", import.meta.url));

// We import the schema directly — the CI pipeline installs deps first
const { SentinelReportSchema } = await import(
  resolve(__dirname, "../../lib/report-engine/src/schema.ts")
);

const filePath = process.argv[2];
if (!filePath) {
  console.error("Usage: node validate-report.mjs <report.json>");
  process.exit(2);
}

let raw;
try {
  raw = readFileSync(resolve(filePath), "utf-8");
} catch (err) {
  console.error(`Could not read file: ${filePath}`);
  console.error(err.message);
  process.exit(2);
}

let parsed;
try {
  parsed = JSON.parse(raw);
} catch (err) {
  console.error("File is not valid JSON.");
  console.error(err.message);
  process.exit(2);
}

console.log("Validating against SentinelReportSchema...");

const result = SentinelReportSchema.safeParse(parsed);

if (result.success) {
  console.log("✓ Schema validation PASSED");
  console.log(`  sentinelSchema: ${result.data.sentinelSchema}`);
  console.log(`  hostname:       ${result.data.system.hostname}`);
  console.log(`  generatedAt:    ${result.data.generatedAt}`);
  process.exit(0);
} else {
  console.error("✗ Schema validation FAILED");
  for (const issue of result.error.issues) {
    const path = issue.path.join(".");
    console.error(`  → ${path}: ${issue.message} (${issue.code})`);
  }
  process.exit(1);
}
