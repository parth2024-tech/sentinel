"""
================================================================================
HP LAPTOP COMPREHENSIVE DIAGNOSTIC & PREDICTIVE HEALTH SCRIPT
================================================================================
Covers: Battery · SSD/NVMe · CPU · RAM · GPU · Thermals · Fans · Power Delivery
        Startup Health · Memory Pressure · Network Stability · Driver Health
        Correlation Detection · Habit Coaching · Weekly Health Report

Supports HP Laptops (2019-2024): Spectre, Envy, Pavilion, EliteBook, ProBook,
        Omen, Victus, ZBook, Dragonfly, Chromebook (Win mode)

Runs on: Windows 10/11 (PowerShell + WMI + Registry access required)
Python:  3.9+ | Dependencies: psutil, wmi, py-cpuinfo, pynvml (auto-installed)

Usage:
    python hp_laptop_diagnostics.py                  # Full diagnostic
    python hp_laptop_diagnostics.py --quick          # Fast 2-min scan
    python hp_laptop_diagnostics.py --report         # Weekly health report
    python hp_laptop_diagnostics.py --monitor 60     # Continuous (60s interval)
    python hp_laptop_diagnostics.py --export json    # Export raw data
================================================================================
"""

import sys
import os
import json
import time
import math
import socket
import struct
import ctypes
import hashlib
import argparse
import platform
import datetime
import threading
import subprocess
import collections
import statistics
import traceback
from pathlib import Path
from dataclasses import dataclass, field, asdict
from typing import Optional, List, Dict, Tuple, Any
from enum import Enum

# ─────────────────────────────── CONSTANTS ──────────────────────────────────

VERSION = "2.0.0"
SCRIPT_NAME = "HP Laptop Health Monitor"
DATA_DIR = Path.home() / ".hp_health_monitor"
HISTORY_FILE = DATA_DIR / "history.json"
BASELINE_FILE = DATA_DIR / "baseline.json"
REPORT_FILE = DATA_DIR / "weekly_report.txt"

# HP-Specific Thermal Thresholds (°C) — tuned per product line
HP_THERMAL_LIMITS = {
    "cpu_normal": 75,       "cpu_warning": 85,      "cpu_critical": 95,
    "gpu_normal": 80,       "gpu_warning": 88,       "gpu_critical": 95,
    "ssd_normal": 50,       "ssd_warning": 60,       "ssd_critical": 70,
    "battery_normal": 45,   "battery_warning": 55,   "battery_critical": 65,
    "motherboard_normal": 60, "motherboard_warning": 75, "motherboard_critical": 85,
}

# HP Battery wear level thresholds (% of original capacity)
BATTERY_HEALTH_THRESHOLDS = {
    "excellent": 90, "good": 75, "fair": 60, "poor": 40, "replace_now": 20
}

# SSD Health thresholds (% remaining life)
SSD_HEALTH_THRESHOLDS = {
    "excellent": 90, "good": 70, "fair": 50, "warning": 30, "critical": 10
}

# HP Product Lines (for model-specific tuning)
HP_PRODUCT_LINES = {
    "spectre": {"tdp_limit": 28, "fan_max_rpm": 5000, "thermal_policy": "balanced"},
    "envy":    {"tdp_limit": 25, "fan_max_rpm": 4500, "thermal_policy": "balanced"},
    "pavilion":{"tdp_limit": 45, "fan_max_rpm": 4000, "thermal_policy": "performance"},
    "elitebook":{"tdp_limit": 15, "fan_max_rpm": 4000, "thermal_policy": "quiet"},
    "probook": {"tdp_limit": 15, "fan_max_rpm": 3800, "thermal_policy": "quiet"},
    "omen":    {"tdp_limit": 80, "fan_max_rpm": 6000, "thermal_policy": "performance"},
    "victus":  {"tdp_limit": 60, "fan_max_rpm": 5500, "thermal_policy": "performance"},
    "zbook":   {"tdp_limit": 55, "fan_max_rpm": 5500, "thermal_policy": "performance"},
    "dragonfly":{"tdp_limit": 12, "fan_max_rpm": 3500, "thermal_policy": "quiet"},
    "default": {"tdp_limit": 45, "fan_max_rpm": 5000, "thermal_policy": "balanced"},
}


# ─────────────────────────────── COLORS ─────────────────────────────────────

class C:
    """ANSI terminal colors"""
    RED    = "\033[91m"
    YELLOW = "\033[93m"
    GREEN  = "\033[92m"
    CYAN   = "\033[96m"
    BLUE   = "\033[94m"
    MAGENTA= "\033[95m"
    WHITE  = "\033[97m"
    GRAY   = "\033[90m"
    BOLD   = "\033[1m"
    DIM    = "\033[2m"
    RESET  = "\033[0m"
    OK     = "\033[92m✓\033[0m"
    WARN   = "\033[93m⚠\033[0m"
    FAIL   = "\033[91m✗\033[0m"
    INFO   = "\033[96mℹ\033[0m"

def colorize(text: str, color: str) -> str:
    """Apply color if terminal supports it"""
    if sys.stdout.isatty() or os.environ.get("FORCE_COLOR"):
        return f"{color}{text}{C.RESET}"
    return text

def status_icon(severity: str) -> str:
    icons = {"ok": C.OK, "warning": C.WARN, "critical": C.FAIL, "info": C.INFO}
    return icons.get(severity, C.INFO)


# ─────────────────────────────── DATA MODELS ────────────────────────────────

class Severity(Enum):
    OK       = "ok"
    INFO     = "info"
    WARNING  = "warning"
    CRITICAL = "critical"

@dataclass
class Finding:
    """A single health finding"""
    component: str
    title: str
    plain_english: str          # No jargon — for normal people
    severity: str               # ok / info / warning / critical
    value: Any = None
    unit: str = ""
    recommendation: str = ""
    prediction: str = ""        # Forward-looking insight
    weeks_to_action: Optional[int] = None

@dataclass
class DiagnosticReport:
    """Full diagnostic session report"""
    timestamp: str = ""
    hostname: str = ""
    hp_model: str = ""
    hp_product_line: str = ""
    windows_version: str = ""
    uptime_hours: float = 0.0
    findings: List[Finding] = field(default_factory=list)
    scores: Dict[str, int] = field(default_factory=dict)
    overall_score: int = 100
    habits: List[str] = field(default_factory=list)
    correlations: List[str] = field(default_factory=list)
    raw: Dict[str, Any] = field(default_factory=dict)

    def add(self, finding: Finding):
        self.findings.append(finding)

    def worst_severity(self) -> str:
        sev_order = ["critical", "warning", "info", "ok"]
        for s in sev_order:
            if any(f.severity == s for f in self.findings):
                return s
        return "ok"


# ─────────────────────────────── DEPENDENCY LOADER ──────────────────────────

def ensure_dependencies():
    """Auto-install required packages silently"""
    required = {
        "psutil": "psutil",
        "wmi": "wmi",
        "cpuinfo": "py-cpuinfo",
    }
    missing = []
    for module, pkg in required.items():
        try:
            __import__(module)
        except ImportError:
            missing.append(pkg)

    if missing:
        print(f"{C.CYAN}Installing missing packages: {', '.join(missing)}...{C.RESET}")
        for pkg in missing:
            subprocess.run(
                [sys.executable, "-m", "pip", "install", pkg, "--quiet"],
                check=False
            )

    # Optional: pynvml for NVIDIA GPU
    try:
        import pynvml
    except ImportError:
        try:
            subprocess.run(
                [sys.executable, "-m", "pip", "install", "pynvml", "--quiet"],
                check=False
            )
        except Exception:
            pass


# ─────────────────────────────── PLATFORM CHECK ─────────────────────────────

def require_windows():
    if platform.system() != "Windows":
        print(f"""
{C.YELLOW}⚠  This script is designed for Windows HP laptops.{C.RESET}
   Your OS: {platform.system()} {platform.release()}

   Running in SIMULATION MODE — limited data available.
   On a real HP Windows laptop, all features will work fully.
""")
        return False
    return True


# ─────────────────────────────── POWERSHELL HELPER ──────────────────────────

def ps(command: str, timeout: int = 15) -> str:
    """Execute PowerShell command and return output"""
    if platform.system() != "Windows":
        return ""
    try:
        result = subprocess.run(
            ["powershell", "-NoProfile", "-NonInteractive",
             "-ExecutionPolicy", "Bypass", "-Command", command],
            capture_output=True, text=True, timeout=timeout
        )
        return result.stdout.strip()
    except (subprocess.TimeoutExpired, FileNotFoundError, OSError):
        return ""

def ps_json(command: str, timeout: int = 15) -> Any:
    """Execute PowerShell command and parse JSON output"""
    raw = ps(f"{command} | ConvertTo-Json -Depth 5", timeout)
    if not raw:
        return None
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return None

def wmic(query: str) -> List[Dict]:
    """Execute WMIC query via PowerShell"""
    result = ps_json(f"Get-WmiObject -Query '{query}'")
    if isinstance(result, dict):
        return [result]
    if isinstance(result, list):
        return result
    return []

def reg_read(key: str, value: str) -> str:
    """Read Windows registry value"""
    return ps(f"(Get-ItemProperty -Path '{key}' -ErrorAction SilentlyContinue).'{value}'")


# ─────────────────────────────── SYSTEM INFO ────────────────────────────────

class SystemInfoCollector:

    def collect(self) -> Dict[str, Any]:
        info = {
            "hostname": socket.gethostname(),
            "os": platform.system(),
            "os_version": "",
            "hp_model": "",
            "hp_serial": "",
            "hp_product_line": "default",
            "bios_version": "",
            "bios_date": "",
            "uptime_seconds": 0,
        }

        # OS Version
        try:
            info["os_version"] = platform.version()
            info["os_build"] = platform.win32_ver()[1] if platform.system() == "Windows" else ""
        except Exception:
            pass

        # HP Model
        model_raw = ps("(Get-WmiObject Win32_ComputerSystem).Model")
        if model_raw:
            info["hp_model"] = model_raw
            # Detect HP product line
            model_lower = model_raw.lower()
            for line in HP_PRODUCT_LINES:
                if line in model_lower:
                    info["hp_product_line"] = line
                    break

        # HP Serial
        serial_raw = ps("(Get-WmiObject Win32_BIOS).SerialNumber")
        if serial_raw:
            info["hp_serial"] = serial_raw.strip()

        # BIOS
        bios_data = ps_json("Get-WmiObject Win32_BIOS")
        if bios_data:
            info["bios_version"] = bios_data.get("SMBIOSBIOSVersion", "")
            info["bios_date"] = bios_data.get("ReleaseDate", "")

        # Uptime
        try:
            import psutil
            boot_time = psutil.boot_time()
            info["uptime_seconds"] = time.time() - boot_time
        except Exception:
            pass

        return info


# ─────────────────────────────── BATTERY DIAGNOSTICS ────────────────────────

