# ============================================================
# LENOVO LAPTOP COMPREHENSIVE DIAGNOSTIC SCRIPT
# Covers: ThinkPad, IdeaPad, Yoga, Legion, LOQ, ThinkBook
# Models: 2019-2024 | Windows 10/11
# Purpose: Data collection for predictive health AI app
# ============================================================
# Run as Administrator in PowerShell:
# Right-click PowerShell > Run as Administrator
# Then paste this entire script
# ============================================================

param([string]$PairCode = "")

$SENTINEL_BASE_URL = "https://sentinelapp.io"

$ErrorActionPreference = "SilentlyContinue"
$reportPath = "$env:USERPROFILE\Desktop\Lenovo_Diagnostic_Report_$(Get-Date -Format 'yyyyMMdd_HHmmss').txt"
$jsonPath   = "$env:USERPROFILE\Desktop\Lenovo_Diagnostic_Data_$(Get-Date -Format 'yyyyMMdd_HHmmss').json"
$diagData   = @{}

function Write-Section($title) {
    $line = "=" * 70
    Write-Host "`n$line" -ForegroundColor Cyan
    Write-Host "  $title" -ForegroundColor Yellow
    Write-Host "$line" -ForegroundColor Cyan
}

function Write-Item($label, $value, $status = "INFO") {
    $color = switch ($status) {
        "OK"      { "Green"  }
        "WARN"    { "Yellow" }
        "CRIT"    { "Red"    }
        default   { "White"  }
    }
    Write-Host "  [$status] $label : $value" -ForegroundColor $color
}

function Safe-WMI($class, $ns = "root\cimv2") {
    try { Get-WmiObject -Class $class -Namespace $ns -ErrorAction Stop }
    catch { $null }
}

function Safe-CIM($class, $ns = "root\cimv2") {
    try { Get-CimInstance -ClassName $class -Namespace $ns -ErrorAction Stop }
    catch { $null }
}

Write-Host "`n  LENOVO LAPTOP DIAGNOSTIC - Starting full scan..." -ForegroundColor Magenta
Write-Host "  This may take 2-5 minutes. Please wait." -ForegroundColor Gray
Write-Host "  Report will be saved to your Desktop.`n" -ForegroundColor Gray

# ============================================================
# SECTION 1: SYSTEM IDENTITY & LENOVO MODEL DETECTION
# ============================================================
Write-Section "1. SYSTEM IDENTITY & LENOVO MODEL"

$cs         = Safe-CIM "Win32_ComputerSystem"
$bios       = Safe-CIM "Win32_BIOS"
$baseboard  = Safe-CIM "Win32_BaseBoard"
$os         = Safe-CIM "Win32_OperatingSystem"
$enclosure  = Safe-CIM "Win32_SystemEnclosure"

$manufacturer = $cs.Manufacturer
$model        = $cs.Model
$serialNumber = $bios.SerialNumber
$biosVersion  = $bios.SMBIOSBIOSVersion
$biosDate     = $bios.ReleaseDate
$pcType       = $enclosure.ChassisTypes

# Detect Lenovo product line
$productLine = "Unknown Lenovo"
if ($model -match "ThinkPad")   { $productLine = "ThinkPad"   }
elseif ($model -match "IdeaPad"){ $productLine = "IdeaPad"    }
elseif ($model -match "Yoga")   { $productLine = "Yoga"       }
elseif ($model -match "Legion") { $productLine = "Legion"     }
elseif ($model -match "LOQ")    { $productLine = "LOQ"        }
elseif ($model -match "ThinkBook"){ $productLine = "ThinkBook"}
elseif ($model -match "V\d|E\d|S\d"){ $productLine = "Lenovo V/E/S Series" }

Write-Item "Manufacturer"   $manufacturer
Write-Item "Model"          $model
Write-Item "Product Line"   $productLine
Write-Item "Serial Number"  $serialNumber
Write-Item "BIOS Version"   $biosVersion
Write-Item "BIOS Date"      $biosDate
Write-Item "OS"             "$($os.Caption) Build $($os.BuildNumber)"
Write-Item "OS Install Date" $os.InstallDate
Write-Item "Last Boot"      $os.LastBootUpTime

$diagData.SystemIdentity = @{
    Manufacturer = $manufacturer; Model = $model; ProductLine = $productLine
    SerialNumber = $serialNumber; BIOSVersion = $biosVersion; BIOSDate = "$biosDate"
    OS = $os.Caption; OSBuild = $os.BuildNumber; LastBoot = "$($os.LastBootUpTime)"
}

# BIOS age check (critical for Lenovo — old BIOS = battery/thermal bugs)
if ($biosDate) {
    $biosAge = (New-TimeSpan -Start ([Management.ManagementDateTimeConverter]::ToDateTime($biosDate)) -End (Get-Date)).Days
    $biosAgeMonths = [math]::Round($biosAge / 30)
    $biosStatus = if ($biosAge -gt 730) { "WARN" } else { "OK" }
    Write-Item "BIOS Age" "$biosAgeMonths months" $biosStatus
    if ($biosAge -gt 730) {
        Write-Host "    >> BIOS is over 2 years old. Check Lenovo Vantage for firmware updates." -ForegroundColor Yellow
    }
    $diagData.SystemIdentity.BIOSAgeMonths = $biosAgeMonths
}

# ============================================================
# SECTION 2: BATTERY HEALTH (Full Lenovo-specific analysis)
# ============================================================
Write-Section "2. BATTERY HEALTH"

# Primary battery via WMI
$batteries = Safe-WMI "Win32_Battery"
$batteryFull = @()

foreach ($bat in $batteries) {
    $status  = $bat.BatteryStatus
    $charge  = $bat.EstimatedChargeRemaining
    $statusText = switch ($status) {
        1 { "Discharging" } 2 { "AC - Fully Charged" } 3 { "Fully Charged" }
        4 { "Low" } 5 { "Critical" } 6 { "Charging" } 7 { "Charging+High" }
        8 { "Charging+Low" } 9 { "Charging+Critical" } 10 { "Undefined" }
        11 { "Partially Charged" } default { "Unknown ($status)" }
    }
    Write-Item "Battery Status"  $statusText
    Write-Item "Charge Level"    "$charge%"    $(if ($charge -lt 20) { "WARN" } else { "OK" })
    Write-Item "Estimated Life"  "$($bat.EstimatedRunTime) min"
    Write-Item "Chemistry"       $bat.Chemistry
    Write-Item "Voltage"         "$($bat.DesignVoltage) mV"
    $batteryFull += @{ Status = $statusText; Charge = $charge; RunTime = $bat.EstimatedRunTime }
}

# Deep battery data via CIM BatteryFullChargedCapacity
$batteryStatic  = Safe-CIM "BatteryFullChargedCapacity"  "root\wmi"
$batteryStatus2 = Safe-CIM "BatteryStatus"               "root\wmi"
$batteryCycle   = Safe-CIM "BatteryCycleCount"           "root\wmi"
$batteryTemp    = Safe-CIM "MSBatteryClass"              "root\wmi"

if ($batteryStatic) {
    $designCap     = $batteryStatic.DesignedCapacity
    $fullChargeCap = $batteryStatic.FullChargedCapacity
    if ($designCap -gt 0) {
        $healthPct = [math]::Round(($fullChargeCap / $designCap) * 100, 1)
        $healthStatus = if ($healthPct -lt 60) { "CRIT" } elseif ($healthPct -lt 80) { "WARN" } else { "OK" }
        Write-Item "Battery Design Capacity"      "$designCap mWh"
        Write-Item "Battery Full Charge Capacity" "$fullChargeCap mWh"
        Write-Item "Battery Health"               "$healthPct%" $healthStatus
        if ($healthPct -lt 60) { Write-Host "    >> CRITICAL: Battery health below 60%. Replace soon." -ForegroundColor Red }
        elseif ($healthPct -lt 80) { Write-Host "    >> WARNING: Battery degraded. Monitor closely." -ForegroundColor Yellow }
        $diagData.Battery = @{ DesignCapacity = $designCap; FullChargeCapacity = $fullChargeCap; HealthPct = $healthPct }
    }
}

if ($batteryCycle) {
    $cycles = $batteryCycle.CycleCount
    $cycleStatus = if ($cycles -gt 800) { "CRIT" } elseif ($cycles -gt 500) { "WARN" } else { "OK" }
    Write-Item "Battery Cycle Count" $cycles $cycleStatus
    if ($cycles -gt 800) { Write-Host "    >> Over 800 cycles — battery near end of rated life." -ForegroundColor Red }
    $diagData.Battery.CycleCounts = $cycles
}

