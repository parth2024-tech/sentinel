# Sentinel Architecture Specification

## 🏗️ Decoupled & Resilient Telemetry Architecture

```mermaid
graph TD
    %% Collection Tier with Process Isolation
    subgraph Client Tier (Elevated Service + Process-Isolated Workers)
        A1[Unprivileged User UI] -->|Named Pipe IPC| B[Signed Elevated Windows Service - SYSTEM]
        
        %% Process Isolation for blocking WMI COM calls
        B -->|Spawn/Abandon Worker Thread| WMIWorker[Isolated thread pool / COM-apartment boundary]
        WMIWorker -->|Query WMI / event logs| C1[Thermal/CPU/Battery WMI Collectors]
        
        %% Configurable per-pipeline timeouts
        B -->|50ms timeout| P1[Registry Security Checks]
        B -->|250ms timeout| P2[Performance Counters]
        B -->|WMI 5000ms timeout| P3[WMI/COM Isolated Collector]
        B -->|1000ms timeout| P4[Direct Storage SCSI/ATA Ports]

        %% Separate storage providers & parsers
        P4 --> C_Storage[IStorageHealthProvider]
        C_Storage -->|PhysicalDrive enumeration| NvmeProv[NvmeProtocolProvider]
        C_Storage -->|PhysicalDrive enumeration| AtaProv[AtaSmartProvider]
        
        NvmeProv -->|Raw Protocol Buffer| NvmeParse[NvmeLogParser: Log Page 0x02]
        AtaProv -->|Raw ATA Struct| SataParse[SataSmartParser: SMART_RCV_DRIVE_DATA]
    end

    %% Ingestion & Time-Series DB Tier
    subgraph Ingestion & Validation Tier (mTLS)
        B -->|Secure Payload| D[Express Gateway]
        D -->|PlausibilityGuard Bounds Check| Val[Zod & Bounds Validation]
        Val -->|Store raw payload snapshot| DB[(PostgreSQL: Reports Table)]
        Val -->|Write delta metrics| TS[(TimescaleDB / PostgreSQL Time-Series)]
    end

    %% Scoring Engine Tier
    subgraph Scoring & Calculation Tier
        DB & TS --> F[generateReport]
        
        %% Data Completeness Floor
        F --> FloorCheck{Data Coverage >= 60%?}
        FloorCheck -->|No| Inc[Mark Report: INCONCLUSIVE]
        FloorCheck -->|Yes| G[Data-Quality-Aware Weight Re-normalization]
        
        subgraph Decoupled Scoring Core
            G --> S_Batt[Battery Scorer]
            G --> S_Ther[Thermal Scorer]
            G --> S_Stor[Storage Scorer: Floor Asymmetry Rules]
            G --> S_CPU[CPU Scorer]
            G --> S_Mem[Memory Scorer]
        end
        
        %% Trend Analysis Integration
        TS -->|Compute delta velocity| S_Stor
        
        S_Stor -->|CriticalWarningFlag set?| FloorScore[Hard-Floor Score to 5/100]
        S_Stor -->|Gradual wear check| AddScore[Additive Penalties: wear level, reallocated sectors]
    end
```

---

## 1. Data Collection Layer (Elevated Windows Service + Isolated Workers)

### Separate Storage Parsers
The `IStorageHealthProvider` enforces a strict separation between NVMe and SATA query mechanisms to prevent structural overlap:
* **`NvmeProtocolProvider` & `NvmeLogParser`:** Interfaces with `STORAGE_PROTOCOL_SPECIFIC_DATA` to command the drive to return NVMe Log Page `0x02` (SMART/Health Information Log). Raw bytes are parsed matching the NVMe command specification (e.g., Offset 0 for critical warnings, Offset 160 for media errors).
* **`AtaSmartProvider` & `SataSmartParser`:** Interrogates SATA/AHCI configurations using `IOCTL_ATA_PASS_THROUGH` or `SMART_RCV_DRIVE_DATA`. Raw buffers are parsed against the legacy ATA/ATAPI attribute table (e.g., reading Attribute `0x05` for Reallocated Sectors, Attribute `0x09` for Power-on Hours, and Attribute `0xE9` for SSD Wear Indicator).

### Process-Isolated WMI Queries
To prevent blocking COM apartment threads from pinning service resources indefinitely during WMI hangs:
* **COM Isolation:** WMI collectors run in dedicated, discardable background execution threads (or dedicated sub-processes).
* **Abandonment Strategy:** If a pipeline exceeds its configurable timeout, the parent service stops waiting and flags the pipeline `Unavailable`. The calling COM thread is abandoned to die in its quarantined state, preventing resource leakage or process deadlocks.

### Granular Configurable Timeouts
Timeouts are configured dynamically per-pipeline:
* **Registry & Security:** `50ms` (Direct registry calls should fail immediately if blocked).
* **Performance Counters:** `250ms` (Reads kernel counters).
* **Direct IOCTL Storage Port:** `1000ms` (Allows physical disk spin-up).
* **WMI CPU/Battery/Thermal:** `5000ms` (Accommodates older hardware under heavy compute loads).

---

## 2. Ingestion & Time-Series Validation Layer

### Time-Series Delta Storage
To transition the platform from **reactive alerts** (lagging indicators) to **predictive analytics**:
* The database schema integrates a historical time-series model.
* Historical telemetry is stored to monitor the velocity of wear metrics:
  $$\Delta \text{ Reallocated Sectors} = \frac{d(\text{realloc})}{dt}$$
  $$\Delta \text{ Media Errors} = \frac{d(\text{media\_errors})}{dt}$$
* An accelerating rate of change (e.g., reallocated sectors growing weekly) triggers critical predictions even if the raw numbers are low.

---

## 3. Score Calculation Layer

### Floor Asymmetry Rules (Storage Scoring)
Storage scoring is updated to use a non-linear floor policy:
* **Linear Additive Penalties:** Applied to slow, predictable wear metrics (e.g., wear leveling count, power-on hours, initial reallocated sectors).
* **Asymmetric Hard Floor:** If `NVME_CRITICAL_WARNING_DEVICE_RELIABILITY` is flagged, or if `mediaErrors` exceeds a critical threshold, the component score bypasses the additive loop and is **immediately floored to 5/100** (Critical Failure Warning), preventing a failing disk from appearing healthy.

### Data-Completeness Floor
Before applying weight re-normalizations to missing data points:
* **Coverage Audit:** The engine measures available hardware diagnostic fields.
* **Completeness Threshold:** If overall pipeline coverage drops below **60%** (e.g., WMI thermal zone, storage, and battery pipelines all time out), the engine aborts calculation. It marks the report status as **Inconclusive** and requests a clean rescanning of system components, preventing false positives.