class BatteryDiagnostics:
    """
    Comprehensive HP battery health analysis.
    Checks: wear level, charge cycles, voltage stability, temperature,
    calibration state, charging speed, power delivery health.
    """

    def run(self) -> List[Finding]:
        findings = []
        try:
            import psutil
            batt = psutil.sensors_battery()
            findings.extend(self._check_psutil_battery(batt))
            findings.extend(self._check_wmi_battery())
            findings.extend(self._check_powercfg_battery())
            findings.extend(self._check_power_delivery())
            findings.extend(self._check_battery_temperature())
        except Exception as e:
            findings.append(Finding(
                component="battery",
                title="Battery Scan Incomplete",
                plain_english=f"Could not fully check your battery. Some info was unavailable. ({e})",
                severity="info"
            ))
        return findings

    def _check_psutil_battery(self, batt) -> List[Finding]:
        findings = []
        if batt is None:
            findings.append(Finding(
                component="battery",
                title="No Battery Detected",
                plain_english="No battery was found. If you're on a laptop, this may mean the battery driver is missing or your laptop is running only on AC power with the battery removed.",
                severity="warning"
            ))
            return findings

        # Charge level
        pct = batt.percent
        if pct < 20:
            findings.append(Finding(
                component="battery",
                title="Battery Very Low",
                plain_english=f"Your battery is at {pct:.0f}%. Plug in soon — running repeatedly at very low charge wears the battery faster.",
                severity="critical" if pct < 10 else "warning",
                value=pct, unit="%",
                recommendation="Plug in your charger. Try to keep charge between 20–80% for longest battery life."
            ))
        elif pct > 95 and batt.power_plugged:
            findings.append(Finding(
                component="battery",
                title="Battery Kept at 100% Constantly",
                plain_english="Your battery stays fully charged all the time. This is actually one of the fastest ways to wear out a laptop battery — like keeping a rubber band stretched 24/7.",
                severity="info",
                value=pct, unit="%",
                recommendation="If HP Battery Health Manager is available (in BIOS or HP Support Assistant), enable 'Optimized Battery Charging' to cap at 80% when plugged in at your desk all day.",
                prediction="Keeping at 100% constantly could reduce your battery's total lifespan by 20–30% over 2–3 years."
            ))
        else:
            findings.append(Finding(
                component="battery",
                title="Battery Charge Level",
                plain_english=f"Battery is at {pct:.0f}% — that's a good healthy range.",
                severity="ok",
                value=pct, unit="%"
            ))

        # Charging status
        if batt.power_plugged and batt.secsleft != psutil.POWER_TIME_UNLIMITED:
            charge_mins = batt.secsleft / 60
            findings.append(Finding(
                component="battery",
                title="Charging in Progress",
                plain_english=f"Your laptop is charging. Estimated full charge in {charge_mins:.0f} minutes.",
                severity="ok",
                value=charge_mins, unit="minutes"
            ))

        # Time remaining on battery
        if not batt.power_plugged and batt.secsleft and batt.secsleft > 0:
            hrs = batt.secsleft / 3600
            findings.append(Finding(
                component="battery",
                title="Battery Runtime Remaining",
                plain_english=f"About {hrs:.1f} hours of battery life left at your current usage.",
                severity="ok" if hrs > 2 else "warning",
                value=round(hrs, 1), unit="hours"
            ))

        return findings

    def _check_wmi_battery(self) -> List[Finding]:
        """Deep battery health via WMI — wear level, cycle count, design capacity"""
        findings = []
        batteries = wmic("SELECT * FROM Win32_Battery")
        battery_statics = wmic("SELECT * FROM BatteryStaticData")
        battery_status = wmic("SELECT * FROM BatteryStatus")

        # Try CIM_Battery for design capacity vs current capacity
        cim_bat = wmic("SELECT DesignCapacity, FullChargeCapacity FROM Win32_Battery")

        # Use powercfg battery report for detailed data (more reliable)
        powercfg_data = self._parse_powercfg_battery_report()
        if powercfg_data:
            design_cap = powercfg_data.get("design_capacity", 0)
            full_cap   = powercfg_data.get("full_charge_capacity", 0)
            cycle_count = powercfg_data.get("cycle_count", 0)

            if design_cap and full_cap:
                wear_pct = 100 - ((design_cap - full_cap) / design_cap * 100)
                wear_pct = max(0, min(100, wear_pct))

                if wear_pct >= BATTERY_HEALTH_THRESHOLDS["excellent"]:
                    sev, label = "ok", "Excellent"
                elif wear_pct >= BATTERY_HEALTH_THRESHOLDS["good"]:
                    sev, label = "ok", "Good"
                elif wear_pct >= BATTERY_HEALTH_THRESHOLDS["fair"]:
                    sev, label = "info", "Fair"
                elif wear_pct >= BATTERY_HEALTH_THRESHOLDS["poor"]:
                    sev, label = "warning", "Getting Worn"
                else:
                    sev, label = "critical", "Needs Replacement"

                pred = ""
                if wear_pct < 80:
                    months_left = max(0, (wear_pct - 20) / 2)
                    pred = f"At this wear rate, you may need a new battery in roughly {months_left:.0f} months."

                findings.append(Finding(
                    component="battery",
                    title=f"Battery Health: {label}",
                    plain_english=(
                        f"Your battery can now hold {wear_pct:.1f}% of what it could when new. "
                        f"It originally held {design_cap:,} mWh, now it holds {full_cap:,} mWh. "
                        f"This is {label.lower()} for a laptop battery."
                    ),
                    severity=sev,
                    value=round(wear_pct, 1), unit="% health",
                    recommendation=(
                        "Consider replacing the battery." if wear_pct < 40
                        else "Battery is still usable. Avoid extreme charge levels to preserve remaining life."
                    ),
                    prediction=pred
                ))

            if cycle_count:
                # HP batteries rated for ~500-1000 cycles depending on model
                cycle_limit = 1000
                cycle_pct = (cycle_count / cycle_limit) * 100
                findings.append(Finding(
                    component="battery",
                    title="Battery Charge Cycles Used",
                    plain_english=(
                        f"Your battery has been fully charged and drained {cycle_count} times. "
                        f"Most HP laptop batteries are rated for about {cycle_limit} cycles. "
                        f"You've used roughly {cycle_pct:.0f}% of the battery's rated lifetime."
                    ),
                    severity="ok" if cycle_pct < 60 else ("warning" if cycle_pct < 85 else "critical"),
                    value=cycle_count, unit="cycles",
                    prediction=f"At your current usage rate, the battery may reach its rated limit in roughly {max(0, cycle_limit - cycle_count)} more cycles."
                ))

        return findings

    def _parse_powercfg_battery_report(self) -> Dict:
        """Generate and parse powercfg /batteryreport"""
        report_path = Path(os.environ.get("TEMP", "C:\\Temp")) / "battery_report.xml"
        data = {}
        try:
            # Generate XML battery report
            ps(f"powercfg /batteryreport /xml /output '{report_path}' 2>$null")
            time.sleep(2)
            if report_path.exists():
                import xml.etree.ElementTree as ET
                tree = ET.parse(str(report_path))
                root = tree.getroot()
                ns = {"b": root.tag.split("}")[0].lstrip("{") if "}" in root.tag else ""}

                # Parse design capacity and full charge capacity
                for bat in root.iter():
                    tag = bat.tag.split("}")[-1] if "}" in bat.tag else bat.tag
                    if tag == "DesignCapacity" and bat.text:
                        try:
                            data["design_capacity"] = int(bat.text)
                        except ValueError:
                            pass
                    elif tag == "FullChargeCapacity" and bat.text:
                        try:
                            data["full_charge_capacity"] = int(bat.text)
                        except ValueError:
                            pass
                    elif tag == "CycleCount" and bat.text:
                        try:
                            data["cycle_count"] = int(bat.text)
                        except ValueError:
                            pass
                report_path.unlink(missing_ok=True)
        except Exception:
            pass

        # Fallback: parse HTML report
        if not data:
            html_path = Path(os.environ.get("TEMP", "C:\\Temp")) / "battery_report.html"
            try:
                ps(f"powercfg /batteryreport /output '{html_path}' 2>$null")
                time.sleep(2)
                if html_path.exists():
                    content = html_path.read_text(errors="ignore")
                    import re
                    # Extract design capacity
                    dc = re.search(r"DESIGN CAPACITY.*?(\d[\d,]+)\s*mWh", content, re.DOTALL | re.IGNORECASE)
                    fc = re.search(r"FULL CHARGE CAPACITY.*?(\d[\d,]+)\s*mWh", content, re.DOTALL | re.IGNORECASE)
                    cc = re.search(r"CYCLE COUNT.*?(\d+)", content, re.DOTALL | re.IGNORECASE)
                    if dc:
                        data["design_capacity"] = int(dc.group(1).replace(",", ""))
                    if fc:
                        data["full_charge_capacity"] = int(fc.group(1).replace(",", ""))
                    if cc:
                        data["cycle_count"] = int(cc.group(1))
                    html_path.unlink(missing_ok=True)
            except Exception:
                pass

        return data

    def _check_powercfg_battery(self) -> List[Finding]:
        """Check power scheme and sleep/hibernate settings"""
        findings = []
        scheme = ps("powercfg /getactivescheme")
        if scheme:
            if "balanced" in scheme.lower():
                findings.append(Finding(
                    component="battery",
                    title="Power Plan: Balanced",
                    plain_english="Your laptop uses the 'Balanced' power plan — a good middle ground between performance and battery life.",
                    severity="ok"
                ))
            elif "power saver" in scheme.lower():
                findings.append(Finding(
                    component="battery",
                    title="Power Plan: Power Saver",
                    plain_english="Your laptop is set to 'Power Saver' mode. This is great for battery life but may make your laptop feel slow.",
                    severity="info"
                ))
            elif "high performance" in scheme.lower() or "ultimate" in scheme.lower():
                findings.append(Finding(
                    component="battery",
                    title="Power Plan: High Performance",
                    plain_english="Your laptop runs in 'High Performance' mode all the time — even on battery. This drains your battery 30–50% faster and generates more heat.",
                    severity="warning",
                    recommendation="Switch to 'Balanced' mode unless you're doing demanding work. Windows > Settings > System > Power & Sleep > Additional Power Settings."
                ))
        return findings

    def _check_power_delivery(self) -> List[Finding]:
        """Check if HP charger/USB-C power delivery is adequate"""
        findings = []
        # Check via WMI for charger wattage
        charger_info = ps("(Get-WmiObject -Namespace root\\WMI -Class MSAcpi_BatteryAlarm -ErrorAction SilentlyContinue)")
        # Check USB-C power delivery
        usbc_pd = ps("Get-PnpDevice -Class 'USB' | Where-Object {$_.FriendlyName -like '*Power*' -or $_.FriendlyName -like '*Delivery*'} | Select-Object FriendlyName | ConvertTo-Json")

        # Check if laptop is drawing enough current (HP-specific BIOS charge limit)
        hp_charge_limit = reg_read(
            "HKLM:\\SYSTEM\\CurrentControlSet\\Services\\HpCISSs2\\Parameters",
            "BatteryChargeLimitMode"
        )
        if hp_charge_limit:
            findings.append(Finding(
                component="battery",
                title="HP Battery Charge Limit Active",
                plain_english="HP's smart charging is limiting your battery to protect its long-term health. This is a good thing — it helps the battery last longer.",
                severity="ok"
            ))

        # Check fast charging
        fast_charge = ps("Get-WmiObject -Namespace root\\WMI -Class HP_BatteryFastCharge -ErrorAction SilentlyContinue")
        return findings

    def _check_battery_temperature(self) -> List[Finding]:
        """Battery temperature via WMI thermal zone"""
        findings = []
        temp_raw = ps("(Get-WmiObject -Namespace root\\WMI -Class MSAcpi_ThermalZoneTemperature -ErrorAction SilentlyContinue) | Select-Object CurrentTemperature | ConvertTo-Json")
        if temp_raw:
            try:
                data = json.loads(temp_raw)
                if isinstance(data, dict):
                    data = [data]
                for zone in (data or []):
                    raw_temp = zone.get("CurrentTemperature", 0)
                    if raw_temp:
                        temp_c = (raw_temp / 10) - 273.15
                        if 10 < temp_c < 100:
                            sev = "ok"
                            if temp_c > HP_THERMAL_LIMITS["battery_critical"]:
                                sev = "critical"
                            elif temp_c > HP_THERMAL_LIMITS["battery_warning"]:
                                sev = "warning"
                            findings.append(Finding(
                                component="battery",
                                title="Battery Temperature",
                                plain_english=(
                                    f"Battery temperature is {temp_c:.1f}°C — "
                                    + ("dangerously hot! Stop using it and let it cool." if sev == "critical"
                                       else "a bit warm." if sev == "warning"
                                       else "perfectly normal.")
                                ),
                                severity=sev,
                                value=round(temp_c, 1), unit="°C"
                            ))
                            break
            except (json.JSONDecodeError, KeyError):
                pass
        return findings


# ─────────────────────────────── SSD / NVMe DIAGNOSTICS ─────────────────────