if ($batteryStatus2) {
    Write-Item "Charging"           $batteryStatus2.Charging
    Write-Item "Discharging"        $batteryStatus2.Discharging
    Write-Item "Power Online"       $batteryStatus2.PowerOnline
    Write-Item "Discharge Rate"     "$($batteryStatus2.DischargeRate) mW"
    Write-Item "Charge Rate"        "$($batteryStatus2.ChargeRate) mW"
    Write-Item "Remaining Capacity" "$($batteryStatus2.RemainingCapacity) mWh"
    $diagData.Battery.DischargeRate = $batteryStatus2.DischargeRate
    $diagData.Battery.ChargeRate    = $batteryStatus2.ChargeRate
    $diagData.Battery.Remaining     = $batteryStatus2.RemainingCapacity
}

# Generate battery report for trend data
Write-Host "`n  Generating Windows battery report (this takes ~20 seconds)..." -ForegroundColor Gray
$batteryReportPath = "$env:TEMP\battery_report_lenovo.html"
powercfg /batteryreport /output $batteryReportPath 2>$null
if (Test-Path $batteryReportPath) {
    $battContent = Get-Content $batteryReportPath -Raw
    # Extract cycle count from report as backup
    if ($battContent -match 'CYCLE COUNT.*?(\d+)') {
        Write-Item "Battery Report Cycle Count (Backup)" $Matches[1]
    }
    Write-Host "    Full battery report saved: $batteryReportPath" -ForegroundColor Gray
    $diagData.Battery.ReportPath = $batteryReportPath
}

# Lenovo-specific: Check conservation mode via registry
$conservationKey = "HKLM:\SYSTEM\CurrentControlSet\Services\ibmpmsvc\Parameters\Tablet"
if (Test-Path $conservationKey) {
    $conservation = (Get-ItemProperty $conservationKey -ErrorAction SilentlyContinue).ConservationMode
    Write-Item "Lenovo Conservation Mode" $(if ($conservation -eq 1) { "ENABLED (charging capped ~60%)" } else { "DISABLED" })
}

# Lenovo Vantage battery threshold via WMI
$lenovoBatt = Get-WmiObject -Namespace "root\WMI" -Class "LENOVO_BATT_CHARGE_THRESHOLD" -ErrorAction SilentlyContinue
if ($lenovoBatt) {
    Write-Item "Lenovo Charge Start Threshold" "$($lenovoBatt.StartCapacity)%"
    Write-Item "Lenovo Charge Stop Threshold"  "$($lenovoBatt.StopCapacity)%"
    $diagData.Battery.ChargeStartThreshold = $lenovoBatt.StartCapacity
    $diagData.Battery.ChargeStopThreshold  = $lenovoBatt.StopCapacity
}

# ============================================================
# SECTION 3: SSD / STORAGE HEALTH
# ============================================================
Write-Section "3. SSD / STORAGE HEALTH"

$disks = Safe-CIM "Win32_DiskDrive"
$diagData.Storage = @()

foreach ($disk in $disks) {
    Write-Host "`n  --- Drive: $($disk.Model) ---" -ForegroundColor White
    $sizeGB = [math]::Round($disk.Size / 1GB, 1)
    Write-Item "Model"        $disk.Model
    Write-Item "Size"         "$sizeGB GB"
    Write-Item "Interface"    $disk.InterfaceType
    Write-Item "Serial"       $disk.SerialNumber
    Write-Item "Firmware"     $disk.FirmwareRevision
    Write-Item "Partitions"   $disk.Partitions
    Write-Item "Status"       $disk.Status $(if ($disk.Status -eq "OK") { "OK" } else { "CRIT" })

    $diskEntry = @{
        Model = $disk.Model; SizeGB = $sizeGB; Interface = $disk.InterfaceType
        Serial = $disk.SerialNumber; Status = $disk.Status
    }

    # SMART data via CIM (works on NVMe and SATA)
    $smartStatus = Safe-CIM "MSFT_StorageReliabilityCounter" "root\microsoft\windows\storage"
    if ($smartStatus) {
        foreach ($smart in $smartStatus) {
            if ($smart.DeviceId -like "*$($disk.SerialNumber.Trim())*" -or $smartStatus.Count -eq 1) {
                Write-Item "SMART Wear Level"           "$($smart.Wear)%"      $(if ($smart.Wear -gt 80) { "CRIT" } elseif ($smart.Wear -gt 50) { "WARN" } else { "OK" })
                Write-Item "SMART Temperature"          "$($smart.Temperature) C" $(if ($smart.Temperature -gt 65) { "CRIT" } elseif ($smart.Temperature -gt 55) { "WARN" } else { "OK" })
                Write-Item "SMART Read Errors"          $smart.ReadErrorsTotal
                Write-Item "SMART Write Errors"         $smart.WriteErrorsTotal
                Write-Item "SMART Power On Hours"       $smart.PowerOnHours
                Write-Item "SMART Power Cycle Count"    $smart.PowerCycleCount
                Write-Item "SMART Reallocated Sectors"  $smart.ReadErrorsCorrected
                $diskEntry.SMARTWear = $smart.Wear
                $diskEntry.SMARTTemp = $smart.Temperature
                $diskEntry.PowerOnHours = $smart.PowerOnHours
            }
        }
    }

    # Logical disk info
    $partitions = Get-WmiObject -Query "ASSOCIATORS OF {Win32_DiskDrive.DeviceID='$($disk.DeviceID)'} WHERE AssocClass=Win32_DiskDriveToDiskPartition" -ErrorAction SilentlyContinue
    foreach ($part in $partitions) {
        $logicals = Get-WmiObject -Query "ASSOCIATORS OF {Win32_DiskPartition.DeviceID='$($part.DeviceID)'} WHERE AssocClass=Win32_LogicalDiskToPartition" -ErrorAction SilentlyContinue
        foreach ($ld in $logicals) {
            $freeGB   = [math]::Round($ld.FreeSpace / 1GB, 1)
            $totalGB  = [math]::Round($ld.Size / 1GB, 1)
            $usedPct  = if ($totalGB -gt 0) { [math]::Round((($totalGB - $freeGB) / $totalGB) * 100, 1) } else { 0 }
            $spStatus = if ($usedPct -gt 90) { "CRIT" } elseif ($usedPct -gt 80) { "WARN" } else { "OK" }
            Write-Item "  Drive $($ld.DeviceID)" "Total: $totalGB GB | Free: $freeGB GB | Used: $usedPct%" $spStatus
            if ($usedPct -gt 90) { Write-Host "      >> Drive over 90% full — SSD performance degrades above 90%." -ForegroundColor Red }
            $diskEntry.FreeSpacePct = 100 - $usedPct
        }
    }

    $diagData.Storage += $diskEntry
}

# Disk reliability events
$diskErrors = Get-WinEvent -FilterHashtable @{LogName='System'; ProviderName='disk'; Level=2} -MaxEvents 20 -ErrorAction SilentlyContinue
Write-Item "Disk Error Events (last 20)" $diskErrors.Count $(if ($diskErrors.Count -gt 5) { "CRIT" } elseif ($diskErrors.Count -gt 0) { "WARN" } else { "OK" })
$diagData.DiskErrorEventCount = $diskErrors.Count

# ============================================================
# SECTION 4: CPU HEALTH & PERFORMANCE
# ============================================================
Write-Section "4. CPU HEALTH & PERFORMANCE"

$cpu = Safe-CIM "Win32_Processor"
$cpuPerf = Safe-CIM "Win32_PerfFormattedData_PerfOS_Processor" | Where-Object { $_.Name -eq "_Total" }

$cpuName   = $cpu.Name
$cpuCores  = $cpu.NumberOfCores
$cpuLogical= $cpu.NumberOfLogicalProcessors
$cpuSpeed  = $cpu.CurrentClockSpeed
$cpuMax    = $cpu.MaxClockSpeed
$cpuLoad   = $cpu.LoadPercentage
$cpuVolt   = $cpu.CurrentVoltage

Write-Item "CPU Model"            $cpuName
Write-Item "Cores / Threads"      "$cpuCores / $cpuLogical"
Write-Item "Current Speed"        "$cpuSpeed MHz"
Write-Item "Max Speed"            "$cpuMax MHz"
Write-Item "Current Load"         "$cpuLoad%" $(if ($cpuLoad -gt 90) { "WARN" } else { "OK" })
Write-Item "Current Voltage"      "$($cpuVolt / 10) V"

# CPU throttling detection
$throttle = Get-WinEvent -FilterHashtable @{LogName='System'; Id=37} -MaxEvents 10 -ErrorAction SilentlyContinue
Write-Item "CPU Thermal Throttle Events" $throttle.Count $(if ($throttle.Count -gt 3) { "WARN" } else { "OK" })
if ($throttle.Count -gt 3) { Write-Host "    >> CPU has been throttling — possible heat or power delivery issue." -ForegroundColor Yellow }

