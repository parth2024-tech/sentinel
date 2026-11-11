# Telemetry Ingestion Pipeline Specification

## Overview
This document specifies the deterministic ingestion, scoring degradation curves, and memory pressure diagnostics implemented within Sentinel.

### Invariants
1. Strict schema validation via Zod on all incoming telemetry payloads.
2. Mathematical degradation curve scoring replacing non-deterministic heuristics.
3. Cryptographically verifiable release and audit trails.