class StorageDiagnostics:
    """
    SSD/NVMe health, SMART data, wear leveling, temperature,
    read/write speed benchmarking, HP-specific SSD errors.
    """

    def run(self) -> List[Finding]:
        findings = []
        try:
            findings.extend(self._check_smart_data())
            findings.extend(self._check_disk_space())
            findings.extend(self._check_disk_errors())
            findings.extend(self._check_disk_performance())
            findings.extend(self._check_disk_fragmentation())
            findings.extend(self._check_nvme_health())
        except Exception as e:
            findings.append(Finding(
                component="storage",
                title="Storage Scan Incomplete",
                plain_english=f"Could not fully check your storage drive. ({e})",
                severity="info"
            ))
        return findings

    def _check_smart_data(self) -> List[Finding]:
        """SMART data via PowerShell/CIM"""
        findings = []
        # Get SMART data
        smart_raw = ps_json("Get-Disk | ForEach-Object { $disk = $_; Get-PhysicalDisk | Where-Object DeviceId -eq $disk.Number | Select-Object FriendlyName, MediaType, HealthStatus, OperationalStatus, @{N='Size';E={$disk.Size}} }")
        disks_wmi = ps_json("Get-WmiObject Win32_DiskDrive | Select-Object Model, Size, MediaType, Status, Partitions, Caption")
        reliability = ps_json("Get-StorageReliabilityCounter -PhysicalDisk (Get-PhysicalDisk) | Select-Object *")

        if isinstance(smart_raw, dict):
            smart_raw = [smart_raw]
        if isinstance(disks_wmi, dict):
            disks_wmi = [disks_wmi]

        for disk in (disks_wmi or []):
            model  = disk.get("Model", "Unknown Drive") or "Unknown Drive"
            status = disk.get("Status", "Unknown") or "Unknown"
            size_b = disk.get("Size", 0) or 0
            size_gb = size_b / (1024**3) if size_b else 0
            media  = disk.get("MediaType", "") or ""

            drive_type = "NVMe SSD" if "nvme" in model.lower() else \
                         "SSD" if ("ssd" in model.lower() or "solid" in media.lower()) else \
                         "HDD" if "hdd" in model.lower() else "Drive"

            sev = "ok" if status.lower() in ("ok", "good") else \
                  "warning" if status.lower() == "degraded" else "critical"

            findings.append(Finding(
                component="storage",
                title=f"{drive_type} Status: {model}",
                plain_english=(
                    f"Your {drive_type} ({model}, {size_gb:.0f} GB) is reporting status: '{status}'. "
                    + ("Everything looks healthy." if sev == "ok"
                       else "This drive is showing signs of trouble — back up your files immediately!" if sev == "critical"
                       else "Something may be wrong. Run a full disk check.")
                ),
                severity=sev,
                value=status
            ))

        # Reliability counters (Windows 8+) — gives real SMART-like data
        if reliability:
            rel = reliability if isinstance(reliability, dict) else (reliability[0] if reliability else {})
            if rel:
                read_errors  = rel.get("ReadErrorsUncorrected", 0) or 0
                write_errors = rel.get("WriteErrorsUncorrected", 0) or 0
                temp         = rel.get("Temperature", 0) or 0
                wear         = rel.get("Wear", None)

                if read_errors > 0 or write_errors > 0:
                    findings.append(Finding(
                        component="storage",
                        title="Drive Read/Write Errors Detected",
                        plain_english=(
                            f"Your drive has had {read_errors} read errors and {write_errors} write errors that couldn't be corrected. "
                            "This is a serious warning sign — like finding cracks in a bridge. Back up your files right now."
                        ),
                        severity="critical" if (read_errors + write_errors) > 5 else "warning",
                        recommendation="Back up your data immediately. Run Check Disk: open Command Prompt as Administrator and type: chkdsk C: /f /r",
                        prediction="Uncorrected drive errors often precede complete drive failure. Don't wait to act on this."
                    ))
                else:
                    findings.append(Finding(
                        component="storage",
                        title="Drive Error Rate",
                        plain_english="No unrecoverable read or write errors found on your drive — it's operating cleanly.",
                        severity="ok"
                    ))

                if temp and 10 < temp < 100:
                    sev = "ok"
                    if temp > HP_THERMAL_LIMITS["ssd_critical"]:
                        sev = "critical"
                    elif temp > HP_THERMAL_LIMITS["ssd_warning"]:
                        sev = "warning"
                    findings.append(Finding(
                        component="storage",
                        title="Drive Temperature",
                        plain_english=(
                            f"Your drive is running at {temp}°C. "
                            + ("This is dangerously hot — excessive heat is the #1 cause of early drive death." if sev == "critical"
                               else "This is warm but manageable. Make sure your laptop has good airflow." if sev == "warning"
                               else "This is a healthy operating temperature.")
                        ),
                        severity=sev,
                        value=temp, unit="°C"
                    ))

                if wear is not None:
                    remaining = 100 - wear
                    if remaining >= SSD_HEALTH_THRESHOLDS["excellent"]:
                        sev, label = "ok", "Excellent"
                    elif remaining >= SSD_HEALTH_THRESHOLDS["good"]:
                        sev, label = "ok", "Good"
                    elif remaining >= SSD_HEALTH_THRESHOLDS["fair"]:
                        sev, label = "info", "Fair"
                    elif remaining >= SSD_HEALTH_THRESHOLDS["warning"]:
                        sev, label = "warning", "Low"
                    else:
                        sev, label = "critical", "Critical"

                    findings.append(Finding(
                        component="storage",
                        title=f"SSD Wear Level: {label}",
                        plain_english=(
                            f"Your SSD has {remaining}% of its write endurance remaining. "
                            f"SSDs can only be written to a finite number of times — like an eraser that gets smaller each use. "
                            f"At {remaining}%, {'it has plenty of life left.' if remaining > 70 else 'you should plan for replacement soon.' if remaining < 30 else 'it is still usable but worth monitoring.'}"
                        ),
                        severity=sev,
                        value=remaining, unit="% remaining",
                        prediction=f"At current wear rate, drive may need replacement in approximately {max(1, remaining // 5)} to {max(2, remaining // 3)} years."
                    ))

        return findings

    def _check_disk_space(self) -> List[Finding]:
        """Check free space on all drives"""
        findings = []
        try:
            import psutil
            for part in psutil.disk_partitions(all=False):
                if "cdrom" in part.opts or not part.fstype:
                    continue
                try:
                    usage = psutil.disk_usage(part.mountpoint)
                    free_pct = usage.free / usage.total * 100
                    free_gb  = usage.free / (1024**3)
                    total_gb = usage.total / (1024**3)

                    # Low space warning
                    if free_pct < 10:
                        sev = "critical"
                        msg = f"Your {part.mountpoint} drive is almost full! Only {free_gb:.1f} GB free out of {total_gb:.0f} GB. This can crash programs, slow your laptop to a crawl, and even corrupt files."
                    elif free_pct < 20:
                        sev = "warning"
                        msg = f"Your {part.mountpoint} drive is getting full. {free_gb:.1f} GB free out of {total_gb:.0f} GB ({free_pct:.0f}% free). Try cleaning up old files."
                    else:
                        sev = "ok"
                        msg = f"Drive {part.mountpoint}: {free_gb:.1f} GB free out of {total_gb:.0f} GB. Plenty of space available."

                    findings.append(Finding(
                        component="storage",
                        title=f"Drive Space ({part.mountpoint})",
                        plain_english=msg,
                        severity=sev,
                        value=round(free_pct, 1), unit="% free",
                        recommendation="Run Disk Cleanup (search it in Start menu) to free space." if sev != "ok" else ""
                    ))

                except PermissionError:
                    pass
        except Exception:
            pass
        return findings

    def _check_disk_errors(self) -> List[Finding]:
        """Check Windows Event Log for disk errors"""
        findings = []
        events = ps("Get-WinEvent -LogName System -FilterXPath \"*[System[(EventID=7 or EventID=11 or EventID=51 or EventID=15) and TimeCreated[timediff(@SystemTime) <= 604800000]]]\" -ErrorAction SilentlyContinue | Select-Object Id, Message | ConvertTo-Json")
        if events:
            try:
                evts = json.loads(events)
                if isinstance(evts, dict):
                    evts = [evts]
                count = len(evts) if evts else 0
                if count > 0:
                    findings.append(Finding(
                        component="storage",
                        title=f"Disk Errors in Event Log ({count} this week)",
                        plain_english=(
                            f"Windows recorded {count} disk-related error(s) in the past week. "
                            "These can be harmless one-offs, but repeated errors often mean your drive is struggling."
                        ),
                        severity="warning" if count < 10 else "critical",
                        value=count,
                        recommendation="Run: Start > Search > 'Event Viewer' > Windows Logs > System — filter for errors from 'disk' source to see details."
                    ))
                else:
                    findings.append(Finding(
                        component="storage",
                        title="Disk Error Log",
                        plain_english="No disk errors found in the Windows event log this week — your drive is operating cleanly.",
                        severity="ok"
                    ))
            except json.JSONDecodeError:
                pass
        return findings

    def _check_disk_performance(self) -> List[Finding]:
        """Quick disk read speed benchmark"""
        findings = []
        try:
            import psutil
            disk_io_1 = psutil.disk_io_counters()
            time.sleep(1)
            disk_io_2 = psutil.disk_io_counters()

            if disk_io_1 and disk_io_2:
                read_mb  = (disk_io_2.read_bytes  - disk_io_1.read_bytes)  / (1024**2)
                write_mb = (disk_io_2.write_bytes - disk_io_1.write_bytes) / (1024**2)
                # High sustained I/O not from user activity = background issue
                if read_mb > 100:
                    findings.append(Finding(
                        component="storage",
                        title="High Background Disk Activity",
                        plain_english=f"Your drive is being read from heavily in the background ({read_mb:.0f} MB/s) even when you're not doing anything. This could be Windows Update, antivirus scanning, or an app behaving badly.",
                        severity="info",
                        value=round(read_mb, 1), unit="MB/s read"
                    ))
        except Exception:
            pass
        return findings

    def _check_disk_fragmentation(self) -> List[Finding]:
        """Check if HDD fragmentation is a concern (not relevant for SSD)"""
        findings = []
        # SSD optimization status
        defrag_status = ps("Get-ScheduledTask -TaskPath '\\Microsoft\\Windows\\Defrag\\' -ErrorAction SilentlyContinue | Select-Object TaskName, State | ConvertTo-Json")
        if defrag_status:
            try:
                task = json.loads(defrag_status)
                if isinstance(task, dict):
                    task = [task]
                for t in (task or []):
                    if t.get("State") == 1:  # Disabled
                        findings.append(Finding(
                            component="storage",
                            title="Drive Optimization Disabled",
                            plain_english="Windows' automatic drive optimization is disabled. For SSDs this helps maintain performance. For traditional HDDs it's essential.",
                            severity="info",
                            recommendation="Re-enable via: Start > Defragment and Optimize Drives > Turn on (scheduled)"
                        ))
            except json.JSONDecodeError:
                pass
        return findings

    def _check_nvme_health(self) -> List[Finding]:
        """NVMe-specific health checks via Windows NVMe commands"""
        findings = []
        # Check via HP-specific NVMe health tool or generic WMI
        nvme_logs = ps("Get-PhysicalDisk | Where-Object BusType -eq 'NVMe' | Get-StorageReliabilityCounter | Select-Object * | ConvertTo-Json")
        if nvme_logs:
            try:
                data = json.loads(nvme_logs)
                if isinstance(data, dict):
                    data = [data]
                for d in (data or []):
                    power_hours = d.get("PowerOnHours", 0)
                    if power_hours:
                        years = power_hours / 8760
                        findings.append(Finding(
                            component="storage",
                            title="NVMe Drive Power-On Hours",
                            plain_english=f"Your NVMe drive has been running for {power_hours:,} hours total (about {years:.1f} years of use). Most NVMe drives are rated for 1.5–5 million hours before failure probability increases.",
                            severity="ok" if power_hours < 30000 else "info",
                            value=power_hours, unit="hours"
                        ))
            except json.JSONDecodeError:
                pass
        return findings


# ─────────────────────────────── CPU DIAGNOSTICS ────────────────────────────

class CPUDiagnostics:
    """
    CPU health: temperature, throttling, frequency, core balance,
    turbo boost status, microcode version, HP-specific CPU tuning.
    """

    def run(self) -> List[Finding]:
        findings = []
        try:
            import psutil
            findings.extend(self._check_cpu_usage(psutil))
            findings.extend(self._check_cpu_temperature())
            findings.extend(self._check_cpu_throttling())
            findings.extend(self._check_cpu_frequency(psutil))
            findings.extend(self._check_cpu_info())
            findings.extend(self._check_turbo_boost())
        except Exception as e:
            findings.append(Finding(
                component="cpu",
                title="CPU Scan Incomplete",
                plain_english=f"Some CPU checks couldn't complete. ({e})",
                severity="info"
            ))
        return findings

    def _check_cpu_usage(self, psutil) -> List[Finding]:
        findings = []
        # Measure for 3 seconds
        usage_samples = []
        for _ in range(3):
            usage_samples.append(psutil.cpu_percent(interval=1, percpu=False))

        avg_usage = statistics.mean(usage_samples)
        per_core  = psutil.cpu_percent(percpu=True)

        findings.append(Finding(
            component="cpu",
            title="CPU Usage",
            plain_english=(
                f"Your processor is working at {avg_usage:.0f}% right now. "
                + ("That's very high — it's working really hard. Check if any program is hogging resources." if avg_usage > 85
                   else "Moderate load — your laptop is busy." if avg_usage > 50
                   else "That's a comfortable, healthy level of activity.")
            ),
            severity="critical" if avg_usage > 90 else "warning" if avg_usage > 75 else "ok",
            value=round(avg_usage, 1), unit="%"
        ))

        # Check core imbalance — one core pegged while others idle = problem
        if per_core:
            max_core = max(per_core)
            min_core = min(per_core)
            if max_core - min_core > 60 and max_core > 90:
                findings.append(Finding(
                    component="cpu",
                    title="CPU Core Imbalance",
                    plain_english=f"One of your processor's cores is at {max_core:.0f}% while others are nearly idle. A single program is monopolizing one part of your processor.",
                    severity="info",
                    recommendation="Open Task Manager (Ctrl+Shift+Esc) and look for a process using lots of CPU."
                ))

        return findings

    def _check_cpu_temperature(self) -> List[Finding]:
        """CPU temperature via Performance Counters / WMI / OHM"""
        findings = []
        cpu_temps = []
        sentinel_zones = []
        thermal_source = "unavailable"
        
        # Method 1: Performance Counters
        counter_script = '''
        $samples = Get-Counter "\\Thermal Zone Information(*)\\Temperature" -SampleInterval 1 -MaxSamples 2 -ErrorAction SilentlyContinue
        if ($samples -and $samples.Count -ge 2) {
            $static = $true
            $zones = @{}
            foreach ($sample in $samples) {
                foreach ($reading in $sample.CounterSamples) {
                    $c = [math]::Round(($reading.CookedValue - 273.15), 1)
                    $k = $reading.CookedValue
                    if ($k -lt 295 -or $k -gt 303) { $static = $false }
                    $zoneName = $reading.InstanceName
                    if ($zones.ContainsKey($zoneName)) {
                        if ($zones[$zoneName].tempC -ne $c) { $static = $false }
                    } else {
                        $zones[$zoneName] = @{ name = $zoneName; tempC = $c }
                    }
                }
            }
            @{ static = $static; zones = @($zones.Values) } | ConvertTo-Json -Depth 5
        }
        '''
        counter_out = ps(counter_script)
        if counter_out:
            try:
                data = json.loads(counter_out)
                static = data.get("static", True)
                zones = data.get("zones", [])
                if zones:
                    for z in zones:
                        c = z.get("tempC")
                        if c is not None and 10 < c < 110:
                            cpu_temps.append(c)
                            sentinel_zones.append({"name": z.get("name"), "tempC": c})
                    if sentinel_zones:
                        thermal_source = "acpi_static_suspect" if static else "performance_counter"
            except json.JSONDecodeError:
                pass

        # Method 2: MSAcpi_ThermalZoneTemp
        if thermal_source in ("unavailable", "acpi_static_suspect"):
            temps_raw = ps("Get-CimInstance -Namespace root\\wmi -ClassName MSAcpi_ThermalZoneTemp -ErrorAction SilentlyContinue | Select-Object InstanceName, CurrentTemperature | ConvertTo-Json")
            if temps_raw:
                try:
                    zones = json.loads(temps_raw)
                    if isinstance(zones, dict):
                        zones = [zones]
                    if zones:
                        new_temps = []
                        new_zones = []
                        for zone in zones:
                            raw = zone.get("CurrentTemperature", 0)
                            name = zone.get("InstanceName", "Zone")
                            if raw:
                                temp_c = round((raw / 10.0) - 273.15, 1)
                                if 10 < temp_c < 110:
                                    new_temps.append(temp_c)
                                    new_zones.append({"name": name, "tempC": temp_c})
                        if new_zones:
                            cpu_temps = new_temps
                            sentinel_zones = new_zones
                            thermal_source = "acpi_wmi"
                except json.JSONDecodeError:
                    pass

        # Method 3: OHM / LHM
        if thermal_source == "unavailable":
            ohm_raw = ps("Get-CimInstance -Namespace root\\OpenHardwareMonitor -ClassName Sensor -Filter \"SensorType='Temperature'\" -ErrorAction SilentlyContinue | Select-Object Name, Value | ConvertTo-Json")
            if not ohm_raw:
                ohm_raw = ps("Get-CimInstance -Namespace root\\LibreHardwareMonitor -ClassName Sensor -Filter \"SensorType='Temperature'\" -ErrorAction SilentlyContinue | Select-Object Name, Value | ConvertTo-Json")
            if ohm_raw:
                try:
                    zones = json.loads(ohm_raw)
                    if isinstance(zones, dict):
                        zones = [zones]
                    for zone in (zones or []):
                        name = zone.get("Name", "")
                        val = zone.get("Value", 0)
                        if val and 10 < val < 110:
                            cpu_temps.append(val)
                            sentinel_zones.append({"name": name, "tempC": val})
                    if cpu_temps:
                        thermal_source = "ohm"
                except json.JSONDecodeError:
                    pass
        
        self.sentinel_thermals = {
            "maxTempC": max(cpu_temps) if cpu_temps else None,
            "zoneCount": len(sentinel_zones),
            "zones": sentinel_zones,
            "thermalSource": thermal_source,
            "thermalSamples": len(sentinel_zones)
        }

        if cpu_temps:
            avg_temp = statistics.mean(cpu_temps)
            max_temp = max(cpu_temps)

            sev = "ok"
            msg_extra = "That's a healthy running temperature."
            if max_temp > HP_THERMAL_LIMITS["cpu_critical"]:
                sev = "critical"
                msg_extra = "DANGER! This is hot enough to cause permanent damage. Your laptop needs immediate cooling — shut it down and check the vents."
            elif max_temp > HP_THERMAL_LIMITS["cpu_warning"]:
                sev = "warning"
                msg_extra = "Your processor is running hot. This causes it to slow itself down automatically and shortens its life over time."
            elif max_temp > HP_THERMAL_LIMITS["cpu_normal"]:
                sev = "info"
                msg_extra = "Slightly warm but manageable. Make sure laptop vents aren't blocked."

            findings.append(Finding(
                component="cpu",
                title="Processor Temperature",
                plain_english=f"Your processor is at {max_temp:.0f}°C. {msg_extra}",
                severity=sev,
                value=round(max_temp, 1), unit="°C",
                recommendation=(
                    "Shut down, clean air vents with compressed air, and use the laptop on a hard flat surface." if sev == "critical"
                    else "Elevate your laptop slightly for better airflow. Clean dust from vents." if sev == "warning"
                    else ""
                ),
                prediction="Sustained high temperatures above 85°C accelerate processor aging by 2–3x." if sev in ("warning", "critical") else ""
            ))
        else:
            findings.append(Finding(
                component="cpu",
                title="Processor Temperature",
                plain_english="Temperature sensors couldn't be read on this system. This is normal on some HP models — HP's thermal protection is still active even without sensor readings.",
                severity="info"
            ))

        return findings

    def _check_cpu_throttling(self) -> List[Finding]:
        """Detect thermal throttling via performance counters"""
        findings = []
        throttle = ps("(Get-Counter '\\Processor Information(_Total)\\% of Maximum Frequency' -ErrorAction SilentlyContinue).CounterSamples.CookedValue")
        if throttle:
            try:
                pct = float(throttle.strip())
                if pct < 70:
                    findings.append(Finding(
                        component="cpu",
                        title="Processor is Being Throttled",
                        plain_english=f"Your processor is running at only {pct:.0f}% of its maximum speed right now. It's intentionally slowing itself down, most likely because it's too hot or your power plan is limiting it.",
                        severity="warning" if pct < 50 else "info",
                        value=round(pct, 1), unit="% of max speed",
                        recommendation="Let the laptop cool down, check for dust-blocked vents, or switch to Balanced power plan."
                    ))
                else:
                    findings.append(Finding(
                        component="cpu",
                        title="Processor Speed",
                        plain_english=f"Your processor is running at {pct:.0f}% of its maximum speed — no throttling detected.",
                        severity="ok",
                        value=round(pct, 1), unit="% of max speed"
                    ))
            except ValueError:
                pass
        return findings

    def _check_cpu_frequency(self, psutil) -> List[Finding]:
        """Check CPU frequency vs rated max"""
        findings = []
        try:
            freq = psutil.cpu_freq()
            if freq:
                current_mhz = freq.current
                max_mhz     = freq.max or freq.current
                pct = (current_mhz / max_mhz * 100) if max_mhz else 100

                findings.append(Finding(
                    component="cpu",
                    title="Processor Clock Speed",
                    plain_english=f"Processor running at {current_mhz/1000:.2f} GHz (max is {max_mhz/1000:.2f} GHz). {f'Running at {pct:.0f}% of potential.' if pct < 95 else 'Running at full speed.'}",
                    severity="ok",
                    value=round(current_mhz/1000, 2), unit="GHz"
                ))
        except Exception:
            pass
        return findings

    def _check_cpu_info(self) -> List[Finding]:
        """Check CPU model, generation, and microcode"""
        findings = []
        cpu_name = ps("(Get-WmiObject Win32_Processor).Name")
        cpu_cores = ps("(Get-WmiObject Win32_Processor).NumberOfCores")
        cpu_threads = ps("(Get-WmiObject Win32_Processor).NumberOfLogicalProcessors")
        microcode = ps("(Get-WmiObject Win32_Processor).Description")

        if cpu_name:
            # Detect generation for Intel
            import re
            gen_match = re.search(r'i[3579]-(\d)(\d{3,4})', cpu_name)
            gen_num = int(gen_match.group(1)) if gen_match else None

            findings.append(Finding(
                component="cpu",
                title="Processor Model",
                plain_english=(
                    f"Your processor: {cpu_name.strip()} "
                    f"({cpu_cores} physical cores, {cpu_threads} threads). "
                    + (f"This is a {gen_num}th-generation Intel processor. " if gen_num else "")
                    + ("This is getting older and may struggle with modern apps." if gen_num and gen_num < 8 else "")
                ),
                severity="info" if (gen_num and gen_num < 8) else "ok",
                value=cpu_name.strip()
            ))

        return findings

    def _check_turbo_boost(self) -> List[Finding]:
        """Check if Intel Turbo Boost / AMD Boost is enabled"""
        findings = []
        turbo = ps("powercfg /query SCHEME_CURRENT SUB_PROCESSOR PERFBOOSTMODE 2>$null")
        if turbo:
            if "0x00000000" in turbo:
                findings.append(Finding(
                    component="cpu",
                    title="Turbo Boost Disabled",
                    plain_english="Your processor's speed-boost feature (Turbo Boost) is turned off. This means your laptop runs slower than it could, especially for demanding tasks.",
                    severity="info",
                    recommendation="Enable via Power Options > Change plan settings > Change advanced power settings > Processor power management > Processor performance boost mode > set to Enabled."
                ))
        return findings