# CPU temperatures via Open Hardware Monitor WMI (if installed)
$cpuTemps = Get-WmiObject -Namespace "root\OpenHardwareMonitor" -Class Sensor -ErrorAction SilentlyContinue | Where-Object { $_.SensorType -eq "Temperature" -and $_.Name -like "*CPU*" }
if ($cpuTemps) {
    foreach ($t in $cpuTemps) {
        $tStatus = if ($t.Value -gt 95) { "CRIT" } elseif ($t.Value -gt 85) { "WARN" } else { "OK" }
        Write-Item "CPU Temp ($($t.Name))" "$($t.Value) C" $tStatus
    }
}

# Processor performance counters
$procCounters = @(
    "\Processor(_Total)\% Processor Time",
    "\Processor(_Total)\% Privileged Time",
    "\Processor(_Total)\% Interrupt Time",
    "\Processor(_Total)\% DPC Time"
)
$counterData = Get-Counter -Counter $procCounters -SampleInterval 2 -MaxSamples 1 -ErrorAction SilentlyContinue
if ($counterData) {
    foreach ($sample in $counterData.CounterSamples) {
        $val = [math]::Round($sample.CookedValue, 1)
        $cName = ($sample.Path -split '\\')[-1]
        Write-Item $cName "$val%"
    }
}

$diagData.CPU = @{
    Model = $cpuName; Cores = $cpuCores; Threads = $cpuLogical
    CurrentMHz = $cpuSpeed; MaxMHz = $cpuMax; LoadPct = $cpuLoad
    ThrottleEvents = $throttle.Count
}

# ============================================================
# SECTION 5: RAM / MEMORY HEALTH
# ============================================================
Write-Section "5. RAM / MEMORY HEALTH"

$memPhys  = Safe-CIM "Win32_PhysicalMemory"
$os2      = Safe-CIM "Win32_OperatingSystem"
$memPerf  = Safe-CIM "Win32_PerfFormattedData_PerfOS_Memory"

$totalRamGB    = [math]::Round($os2.TotalVisibleMemorySize / 1MB, 1)
$freeRamGB     = [math]::Round($os2.FreePhysicalMemory / 1MB, 1)
$usedRamGB     = [math]::Round($totalRamGB - $freeRamGB, 1)
$ramUsedPct    = [math]::Round(($usedRamGB / $totalRamGB) * 100, 1)
$pageFileTotalGB = [math]::Round($os2.TotalVirtualMemorySize / 1MB, 1)
$pageFileFreeGB  = [math]::Round($os2.FreeVirtualMemory / 1MB, 1)

Write-Item "Total RAM"          "$totalRamGB GB"
Write-Item "Used RAM"           "$usedRamGB GB ($ramUsedPct%)" $(if ($ramUsedPct -gt 90) { "CRIT" } elseif ($ramUsedPct -gt 80) { "WARN" } else { "OK" })
Write-Item "Free RAM"           "$freeRamGB GB"
Write-Item "Page File Total"    "$pageFileTotalGB GB"
Write-Item "Page File Free"     "$pageFileFreeGB GB"

if ($memPerf) {
    $pageFaults = $memPerf.PageFaultsPersec
    $hardFaults = $memPerf.PageReadsPersec
    $pfStatus   = if ($pageFaults -gt 1000) { "WARN" } else { "OK" }
    Write-Item "Page Faults/sec"     $pageFaults $pfStatus
    Write-Item "Hard Page Faults/sec" $hardFaults $(if ($hardFaults -gt 10) { "WARN" } else { "OK" })
    Write-Item "Available Bytes"     "$([math]::Round($memPerf.AvailableMBytes / 1024, 1)) GB"
    Write-Item "Committed Bytes"     "$([math]::Round($memPerf.CommittedBytes / 1GB, 1)) GB"
    Write-Item "Pool NonPaged"       "$([math]::Round($memPerf.PoolNonpagedBytes / 1MB, 0)) MB"
    $diagData.Memory = @{
        TotalGB = $totalRamGB; UsedGB = $usedRamGB; FreeMB = $os2.FreePhysicalMemory
        PageFaultsPersec = $pageFaults; HardFaultsPersec = $hardFaults
    }
}

foreach ($stick in $memPhys) {
    $stickGB = [math]::Round($stick.Capacity / 1GB, 0)
    Write-Item "DIMM $($stick.DeviceLocator)" "$stickGB GB | $($stick.Speed) MHz | $($stick.MemoryType) | $($stick.Manufacturer) | SN:$($stick.SerialNumber)"
    $diagData.Memory.Sticks += @{ Slot = $stick.DeviceLocator; GB = $stickGB; Speed = $stick.Speed; SN = $stick.SerialNumber }
}

# Memory errors from event log
$memErrors = Get-WinEvent -FilterHashtable @{LogName='System'; ProviderName='Microsoft-Windows-MemoryDiagnostics-Results'} -MaxEvents 5 -ErrorAction SilentlyContinue
Write-Item "Memory Diagnostic Errors" $memErrors.Count $(if ($memErrors.Count -gt 0) { "WARN" } else { "OK" })

# ============================================================
# SECTION 6: GPU HEALTH
# ============================================================
Write-Section "6. GPU HEALTH"

$gpus = Safe-CIM "Win32_VideoController"
$diagData.GPU = @()

foreach ($gpu in $gpus) {
    Write-Host "`n  --- GPU: $($gpu.Name) ---" -ForegroundColor White
    $vramMB   = [math]::Round($gpu.AdapterRAM / 1MB, 0)
    $drvDate  = $gpu.DriverDate
    $drvVer   = $gpu.DriverVersion
    $gpuStatus= $gpu.Status

    Write-Item "GPU Name"          $gpu.Name
    Write-Item "VRAM"              "$vramMB MB"
    Write-Item "Driver Version"    $drvVer
    Write-Item "Driver Date"       $drvDate
    Write-Item "Status"            $gpuStatus $(if ($gpuStatus -eq "OK") { "OK" } else { "WARN" })
    Write-Item "Current BPP"       $gpu.CurrentBitsPerPixel
    Write-Item "Current Resolution" "$($gpu.CurrentHorizontalResolution) x $($gpu.CurrentVerticalResolution)"
    Write-Item "Refresh Rate"      "$($gpu.CurrentRefreshRate) Hz"
    Write-Item "Video Mode"        $gpu.VideoModeDescription

    # Check driver age
    if ($drvDate) {
        $drvAge = (New-TimeSpan -Start ([Management.ManagementDateTimeConverter]::ToDateTime($drvDate)) -End (Get-Date)).Days
        $drvAgeMonths = [math]::Round($drvAge / 30)
        $drvStatus = if ($drvAge -gt 365) { "WARN" } else { "OK" }
        Write-Item "Driver Age" "$drvAgeMonths months" $drvStatus
        if ($drvAge -gt 365) { Write-Host "    >> GPU driver over 1 year old. Update recommended." -ForegroundColor Yellow }
    }

    $diagData.GPU += @{ Name = $gpu.Name; VRAM_MB = $vramMB; DriverVersion = $drvVer; Status = $gpuStatus }
}

# GPU temps via OHM if available
$gpuTemps = Get-WmiObject -Namespace "root\OpenHardwareMonitor" -Class Sensor -ErrorAction SilentlyContinue | Where-Object { $_.SensorType -eq "Temperature" -and $_.Name -like "*GPU*" }
if ($gpuTemps) {
    foreach ($t in $gpuTemps) {
        $tStatus = if ($t.Value -gt 90) { "CRIT" } elseif ($t.Value -gt 80) { "WARN" } else { "OK" }
        Write-Item "GPU Temp ($($t.Name))" "$($t.Value) C" $tStatus
    }
}

# GPU TDR (driver crashes) from event log
$gpuTDR = Get-WinEvent -FilterHashtable @{LogName='System'; ProviderName='nvlddmkm'} -MaxEvents 20 -ErrorAction SilentlyContinue
$gpuTDR += Get-WinEvent -FilterHashtable @{LogName='System'; Id=4101} -MaxEvents 20 -ErrorAction SilentlyContinue
Write-Item "GPU Driver Crash (TDR) Events" $gpuTDR.Count $(if ($gpuTDR.Count -gt 2) { "WARN" } else { "OK" })
$diagData.GPU | ForEach-Object { $_ | Add-Member -NotePropertyName TDREvents -NotePropertyValue $gpuTDR.Count -Force }

# ============================================================
# SECTION 7: THERMAL MANAGEMENT & FANS
# ============================================================
Write-Section "7. THERMAL MANAGEMENT & FANS"