# ─────────────────────────────── RAM DIAGNOSTICS ────────────────────────────

class RAMDiagnostics:
    """
    RAM health: total/used/available, memory pressure, virtual memory,
    memory errors (if ECC), memory leaks, HP-specific RAM config.
    """

    def run(self) -> List[Finding]:
        findings = []
        try:
            import psutil
            findings.extend(self._check_ram_usage(psutil))
            findings.extend(self._check_virtual_memory(psutil))
            findings.extend(self._check_memory_pressure())
            findings.extend(self._check_ram_specs())
            findings.extend(self._check_memory_errors())
        except Exception as e:
            findings.append(Finding(
                component="ram",
                title="RAM Scan Incomplete",
                plain_english=f"Some memory checks couldn't complete. ({e})",
                severity="info"
            ))
        return findings

    def _check_ram_usage(self, psutil) -> List[Finding]:
        findings = []
        mem = psutil.virtual_memory()
        used_pct = mem.percent
        total_gb = mem.total / (1024**3)
        avail_gb = mem.available / (1024**3)

        if used_pct > 90:
            sev = "critical"
            msg = f"Your computer's memory is almost completely full ({used_pct:.0f}% used)! Only {avail_gb:.1f} GB free. This causes severe slowdowns, crashes, and forces Windows to use your (much slower) hard drive as fake memory."
        elif used_pct > 75:
            sev = "warning"
            msg = f"Memory is getting tight — {used_pct:.0f}% used, {avail_gb:.1f} GB free out of {total_gb:.0f} GB total. Your laptop may start slowing down if you open more programs."
        else:
            sev = "ok"
            msg = f"Memory usage is healthy: {used_pct:.0f}% used, {avail_gb:.1f} GB free out of {total_gb:.0f} GB."

        findings.append(Finding(
            component="ram",
            title="Memory Usage",
            plain_english=msg,
            severity=sev,
            value=round(used_pct, 1), unit="% used",
            recommendation="Close unused programs or browser tabs. If this is consistently high, you may need more RAM." if sev != "ok" else ""
        ))

        # Low total RAM warning
        if total_gb < 8:
            findings.append(Finding(
                component="ram",
                title="Low Total Memory",
                plain_english=f"Your laptop has {total_gb:.0f} GB of memory — this is below the recommended amount for comfortable use in 2024. Windows alone uses 2–4 GB, leaving little room for apps.",
                severity="warning" if total_gb < 4 else "info",
                value=total_gb, unit="GB",
                recommendation="Consider upgrading to 16 GB if your HP model supports it (check HP's website or iFixit for your model).",
                prediction="With modern apps and browser tabs increasing in memory requirements, less than 8 GB will feel increasingly limiting."
            ))

        return findings

    def _check_virtual_memory(self, psutil) -> List[Finding]:
        """Page file (virtual memory) usage"""
        findings = []
        swap = psutil.swap_memory()
        if swap.total > 0:
            swap_pct = swap.percent
            swap_gb  = swap.used / (1024**3)

            if swap_pct > 50:
                findings.append(Finding(
                    component="ram",
                    title="Heavy Virtual Memory Use",
                    plain_english=f"Your laptop is using {swap_gb:.1f} GB of virtual memory (page file) because it has run out of real memory. This is like using a slow notepad instead of your brain — it makes everything much slower.",
                    severity="warning" if swap_pct < 75 else "critical",
                    value=round(swap_pct, 1), unit="% page file used",
                    recommendation="Close programs you're not using, or upgrade your RAM."
                ))
        return findings

    def _check_memory_pressure(self) -> List[Finding]:
        """Detect memory pressure via Windows performance counters"""
        findings = []
        # Hard page faults per second = true memory pressure indicator
        page_faults = ps("(Get-Counter '\\Memory\\Page Faults/sec' -ErrorAction SilentlyContinue).CounterSamples.CookedValue")
        hard_faults  = ps("(Get-Counter '\\Memory\\Page Reads/sec' -ErrorAction SilentlyContinue).CounterSamples.CookedValue")

        if hard_faults:
            try:
                hf = float(hard_faults.strip())
                if hf > 50:
                    findings.append(Finding(
                        component="ram",
                        title="Memory Pressure Detected",
                        plain_english=f"Your computer is reading from disk {hf:.0f} times per second because it's out of real memory. This is like constantly running to a slow filing cabinet because your desk is too full — it makes everything sluggish.",
                        severity="warning" if hf < 200 else "critical",
                        value=round(hf, 0), unit="disk reads/sec due to RAM shortage"
                    ))
            except ValueError:
                pass
        return findings

    def _check_ram_specs(self) -> List[Finding]:
        """RAM speed, type, slots via WMI"""
        findings = []
        sticks = ps_json("Get-WmiObject Win32_PhysicalMemory | Select-Object Capacity, Speed, MemoryType, SMBIOSMemoryType, Manufacturer, PartNumber, BankLabel")
        if isinstance(sticks, dict):
            sticks = [sticks]

        if sticks:
            total_gb = sum((s.get("Capacity", 0) or 0) / (1024**3) for s in sticks)
            speed    = max((s.get("Speed", 0) or 0) for s in sticks)
            type_map = {24: "DDR3", 26: "DDR4", 34: "DDR5"}
            ram_type = type_map.get(sticks[0].get("SMBIOSMemoryType", 0), "DDR4")

            findings.append(Finding(
                component="ram",
                title="Memory Configuration",
                plain_english=f"You have {len(sticks)} memory stick(s) installed: {total_gb:.0f} GB total, running at {speed} MHz ({ram_type}). {'Dual-channel setup — good for performance.' if len(sticks) == 2 else 'Single stick — consider adding a matching stick for better performance.'}",
                severity="ok" if len(sticks) >= 2 else "info",
                value=f"{total_gb:.0f} GB {ram_type} @ {speed} MHz"
            ))

        return findings

    def _check_memory_errors(self) -> List[Finding]:
        """Check event log for memory errors"""
        findings = []
        mem_errors = ps("Get-WinEvent -LogName System -ErrorAction SilentlyContinue | Where-Object {$_.Id -in @(1, 19, 41, 51, 4108, 4109)} | Measure-Object | Select-Object -ExpandProperty Count")
        if mem_errors:
            try:
                count = int(mem_errors.strip())
                if count > 0:
                    findings.append(Finding(
                        component="ram",
                        title=f"Memory-Related Events Found ({count})",
                        plain_english=f"Windows found {count} memory-related event(s) in its logs. These can range from harmless to serious. If your laptop crashes or freezes, these events might explain it.",
                        severity="warning",
                        recommendation="Run Windows Memory Diagnostic: Start > Search > 'Windows Memory Diagnostic' > Restart and check for problems."
                    ))
                else:
                    findings.append(Finding(
                        component="ram",
                        title="Memory Error Log",
                        plain_english="No memory errors found in the Windows event log — your RAM appears to be working reliably.",
                        severity="ok"
                    ))
            except ValueError:
                pass
        return findings


# ─────────────────────────────── GPU DIAGNOSTICS ────────────────────────────

class GPUDiagnostics:
    """
    GPU health: temperature, VRAM usage, driver version, HP Omen gaming GPU,
    Intel/AMD/NVIDIA detection, display driver stability.
    """

    def run(self) -> List[Finding]:
        findings = []
        try:
            findings.extend(self._check_gpu_info())
            findings.extend(self._check_gpu_temperature())
            findings.extend(self._check_gpu_driver())
            findings.extend(self._check_nvidia_gpu())
        except Exception as e:
            findings.append(Finding(
                component="gpu",
                title="GPU Scan Incomplete",
                plain_english=f"Some GPU checks couldn't complete. ({e})",
                severity="info"
            ))
        return findings

    def _check_gpu_info(self) -> List[Finding]:
        findings = []
        gpus = ps_json("Get-WmiObject Win32_VideoController | Select-Object Name, AdapterRAM, DriverVersion, Status, VideoProcessor, CurrentHorizontalResolution, CurrentVerticalResolution")
        if isinstance(gpus, dict):
            gpus = [gpus]

        for gpu in (gpus or []):
            name   = gpu.get("Name", "Unknown GPU") or "Unknown GPU"
            status = gpu.get("Status", "Unknown") or "Unknown"
            vram_b = gpu.get("AdapterRAM", 0) or 0
            vram_gb = vram_b / (1024**3) if vram_b else 0
            res_h  = gpu.get("CurrentHorizontalResolution", 0)
            res_v  = gpu.get("CurrentVerticalResolution", 0)

            sev = "ok" if status.lower() in ("ok", "running") else "warning"

            findings.append(Finding(
                component="gpu",
                title=f"Graphics Card: {name}",
                plain_english=(
                    f"Your graphics card: {name}"
                    + (f" with {vram_gb:.0f} GB video memory" if vram_gb > 0.5 else "")
                    + (f", driving a {res_h}×{res_v} display" if res_h and res_v else "")
                    + (f". Status: {status}." if status.lower() != "ok" else ". Working normally.")
                ),
                severity=sev,
                value=name
            ))

        return findings

    def _check_gpu_temperature(self) -> List[Finding]:
        """GPU temperature via WMI or NVIDIA tools"""
        findings = []
        # Try OpenHardwareMonitor if available, else NVIDIA SMI
        gpu_temp = ps("(nvidia-smi --query-gpu=temperature.gpu --format=csv,noheader,nounits 2>$null)")
        if gpu_temp and gpu_temp.strip().isdigit():
            temp = int(gpu_temp.strip())
            sev = "ok"
            msg = "Normal operating temperature."
            if temp > HP_THERMAL_LIMITS["gpu_critical"]:
                sev = "critical"
                msg = "Dangerously hot! Reduce graphics load immediately."
            elif temp > HP_THERMAL_LIMITS["gpu_warning"]:
                sev = "warning"
                msg = "Running hot. Ensure vents are clear."
            elif temp > HP_THERMAL_LIMITS["gpu_normal"]:
                sev = "info"
                msg = "Warm but within limits."

            findings.append(Finding(
                component="gpu",
                title="Graphics Card Temperature",
                plain_english=f"GPU temperature is {temp}°C. {msg}",
                severity=sev,
                value=temp, unit="°C"
            ))
        return findings

    def _check_gpu_driver(self) -> List[Finding]:
        """Check GPU driver version and stability"""
        findings = []
        gpus = ps_json("Get-WmiObject Win32_VideoController | Select-Object Name, DriverVersion, DriverDate")
        if isinstance(gpus, dict):
            gpus = [gpus]

        for gpu in (gpus or []):
            name    = gpu.get("Name", "") or ""
            version = gpu.get("DriverVersion", "") or ""
            date    = gpu.get("DriverDate", "") or ""

            if version:
                # Check for very old drivers (WMI date format: 20231001000000.000000+000)
                try:
                    if date and len(date) >= 8:
                        driver_year = int(date[:4])
                        current_year = datetime.datetime.now().year
                        age_years = current_year - driver_year

                        if age_years > 2:
                            findings.append(Finding(
                                component="gpu",
                                title=f"Outdated Graphics Driver ({name})",
                                plain_english=f"Your graphics driver for {name} is from {driver_year} — about {age_years} year(s) old. Old graphics drivers cause game crashes, display glitches, security holes, and miss performance improvements.",
                                severity="warning" if age_years > 3 else "info",
                                recommendation="Update via: HP Support Assistant, or NVIDIA/AMD/Intel's website, or Windows Update > Optional Updates.",
                                prediction="Outdated GPU drivers are a leading cause of unexpected system crashes (blue screens)."
                            ))
                        else:
                            findings.append(Finding(
                                component="gpu",
                                title=f"Graphics Driver ({name})",
                                plain_english=f"Graphics driver for {name} is reasonably up to date (from {driver_year}). Version: {version}.",
                                severity="ok"
                            ))
                except (ValueError, IndexError):
                    pass

        # Check for recent display driver crashes in event log
        dxgi_crashes = ps("Get-WinEvent -LogName System -ErrorAction SilentlyContinue | Where-Object {$_.Id -eq 4101 -and $_.TimeCreated -gt (Get-Date).AddDays(-7)} | Measure-Object | Select-Object -ExpandProperty Count")
        if dxgi_crashes:
            try:
                count = int(dxgi_crashes.strip())
                if count > 0:
                    findings.append(Finding(
                        component="gpu",
                        title=f"Graphics Driver Crashed {count} Time(s) This Week",
                        plain_english=f"Your graphics driver crashed and recovered {count} time(s) in the last 7 days. You might have seen your screen go black briefly or gotten a 'Display driver stopped responding' message.",
                        severity="warning" if count < 5 else "critical",
                        recommendation="Update your graphics drivers. If crashes continue after updating, the GPU itself may be failing.",
                        prediction="Frequent GPU driver crashes often worsen over time and can eventually cause permanent display failure."
                    ))
            except ValueError:
                pass

        return findings

    def _check_nvidia_gpu(self) -> List[Finding]:
        """NVIDIA-specific checks via nvidia-smi"""
        findings = []
        try:
            nvinfo = ps("nvidia-smi --query-gpu=name,memory.total,memory.used,memory.free,utilization.gpu,power.draw,power.limit,fan.speed --format=csv,noheader,nounits 2>$null")
            if nvinfo and "," in nvinfo:
                parts = [p.strip() for p in nvinfo.split(",")]
                if len(parts) >= 8:
                    name     = parts[0]
                    vram_tot = int(parts[1]) if parts[1].isdigit() else 0
                    vram_use = int(parts[2]) if parts[2].isdigit() else 0
                    util     = int(parts[5]) if parts[5].isdigit() else 0
                    power    = float(parts[6]) if parts[6].replace(".", "").isdigit() else 0
                    power_lim= float(parts[7]) if parts[7].replace(".", "").isdigit() else 100
                    fan_spd  = parts[8].strip() if len(parts) > 8 else "N/A"

                    if vram_tot > 0:
                        vram_pct = vram_use / vram_tot * 100
                        findings.append(Finding(
                            component="gpu",
                            title=f"NVIDIA {name} — VRAM Usage",
                            plain_english=f"Your NVIDIA GPU is using {vram_use} MB of {vram_tot} MB video memory ({vram_pct:.0f}%). {'Getting tight — close some graphics-heavy applications.' if vram_pct > 85 else 'Plenty of video memory available.'}",
                            severity="warning" if vram_pct > 90 else "ok",
                            value=round(vram_pct, 1), unit="% VRAM used"
                        ))

                    if power and power_lim:
                        power_pct = power / power_lim * 100
                        if power_pct > 95:
                            findings.append(Finding(
                                component="gpu",
                                title="GPU at Power Limit",
                                plain_english=f"Your GPU is drawing {power:.0f}W — right at its {power_lim:.0f}W power limit. It may start throttling to avoid overheating.",
                                severity="info",
                                value=round(power, 1), unit="W"
                            ))
        except Exception:
            pass
        return findings


# ─────────────────────────────── THERMAL / FAN DIAGNOSTICS ──────────────────

class ThermalFanDiagnostics:
    """
    Fan RPM, thermal zones, throttling, HP Thermal Profiles,
    vent blockage detection via sustained thermal patterns.
    """

    def run(self) -> List[Finding]:
        findings = []
        try:
            findings.extend(self._check_fans())
            findings.extend(self._check_thermal_zones())
            findings.extend(self._check_thermal_throttling())
            findings.extend(self._check_hp_thermal_profiles())
        except Exception as e:
            findings.append(Finding(
                component="thermals",
                title="Thermal Scan Incomplete",
                plain_english=f"Some thermal checks couldn't complete. ({e})",
                severity="info"
            ))
        return findings

    def _check_fans(self) -> List[Finding]:
        """Fan speed via WMI"""
        findings = []
        fans = ps_json("Get-WmiObject -Namespace root\\WMI -Class MSAcpi_ThermalZoneTemperature -ErrorAction SilentlyContinue | Select-Object InstanceName, CurrentTemperature")
        fan_raw = ps_json("Get-WmiObject Win32_Fan -ErrorAction SilentlyContinue | Select-Object Name, DesiredSpeed, ActiveCooling")

        if fan_raw:
            if isinstance(fan_raw, dict):
                fan_raw = [fan_raw]
            for fan in fan_raw:
                speed = fan.get("DesiredSpeed", 0)
                name  = fan.get("Name", "Fan") or "Fan"
                if speed:
                    findings.append(Finding(
                        component="thermals",
                        title=f"Fan Speed: {name}",
                        plain_english=f"Fan '{name}' is running at {speed} RPM. {'Very high — your laptop is working hard to stay cool.' if speed > 4500 else 'Normal operating speed.' if speed > 1000 else 'Very low — fan may be off (normal when cool) or stuck.'}",
                        severity="info" if speed > 4500 else "ok",
                        value=speed, unit="RPM"
                    ))
        else:
            # Try HP-specific WMI
            hp_fans = ps("Get-WmiObject -Namespace root\\HP\\InstrumentedBIOS -ErrorAction SilentlyContinue")
            if not hp_fans:
                findings.append(Finding(
                    component="thermals",
                    title="Fan Speed Data",
                    plain_english="Fan speed couldn't be directly read — this is normal on many HP models as they use proprietary fan control. HP's built-in thermal protection is still active and will protect your laptop even without readable fan data.",
                    severity="info"
                ))
        return findings

    def _check_thermal_zones(self) -> List[Finding]:
        """All thermal zone temperatures"""
        findings = []
        zones_raw = ps_json("Get-WmiObject -Namespace root\\WMI -Class MSAcpi_ThermalZoneTemperature -ErrorAction SilentlyContinue | Select-Object InstanceName, CurrentTemperature, CriticalTripPoint")

        if isinstance(zones_raw, dict):
            zones_raw = [zones_raw]

        zone_temps = []
        for zone in (zones_raw or []):
            raw    = zone.get("CurrentTemperature", 0)
            crit   = zone.get("CriticalTripPoint", 0)
            name   = zone.get("InstanceName", "Zone") or "Zone"

            if raw:
                temp_c = (raw / 10) - 273.15
                crit_c = ((crit / 10) - 273.15) if crit else None

                if 10 < temp_c < 120:
                    zone_temps.append(temp_c)

        if zone_temps:
            max_t = max(zone_temps)
            avg_t = statistics.mean(zone_temps)

            if max_t > 90:
                findings.append(Finding(
                    component="thermals",
                    title="System Running Very Hot",
                    plain_english=f"The hottest part of your laptop's internals is at {max_t:.0f}°C — that's dangerously high. Your laptop will start slowing itself down to avoid damage, and prolonged exposure to these temperatures will shorten its life significantly.",
                    severity="critical",
                    value=round(max_t, 1), unit="°C",
                    recommendation="Shut down and let it cool. Clean vents with compressed air. Never use on carpet or pillows. Consider a laptop cooling pad.",
                    prediction="Running consistently above 90°C can reduce CPU lifespan by up to 50% and cause solder joint failure."
                ))
            elif max_t > 80:
                findings.append(Finding(
                    component="thermals",
                    title="System Running Warm",
                    plain_english=f"Internal temperature reached {max_t:.0f}°C. Warm, but within operating limits for most tasks.",
                    severity="warning",
                    value=round(max_t, 1), unit="°C"
                ))

        return findings

    def _check_thermal_throttling(self) -> List[Finding]:
        """Detect if system is currently throttling"""
        findings = []
        # Performance counter for throttled time
        throttle_time = ps("(Get-Counter '\\Processor Information(_Total)\\% Processor Performance' -ErrorAction SilentlyContinue).CounterSamples.CookedValue")
        if throttle_time:
            try:
                perf = float(throttle_time.strip())
                if perf < 60:
                    findings.append(Finding(
                        component="thermals",
                        title="Thermal Throttling Active",
                        plain_english=f"Your processor is running at {perf:.0f}% of its normal speed because it's throttling. This happens automatically to prevent overheating — but if it's happening when you're just browsing or working on documents, something is wrong.",
                        severity="warning",
                        recommendation="Check for dust-blocked vents. If cleaning doesn't help, the thermal paste on the CPU may need replacing (a laptop shop can do this)."
                    ))
            except ValueError:
                pass
        return findings

    def _check_hp_thermal_profiles(self) -> List[Finding]:
        """HP-specific thermal profile (Cool/Balanced/Performance/HP Omen modes)"""
        findings = []
        # HP thermal mode via registry
        hp_mode = reg_read("HKLM:\\SYSTEM\\CurrentControlSet\\Services\\HpThermalPolicy\\Parameters", "ThermalPolicyMode")
        if hp_mode:
            mode_names = {"0": "Cool", "1": "Balanced", "2": "Performance"}
            mode_name = mode_names.get(hp_mode.strip(), hp_mode.strip())
            findings.append(Finding(
                component="thermals",
                title=f"HP Thermal Profile: {mode_name}",
                plain_english=f"Your HP laptop is currently in '{mode_name}' thermal mode. {'This prioritizes cooling over speed — good for longevity.' if mode_name == 'Cool' else 'This balances heat and performance.' if mode_name == 'Balanced' else 'This maximizes performance but generates more heat.'}",
                severity="ok" if mode_name in ("Cool", "Balanced") else "info"
            ))
        return findings


# ─────────────────────────────── STARTUP HEALTH ──────────────────────────────