# Thermal zones
$thermalZones = Get-WmiObject -Namespace "root\wmi" -Class "MSAcpi_ThermalZoneTemperature" -ErrorAction SilentlyContinue
$diagData.Thermals = @()

if ($thermalZones) {
    foreach ($zone in $thermalZones) {
        $tempC = [math]::Round(($zone.CurrentTemperature - 2732) / 10, 1)
        $critC = [math]::Round(($zone.CriticalTripPoint - 2732) / 10, 1)
        $tStatus = if ($tempC -gt ($critC * 0.9)) { "CRIT" } elseif ($tempC -gt ($critC * 0.8)) { "WARN" } else { "OK" }
        Write-Item "Thermal Zone: $($zone.InstanceName)" "$tempC C (Critical: $critC C)" $tStatus
        $diagData.Thermals += @{ Zone = $zone.InstanceName; TempC = $tempC; CriticalC = $critC }
    }
} else {
    Write-Host "  [INFO] Thermal zones not exposed via WMI (normal on some Lenovo models)" -ForegroundColor Gray
}

# Lenovo-specific thermal mode
$thermalMode = Get-WmiObject -Namespace "root\WMI" -Class "LENOVO_FAN_TABLE_DATA" -ErrorAction SilentlyContinue
$thermalProfile = Get-WmiObject -Namespace "root\WMI" -Class "LENOVO_GAMEZONE_TEMP_STATUS" -ErrorAction SilentlyContinue

if ($thermalProfile) {
    Write-Item "Lenovo GameZone Temp Status" $thermalProfile.CurrentTemperatureRange
}

# Lenovo power/thermal mode via Vantage registry
$powerModeKey = "HKLM:\SYSTEM\CurrentControlSet\Services\ibmpmsvc\Parameters"
if (Test-Path $powerModeKey) {
    $powerMode = (Get-ItemProperty $powerModeKey -ErrorAction SilentlyContinue).ThermalMode
    $modeName = switch ($powerMode) {
        0 { "Quiet Mode" } 1 { "Balanced Mode" } 2 { "Performance Mode" } 3 { "Custom" } default { "Unknown" }
    }
    Write-Item "Lenovo Thermal Mode" $modeName
    $diagData.ThermalMode = $modeName
}

# Fan data via WMI
$fans = Get-WmiObject -Namespace "root\WMI" -Class "LENOVO_FAN_METHOD" -ErrorAction SilentlyContinue
if ($fans) {
    Write-Item "Lenovo Fan Control" "Available"
} else {
    # Fallback: check via general fan WMI
    $fanGen = Safe-CIM "Win32_Fan"
    if ($fanGen) {
        foreach ($fan in $fanGen) {
            Write-Item "Fan: $($fan.Name)" "$($fan.DesiredSpeed) RPM | Active: $($fan.ActiveCooling)"
        }
    } else {
        Write-Host "  [INFO] Fan RPM data not accessible via WMI (use HWiNFO64 for live RPMs)" -ForegroundColor Gray
    }
}

# Check Event Viewer for thermal events
$thermalEvents = Get-WinEvent -FilterHashtable @{LogName='System'; ProviderName='Microsoft-Windows-Kernel-Processor-Power'} -MaxEvents 30 -ErrorAction SilentlyContinue
Write-Item "Kernel Power Events" $thermalEvents.Count $(if ($thermalEvents.Count -gt 10) { "WARN" } else { "OK" })

# ============================================================
# SECTION 8: POWER DELIVERY & CHARGER HEALTH
# ============================================================
Write-Section "8. POWER DELIVERY & CHARGER"

$powerPlan = Get-WmiObject -Namespace "root\cimv2\power" -Class "Win32_PowerPlan" -Filter "IsActive=True" -ErrorAction SilentlyContinue
Write-Item "Active Power Plan" $powerPlan.ElementName

$acAdapter = Safe-CIM "Win32_PortableBattery"
if ($acAdapter) {
    foreach ($ac in $acAdapter) {
        Write-Item "Battery Location"      $ac.Location
        Write-Item "Battery Manufacturer"  $ac.Manufacturer
        Write-Item "Max Recharge Time"     "$($ac.MaxRechargeTime) min"
        Write-Item "Design Voltage"        "$($ac.DesignVoltage) mV"
    }
}

# Lenovo-specific: AC adapter detection
$lenovoAC = Get-WmiObject -Namespace "root\WMI" -Class "LENOVO_GAMEZONE_POWER_CHARGE_MODE" -ErrorAction SilentlyContinue
if ($lenovoAC) {
    Write-Item "Lenovo Charge Mode" $lenovoAC.CurrentPowerChargeMode
}

# Sleep/hibernate/wake events
$sleepEvents = Get-WinEvent -FilterHashtable @{LogName='System'; Id=42} -MaxEvents 20 -ErrorAction SilentlyContinue
$wakeEvents  = Get-WinEvent -FilterHashtable @{LogName='System'; Id=1} -MaxEvents 20 -ErrorAction SilentlyContinue
Write-Item "Sleep Events (recent)"       $sleepEvents.Count
Write-Item "Wake Events (recent)"        $wakeEvents.Count

# Power efficiency report
$powerReportPath = "$env:TEMP\power_report_lenovo.html"
powercfg /energy /output $powerReportPath /duration 20 2>$null
if (Test-Path $powerReportPath) {
    $powerContent = Get-Content $powerReportPath -Raw
    $warnings = ([regex]::Matches($powerContent, "WARNING")).Count
    $errors   = ([regex]::Matches($powerContent, "ERROR")).Count
    Write-Item "Power Efficiency Warnings" $warnings $(if ($warnings -gt 5) { "WARN" } else { "OK" })
    Write-Item "Power Efficiency Errors"   $errors   $(if ($errors -gt 2) { "CRIT" } else { "OK" })
    $diagData.PowerEfficiency = @{ Warnings = $warnings; Errors = $errors }
}

# Connected standby support
$csInfo = powercfg /a 2>&1
$csSupport = if ($csInfo -match "Standby \(S0 Low Power Idle\).*Available") { "Supported" } else { "Not supported" }
Write-Item "Modern Standby (S0)" $csSupport

$diagData.Power = @{
    Plan = $powerPlan.ElementName; SleepEvents = $sleepEvents.Count; WakeEvents = $wakeEvents.Count
    ModernStandby = $csSupport
}

# ============================================================
# SECTION 9: STARTUP HEALTH & BOOT PERFORMANCE
# ============================================================
Write-Section "9. STARTUP HEALTH & BOOT PERFORMANCE"

# Boot time from event log (Event 12 = kernel load, Event 100 = boot success)
$bootEvent = Get-WinEvent -FilterHashtable @{LogName='Microsoft-Windows-Diagnostics-Performance/Operational'; Id=100} -MaxEvents 5 -ErrorAction SilentlyContinue
if ($bootEvent) {
    foreach ($be in $bootEvent | Select-Object -First 3) {
        $bootMs = ([xml]$be.ToXml()).Event.EventData.Data | Where-Object { $_.Name -eq "BootDuration" } | Select-Object -ExpandProperty "#text"
        $bootSec = [math]::Round([int]$bootMs / 1000, 1)
        $bootStatus = if ($bootSec -gt 60) { "WARN" } elseif ($bootSec -gt 120) { "CRIT" } else { "OK" }
        Write-Item "Boot Duration" "$bootSec seconds" $bootStatus
    }
}

# Startup programs
$startupItems = Get-CimInstance -ClassName Win32_StartupCommand -ErrorAction SilentlyContinue
Write-Item "Startup Programs Count" $startupItems.Count $(if ($startupItems.Count -gt 20) { "WARN" } else { "OK" })
$diagData.Startup = @{ StartupProgramCount = $startupItems.Count }

# Critical startup delays from event log
$startupDelays = Get-WinEvent -FilterHashtable @{LogName='Microsoft-Windows-Diagnostics-Performance/Operational'; Id=101,102,103} -MaxEvents 10 -ErrorAction SilentlyContinue
Write-Item "Startup Delay Events" $startupDelays.Count $(if ($startupDelays.Count -gt 5) { "WARN" } else { "OK" })

# BIOS POST time
$biosPost = Get-WinEvent -FilterHashtable @{LogName='Microsoft-Windows-Diagnostics-Performance/Operational'; Id=100} -MaxEvents 1 -ErrorAction SilentlyContinue
if ($biosPost) {
    $biosMs = ([xml]$biosPost[0].ToXml()).Event.EventData.Data | Where-Object { $_.Name -eq "BIOSDuration" } | Select-Object -ExpandProperty "#text"
    $biosSec = [math]::Round([int]$biosMs / 1000, 1)
    Write-Item "BIOS POST Duration" "$biosSec seconds" $(if ($biosSec -gt 15) { "WARN" } else { "OK" })
    $diagData.Startup.BIOSPostSec = $biosSec
}