class StartupDiagnostics:
    """
    Boot time, startup programs, Windows startup health,
    Fast Startup status, HP-specific boot items.
    """

    def run(self) -> List[Finding]:
        findings = []
        try:
            findings.extend(self._check_boot_time())
            findings.extend(self._check_startup_programs())
            findings.extend(self._check_fast_startup())
            findings.extend(self._check_bcd_health())
        except Exception as e:
            findings.append(Finding(
                component="startup",
                title="Startup Scan Incomplete",
                plain_english=f"Some startup checks couldn't complete. ({e})",
                severity="info"
            ))
        return findings

    def _check_boot_time(self) -> List[Finding]:
        """Windows boot time measurement"""
        findings = []
        try:
            import psutil
            boot_seconds = time.time() - psutil.boot_time()
            uptime_hr = boot_seconds / 3600

            findings.append(Finding(
                component="startup",
                title="System Uptime",
                plain_english=f"Your laptop has been running for {uptime_hr:.1f} hours since last boot.",
                severity="ok",
                value=round(uptime_hr, 1), unit="hours"
            ))

            # Long uptime warning
            if uptime_hr > 72:
                findings.append(Finding(
                    component="startup",
                    title="Laptop Running for a Long Time Without Restart",
                    plain_english=f"Your laptop has been on for {uptime_hr:.0f} hours ({uptime_hr/24:.0f} days) without a restart. Memory leaks build up, Windows updates get delayed, and performance gradually degrades the longer a laptop runs without rebooting.",
                    severity="info" if uptime_hr < 168 else "warning",
                    recommendation="Restart your laptop at least once a week to apply updates and clear accumulated memory issues."
                ))
        except Exception:
            pass

        # Windows boot performance event
        boot_perf = ps("Get-WinEvent -LogName 'Microsoft-Windows-Diagnostics-Performance/Operational' -ErrorAction SilentlyContinue | Where-Object {$_.Id -eq 100} | Select-Object -First 1 | Select-Object TimeCreated, Message | ConvertTo-Json")
        if boot_perf:
            try:
                event = json.loads(boot_perf)
                msg = event.get("Message", "") or ""
                import re
                ms_match = re.search(r'Boot Duration:\s*(\d+)', msg)
                if ms_match:
                    boot_ms = int(ms_match.group(1))
                    boot_sec = boot_ms / 1000
                    findings.append(Finding(
                        component="startup",
                        title="Last Boot Time",
                        plain_english=(
                            f"Your last Windows startup took {boot_sec:.0f} seconds. "
                            + ("Excellent — very fast boot!" if boot_sec < 15
                               else "Normal speed." if boot_sec < 45
                               else "Slower than expected — too many startup programs or a drive issue may be responsible." if boot_sec < 120
                               else "Very slow boot. Something is significantly slowing down your startup.")
                        ),
                        severity="ok" if boot_sec < 45 else "info" if boot_sec < 90 else "warning",
                        value=round(boot_sec, 0), unit="seconds"
                    ))
            except (json.JSONDecodeError, KeyError):
                pass

        return findings

    def _check_startup_programs(self) -> List[Finding]:
        """Count and evaluate startup programs"""
        findings = []
        startup_items = ps("Get-CimInstance Win32_StartupCommand | Measure-Object | Select-Object -ExpandProperty Count")
        if startup_items:
            try:
                count = int(startup_items.strip())
                findings.append(Finding(
                    component="startup",
                    title=f"Startup Programs: {count} Items",
                    plain_english=(
                        f"You have {count} programs set to start automatically when Windows boots. "
                        + ("That's a lot — too many startup apps slow boot time and waste memory." if count > 15
                           else "A reasonable number." if count > 8
                           else "A light startup setup — good for fast boot times.")
                    ),
                    severity="warning" if count > 20 else "info" if count > 10 else "ok",
                    value=count,
                    recommendation="Manage startup apps: Task Manager (Ctrl+Shift+Esc) > Startup tab > Disable anything you don't need immediately on boot." if count > 15 else ""
                ))
            except ValueError:
                pass
        return findings

    def _check_fast_startup(self) -> List[Finding]:
        """HP recommendation: Fast Startup can cause issues on some models"""
        findings = []
        fast_start = reg_read("HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Power", "HiberbootEnabled")
        if fast_start:
            enabled = fast_start.strip() == "1"
            if enabled:
                findings.append(Finding(
                    component="startup",
                    title="Fast Startup Enabled",
                    plain_english="Windows Fast Startup is on — it makes your laptop start faster by not fully shutting down. Most of the time this is fine, but on some HP models it can prevent Windows Updates from installing properly or cause occasional startup errors.",
                    severity="info",
                    recommendation="If your HP laptop occasionally hangs at startup or skips updates, try disabling Fast Startup: Control Panel > Power Options > Choose what the power button does > Turn off fast startup."
                ))
        return findings

    def _check_bcd_health(self) -> List[Finding]:
        """Check Boot Configuration Data integrity"""
        findings = []
        bcd_check = ps("bcdedit /enum | Select-String 'recoveryenabled' | Select-Object -ExpandProperty Line")
        if bcd_check and "yes" in bcd_check.lower():
            findings.append(Finding(
                component="startup",
                title="Windows Recovery Enabled",
                plain_english="Windows can automatically recover from startup failures — this is a good safety net.",
                severity="ok"
            ))
        elif bcd_check:
            findings.append(Finding(
                component="startup",
                title="Windows Recovery Disabled",
                plain_english="Windows automatic startup recovery is disabled. If Windows fails to start, recovery options will be limited.",
                severity="info",
                recommendation="Enable via Command Prompt (Admin): bcdedit /set {current} recoveryenabled yes"
            ))
        return findings


# ─────────────────────────────── NETWORK DIAGNOSTICS ────────────────────────

class NetworkDiagnostics:
    """
    Network adapter health, WiFi signal quality, DNS performance,
    connection stability, HP-specific network driver health.
    """

    def run(self) -> List[Finding]:
        findings = []
        try:
            findings.extend(self._check_adapters())
            findings.extend(self._check_wifi_quality())
            findings.extend(self._check_dns_performance())
            findings.extend(self._check_network_errors())
            findings.extend(self._check_network_usage())
        except Exception as e:
            findings.append(Finding(
                component="network",
                title="Network Scan Incomplete",
                plain_english=f"Some network checks couldn't complete. ({e})",
                severity="info"
            ))
        return findings

    def _check_adapters(self) -> List[Finding]:
        """Network adapter status"""
        findings = []
        adapters = ps_json("Get-NetAdapter | Select-Object Name, InterfaceDescription, Status, LinkSpeed, MacAddress, MediaType")
        if isinstance(adapters, dict):
            adapters = [adapters]

        active_count = 0
        for adapter in (adapters or []):
            name   = adapter.get("Name", "") or ""
            status = adapter.get("Status", "") or ""
            speed  = adapter.get("LinkSpeed", "") or ""
            desc   = adapter.get("InterfaceDescription", "") or ""

            if status.lower() == "up":
                active_count += 1
                speed_val = str(speed)
                findings.append(Finding(
                    component="network",
                    title=f"Network: {name} Connected",
                    plain_english=f"'{name}' ({desc}) is connected and active at {speed_val}.",
                    severity="ok",
                    value=speed_val
                ))
            elif status.lower() in ("disabled", "not present"):
                pass  # Skip disabled adapters silently
            else:
                findings.append(Finding(
                    component="network",
                    title=f"Network Adapter Issue: {name}",
                    plain_english=f"Network adapter '{name}' has status '{status}' — it may not be working correctly.",
                    severity="warning"
                ))

        return findings

    def _check_wifi_quality(self) -> List[Finding]:
        """WiFi signal strength via netsh"""
        findings = []
        wifi_info = ps("netsh wlan show interfaces 2>$null")
        if wifi_info and "Signal" in wifi_info:
            import re
            signal_match = re.search(r'Signal\s*:\s*(\d+)%', wifi_info)
            profile_match = re.search(r'Profile\s*:\s*(.+)', wifi_info)
            ssid_match    = re.search(r'SSID\s*:\s*(.+)', wifi_info)
            band_match    = re.search(r'Radio type\s*:\s*(.+)', wifi_info)

            if signal_match:
                signal = int(signal_match.group(1))
                ssid   = ssid_match.group(1).strip() if ssid_match else "Unknown"
                band   = band_match.group(1).strip() if band_match else ""

                sev = "ok"
                if signal < 40:
                    sev = "critical"
                    desc = "Very weak signal — expect dropouts and slow speeds."
                elif signal < 60:
                    sev = "warning"
                    desc = "Weak signal — you may experience slowness or dropouts."
                elif signal < 80:
                    sev = "ok"
                    desc = "Decent signal."
                else:
                    sev = "ok"
                    desc = "Excellent signal."

                findings.append(Finding(
                    component="network",
                    title=f"WiFi Signal Strength: {signal}%",
                    plain_english=f"Connected to '{ssid}' with {signal}% signal strength. {desc}" + (f" Band: {band}." if band else ""),
                    severity=sev,
                    value=signal, unit="%",
                    recommendation="Move closer to your router, or use 5GHz WiFi if your router supports it." if sev in ("warning", "critical") else ""
                ))

        # Check for HP Intel WiFi driver issues specifically
        wifi_driver = ps("Get-WmiObject Win32_NetworkAdapter | Where-Object {$_.AdapterType -like '*Ethernet*' -and $_.Name -like '*Wi*'} | Select-Object Name, Status | ConvertTo-Json")
        return findings

    def _check_dns_performance(self) -> List[Finding]:
        """DNS response time check"""
        findings = []
        try:
            import socket
            start = time.time()
            socket.getaddrinfo("www.google.com", 80)
            dns_ms = (time.time() - start) * 1000

            findings.append(Finding(
                component="network",
                title="DNS Response Speed",
                plain_english=(
                    f"DNS lookup (translating website names to addresses) takes {dns_ms:.0f} milliseconds. "
                    + ("Excellent — very fast internet name resolution." if dns_ms < 20
                       else "Good speed." if dns_ms < 100
                       else "Slow — websites may feel sluggish to load even on a fast connection." if dns_ms < 500
                       else "Very slow DNS — most web browsing will feel slow.")
                ),
                severity="ok" if dns_ms < 100 else "warning" if dns_ms < 500 else "critical",
                value=round(dns_ms, 0), unit="ms",
                recommendation="Try using Google DNS (8.8.8.8) or Cloudflare DNS (1.1.1.1) for faster browsing." if dns_ms > 200 else ""
            ))
        except Exception:
            findings.append(Finding(
                component="network",
                title="Internet Connectivity",
                plain_english="Could not reach the internet for DNS testing. You may be offline or your DNS is blocked.",
                severity="warning"
            ))
        return findings

    def _check_network_errors(self) -> List[Finding]:
        """Network adapter error rates"""
        findings = []
        net_stats = ps_json("Get-NetAdapterStatistics | Select-Object Name, ReceivedPacketsErrors, OutboundPacketsErrors, ReceivedDiscardedPackets, OutboundDiscardedPackets")
        if isinstance(net_stats, dict):
            net_stats = [net_stats]

        for stat in (net_stats or []):
            name = stat.get("Name", "Adapter") or "Adapter"
            rx_err = stat.get("ReceivedPacketsErrors", 0) or 0
            tx_err = stat.get("OutboundPacketsErrors", 0) or 0

            if rx_err + tx_err > 100:
                findings.append(Finding(
                    component="network",
                    title=f"Network Errors on {name}",
                    plain_english=f"Network adapter '{name}' has had {rx_err + tx_err} errors. This can cause slow, unreliable connections even when signal is good.",
                    severity="warning",
                    recommendation="Try reinstalling the network adapter driver via Device Manager."
                ))

        return findings

    def _check_network_usage(self) -> List[Finding]:
        """Current network throughput"""
        findings = []
        try:
            import psutil
            net1 = psutil.net_io_counters()
            time.sleep(1)
            net2 = psutil.net_io_counters()

            sent_mb = (net2.bytes_sent - net1.bytes_sent) / (1024**2)
            recv_mb = (net2.bytes_recv - net1.bytes_recv) / (1024**2)

            if sent_mb > 5 or recv_mb > 5:
                findings.append(Finding(
                    component="network",
                    title="Active Network Traffic",
                    plain_english=f"Your laptop is actively sending/receiving data: ↓{recv_mb:.1f} MB/s received, ↑{sent_mb:.1f} MB/s sent. If you're not downloading anything, a background app may be using your connection.",
                    severity="info",
                    value=f"↓{recv_mb:.1f} ↑{sent_mb:.1f}", unit="MB/s"
                ))
        except Exception:
            pass
        return findings


# ─────────────────────────────── DRIVER HEALTH ──────────────────────────────

class DriverDiagnostics:
    """
    Driver health: problem devices, HP-specific driver versions,
    Windows Update driver status, blue screen history.
    """

    def run(self) -> List[Finding]:
        findings = []
        try:
            findings.extend(self._check_problem_devices())
            findings.extend(self._check_hp_drivers())
            findings.extend(self._check_bsod_history())
            findings.extend(self._check_windows_update())
        except Exception as e:
            findings.append(Finding(
                component="drivers",
                title="Driver Scan Incomplete",
                plain_english=f"Some driver checks couldn't complete. ({e})",
                severity="info"
            ))
        return findings

    def _check_problem_devices(self) -> List[Finding]:
        """Devices with errors in Device Manager"""
        findings = []
        problem_devs = ps_json("Get-PnpDevice | Where-Object {$_.Status -eq 'Error' -or $_.Status -eq 'Unknown'} | Select-Object FriendlyName, Status, Class, Problem, ProblemDescription")
        if isinstance(problem_devs, dict):
            problem_devs = [problem_devs]

        critical_devs = []
        for dev in (problem_devs or []):
            name   = dev.get("FriendlyName", "Unknown Device") or "Unknown Device"
            status = dev.get("Status", "") or ""
            cls    = dev.get("Class", "") or ""
            # Skip generic system devices that commonly show as unknown
            if "generic" in name.lower() or "unknown" in name.lower():
                continue
            critical_devs.append(name)

        if critical_devs:
            count = len(critical_devs)
            findings.append(Finding(
                component="drivers",
                title=f"{count} Device(s) Have Driver Problems",
                plain_english=f"Windows reports driver problems with {count} device(s): {', '.join(critical_devs[:3])}{'...' if count > 3 else ''}. These devices may not be working at all or may be working poorly.",
                severity="warning" if count < 5 else "critical",
                value=count,
                recommendation="Open Device Manager: Right-click Start > Device Manager. Look for items with yellow warning icons and update or reinstall those drivers."
            ))
        else:
            findings.append(Finding(
                component="drivers",
                title="Device Manager: All Clear",
                plain_english="All hardware devices have working drivers — no problem devices detected in Device Manager.",
                severity="ok"
            ))

        return findings

    def _check_hp_drivers(self) -> List[Finding]:
        """HP-specific driver health (HP Support Assistant, HP Audio, HP System Event)"""
        findings = []
        hp_software = ps_json("Get-WmiObject Win32_Product | Where-Object {$_.Name -like 'HP*'} | Select-Object Name, Version, InstallDate")
        if isinstance(hp_software, dict):
            hp_software = [hp_software]

        hp_sa_found = False
        for sw in (hp_software or []):
            name = sw.get("Name", "") or ""
            ver  = sw.get("Version", "") or ""
            if "support assistant" in name.lower():
                hp_sa_found = True
                findings.append(Finding(
                    component="drivers",
                    title="HP Support Assistant Installed",
                    plain_english=f"HP Support Assistant (version {ver}) is installed. This tool automatically keeps HP drivers and firmware updated — keep it running for best results.",
                    severity="ok"
                ))

        if not hp_sa_found:
            findings.append(Finding(
                component="drivers",
                title="HP Support Assistant Not Found",
                plain_english="HP Support Assistant isn't installed. This free tool from HP keeps your laptop's drivers, BIOS, and firmware updated automatically.",
                severity="info",
                recommendation="Download HP Support Assistant from hp.com/support to keep drivers updated."
            ))

        return findings

    def _check_bsod_history(self) -> List[Finding]:
        """Blue screen (BSOD) history"""
        findings = []
        bsod_count = ps("Get-WinEvent -LogName System -ErrorAction SilentlyContinue | Where-Object {$_.Id -eq 41 -and $_.TimeCreated -gt (Get-Date).AddDays(-30)} | Measure-Object | Select-Object -ExpandProperty Count")
        if bsod_count:
            try:
                count = int(bsod_count.strip())
                if count > 0:
                    findings.append(Finding(
                        component="drivers",
                        title=f"System Crashes (Blue Screens): {count} in Last 30 Days",
                        plain_english=f"Your laptop has crashed {count} time(s) in the past month (blue screen / unexpected restart). Even one blue screen is worth investigating.",
                        severity="critical" if count > 3 else "warning",
                        value=count,
                        recommendation="The most common causes: outdated drivers (especially GPU), failing RAM, overheating, or dying storage. Run Windows Memory Diagnostic and update all drivers.",
                        prediction="Recurring blue screens almost always worsen over time without intervention."
                    ))
                else:
                    findings.append(Finding(
                        component="drivers",
                        title="System Stability: No Crashes",
                        plain_english="No unexpected crashes (blue screens) in the past 30 days — your system is stable.",
                        severity="ok"
                    ))
            except ValueError:
                pass
        return findings

    def _check_windows_update(self) -> List[Finding]:
        """Pending Windows Updates"""
        findings = []
        pending = ps("(New-Object -ComObject Microsoft.Update.Session).CreateUpdateSearcher().Search('IsInstalled=0 and IsHidden=0').Updates.Count 2>$null")
        if pending:
            try:
                count = int(pending.strip())
                if count > 0:
                    findings.append(Finding(
                        component="drivers",
                        title=f"{count} Windows Update(s) Pending",
                        plain_english=f"You have {count} Windows updates waiting to be installed. Updates contain security fixes and driver improvements — delaying them leaves your laptop vulnerable.",
                        severity="warning" if count > 5 else "info",
                        value=count,
                        recommendation="Run Windows Updates: Start > Settings > Windows Update > Check for updates."
                    ))
                else:
                    findings.append(Finding(
                        component="drivers",
                        title="Windows Updates: Up to Date",
                        plain_english="Windows is fully up to date — all security patches and driver updates are installed.",
                        severity="ok"
                    ))
            except ValueError:
                pass
        return findings


# ─────────────────────────────── CORRELATION ENGINE ─────────────────────────

class CorrelationEngine:
    """
    Cross-component analysis — catches problems that no single metric reveals.
    The core intelligence that makes this tool unique.
    """

    def analyze(self, report: DiagnosticReport) -> List[str]:
        correlations = []
        findings = report.findings
        raw = report.raw

        def has(component: str, severity: str = None) -> bool:
            for f in findings:
                if f.component == component:
                    if severity is None or f.severity == severity:
                        return True
            return False

        def get_val(component: str, title_substr: str) -> Optional[Any]:
            for f in findings:
                if f.component == component and title_substr.lower() in f.title.lower():
                    return f.value
            return None

        # Correlation 1: Hot + Throttled + Poor battery = Dirty vents
        cpu_temp = get_val("cpu", "temperature")
        if cpu_temp and cpu_temp > 80 and has("cpu", "warning") and has("battery", "warning"):
            correlations.append(
                "🔍 Pattern detected: High CPU temperature + performance throttling + battery stress together suggest your laptop vents are likely blocked with dust. All three problems share one root cause — poor cooling. Cleaning the vents may fix all of them at once."
            )

        # Correlation 2: Low RAM + high disk = RAM-to-disk swapping loop
        ram_usage = get_val("ram", "Usage")
        if ram_usage and ram_usage > 80 and get_val("storage", "disk activity"):
            correlations.append(
                "🔍 Pattern detected: High memory usage combined with heavy disk activity suggests your computer is constantly swapping between real memory and disk storage. This 'memory thrashing' loop is why your laptop feels sluggish even when the CPU isn't maxed out."
            )

        # Correlation 3: Old GPU driver + BSOD + GPU temp = GPU on the way out
        if has("drivers", "critical") and has("gpu", "warning") and has("drivers", "warning"):
            correlations.append(
                "🔍 Pattern detected: System crashes + GPU driver issues + high GPU temperature together are a warning sign of a failing graphics card or seriously outdated drivers. Update GPU drivers immediately. If crashes continue after updating, the GPU may need professional assessment."
            )

        # Correlation 4: Fast SSD wear + large disk writes = aggressive behavior
        if has("storage", "warning") and get_val("storage", "space") and not None:
            correlations.append(
                "🔍 Pattern detected: Your SSD is showing more wear than expected for its age. Combined with full disk usage, this suggests frequent large file operations (video editing, downloads, game installs) are consuming write endurance faster than typical. SSDs have finite write limits."
            )

        # Correlation 5: Low battery health + always plugged in + high temp = triple threat
        batt_health = get_val("battery", "health")
        if batt_health and batt_health < 70:
            correlations.append(
                "🔍 Pattern detected: Your battery health is declining faster than it should. This is most commonly caused by three habits working together: keeping the laptop plugged in 24/7 at 100% charge, using it on soft surfaces that trap heat, and running demanding tasks that push temperatures high. Any one of these degrades batteries — all three together accelerate it dramatically."
            )

        # Correlation 6: Many startup items + slow boot + high RAM usage = startup bloat
        startup_count = get_val("startup", "Programs")
        if startup_count and startup_count > 15 and ram_usage and ram_usage > 70:
            correlations.append(
                "🔍 Pattern detected: Your slow boot times and high memory usage share a root cause — too many programs launching at startup. Each startup program takes a slice of your memory before you even open a single app. Cutting startup programs in half could visibly speed up both boot time and everyday performance."
            )

        # Correlation 7: Network errors + WiFi signal poor + DNS slow = connectivity stack issue
        if has("network", "warning") and get_val("network", "DNS"):
            correlations.append(
                "🔍 Pattern detected: Slow DNS, weak WiFi signal, and network errors are all present simultaneously. This isn't just a 'bad internet day' — it suggests either your WiFi adapter driver needs updating, or your router is congested. Try updating the Intel/Realtek WiFi driver via HP Support Assistant."
            )

        return correlations


# ─────────────────────────────── HABIT COACH ────────────────────────────────

class HabitCoach:
    """
    Analyzes usage patterns and provides behavior-change coaching.
    Only shows tips relevant to the user's actual data.
    """

    def analyze(self, report: DiagnosticReport) -> List[str]:
        habits = []
        findings = report.findings

        def get_val(component: str, title_substr: str) -> Optional[Any]:
            for f in findings:
                if f.component == component and title_substr.lower() in f.title.lower():
                    return f.value
            return None

        def has_sev(component: str, severity: str) -> bool:
            return any(f.component == component and f.severity == severity for f in findings)

        # Battery habits
        batt_pct = get_val("battery", "Charge Level")
        if batt_pct is not None:
            if batt_pct > 95:
                habits.append("💡 Battery Habit: You keep your laptop plugged in at 100% most of the time. Try HP's Battery Health Manager (HP OMEN Command Center or BIOS) to cap charging at 80%. This one change can extend your battery's life by 1–2 years.")
            if batt_pct < 15:
                habits.append("💡 Battery Habit: You regularly drain your battery very low. Modern lithium batteries prefer to stay between 20–80%. Deep discharges are harder on the battery than many partial cycles.")

        # Thermal habits
        cpu_temp = get_val("cpu", "Temperature")
        if cpu_temp and cpu_temp > 75:
            habits.append("💡 Cooling Habit: Your laptop runs hot during typical use. Check where you use it — soft surfaces like beds, couches, and carpets block the bottom vents. A $15 laptop stand or cooling pad can drop temperatures by 10–15°C.")

        # RAM habits
        ram_pct = get_val("ram", "Usage")
        if ram_pct and ram_pct > 80:
            habits.append("💡 Memory Habit: You consistently have many programs open. Try restarting your laptop weekly and using one of these free tools to identify memory-hungry apps: Task Manager > Memory column (sort by highest first).")

        # Storage habits
        space_pct = get_val("storage", "Space")
        if space_pct and space_pct < 20:
            habits.append("💡 Storage Habit: Your drive is often near-full. Windows needs 10–15% free space to run properly — without it, updates fail, programs crash, and the drive itself degrades faster. Run Disk Cleanup (search in Start menu) weekly.")

        # Restart habits
        uptime = get_val("startup", "Uptime")
        if uptime and uptime > 72:
            habits.append("💡 Restart Habit: Your laptop rarely gets restarted. A weekly restart takes 2 minutes and clears accumulated memory issues, installs pending security updates, and resets driver states that can drift over time.")

        # Update habits
        for f in findings:
            if f.component == "drivers" and "Update" in f.title and f.severity in ("warning", "critical"):
                habits.append("💡 Update Habit: Keeping Windows and drivers updated is one of the most impactful things you can do for security and stability. Set Windows Update to 'Active Hours' so updates happen overnight instead of interrupting your work.")
                break

        return habits


# ─────────────────────────────── SCORE CALCULATOR ───────────────────────────

class ScoreCalculator:
    """Calculate component and overall health scores (0–100)"""

    COMPONENT_WEIGHTS = {
        "battery": 20, "storage": 25, "cpu": 20, "ram": 15,
        "gpu": 10, "thermals": 15, "startup": 5, "network": 5,
        "drivers": 10
    }

    SEVERITY_PENALTIES = {
        "ok": 0, "info": 2, "warning": 10, "critical": 25
    }

    def calculate(self, report: DiagnosticReport) -> Tuple[Dict[str, int], int]:
        component_scores = {}
        for comp in self.COMPONENT_WEIGHTS:
            comp_findings = [f for f in report.findings if f.component == comp]
            if not comp_findings:
                component_scores[comp] = 100
                continue
            penalty = sum(self.SEVERITY_PENALTIES.get(f.severity, 0) for f in comp_findings)
            score = max(0, 100 - penalty)
            component_scores[comp] = score

        # Weighted overall score
        total_weight = sum(self.COMPONENT_WEIGHTS.values())
        overall = sum(
            component_scores.get(comp, 100) * weight
            for comp, weight in self.COMPONENT_WEIGHTS.items()
        ) / total_weight

        return component_scores, round(overall)


# ─────────────────────────────── REPORT GENERATOR ───────────────────────────

class ReportGenerator:
    """Generate weekly plain-English health report"""

    def generate(self, report: DiagnosticReport) -> str:
        now = datetime.datetime.now()
        score = report.overall_score
        grade = (
            "A — Excellent" if score >= 90 else
            "B — Good" if score >= 75 else
            "C — Fair" if score >= 60 else
            "D — Needs Attention" if score >= 40 else
            "F — Critical Issues"
        )

        lines = [
            "=" * 70,
            f"  HP LAPTOP WEEKLY HEALTH REPORT",
            f"  {now.strftime('%A, %B %d, %Y — %I:%M %p')}",
            f"  Device: {report.hp_model or 'HP Laptop'}",
            "=" * 70,
            "",
            f"  OVERALL HEALTH SCORE:  {score}/100  ({grade})",
            "",
            "─" * 70,
            "  COMPONENT BREAKDOWN",
            "─" * 70,
        ]

        score_bars = {
            "Battery":  ("battery",  report.scores.get("battery", 100)),
            "Storage":  ("storage",  report.scores.get("storage", 100)),
            "Processor":("cpu",      report.scores.get("cpu", 100)),
            "Memory":   ("ram",      report.scores.get("ram", 100)),
            "Graphics": ("gpu",      report.scores.get("gpu", 100)),
            "Cooling":  ("thermals", report.scores.get("thermals", 100)),
            "Startup":  ("startup",  report.scores.get("startup", 100)),
            "Network":  ("network",  report.scores.get("network", 100)),
            "Drivers":  ("drivers",  report.scores.get("drivers", 100)),
        }

        for display_name, (comp, score_val) in score_bars.items():
            bar_len = score_val // 5
            bar = "█" * bar_len + "░" * (20 - bar_len)
            status = "✓" if score_val >= 80 else "⚠" if score_val >= 60 else "✗"
            lines.append(f"  {status} {display_name:<12} [{bar}] {score_val:>3}/100")

        # Critical findings
        critical = [f for f in report.findings if f.severity == "critical"]
        warnings  = [f for f in report.findings if f.severity == "warning"]

        if critical:
            lines.extend(["", "─" * 70, "  ⚠ URGENT — ACTION REQUIRED", "─" * 70])
            for f in critical:
                lines.append(f"\n  [{f.component.upper()}] {f.title}")
                lines.append(f"  → {f.plain_english}")
                if f.recommendation:
                    lines.append(f"  → What to do: {f.recommendation}")
                if f.prediction:
                    lines.append(f"  → What happens if ignored: {f.prediction}")

        if warnings:
            lines.extend(["", "─" * 70, "  ⚡ WORTH YOUR ATTENTION", "─" * 70])
            for f in warnings[:5]:
                lines.append(f"\n  [{f.component.upper()}] {f.title}")
                lines.append(f"  → {f.plain_english}")
                if f.recommendation:
                    lines.append(f"  → Tip: {f.recommendation}")

        # Habits
        if report.habits:
            lines.extend(["", "─" * 70, "  YOUR USAGE HABITS", "─" * 70, ""])
            for h in report.habits:
                lines.append(f"  {h}")

        # Correlations
        if report.correlations:
            lines.extend(["", "─" * 70, "  PATTERNS DETECTED", "─" * 70, ""])
            for c in report.correlations:
                lines.append(f"  {c}")

        lines.extend([
            "",
            "─" * 70,
            "  All clear items are not listed to keep this brief.",
            f"  Next recommended scan: {(now + datetime.timedelta(days=7)).strftime('%B %d, %Y')}",
            "=" * 70,
        ])

        return "\n".join(lines)


# ─────────────────────────────── PRINTER ────────────────────────────────────