# Fast startup state
$fastStartup = (Get-ItemProperty "HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager\Power" -ErrorAction SilentlyContinue).HiberbootEnabled
Write-Item "Fast Startup" $(if ($fastStartup -eq 1) { "Enabled" } else { "Disabled" })

# Last crash/restart reason
$shutdownEvents = Get-WinEvent -FilterHashtable @{LogName='System'; Id=41,1074,6006,6008} -MaxEvents 10 -ErrorAction SilentlyContinue
Write-Item "Unexpected Shutdown Events (Kernel-41)" ($shutdownEvents | Where-Object { $_.Id -eq 41 }).Count $(if (($shutdownEvents | Where-Object { $_.Id -eq 41 }).Count -gt 2) { "WARN" } else { "OK" })
Write-Item "Clean Shutdown Events" ($shutdownEvents | Where-Object { $_.Id -eq 1074 }).Count

$diagData.Startup.UnexpectedShutdowns = ($shutdownEvents | Where-Object { $_.Id -eq 41 }).Count

# ============================================================
# SECTION 10: DRIVER HEALTH
# ============================================================
Write-Section "10. DRIVER HEALTH"

# All signed/unsigned drivers
$drivers = Get-WmiObject Win32_SystemDriver -ErrorAction SilentlyContinue
$runningDrivers = $drivers | Where-Object { $_.State -eq "Running" }
$stoppedDrivers = $drivers | Where-Object { $_.State -ne "Running" -and $_.StartMode -eq "Auto" }
Write-Item "Total Drivers"           $drivers.Count
Write-Item "Running Drivers"         $runningDrivers.Count
Write-Item "Auto-Start But Stopped"  $stoppedDrivers.Count $(if ($stoppedDrivers.Count -gt 5) { "WARN" } else { "OK" })

# Problem devices
$problemDevices = Get-WmiObject Win32_PnPEntity -ErrorAction SilentlyContinue | Where-Object { $_.ConfigManagerErrorCode -ne 0 }
Write-Item "Problem Devices" $problemDevices.Count $(if ($problemDevices.Count -gt 0) { "WARN" } else { "OK" })
if ($problemDevices) {
    foreach ($pd in $problemDevices) {
        Write-Host "    >> Problem: $($pd.Name) - Error Code: $($pd.ConfigManagerErrorCode)" -ForegroundColor Yellow
    }
}

$diagData.Drivers = @{
    Total = $drivers.Count; Running = $runningDrivers.Count
    ProblemDevices = $problemDevices.Count
    ProblemDeviceList = ($problemDevices | Select-Object -ExpandProperty Name)
}

# Driver error events
$driverErrors = Get-WinEvent -FilterHashtable @{LogName='System'; Level=2; ProviderName='Service Control Manager'} -MaxEvents 20 -ErrorAction SilentlyContinue
Write-Item "Driver Service Errors" $driverErrors.Count $(if ($driverErrors.Count -gt 5) { "WARN" } else { "OK" })

# Lenovo-specific drivers
$lenovoDrivers = $drivers | Where-Object { $_.PathName -like "*lenovo*" -or $_.PathName -like "*ibm*" }
Write-Item "Lenovo-Specific Drivers" $lenovoDrivers.Count

# ============================================================
# SECTION 11: NETWORK STABILITY
# ============================================================
Write-Section "11. NETWORK STABILITY"

$netAdapters = Get-NetAdapter -ErrorAction SilentlyContinue | Where-Object { $_.Status -eq "Up" }
$diagData.Network = @()

foreach ($nic in $netAdapters) {
    $nicStats = Get-NetAdapterStatistics -Name $nic.Name -ErrorAction SilentlyContinue
    $nicIP    = (Get-NetIPAddress -InterfaceAlias $nic.Name -AddressFamily IPv4 -ErrorAction SilentlyContinue).IPAddress

    Write-Host "`n  --- Adapter: $($nic.Name) ---" -ForegroundColor White
    Write-Item "Description"     $nic.InterfaceDescription
    Write-Item "IP Address"      $($nicIP -join ', ')
    Write-Item "Link Speed"      "$([math]::Round($nic.LinkSpeed / 1MB, 0)) Mbps"
    Write-Item "MAC Address"     $nic.MacAddress
    Write-Item "Media Type"      $nic.MediaType
    Write-Item "Driver Version"  $nic.DriverVersion

    if ($nicStats) {
        Write-Item "Bytes Received"  "$([math]::Round($nicStats.ReceivedBytes / 1MB, 1)) MB"
        Write-Item "Bytes Sent"      "$([math]::Round($nicStats.SentBytes / 1MB, 1)) MB"
        Write-Item "Receive Errors"  $nicStats.ReceivedErrors $(if ($nicStats.ReceivedErrors -gt 100) { "WARN" } else { "OK" })
        Write-Item "Transmit Errors" $nicStats.OutboundErrors $(if ($nicStats.OutboundErrors -gt 100) { "WARN" } else { "OK" })
        Write-Item "Discarded Pkts"  $nicStats.ReceivedDiscardedPackets

        $diagData.Network += @{
            Name = $nic.Name; Type = $nic.MediaType; SpeedMbps = [math]::Round($nic.LinkSpeed / 1MB, 0)
            RecvErrors = $nicStats.ReceivedErrors; SendErrors = $nicStats.OutboundErrors
        }
    }
}

# Wi-Fi specific stability
$wifiProfiles = netsh wlan show profiles 2>$null
$wifiDrops = Get-WinEvent -FilterHashtable @{LogName='Microsoft-Windows-WLAN-AutoConfig/Operational'; Level=2} -MaxEvents 30 -ErrorAction SilentlyContinue
Write-Item "Wi-Fi Disconnect Events" $wifiDrops.Count $(if ($wifiDrops.Count -gt 5) { "WARN" } else { "OK" })
$diagData.WiFiDropEvents = $wifiDrops.Count

# DNS test
$dnsTest = Resolve-DnsName "google.com" -ErrorAction SilentlyContinue
Write-Item "DNS Resolution Test"  $(if ($dnsTest) { "PASS" } else { "FAIL" }) $(if ($dnsTest) { "OK" } else { "WARN" })

# Ping test
$ping = Test-Connection "8.8.8.8" -Count 4 -ErrorAction SilentlyContinue
if ($ping) {
    $avgPing = ($ping | Measure-Object -Property ResponseTime -Average).Average
    $maxPing = ($ping | Measure-Object -Property ResponseTime -Maximum).Maximum
    Write-Item "Internet Ping (avg)" "$([math]::Round($avgPing, 0)) ms" $(if ($avgPing -gt 100) { "WARN" } else { "OK" })
    Write-Item "Internet Ping (max)" "$([math]::Round($maxPing, 0)) ms"
    $diagData.Ping = @{ AvgMs = [math]::Round($avgPing, 0); MaxMs = [math]::Round($maxPing, 0) }
}

# ============================================================
# SECTION 12: MEMORY PRESSURE & VIRTUAL MEMORY
# ============================================================
Write-Section "12. MEMORY PRESSURE ANALYSIS"

$vmPerf = Safe-CIM "Win32_PerfFormattedData_PerfOS_Memory"
if ($vmPerf) {
    $commitLimit  = [math]::Round($vmPerf.CommitLimit / 1GB, 1)
    $committedGB  = [math]::Round($vmPerf.CommittedBytes / 1GB, 1)
    $commitPct    = [math]::Round(($committedGB / $commitLimit) * 100, 1)
    $cacheMB      = [math]::Round($vmPerf.CacheBytes / 1MB, 0)
    $workingSetMB = [math]::Round($vmPerf.SystemCacheResidentBytes / 1MB, 0)
    $freeSystemPTE= $vmPerf.FreeSystemPageTableEntries

    Write-Item "Commit Limit"          "$commitLimit GB"
    Write-Item "Committed Memory"      "$committedGB GB ($commitPct%)" $(if ($commitPct -gt 80) { "WARN" } else { "OK" })
    Write-Item "System Cache"          "$cacheMB MB"
    Write-Item "Free PTE Entries"      $freeSystemPTE $(if ($freeSystemPTE -lt 5000) { "WARN" } else { "OK" })
    Write-Item "Paged Pool"            "$([math]::Round($vmPerf.PoolPagedBytes / 1MB, 0)) MB"
    Write-Item "Non-Paged Pool"        "$([math]::Round($vmPerf.PoolNonpagedBytes / 1MB, 0)) MB"
    Write-Item "Transition Faults/sec" $vmPerf.TransitionFaultsPersec
    Write-Item "Write Copies/sec"      $vmPerf.WriteCopiesPersec

    if ($commitPct -gt 80) {
        Write-Host "    >> High memory pressure — system is relying heavily on page file." -ForegroundColor Yellow
    }
    $diagData.MemoryPressure = @{
        CommitLimitGB = $commitLimit; CommittedGB = $committedGB; CommitPct = $commitPct
        PageFaultsPersec = $vmPerf.PageFaultsPersec
    }
}

# Page file locations and sizes
$pageFiles = Safe-CIM "Win32_PageFileSetting"
foreach ($pf in $pageFiles) {
    Write-Item "Page File" "$($pf.Name) | Init: $($pf.InitialSize) MB | Max: $($pf.MaximumSize) MB"
}

# ============================================================
# SECTION 13: WINDOWS HEALTH & SYSTEM INTEGRITY
# ============================================================
Write-Section "13. WINDOWS HEALTH & SYSTEM INTEGRITY"

# System file checker status from CBS log
$cbsLog = "$env:windir\Logs\CBS\CBS.log"
if (Test-Path $cbsLog) {
    $cbsContent = Get-Content $cbsLog -Tail 100 -ErrorAction SilentlyContinue
    $sfcErrors  = ($cbsContent | Select-String "Cannot repair").Count
    $sfcFixed   = ($cbsContent | Select-String "successfully repaired").Count
    Write-Item "SFC Errors Found"   $sfcErrors $(if ($sfcErrors -gt 0) { "WARN" } else { "OK" })
    Write-Item "SFC Files Repaired" $sfcFixed
}

# Windows Update status
$wuKey = "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\WindowsUpdate\Auto Update\Results\Install"
if (Test-Path $wuKey) {
    $lastUpdate = (Get-ItemProperty $wuKey -ErrorAction SilentlyContinue).LastSuccessTime
    Write-Item "Last Successful Windows Update" $lastUpdate
}

$pendingUpdates = Get-WinEvent -FilterHashtable @{LogName='System'; ProviderName='Microsoft-Windows-WindowsUpdateClient'; Id=19} -MaxEvents 5 -ErrorAction SilentlyContinue
Write-Item "Recent Update Installs" $pendingUpdates.Count

# Critical system events
$criticalEvents = Get-WinEvent -FilterHashtable @{LogName='System'; Level=1} -MaxEvents 20 -ErrorAction SilentlyContinue
$errorEvents    = Get-WinEvent -FilterHashtable @{LogName='System'; Level=2} -MaxEvents 100 -ErrorAction SilentlyContinue
Write-Item "Critical System Events (recent)" $criticalEvents.Count $(if ($criticalEvents.Count -gt 3) { "CRIT" } else { "OK" })
Write-Item "Error System Events (recent)"    $errorEvents.Count    $(if ($errorEvents.Count -gt 20) { "WARN" } else { "OK" })

# WHEA hardware errors (critical for predicting CPU/RAM failure)
$wheaErrors = Get-WinEvent -FilterHashtable @{LogName='System'; ProviderName='Microsoft-Windows-WHEA-Logger'} -MaxEvents 20 -ErrorAction SilentlyContinue
Write-Item "WHEA Hardware Errors" $wheaErrors.Count $(if ($wheaErrors.Count -gt 0) { "CRIT" } else { "OK" })
if ($wheaErrors.Count -gt 0) {
    Write-Host "    >> CRITICAL: Hardware errors detected! Possible CPU/RAM/motherboard failure." -ForegroundColor Red
    $diagData.WHEAErrors = $wheaErrors.Count
}

# Reliability Monitor score via WMI
$reliability = Get-WmiObject -Namespace "root\cimv2" -Class "Win32_ReliabilityRecords" -ErrorAction SilentlyContinue | Select-Object -First 10
Write-Item "Reliability Records Available" $reliability.Count

$diagData.WindowsHealth = @{
    CriticalEvents = $criticalEvents.Count; ErrorEvents = $errorEvents.Count
    WHEAErrors = $wheaErrors.Count; SFCErrors = $sfcErrors
}

# ============================================================
# SECTION 14: LENOVO-SPECIFIC HARDWARE MONITORING
# ============================================================
Write-Section "14. LENOVO-SPECIFIC HARDWARE FEATURES"

# Lenovo Vantage / System Interface Foundation
$lenovoService = Get-Service -Name "ImControllerService" -ErrorAction SilentlyContinue
$vantageService = Get-Service -Name "LenovoVantageService" -ErrorAction SilentlyContinue
$sifService = Get-Service -Name "System Interface Foundation*" -ErrorAction SilentlyContinue

Write-Item "Lenovo ImController Service"  $(if ($lenovoService) { $lenovoService.Status } else { "Not installed" })
Write-Item "Lenovo Vantage Service"       $(if ($vantageService) { $vantageService.Status } else { "Not installed" })

# ThinkPad-specific: Active Protection System (APS) / Sensors
$apsDriver = Get-WmiObject -Namespace "root\WMI" -Class "IBM_ThinkPadProfiles" -ErrorAction SilentlyContinue
if ($apsDriver) {
    Write-Item "ThinkPad Active Protection System" "Detected"
}

# Legion/Gaming specific: GameZone features
$gameZone = Get-WmiObject -Namespace "root\WMI" -Class "LENOVO_GAMEZONE_DATA" -ErrorAction SilentlyContinue
if ($gameZone) {
    Write-Item "Legion GameZone Status"   $gameZone.GameZoneStatus
    Write-Item "GPU Temperature (Legion)" "$($gameZone.GPUTemperature) C"
    Write-Item "CPU Temperature (Legion)" "$($gameZone.CPUTemperature) C"
    Write-Item "Fan 1 Speed"              "$($gameZone.Fan1Speed) RPM"
    Write-Item "Fan 2 Speed"              "$($gameZone.Fan2Speed) RPM"
    $diagData.LegionData = @{
        GPUTemp = $gameZone.GPUTemperature; CPUTemp = $gameZone.CPUTemperature
        Fan1RPM = $gameZone.Fan1Speed; Fan2RPM = $gameZone.Fan2Speed
    }
}

# Lenovo power management extended data
$pmData = Get-WmiObject -Namespace "root\WMI" -Class "LENOVO_PM_SUPPORT" -ErrorAction SilentlyContinue
if ($pmData) { Write-Item "Lenovo PM Extended Data" "Available" }

# Lenovo smart standby
$smartStandby = Get-WmiObject -Namespace "root\WMI" -Class "LENOVO_INTELLIGENT_STANDBY_LIST_CAPABILITY" -ErrorAction SilentlyContinue
if ($smartStandby) { Write-Item "Lenovo Intelligent Standby" "Supported" }

# Yoga/2-in-1: Hinge/rotation sensor
$sensorService = Get-Service "SensorService" -ErrorAction SilentlyContinue
Write-Item "Sensor Service (Yoga/2-in-1)" $(if ($sensorService) { $sensorService.Status } else { "Not running" })

# Keyboard backlight state (ThinkPad/IdeaPad)
$kbdBacklight = Get-WmiObject -Namespace "root\WMI" -Class "LENOVO_LIGHTING_FEATURE" -ErrorAction SilentlyContinue
if ($kbdBacklight) { Write-Item "Keyboard Backlight Feature" "Detected" }

$diagData.LenovoSpecific = @{
    ImControllerInstalled = ($null -ne $lenovoService)
    VantageInstalled      = ($null -ne $vantageService)
    IsLegion              = ($null -ne $gameZone)
    IsThinkPad            = ($null -ne $apsDriver)
}

# ============================================================
# SECTION 15: CORRELATION ANALYSIS (AI-Ready Cross-Metrics)
# ============================================================
Write-Section "15. CROSS-METRIC CORRELATION ANALYSIS"

Write-Host "  Analyzing metric combinations for early failure patterns..." -ForegroundColor Gray

$correlationFlags = @()

# Battery + Thermal correlation (swollen battery indicator)
if ($diagData.Battery.HealthPct -lt 75 -and $diagData.Thermals.Count -gt 0) {
    $avgTemp = ($diagData.Thermals | Measure-Object -Property TempC -Average).Average
    if ($avgTemp -gt 50) {
        $correlationFlags += "BATTERY_HEAT_DEGRADATION: Low battery health + high thermals = accelerated degradation pattern"
    }
}

# SSD + High RAM usage correlation (death spiral indicator)
if ($diagData.Memory.FreeMB -lt 512000 -and $diagData.Storage[0].SMARTWear -gt 40) {
    $correlationFlags += "SSD_PRESSURE_WEAR: High RAM usage causing excessive SSD paging + SSD already worn = failure risk"
}