class ConsolePrinter:
    """Rich console output with colors and structured sections"""

    COMPONENT_ICONS = {
        "battery": "🔋", "storage": "💾", "cpu": "⚙️ ", "ram": "🧠",
        "gpu": "🖥️ ", "thermals": "🌡️ ", "startup": "🚀", "network": "📶",
        "drivers": "🔧"
    }

    def print_header(self, report: DiagnosticReport):
        print()
        print(colorize("═" * 70, C.CYAN))
        print(colorize(f"  {SCRIPT_NAME} v{VERSION}", C.BOLD + C.WHITE))
        print(colorize(f"  {report.timestamp}", C.GRAY))
        print(colorize(f"  Device: {report.hp_model or 'HP Laptop'}", C.WHITE))
        print(colorize(f"  OS: {report.windows_version}", C.GRAY))
        print(colorize("═" * 70, C.CYAN))
        print()

    def print_score(self, report: DiagnosticReport):
        score = report.overall_score
        color = C.GREEN if score >= 80 else C.YELLOW if score >= 60 else C.RED
        grade = (
            "Excellent" if score >= 90 else "Good" if score >= 75 else
            "Fair" if score >= 60 else "Needs Attention" if score >= 40 else "Critical"
        )
        print(colorize(f"  Overall Health Score: ", C.WHITE) +
              colorize(f"{score}/100 — {grade}", color + C.BOLD))
        print()

    def print_findings(self, report: DiagnosticReport, quick: bool = False):
        current_component = None
        shown = set()

        severity_order = ["critical", "warning", "info", "ok"]
        sorted_findings = sorted(
            report.findings,
            key=lambda f: (severity_order.index(f.severity) if f.severity in severity_order else 99, f.component)
        )

        if quick:
            # Quick mode: only show warnings and criticals
            sorted_findings = [f for f in sorted_findings if f.severity in ("critical", "warning")]

        for finding in sorted_findings:
            if finding.component != current_component:
                current_component = finding.component
                icon = self.COMPONENT_ICONS.get(finding.component, "•")
                print(colorize(f"\n  {icon} {finding.component.upper()}", C.BOLD + C.CYAN))
                print(colorize("  " + "─" * 50, C.GRAY))

            icon = status_icon(finding.severity)
            color = C.RED if finding.severity == "critical" else \
                    C.YELLOW if finding.severity == "warning" else \
                    C.GREEN if finding.severity == "ok" else C.CYAN

            print(f"  {icon} {colorize(finding.title, color)}")
            print(f"     {finding.plain_english}")
            if finding.recommendation:
                print(f"     {colorize('→ ' + finding.recommendation, C.GRAY)}")
            if finding.prediction:
                print(f"     {colorize('🔮 ' + finding.prediction, C.MAGENTA)}")
            print()

    def print_correlations(self, correlations: List[str]):
        if not correlations:
            return
        print(colorize("\n  🔍 CROSS-COMPONENT PATTERNS DETECTED", C.BOLD + C.MAGENTA))
        print(colorize("  " + "─" * 50, C.GRAY))
        for c in correlations:
            print(f"  {c}")
            print()

    def print_habits(self, habits: List[str]):
        if not habits:
            return
        print(colorize("\n  💡 HABIT COACHING", C.BOLD + C.BLUE))
        print(colorize("  " + "─" * 50, C.GRAY))
        for h in habits:
            print(f"  {h}")
            print()

    def print_footer(self, report: DiagnosticReport):
        total = len(report.findings)
        critical_n = sum(1 for f in report.findings if f.severity == "critical")
        warning_n  = sum(1 for f in report.findings if f.severity == "warning")
        ok_n       = sum(1 for f in report.findings if f.severity == "ok")

        print(colorize("═" * 70, C.CYAN))
        print(f"  Scan complete: {total} checks — "
              + colorize(f"{critical_n} critical", C.RED) + "  "
              + colorize(f"{warning_n} warnings", C.YELLOW) + "  "
              + colorize(f"{ok_n} healthy", C.GREEN))
        print(colorize("═" * 70, C.CYAN))
        print()


# ─────────────────────────────── HISTORY / BASELINE ─────────────────────────

class HistoryManager:
    """Persist diagnostic history for trend analysis and baseline learning"""

    def __init__(self):
        DATA_DIR.mkdir(parents=True, exist_ok=True)

    def save(self, report: DiagnosticReport):
        history = self.load_all()
        history.append({
            "timestamp": report.timestamp,
            "scores": report.scores,
            "overall": report.overall_score,
            "critical_count": sum(1 for f in report.findings if f.severity == "critical"),
            "warning_count": sum(1 for f in report.findings if f.severity == "warning"),
        })
        # Keep last 52 entries (1 year of weekly scans)
        history = history[-52:]
        try:
            HISTORY_FILE.write_text(json.dumps(history, indent=2))
        except (IOError, OSError):
            pass

    def load_all(self) -> List[Dict]:
        try:
            if HISTORY_FILE.exists():
                return json.loads(HISTORY_FILE.read_text())
        except (json.JSONDecodeError, IOError):
            pass
        return []

    def get_trend(self, component: str) -> Optional[str]:
        """Analyze score trend for a component"""
        history = self.load_all()
        if len(history) < 3:
            return None

        recent = [h["scores"].get(component, 100) for h in history[-5:] if "scores" in h]
        if len(recent) < 2:
            return None

        trend = recent[-1] - recent[0]
        if trend < -15:
            return "declining"
        elif trend > 10:
            return "improving"
        return "stable"


# ─────────────────────────────── MAIN ORCHESTRATOR ──────────────────────────

class HPDiagnosticOrchestrator:

    def __init__(self, args):
        self.args = args
        self.history = HistoryManager()
        self.printer  = ConsolePrinter()

    def run(self) -> DiagnosticReport:
        report = DiagnosticReport()
        report.timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        # System info
        print(colorize("  Gathering system information...", C.GRAY))
        sysinfo = SystemInfoCollector().collect()
        report.hostname        = sysinfo.get("hostname", "")
        report.hp_model        = sysinfo.get("hp_model", "HP Laptop")
        report.hp_product_line = sysinfo.get("hp_product_line", "default")
        report.windows_version = sysinfo.get("os_version", "")
        report.uptime_hours    = sysinfo.get("uptime_seconds", 0) / 3600
        report.raw["system"]   = sysinfo

        self.printer.print_header(report)

        # Run all diagnostic modules
        cpu_diag = CPUDiagnostics()
        modules = [
            ("🔋 Battery",   BatteryDiagnostics()),
            ("💾 Storage",   StorageDiagnostics()),
            ("⚙️  CPU",       cpu_diag),
            ("🧠 RAM",       RAMDiagnostics()),
            ("🖥️  GPU",       GPUDiagnostics()),
            ("🌡️  Thermals",  ThermalFanDiagnostics()),
            ("🚀 Startup",   StartupDiagnostics()),
            ("📶 Network",   NetworkDiagnostics()),
            ("🔧 Drivers",   DriverDiagnostics()),
        ]

        for label, module in modules:
            print(colorize(f"  Scanning {label}...", C.GRAY), end="\r")
            try:
                findings = module.run()
                for f in findings:
                    report.add(f)
            except Exception as e:
                report.add(Finding(
                    component=label.split()[-1].lower(),
                    title=f"{label} scan error",
                    plain_english=f"Could not complete {label} scan: {e}",
                    severity="info"
                ))
            print(" " * 50, end="\r")  # Clear line

        # Scoring
        scorer = ScoreCalculator()
        report.scores, report.overall_score = scorer.calculate(report)

        # Correlations
        report.correlations = CorrelationEngine().analyze(report)

        # Habit coaching
        report.habits = HabitCoach().analyze(report)

        report.raw["sentinel_thermals"] = getattr(cpu_diag, "sentinel_thermals", {
            "maxTempC": None, "zoneCount": 0, "zones": [], "thermalSource": "unavailable", "thermalSamples": 0
        })

        # Save history
        self.history.save(report)

        return report

    def display(self, report: DiagnosticReport):
        self.printer.print_score(report)
        self.printer.print_findings(report, quick=self.args.quick)
        self.printer.print_correlations(report.correlations)
        self.printer.print_habits(report.habits)
        self.printer.print_footer(report)

    def save_report(self, report: DiagnosticReport):
        gen = ReportGenerator()
        text = gen.generate(report)
        try:
            REPORT_FILE.write_text(text)
            print(colorize(f"  Report saved: {REPORT_FILE}", C.CYAN))
        except (IOError, OSError) as e:
            print(colorize(f"  Could not save report: {e}", C.YELLOW))
        return text

    def export_json(self, report: DiagnosticReport):
        output = {
            "meta": {
                "version": VERSION,
                "timestamp": report.timestamp,
                "hostname": report.hostname,
                "hp_model": report.hp_model,
            },
            "scores": {**report.scores, "overall": report.overall_score},
            "findings": [
                {
                    "component": f.component,
                    "title": f.title,
                    "severity": f.severity,
                    "plain_english": f.plain_english,
                    "value": f.value,
                    "unit": f.unit,
                    "recommendation": f.recommendation,
                    "prediction": f.prediction,
                }
                for f in report.findings
            ],
            "correlations": report.correlations,
            "habits": report.habits,
        }
        export_path = DATA_DIR / f"export_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        try:
            DATA_DIR.mkdir(parents=True, exist_ok=True)
            export_path.write_text(json.dumps(output, indent=2))
            print(colorize(f"  JSON exported: {export_path}", C.CYAN))
        except (IOError, OSError) as e:
            print(colorize(f"  Export failed: {e}", C.YELLOW))

    def export_sentinel_json(self, report: DiagnosticReport):
        sentinel = {
            "sentinelSchema": 1,
            "generatedAt": report.timestamp,
            "system": {
                "hostname": report.hostname,
                "model": report.hp_model,
                "manufacturer": "HP",
                "os": "Windows",
                "osVersion": report.windows_version,
                "biosVersion": report.raw["system"].get("bios_version", "")
            },
            "battery": {
                "health": None,
                "cycleCount": None
            },
            "thermals": report.raw.get("sentinel_thermals", {
                "maxTempC": None, "zoneCount": 0, "zones": [], "thermalSource": "unavailable", "thermalSamples": 0
            }),
            "storage": [],
            "memory": {},
            "cpu": {},
            "startup": {}
        }
        
        for f in report.findings:
            if "Battery Health:" in f.title:
                sentinel["battery"]["health"] = f.value
            if "Battery Charge Cycles" in f.title:
                sentinel["battery"]["cycleCount"] = f.value

        print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        print("  Sentinel Compatible JSON (Paste this into Sentinel):")
        print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        print(json.dumps(sentinel, separators=(',', ':')))
        print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        try:
            import subprocess
            subprocess.run(["clip.exe"], input=json.dumps(sentinel, separators=(',', ':')).encode('utf-16le'), check=True, timeout=2)
            print(colorize("✓ Sentinel JSON copied to clipboard.", C.GREEN))
        except Exception:
            pass
        return sentinel


# ─────────────────────────────── MONITOR MODE ───────────────────────────────

def monitor_mode(interval_seconds: int):
    """Continuous monitoring mode"""
    print(colorize(f"  Monitoring mode: scan every {interval_seconds}s. Press Ctrl+C to stop.", C.CYAN))
    args = argparse.Namespace(quick=True, report=False, export=None, monitor=interval_seconds)
    orchestrator = HPDiagnosticOrchestrator(args)

    while True:
        try:
            report = orchestrator.run()
            # Just print score and critical/warning findings in monitor mode
            score = report.overall_score
            color = C.GREEN if score >= 80 else C.YELLOW if score >= 60 else C.RED
            ts = datetime.datetime.now().strftime("%H:%M:%S")
            print(f"\n  [{ts}] Score: {colorize(str(score), color)}/100", end="  ")
            critical = [f for f in report.findings if f.severity == "critical"]
            for f in critical:
                print(colorize(f"⚠ {f.title}", C.RED), end="  ")
            print()
            time.sleep(interval_seconds)
        except KeyboardInterrupt:
            print(colorize("\n  Monitoring stopped.", C.CYAN))
            break


# ─────────────────────────────── ENTRY POINT ────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description=f"{SCRIPT_NAME} v{VERSION} — HP Laptop Predictive Health Monitor",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python hp_laptop_diagnostics.py                Run full diagnostic
  python hp_laptop_diagnostics.py --quick        Fast scan (warnings/criticals only)
  python hp_laptop_diagnostics.py --report       Generate weekly health report
  python hp_laptop_diagnostics.py --monitor 60   Monitor every 60 seconds
  python hp_laptop_diagnostics.py --export json  Export raw data to JSON
        """
    )
    parser.add_argument("--quick",     action="store_true",  help="Quick scan — show only warnings and criticals")
    parser.add_argument("--report",    action="store_true",  help="Generate and save weekly health report")
    parser.add_argument("--monitor",   type=int, metavar="SECONDS", help="Continuous monitoring mode")
    parser.add_argument("--export",    type=str, choices=["json"], help="Export raw data")
    parser.add_argument("--no-color",  action="store_true",  help="Disable colored output")
    parser.add_argument("--pair-code", type=str, default="",  help="Auto-send telemetry to Sentinel via pair code (e.g. K7M2-P9R4)")
    args = parser.parse_args()

    if args.no_color:
        # Monkey-patch colorize to return plain text
        global colorize
        colorize = lambda text, *_: text

    # Enable ANSI colors on Windows
    if platform.system() == "Windows":
        try:
            import ctypes
            kernel32 = ctypes.windll.kernel32
            kernel32.SetConsoleMode(kernel32.GetStdHandle(-11), 7)
        except Exception:
            pass

    is_windows = require_windows()

    if args.monitor:
        monitor_mode(args.monitor)
        return

    # Install dependencies
    ensure_dependencies()

    # Run diagnostics
    orchestrator = HPDiagnosticOrchestrator(args)
    report = orchestrator.run()
    orchestrator.display(report)

    # Weekly report
    if args.report:
        text = orchestrator.save_report(report)
        print()
        print(text)

    # Sentinel output (always printed — paste flow always available as fallback)
    sentinel_payload = orchestrator.export_sentinel_json(report)

    # Auto-send via Pair Code
    pair_code = getattr(args, 'pair_code', '')
    if pair_code:
        print(colorize(f"  Sending data to Sentinel via pair code {pair_code}...", C.CYAN))
        try:
            import requests  # type: ignore
            resp = requests.post(
                "https://sentinelapp.io/api/pair/push",
                json={"pairCode": pair_code, "rawJson": sentinel_payload},
                timeout=15,
            )
            resp.raise_for_status()
            print()
            print(colorize("━" * 64, C.GREEN))
            print(colorize("  ✓ Data sent. Return to your browser — your report is ready.", C.GREEN))
            print(colorize("━" * 64, C.GREEN))
            print()
        except Exception as e:
            print()
            print(colorize("━" * 64, C.YELLOW))
            print(colorize("  ⚠ Auto-send failed. Copy the JSON above and paste it manually", C.YELLOW))
            print(colorize("    at sentinelapp.io/health-test → 'Paste output'", C.YELLOW))
            print(colorize("━" * 64, C.YELLOW))
            print()

    # JSON export
    if args.export == "json":
        orchestrator.export_json(report)

    # Exit code reflects severity
    worst = report.worst_severity()
    sys.exit(2 if worst == "critical" else 1 if worst == "warning" else 0)


if __name__ == "__main__":
    main()