# CPU throttling + fan correlation
if ($diagData.CPU.ThrottleEvents -gt 3 -and $diagData.ThermalMode -ne "Performance Mode") {
    $correlationFlags += "THERMAL_MANAGEMENT: CPU throttling without performance mode = thermal paste degradation likely"
}

# Unexpected shutdowns + WHEA errors
if ($diagData.Startup.UnexpectedShutdowns -gt 2 -and $diagData.WHEAErrors -gt 0) {
    $correlationFlags += "HARDWARE_INSTABILITY: Unexpected shutdowns + hardware errors = RAM or power delivery failure risk"
}

# Old BIOS + battery issues
if ($diagData.SystemIdentity.BIOSAgeMonths -gt 24 -and $diagData.Battery.HealthPct -lt 80) {
    $correlationFlags += "BIOS_BATTERY_MGMT: Old BIOS firmware + battery degradation = suboptimal charge management"
}

# Disk errors + old SSD + high usage
if ($diagData.DiskErrorEventCount -gt 3 -and $diagData.Storage[0].PowerOnHours -gt 15000) {
    $correlationFlags += "SSD_END_OF_LIFE: Disk errors + $($diagData.Storage[0].PowerOnHours) power-on hours = SSD approaching end of life"
}

# Network drops + driver age
$oldGpuDriver = $diagData.GPU | Where-Object { $_.DriverVersion -and $_.Name -like "*Intel*" -or $_.Name -like "*NVIDIA*" }
if ($diagData.WiFiDropEvents -gt 5) {
    $correlationFlags += "WIFI_DRIVER_STABILITY: $($diagData.WiFiDropEvents) Wi-Fi drops detected = driver or hardware issue"
}

# Memory pressure + startup slowness
if ($diagData.MemoryPressure.CommitPct -gt 75 -and $diagData.Startup.StartupProgramCount -gt 15) {
    $correlationFlags += "MEMORY_PRESSURE: $($diagData.MemoryPressure.CommitPct)% memory commit + $($diagData.Startup.StartupProgramCount) startup programs = chronic memory pressure"
}

if ($correlationFlags.Count -eq 0) {
    Write-Host "  [OK] No significant cross-metric correlation issues detected." -ForegroundColor Green
} else {
    Write-Host "`n  CORRELATION FLAGS DETECTED:" -ForegroundColor Red
    foreach ($flag in $correlationFlags) {
        Write-Host "  >> $flag" -ForegroundColor Yellow
    }
}
$diagData.CorrelationFlags = $correlationFlags

# ============================================================
# SECTION 16: HABIT COACHING DATA COLLECTION
# ============================================================
Write-Section "16. USAGE HABIT ANALYSIS"

# Uptime (habit: never rebooting)
$uptimeSec  = (Get-Date) - $os.LastBootUpTime
$uptimeDays = [math]::Round($uptimeSec.TotalDays, 1)
$uptimeStatus = if ($uptimeDays -gt 14) { "WARN" } elseif ($uptimeDays -gt 30) { "CRIT" } else { "OK" }
Write-Item "System Uptime" "$uptimeDays days" $uptimeStatus
if ($uptimeDays -gt 14) { Write-Host "    >> Habit tip: Restarting weekly helps clear memory leaks and apply updates." -ForegroundColor Yellow }

# High-load process habits
$topProcs = Get-Process | Sort-Object CPU -Descending | Select-Object -First 5
Write-Host "`n  Top 5 CPU Consuming Processes:" -ForegroundColor White
foreach ($p in $topProcs) {
    Write-Host "    $($p.Name) | CPU: $([math]::Round($p.CPU, 1))s | RAM: $([math]::Round($p.WorkingSet / 1MB, 0)) MB"
}

# Check for known CPU/RAM abusers
$browsers = Get-Process -Name "chrome","firefox","msedge","opera" -ErrorAction SilentlyContinue
$browserCount = ($browsers | Measure-Object).Count
if ($browserCount -gt 0) {
    $browserRam = ($browsers | Measure-Object -Property WorkingSet -Sum).Sum
    Write-Item "Browser RAM Usage" "$([math]::Round($browserRam / 1MB, 0)) MB across $browserCount browser processes"
}

# Screensaver / display timeout (battery habit)
$powerSettings = powercfg /query SCHEME_CURRENT 2>$null
Write-Item "Uptime Days" $uptimeDays $(if ($uptimeDays -gt 14) { "WARN" } else { "OK" })

$diagData.HabitData = @{
    UptimeDays = $uptimeDays; TopProcesses = ($topProcs | Select-Object -ExpandProperty Name)
    BrowserProcessCount = $browserCount
}

# ============================================================
# SECTION 17: PREDICTIVE HEALTH SCORE SUMMARY
# ============================================================
Write-Section "17. PREDICTIVE HEALTH SCORE SUMMARY"

$healthScore = 100
$deductions  = @()

# Battery
if ($diagData.Battery.HealthPct -lt 60)    { $healthScore -= 25; $deductions += "Battery critical (<60%): -25" }
elseif ($diagData.Battery.HealthPct -lt 80) { $healthScore -= 12; $deductions += "Battery degraded (<80%): -12" }
if ($diagData.Battery.CycleCounts -gt 800)  { $healthScore -= 10; $deductions += "High cycle count (>800): -10" }

# Storage
if ($diagData.DiskErrorEventCount -gt 5)    { $healthScore -= 20; $deductions += "Disk errors (>5): -20" }
if ($diagData.Storage[0].SMARTWear -gt 80)  { $healthScore -= 20; $deductions += "SSD wear >80%: -20" }

# Memory
if ($diagData.WHEAErrors -gt 0)             { $healthScore -= 25; $deductions += "WHEA hardware errors: -25" }
if ($diagData.MemoryPressure.CommitPct -gt 80){ $healthScore -= 10; $deductions += "High memory pressure (>80%): -10" }

# System
if ($diagData.Startup.UnexpectedShutdowns -gt 5) { $healthScore -= 15; $deductions += "Frequent crashes (>5): -15" }
if ($diagData.CPU.ThrottleEvents -gt 5)     { $healthScore -= 8;  $deductions += "CPU throttling (>5 events): -8" }
if ($diagData.SystemIdentity.BIOSAgeMonths -gt 36){ $healthScore -= 5; $deductions += "BIOS very outdated (>3yr): -5" }

# Drivers
if ($diagData.Drivers.ProblemDevices -gt 3) { $healthScore -= 10; $deductions += "Problem devices (>3): -10" }

# Correlation flags multiply risk
$healthScore -= ($diagData.CorrelationFlags.Count * 3)
if ($diagData.CorrelationFlags.Count -gt 0) { $deductions += "Correlation risk flags ($($diagData.CorrelationFlags.Count)): -$($diagData.CorrelationFlags.Count * 3)" }

$healthScore = [math]::Max(0, $healthScore)
$healthGrade = if ($healthScore -ge 85) { "EXCELLENT" } elseif ($healthScore -ge 70) { "GOOD" } elseif ($healthScore -ge 50) { "FAIR - MONITOR CLOSELY" } else { "POOR - ACTION REQUIRED" }
$gradeColor  = if ($healthScore -ge 85) { "Green" } elseif ($healthScore -ge 70) { "Yellow" } elseif ($healthScore -ge 50) { "DarkYellow" } else { "Red" }

Write-Host "`n  ============================================" -ForegroundColor Cyan
Write-Host "  OVERALL HEALTH SCORE: $healthScore/100" -ForegroundColor $gradeColor
Write-Host "  GRADE: $healthGrade" -ForegroundColor $gradeColor
Write-Host "  ============================================" -ForegroundColor Cyan

if ($deductions.Count -gt 0) {
    Write-Host "`n  Score Deductions:" -ForegroundColor Yellow
    foreach ($d in $deductions) { Write-Host "    - $d" -ForegroundColor Yellow }
}

$diagData.HealthScore = @{ Score = $healthScore; Grade = $healthGrade; Deductions = $deductions }

# ============================================================
# SECTION 18: SAVE REPORTS
# ============================================================
Write-Section "18. SAVING REPORTS"

# Save JSON for AI processing
$diagData | ConvertTo-Json -Depth 10 | Out-File $jsonPath -Encoding UTF8
Write-Host "  JSON data saved: $jsonPath" -ForegroundColor Green

# Save human-readable text report
$reportLines = @(
    "LENOVO LAPTOP DIAGNOSTIC REPORT",
    "Generated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')",
    "Model: $($diagData.SystemIdentity.Model)",
    "Serial: $($diagData.SystemIdentity.SerialNumber)",
    "OS: $($diagData.SystemIdentity.OS)",
    "=" * 60,
    "",
    "HEALTH SCORE: $healthScore/100 - $healthGrade",
    "",
    "KEY FINDINGS:",
    "- Battery Health: $($diagData.Battery.HealthPct)% | Cycles: $($diagData.Battery.CycleCounts)",
    "- SSD Wear Level: $($diagData.Storage[0].SMARTWear)% | Power-On Hours: $($diagData.Storage[0].PowerOnHours)",
    "- Unexpected Shutdowns: $($diagData.Startup.UnexpectedShutdowns)",
    "- WHEA Hardware Errors: $($diagData.WHEAErrors)",
    "- Problem Devices: $($diagData.Drivers.ProblemDevices)",
    "- Memory Pressure: $($diagData.MemoryPressure.CommitPct)%",
    "- Wi-Fi Drop Events: $($diagData.WiFiDropEvents)",
    "- BIOS Age: $($diagData.SystemIdentity.BIOSAgeMonths) months",
    "",
    "CORRELATION FLAGS:",
    ($diagData.CorrelationFlags | ForEach-Object { "- $_" }) -join "`n",
    "",
    "SCORE DEDUCTIONS:",
    ($deductions | ForEach-Object { "- $_" }) -join "`n",
    "",
    "Full JSON data: $jsonPath",
    "Battery report: $batteryReportPath",
    "Power report:   $powerReportPath"
)
$reportLines | Out-File $reportPath -Encoding UTF8
Write-Host "  Text report saved: $reportPath" -ForegroundColor Green

Write-Host "`n" -NoNewline
Write-Host "  ╔══════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "  ║   DIAGNOSTIC COMPLETE — CHECK YOUR DESKTOP!     ║" -ForegroundColor Cyan
Write-Host "  ╚══════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# ============================================================
# SECTION 19: SENTINEL COMPATIBLE JSON OUTPUT
# ============================================================
Write-Section "19. SENTINEL COMPATIBLE JSON OUTPUT"

$sentinelThermals = $null
$sentinelThermalZones = @()
$maxTempC = $null

$lenovoTherm = Get-WmiObject -Namespace "root\wmi" -Class "LENOVO_THERMAL_TABLE" -ErrorAction SilentlyContinue
if ($lenovoTherm) {
    foreach ($lt in $lenovoTherm) {
        $c = $null
        if ($null -ne $lt.CurrentTemperature) { $c = [math]::Round(($lt.CurrentTemperature / 10.0) - 273.15, 1) }
        elseif ($null -ne $lt.Temperature) { $c = $lt.Temperature }
        
        if ($null -ne $c) {
            $name = if ($lt.InstanceName) { $lt.InstanceName } else { "LenovoThermal" }
            if ($null -eq $maxTempC -or $c -gt $maxTempC) { $maxTempC = $c }
            $sentinelThermalZones += [ordered]@{ name = $name; tempC = $c }
        }
    }
    if ($sentinelThermalZones.Count -gt 0) {
        $sentinelThermals = [ordered]@{
            maxTempC       = $maxTempC
            zoneCount      = $sentinelThermalZones.Count
            zones          = $sentinelThermalZones
            thermalSource  = "lenovo_wmi"
            thermalSamples = $sentinelThermalZones.Count
        }
    }
}

if (-not $sentinelThermals -and $diagData.Thermals.Count -gt 0) {
    foreach ($z in $diagData.Thermals) {
        $c = $z.TempC
        if ($null -eq $maxTempC -or $c -gt $maxTempC) { $maxTempC = $c }
        $sentinelThermalZones += [ordered]@{ name = $z.Zone; tempC = $c }
    }
    $sentinelThermals = [ordered]@{
        maxTempC       = $maxTempC
        zoneCount      = $sentinelThermalZones.Count
        zones          = $sentinelThermalZones
        thermalSource  = "acpi_wmi"
        thermalSamples = $sentinelThermalZones.Count
    }
}

if (-not $sentinelThermals) {
    $samples = Get-Counter "\Thermal Zone Information(*)\Temperature" -SampleInterval 1 -MaxSamples 2 -ErrorAction SilentlyContinue
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
                    $zones[$zoneName] = [ordered]@{ name = $zoneName; tempC = $c }
                }
            }
        }
        $zList = @($zones.Values)
        if ($zList.Count -gt 0) {
            foreach ($z in $zList) {
                if ($null -eq $maxTempC -or $z.tempC -gt $maxTempC) { $maxTempC = $z.tempC }
            }
            $sentinelThermals = [ordered]@{
                maxTempC       = $maxTempC
                zoneCount      = $zList.Count
                zones          = $zList
                thermalSource  = if ($static) { "acpi_static_suspect" } else { "performance_counter" }
                thermalSamples = $zList.Count
            }
        }
    }
}

if (-not $sentinelThermals) {
    $sentinelThermals = [ordered]@{
        maxTempC       = $null
        zoneCount      = 0
        zones          = @()
        thermalSource  = "unavailable"
        thermalSamples = 0
    }
}

$sentinelStorageList = @()
foreach ($disk in $diagData.Storage) {
    $dataSource = if ($null -ne $disk.SMARTWear) { "reliability_counter" } else { "unavailable" }
    $sentinelStorageList += [ordered]@{
        model              = $disk.Model
        type               = $disk.Interface
        healthPct          = $disk.SMARTWear
        reallocatedSectors = $null
        wearLevelPct       = $disk.SMARTWear
        freeSpacePct       = $disk.FreeSpacePct
        totalGB            = $disk.SizeGB
        powerOnHours       = $disk.PowerOnHours
        dataSource         = $dataSource
    }
}

$sentinelOutput = [ordered]@{
    sentinelSchema = 1
    generatedAt    = (Get-Date -Format 'o')
    system         = [ordered]@{
        hostname     = $env:COMPUTERNAME
        model        = $diagData.SystemIdentity.Model
        manufacturer = $diagData.SystemIdentity.Manufacturer
        os           = $diagData.SystemIdentity.OS
        osVersion    = $diagData.SystemIdentity.OSBuild
        biosVersion  = $diagData.SystemIdentity.BIOSVersion
    }
    battery        = [ordered]@{
        designCapacity     = $diagData.Battery.DesignCapacity
        fullChargeCapacity = $diagData.Battery.FullChargeCapacity
        cycleCount         = $diagData.Battery.CycleCounts
        health             = $diagData.Battery.HealthPct
        status             = $diagData.Battery.DCIMState
        dischargeRateMw    = $diagData.Battery.DischargeRate
    }
    thermals       = $sentinelThermals
    storage        = $sentinelStorageList
    memory         = [ordered]@{
        totalGB          = $diagData.Memory.TotalGB
        usedPct          = if ($diagData.Memory.TotalGB -gt 0) { [math]::Round(($diagData.Memory.UsedGB / $diagData.Memory.TotalGB) * 100, 1) } else { 0 }
        pageFaultsPerSec = $diagData.Memory.PageFaultsPersec
    }
    cpu            = [ordered]@{
        name                = $diagData.CPU.Model
        cores               = $diagData.CPU.Cores
        threads             = $diagData.CPU.Threads
        avgLoadPct          = $diagData.CPU.LoadPct
        throttleEvents30min = $diagData.CPU.ThrottleEvents
        maxClockMhz         = $diagData.CPU.MaxMHz
    }
    startup        = [ordered]@{
        lastBootTime = $diagData.SystemIdentity.LastBoot
    }
}

$sentinelJson = $sentinelOutput | ConvertTo-Json -Depth 10 -Compress
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
Write-Host "  Sentinel Compatible JSON (Paste this into Sentinel):"
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
Write-Host $sentinelJson
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

try {
    $sentinelJson | Set-Clipboard
    Write-Host "✓ Sentinel JSON copied to clipboard." -ForegroundColor Green
} catch {}

# ── Auto-send via Pair Code ───────────────────────────────────────────────────
if ($PairCode -ne "") {
    Write-Host "  Sending data to Sentinel via pair code $PairCode..." -ForegroundColor Cyan
    try {
        $body = [ordered]@{ pairCode = $PairCode; rawJson = ($sentinelOutput | ConvertTo-Json -Depth 10 | ConvertFrom-Json) } | ConvertTo-Json -Depth 12 -Compress
        $response = Invoke-RestMethod -Method POST `
            -Uri "$SENTINEL_BASE_URL/api/pair/push" `
            -ContentType "application/json" `
            -Body $body `
            -ErrorAction Stop
        Write-Host ""
        Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
        Write-Host "  ✓ Data sent. Return to your browser — your report is ready." -ForegroundColor Green
        Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
        Write-Host ""
    } catch {
        Write-Host ""
        Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow
        Write-Host "  ⚠ Auto-send failed. Copy the JSON above and paste it manually" -ForegroundColor Yellow
        Write-Host "    at sentinelapp.io/health-test → 'Paste output'" -ForegroundColor Yellow
        Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow
        Write-Host ""
    }
}