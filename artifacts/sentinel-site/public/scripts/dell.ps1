# ============================================================
# DELL LAPTOP COMPREHENSIVE DIAGNOSTIC SCRIPT
# Covers: XPS, Inspiron, Latitude, Vostro, Alienware, G-Series, Precision
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
$reportPath = "$env:USERPROFILE\Desktop\Dell_Diagnostic_Report_$(Get-Date -Format 'yyyyMMdd_HHmmss').txt"
$jsonPath   = "$env:USERPROFILE\Desktop\Dell_Diagnostic_Data_$(Get-Date -Format 'yyyyMMdd_HHmmss').json"
$diagData   = @{}

function Write-Section($title) {
    $line = "=" * 70
    Write-Host "`n$line" -ForegroundColor Cyan
    Write-Host "  $title" -ForegroundColor Yellow
    Write-Host "$line" -ForegroundColor Cyan
}

function Write-Item($label, $value, $status = "INFO") {
    $color = switch ($status) {
        "OK"    { "Green"  }
        "WARN"  { "Yellow" }
        "CRIT"  { "Red"    }
        default { "White"  }
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

Write-Host "`n  DELL LAPTOP DIAGNOSTIC - Starting full scan..." -ForegroundColor Magenta
Write-Host "  This may take 2-5 minutes. Please wait." -ForegroundColor Gray
Write-Host "  Report will be saved to your Desktop.`n" -ForegroundColor Gray

# ============================================================
# SECTION 1: SYSTEM IDENTITY & DELL MODEL DETECTION
# ============================================================
Write-Section "1. SYSTEM IDENTITY & DELL MODEL DETECTION"

$cs        = Safe-CIM "Win32_ComputerSystem"
$bios      = Safe-CIM "Win32_BIOS"
$baseboard = Safe-CIM "Win32_BaseBoard"
$os        = Safe-CIM "Win32_OperatingSystem"
$enclosure = Safe-CIM "Win32_SystemEnclosure"

$manufacturer = $cs.Manufacturer
$model        = $cs.Model
$serialNumber = $bios.SerialNumber
$biosVersion  = $bios.SMBIOSBIOSVersion
$biosDate     = $bios.ReleaseDate

# Dell product line detection
$productLine = "Unknown Dell"
if ($model -match "XPS")        { $productLine = "XPS"        }
elseif ($model -match "Inspiron")   { $productLine = "Inspiron"   }
elseif ($model -match "Latitude")   { $productLine = "Latitude"   }
elseif ($model -match "Vostro")     { $productLine = "Vostro"     }
elseif ($model -match "Alienware")  { $productLine = "Alienware"  }
elseif ($model -match "Precision")  { $productLine = "Precision"  }
elseif ($model -match " G\d")       { $productLine = "Dell G-Series (Gaming)" }
elseif ($model -match "Chromebook") { $productLine = "Chromebook" }

Write-Item "Manufacturer"    $manufacturer
Write-Item "Model"           $model
Write-Item "Product Line"    $productLine
Write-Item "Serial Number"   $serialNumber
Write-Item "BIOS Version"    $biosVersion
Write-Item "BIOS Date"       $biosDate
Write-Item "OS"              "$($os.Caption) Build $($os.BuildNumber)"
Write-Item "OS Install Date" $os.InstallDate
Write-Item "Last Boot"       $os.LastBootUpTime

$diagData.SystemIdentity = @{
    Manufacturer = $manufacturer; Model = $model; ProductLine = $productLine
    SerialNumber = $serialNumber; BIOSVersion = $biosVersion; BIOSDate = "$biosDate"
    OS = $os.Caption; OSBuild = $os.BuildNumber; LastBoot = "$($os.LastBootUpTime)"
}

# BIOS age check
if ($biosDate) {
    $biosAge = (New-TimeSpan -Start ([Management.ManagementDateTimeConverter]::ToDateTime($biosDate)) -End (Get-Date)).Days
    $biosAgeMonths = [math]::Round($biosAge / 30)
    $biosStatus = if ($biosAge -gt 730) { "WARN" } else { "OK" }
    Write-Item "BIOS Age" "$biosAgeMonths months" $biosStatus
    if ($biosAge -gt 730) { Write-Host "    >> BIOS over 2 years old. Check Dell SupportAssist for firmware updates." -ForegroundColor Yellow }
    $diagData.SystemIdentity.BIOSAgeMonths = $biosAgeMonths
}

# Dell Service Tag validation (7-char alphanumeric = valid)
if ($serialNumber -match "^[A-Z0-9]{7}$") {
    Write-Item "Dell Service Tag" "$serialNumber (VALID — use at dell.com/support)" "OK"
} else {
    Write-Item "Dell Service Tag" "$serialNumber (format unexpected)" "WARN"
}

# Dell-specific WMI namespace check
$dellBIOS = Get-WmiObject -Namespace "root\dcim\sysman" -Class "DCIM_BIOSEnumeration" -ErrorAction SilentlyContinue
if ($dellBIOS) {
    Write-Item "Dell DCIM WMI Namespace" "Available (Dell Command tools detected)" "OK"
    $diagData.SystemIdentity.DellDCIMAvailable = $true
} else {
    Write-Item "Dell DCIM WMI Namespace" "Not found (install Dell Command | Monitor for deeper data)" "INFO"
    $diagData.SystemIdentity.DellDCIMAvailable = $false
}

# Dell SupportAssist service
$dellSA = Get-Service -Name "DellSupportAssistRemedyforPCs","SupportAssistAgent" -ErrorAction SilentlyContinue
foreach ($svc in $dellSA) {
    Write-Item "Dell SupportAssist: $($svc.Name)" $svc.Status
}

# ============================================================
# SECTION 2: BATTERY HEALTH (Dell-specific deep analysis)
# ============================================================
Write-Section "2. BATTERY HEALTH"

$batteries = Safe-WMI "Win32_Battery"
foreach ($bat in $batteries) {
    $statusText = switch ($bat.BatteryStatus) {
        1{"Discharging"} 2{"AC-Fully Charged"} 3{"Fully Charged"}
        4{"Low"} 5{"Critical"} 6{"Charging"} 7{"Charging+High"}
        8{"Charging+Low"} 9{"Charging+Critical"} 11{"Partially Charged"} default{"Unknown"}
    }
    Write-Item "Battery Status"  $statusText
    Write-Item "Charge Level"    "$($bat.EstimatedChargeRemaining)%" $(if ($bat.EstimatedChargeRemaining -lt 20) { "WARN" } else { "OK" })
    Write-Item "Estimated Life"  "$($bat.EstimatedRunTime) min"
    Write-Item "Chemistry"       $bat.Chemistry
    Write-Item "Design Voltage"  "$($bat.DesignVoltage) mV"
}

# Deep battery WMI via root\wmi
$batteryStatic  = Safe-CIM "BatteryFullChargedCapacity" "root\wmi"
$batteryStatus2 = Safe-CIM "BatteryStatus"              "root\wmi"
$batteryCycle   = Safe-CIM "BatteryCycleCount"          "root\wmi"

if ($batteryStatic) {
    $designCap     = $batteryStatic.DesignedCapacity
    $fullChargeCap = $batteryStatic.FullChargedCapacity
    if ($designCap -gt 0) {
        $healthPct = [math]::Round(($fullChargeCap / $designCap) * 100, 1)
        $healthStatus = if ($healthPct -lt 60) { "CRIT" } elseif ($healthPct -lt 80) { "WARN" } else { "OK" }
        Write-Item "Battery Design Capacity"      "$designCap mWh"
        Write-Item "Battery Full Charge Capacity" "$fullChargeCap mWh"
        Write-Item "Battery Health"               "$healthPct%" $healthStatus
        if ($healthPct -lt 60) { Write-Host "    >> CRITICAL: Battery health below 60%. Schedule replacement." -ForegroundColor Red }
        elseif ($healthPct -lt 80) { Write-Host "    >> WARNING: Battery degraded. Avoid extended unplugged use." -ForegroundColor Yellow }
        $diagData.Battery = @{ DesignCapacity = $designCap; FullChargeCapacity = $fullChargeCap; HealthPct = $healthPct }
    }
}

if ($batteryCycle) {
    $cycles = $batteryCycle.CycleCount
    $cycleStatus = if ($cycles -gt 800) { "CRIT" } elseif ($cycles -gt 500) { "WARN" } else { "OK" }
    Write-Item "Battery Cycle Count" $cycles $cycleStatus
    if ($cycles -gt 800) { Write-Host "    >> Over 800 cycles — approaching rated end of life." -ForegroundColor Red }
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

# Dell Command | Monitor battery data (DCIM)
$dellBattDCIM = Get-WmiObject -Namespace "root\dcim\sysman" -Class "DCIM_Battery" -ErrorAction SilentlyContinue
if ($dellBattDCIM) {
    foreach ($db in $dellBattDCIM) {
        Write-Item "Dell DCIM Battery Health"    "$($db.PrimaryStatus)"
        Write-Item "Dell DCIM Battery State"     "$($db.BatteryStatus)"
        Write-Item "Dell DCIM Charge Remaining"  "$($db.EstimatedChargeRemaining)%"
        Write-Item "Dell DCIM Manufacture Date"  "$($db.ManufactureDate)"
        Write-Item "Dell DCIM Chemistry"         "$($db.Chemistry)"
        $diagData.Battery.DCIMHealth = $db.PrimaryStatus
        $diagData.Battery.DCIMState  = $db.BatteryStatus
    }
}

# Dell ExpressCharge / Custom charge mode via DCIM
$dellChargeMode = Get-WmiObject -Namespace "root\dcim\sysman" -Class "DCIM_BIOSEnumeration" -Filter "AttributeName='BatteryChargeCfg'" -ErrorAction SilentlyContinue
if ($dellChargeMode) {
    Write-Item "Dell Battery Charge Config" $dellChargeMode.CurrentValue
    $diagData.Battery.ChargeConfig = $dellChargeMode.CurrentValue
}

# ExpressCharge setting
$dellExpressCharge = Get-WmiObject -Namespace "root\dcim\sysman" -Class "DCIM_BIOSEnumeration" -Filter "AttributeName='ExpressCharge'" -ErrorAction SilentlyContinue
if ($dellExpressCharge) {
    Write-Item "Dell ExpressCharge" $dellExpressCharge.CurrentValue
    $diagData.Battery.ExpressCharge = $dellExpressCharge.CurrentValue
}

# Generate battery report
Write-Host "`n  Generating Windows battery report (~20 seconds)..." -ForegroundColor Gray
$batteryReportPath = "$env:TEMP\battery_report_dell.html"
powercfg /batteryreport /output $batteryReportPath 2>$null
if (Test-Path $batteryReportPath) {
    Write-Host "    Full battery report saved: $batteryReportPath" -ForegroundColor Gray
    $diagData.Battery.ReportPath = $batteryReportPath
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
    Write-Item "Model"       $disk.Model
    Write-Item "Size"        "$sizeGB GB"
    Write-Item "Interface"   $disk.InterfaceType
    Write-Item "Serial"      $disk.SerialNumber
    Write-Item "Firmware"    $disk.FirmwareRevision
    Write-Item "Partitions"  $disk.Partitions
    Write-Item "Status"      $disk.Status $(if ($disk.Status -eq "OK") { "OK" } else { "CRIT" })

    $diskEntry = @{
        Model = $disk.Model; SizeGB = $sizeGB; Interface = $disk.InterfaceType
        Serial = $disk.SerialNumber; Status = $disk.Status
    }

    # SMART via MSFT_StorageReliabilityCounter
    $smartAll = Safe-CIM "MSFT_StorageReliabilityCounter" "root\microsoft\windows\storage"
    if ($smartAll) {
        foreach ($smart in $smartAll) {
            Write-Item "SMART Wear Level"        "$($smart.Wear)%"           $(if ($smart.Wear -gt 80) { "CRIT" } elseif ($smart.Wear -gt 50) { "WARN" } else { "OK" })
            Write-Item "SMART Temperature"       "$($smart.Temperature) C"  $(if ($smart.Temperature -gt 65) { "CRIT" } elseif ($smart.Temperature -gt 55) { "WARN" } else { "OK" })
            Write-Item "SMART Read Errors"       $smart.ReadErrorsTotal
            Write-Item "SMART Write Errors"      $smart.WriteErrorsTotal
            Write-Item "SMART Power On Hours"    $smart.PowerOnHours
            Write-Item "SMART Power Cycle Count" $smart.PowerCycleCount
            $diskEntry.SMARTWear    = $smart.Wear
            $diskEntry.SMARTTemp    = $smart.Temperature
            $diskEntry.PowerOnHours = $smart.PowerOnHours
        }
    }

    # Dell DCIM storage data
    $dellDisk = Get-WmiObject -Namespace "root\dcim\sysman" -Class "DCIM_DiskDrive" -ErrorAction SilentlyContinue
    if ($dellDisk) {
        foreach ($dd in $dellDisk) {
            Write-Item "Dell DCIM Disk Status"    $dd.PrimaryStatus
            Write-Item "Dell DCIM Disk MediaType" $dd.MediaType
            Write-Item "Dell DCIM Disk Model"     $dd.Model
            $diskEntry.DCIMStatus = $dd.PrimaryStatus
        }
    }

    # Logical disk usage
    $partitions = Get-WmiObject -Query "ASSOCIATORS OF {Win32_DiskDrive.DeviceID='$($disk.DeviceID)'} WHERE AssocClass=Win32_DiskDriveToDiskPartition" -ErrorAction SilentlyContinue
    foreach ($part in $partitions) {
        $logicals = Get-WmiObject -Query "ASSOCIATORS OF {Win32_DiskPartition.DeviceID='$($part.DeviceID)'} WHERE AssocClass=Win32_LogicalDiskToPartition" -ErrorAction SilentlyContinue
        foreach ($ld in $logicals) {
            $freeGB  = [math]::Round($ld.FreeSpace / 1GB, 1)
            $totalGB = [math]::Round($ld.Size / 1GB, 1)
            $usedPct = if ($totalGB -gt 0) { [math]::Round((($totalGB - $freeGB) / $totalGB) * 100, 1) } else { 0 }
            $spStatus = if ($usedPct -gt 90) { "CRIT" } elseif ($usedPct -gt 80) { "WARN" } else { "OK" }
            Write-Item "  Drive $($ld.DeviceID)" "Total: $totalGB GB | Free: $freeGB GB | Used: $usedPct%" $spStatus
            if ($usedPct -gt 90) { Write-Host "      >> Drive over 90% full — SSD performance degrades above 90%." -ForegroundColor Red }
            $diskEntry.FreeSpacePct = 100 - $usedPct
        }
    }

    $diagData.Storage += $diskEntry
}

$diskErrors = Get-WinEvent -FilterHashtable @{LogName='System'; ProviderName='disk'; Level=2} -MaxEvents 20 -ErrorAction SilentlyContinue
Write-Item "Disk Error Events (recent)" $diskErrors.Count $(if ($diskErrors.Count -gt 5) { "CRIT" } elseif ($diskErrors.Count -gt 0) { "WARN" } else { "OK" })
$diagData.DiskErrorEventCount = $diskErrors.Count

# ============================================================
# SECTION 4: CPU HEALTH & PERFORMANCE
# ============================================================
Write-Section "4. CPU HEALTH & PERFORMANCE"

$cpu = Safe-CIM "Win32_Processor"
Write-Item "CPU Model"         $cpu.Name
Write-Item "Cores / Threads"   "$($cpu.NumberOfCores) / $($cpu.NumberOfLogicalProcessors)"
Write-Item "Current Speed"     "$($cpu.CurrentClockSpeed) MHz"
Write-Item "Max Speed"         "$($cpu.MaxClockSpeed) MHz"
Write-Item "Current Load"      "$($cpu.LoadPercentage)%" $(if ($cpu.LoadPercentage -gt 90) { "WARN" } else { "OK" })
Write-Item "Voltage"           "$([math]::Round($cpu.CurrentVoltage / 10, 2)) V"
Write-Item "L2 Cache"          "$($cpu.L2CacheSize) KB"
Write-Item "L3 Cache"          "$($cpu.L3CacheSize) KB"

# CPU throttling
$throttle = Get-WinEvent -FilterHashtable @{LogName='System'; Id=37} -MaxEvents 10 -ErrorAction SilentlyContinue
Write-Item "CPU Thermal Throttle Events" $throttle.Count $(if ($throttle.Count -gt 3) { "WARN" } else { "OK" })
if ($throttle.Count -gt 3) { Write-Host "    >> CPU throttling detected — possible heat or power delivery issue." -ForegroundColor Yellow }

# Dell DCIM CPU data
$dellCPU = Get-WmiObject -Namespace "root\dcim\sysman" -Class "DCIM_Processor" -ErrorAction SilentlyContinue
if ($dellCPU) {
    Write-Item "Dell DCIM CPU Status"       $dellCPU.PrimaryStatus
    Write-Item "Dell DCIM CPU Manufacturer" $dellCPU.Manufacturer
    Write-Item "Dell DCIM CPU Family"       $dellCPU.Family
    $diagData.CPUDCIMStatus = $dellCPU.PrimaryStatus
}

# Performance counters
$procCounters = @(
    "\Processor(_Total)\% Processor Time",
    "\Processor(_Total)\% Privileged Time",
    "\Processor(_Total)\% Interrupt Time",
    "\Processor(_Total)\% DPC Time"
)
$counterData = Get-Counter -Counter $procCounters -SampleInterval 2 -MaxSamples 1 -ErrorAction SilentlyContinue
if ($counterData) {
    foreach ($sample in $counterData.CounterSamples) {
        $val  = [math]::Round($sample.CookedValue, 1)
        $cName= ($sample.Path -split '\\')[-1]
        Write-Item $cName "$val%"
    }
}

# OHM temps if installed
$cpuTemps = Get-WmiObject -Namespace "root\OpenHardwareMonitor" -Class Sensor -ErrorAction SilentlyContinue | Where-Object { $_.SensorType -eq "Temperature" -and $_.Name -like "*CPU*" }
if ($cpuTemps) {
    foreach ($t in $cpuTemps) {
        $tStatus = if ($t.Value -gt 95) { "CRIT" } elseif ($t.Value -gt 85) { "WARN" } else { "OK" }
        Write-Item "CPU Temp ($($t.Name))" "$($t.Value) C" $tStatus
    }
}

$diagData.CPU = @{
    Model = $cpu.Name; Cores = $cpu.NumberOfCores; Threads = $cpu.NumberOfLogicalProcessors
    CurrentMHz = $cpu.CurrentClockSpeed; MaxMHz = $cpu.MaxClockSpeed; LoadPct = $cpu.LoadPercentage
    ThrottleEvents = $throttle.Count
}

# ============================================================
# SECTION 5: RAM / MEMORY HEALTH
# ============================================================
Write-Section "5. RAM / MEMORY HEALTH"

$os2     = Safe-CIM "Win32_OperatingSystem"
$memPhys = Safe-CIM "Win32_PhysicalMemory"
$memPerf = Safe-CIM "Win32_PerfFormattedData_PerfOS_Memory"

$totalRamGB = [math]::Round($os2.TotalVisibleMemorySize / 1MB, 1)
$freeRamGB  = [math]::Round($os2.FreePhysicalMemory / 1MB, 1)
$usedRamGB  = [math]::Round($totalRamGB - $freeRamGB, 1)
$ramUsedPct = [math]::Round(($usedRamGB / $totalRamGB) * 100, 1)

Write-Item "Total RAM"  "$totalRamGB GB"
Write-Item "Used RAM"   "$usedRamGB GB ($ramUsedPct%)" $(if ($ramUsedPct -gt 90) { "CRIT" } elseif ($ramUsedPct -gt 80) { "WARN" } else { "OK" })
Write-Item "Free RAM"   "$freeRamGB GB"

foreach ($stick in $memPhys) {
    $stickGB = [math]::Round($stick.Capacity / 1GB, 0)
    Write-Item "DIMM $($stick.DeviceLocator)" "$stickGB GB | $($stick.Speed) MHz | Mfr: $($stick.Manufacturer) | SN: $($stick.SerialNumber)"
}

if ($memPerf) {
    Write-Item "Page Faults/sec"      $memPerf.PageFaultsPersec $(if ($memPerf.PageFaultsPersec -gt 1000) { "WARN" } else { "OK" })
    Write-Item "Hard Page Faults/sec" $memPerf.PageReadsPersec  $(if ($memPerf.PageReadsPersec -gt 10) { "WARN" } else { "OK" })
    Write-Item "Available Memory"     "$([math]::Round($memPerf.AvailableMBytes / 1024, 1)) GB"
    Write-Item "Committed Bytes"      "$([math]::Round($memPerf.CommittedBytes / 1GB, 1)) GB"
    Write-Item "Pool NonPaged"        "$([math]::Round($memPerf.PoolNonpagedBytes / 1MB, 0)) MB"
}

# Dell DCIM memory
$dellMem = Get-WmiObject -Namespace "root\dcim\sysman" -Class "DCIM_Memory" -ErrorAction SilentlyContinue
if ($dellMem) {
    foreach ($dm in $dellMem) {
        Write-Item "Dell DCIM Memory Bank"   $dm.BankLabel
        Write-Item "Dell DCIM Memory Status" $dm.PrimaryStatus
        Write-Item "Dell DCIM Memory Speed"  "$($dm.Speed) MHz"
    }
}

$memErrors = Get-WinEvent -FilterHashtable @{LogName='System'; ProviderName='Microsoft-Windows-MemoryDiagnostics-Results'} -MaxEvents 5 -ErrorAction SilentlyContinue
Write-Item "Memory Diagnostic Errors" $memErrors.Count $(if ($memErrors.Count -gt 0) { "WARN" } else { "OK" })

$diagData.Memory = @{
    TotalGB = $totalRamGB; UsedGB = $usedRamGB; FreeMB = $os2.FreePhysicalMemory
    PageFaultsPersec = $memPerf.PageFaultsPersec; Sticks = @()
}
foreach ($stick in $memPhys) {
    $diagData.Memory.Sticks += @{ Slot = $stick.DeviceLocator; GB = [math]::Round($stick.Capacity / 1GB, 0); Speed = $stick.Speed }
}

# ============================================================
# SECTION 6: GPU HEALTH
# ============================================================
Write-Section "6. GPU HEALTH"

$gpus = Safe-CIM "Win32_VideoController"
$diagData.GPU = @()

foreach ($gpu in $gpus) {
    Write-Host "`n  --- GPU: $($gpu.Name) ---" -ForegroundColor White
    $vramMB  = [math]::Round($gpu.AdapterRAM / 1MB, 0)
    $drvDate = $gpu.DriverDate
    Write-Item "GPU Name"          $gpu.Name
    Write-Item "VRAM"              "$vramMB MB"
    Write-Item "Driver Version"    $gpu.DriverVersion
    Write-Item "Driver Date"       $drvDate
    Write-Item "Status"            $gpu.Status $(if ($gpu.Status -eq "OK") { "OK" } else { "WARN" })
    Write-Item "Resolution"        "$($gpu.CurrentHorizontalResolution) x $($gpu.CurrentVerticalResolution)"
    Write-Item "Refresh Rate"      "$($gpu.CurrentRefreshRate) Hz"

    if ($drvDate) {
        $drvAge = (New-TimeSpan -Start ([Management.ManagementDateTimeConverter]::ToDateTime($drvDate)) -End (Get-Date)).Days
        $drvAgeMonths = [math]::Round($drvAge / 30)
        Write-Item "Driver Age" "$drvAgeMonths months" $(if ($drvAge -gt 365) { "WARN" } else { "OK" })
        if ($drvAge -gt 365) { Write-Host "    >> GPU driver over 1 year old. Update via Dell SupportAssist." -ForegroundColor Yellow }
    }

    $diagData.GPU += @{ Name = $gpu.Name; VRAM_MB = $vramMB; DriverVersion = $gpu.DriverVersion; Status = $gpu.Status }
}

# Dell DCIM GPU
$dellGPU = Get-WmiObject -Namespace "root\dcim\sysman" -Class "DCIM_VideoController" -ErrorAction SilentlyContinue
if ($dellGPU) {
    Write-Item "Dell DCIM GPU Status"  $dellGPU.PrimaryStatus
    Write-Item "Dell DCIM GPU Driver"  $dellGPU.DriverVersion
    $diagData.GPU | ForEach-Object { $_ | Add-Member -NotePropertyName DCIMStatus -NotePropertyValue $dellGPU.PrimaryStatus -Force }
}

# Alienware/G-Series AWCC GPU status
$awccGPU = Get-WmiObject -Namespace "root\WMI" -Class "AWCCWmiMethodFunction" -ErrorAction SilentlyContinue
if ($awccGPU) { Write-Item "Alienware AWCC GPU Interface" "Detected" "OK" }

# OHM GPU temps
$gpuTemps = Get-WmiObject -Namespace "root\OpenHardwareMonitor" -Class Sensor -ErrorAction SilentlyContinue | Where-Object { $_.SensorType -eq "Temperature" -and $_.Name -like "*GPU*" }
if ($gpuTemps) {
    foreach ($t in $gpuTemps) {
        Write-Item "GPU Temp ($($t.Name))" "$($t.Value) C" $(if ($t.Value -gt 90) { "CRIT" } elseif ($t.Value -gt 80) { "WARN" } else { "OK" })
    }
}

# TDR events
$gpuTDR = Get-WinEvent -FilterHashtable @{LogName='System'; Id=4101} -MaxEvents 20 -ErrorAction SilentlyContinue
Write-Item "GPU Driver Crash (TDR) Events" $gpuTDR.Count $(if ($gpuTDR.Count -gt 2) { "WARN" } else { "OK" })

# ============================================================
# SECTION 7: THERMAL MANAGEMENT & FANS
# ============================================================
Write-Section "7. THERMAL MANAGEMENT & FANS"

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
    Write-Host "  [INFO] Thermal zones not exposed via WMI on this Dell model." -ForegroundColor Gray
}

# Dell DCIM thermal sensors
$dellThermal = Get-WmiObject -Namespace "root\dcim\sysman" -Class "DCIM_NumericSensor" -ErrorAction SilentlyContinue | Where-Object { $_.SensorType -eq 2 }
if ($dellThermal) {
    foreach ($dt in $dellThermal) {
        $tempC = $dt.CurrentReading / 10
        $tStatus = if ($tempC -gt 90) { "CRIT" } elseif ($tempC -gt 75) { "WARN" } else { "OK" }
        Write-Item "Dell DCIM Sensor: $($dt.ElementName)" "$tempC C" $tStatus
        $diagData.Thermals += @{ Zone = $dt.ElementName; TempC = $tempC; Source = "DCIM" }
    }
}

# Dell DCIM fan data
$dellFans = Get-WmiObject -Namespace "root\dcim\sysman" -Class "DCIM_Fan" -ErrorAction SilentlyContinue
if ($dellFans) {
    foreach ($fan in $dellFans) {
        $fanStatus = if ($fan.PrimaryStatus -eq 1) { "OK" } else { "WARN" }
        Write-Item "Dell Fan: $($fan.ElementName)" "$($fan.CurrentReading) RPM | Status: $($fan.PrimaryStatus)" $fanStatus
    }
    $diagData.FanData = ($dellFans | ForEach-Object { @{ Name = $_.ElementName; RPM = $_.CurrentReading; Status = $_.PrimaryStatus } })
} else {
    Write-Host "  [INFO] Fan RPM: Use Dell SupportAssist or HWiNFO64 for live RPM data." -ForegroundColor Gray
}

# Alienware/G-Series thermal mode via AWCC
$awccThermal = Get-WmiObject -Namespace "root\WMI" -Class "AWCC_ThermalInformation" -ErrorAction SilentlyContinue
if ($awccThermal) {
    Write-Item "Alienware Thermal Mode" $awccThermal.ThermalMode
    $diagData.ThermalMode = $awccThermal.ThermalMode
}

# Dell thermal mode from DCIM
$dellThermalMode = Get-WmiObject -Namespace "root\dcim\sysman" -Class "DCIM_BIOSEnumeration" -Filter "AttributeName='ThermalManagement'" -ErrorAction SilentlyContinue
if ($dellThermalMode) {
    Write-Item "Dell BIOS Thermal Mode" $dellThermalMode.CurrentValue
    $diagData.ThermalMode = $dellThermalMode.CurrentValue
}

# Kernel thermal events
$thermalEvents = Get-WinEvent -FilterHashtable @{LogName='System'; ProviderName='Microsoft-Windows-Kernel-Processor-Power'} -MaxEvents 30 -ErrorAction SilentlyContinue
Write-Item "Kernel Power/Thermal Events" $thermalEvents.Count $(if ($thermalEvents.Count -gt 10) { "WARN" } else { "OK" })

# ============================================================
# SECTION 8: POWER DELIVERY & CHARGER HEALTH
# ============================================================
Write-Section "8. POWER DELIVERY & CHARGER HEALTH"

$powerPlan = Get-WmiObject -Namespace "root\cimv2\power" -Class "Win32_PowerPlan" -Filter "IsActive=True" -ErrorAction SilentlyContinue
Write-Item "Active Power Plan" $powerPlan.ElementName

# Dell-specific: AC adapter type detection via WMI
$dellAC = Get-WmiObject -Namespace "root\dcim\sysman" -Class "DCIM_ACPowerSupply" -ErrorAction SilentlyContinue
if ($dellAC) {
    foreach ($ac in $dellAC) {
        Write-Item "Dell AC Adapter Wattage"   "$($ac.TotalOutputPower) W"
        Write-Item "Dell AC Adapter Status"    $ac.PrimaryStatus  $(if ($ac.PrimaryStatus -eq 1) { "OK" } else { "WARN" })
        Write-Item "Dell AC Adapter Type"      $ac.TypeDescription
        $diagData.ACAdapter = @{ Watts = $ac.TotalOutputPower; Status = $ac.PrimaryStatus; Type = $ac.TypeDescription }
    }
} else {
    # Fallback: check via PortableBattery
    $acFallback = Safe-CIM "Win32_PortableBattery"
    if ($acFallback) { Write-Item "Charger Info" "Detected via PortableBattery WMI" }
    Write-Host "  [INFO] Dell DCIM AC adapter class not available — install Dell Command | Monitor." -ForegroundColor Gray
}

# Dell underpowered adapter detection (common Dell issue — wrong wattage adapter)
$underPowerEvent = Get-WinEvent -FilterHashtable @{LogName='Application'; ProviderName='DellBatteryAlert'} -MaxEvents 5 -ErrorAction SilentlyContinue
Write-Item "Dell Underpowered Adapter Alerts" $underPowerEvent.Count $(if ($underPowerEvent.Count -gt 0) { "WARN" } else { "OK" })
if ($underPowerEvent.Count -gt 0) { Write-Host "    >> Wrong wattage charger detected — use Dell original adapter." -ForegroundColor Yellow }

# Power efficiency report
$powerReportPath = "$env:TEMP\power_report_dell.html"
powercfg /energy /output $powerReportPath /duration 20 2>$null
if (Test-Path $powerReportPath) {
    $powerContent = Get-Content $powerReportPath -Raw
    $warnings = ([regex]::Matches($powerContent, "WARNING")).Count
    $errors   = ([regex]::Matches($powerContent, "ERROR")).Count
    Write-Item "Power Efficiency Warnings" $warnings $(if ($warnings -gt 5) { "WARN" } else { "OK" })
    Write-Item "Power Efficiency Errors"   $errors   $(if ($errors -gt 2) { "CRIT" } else { "OK" })
    $diagData.PowerEfficiency = @{ Warnings = $warnings; Errors = $errors }
}

$sleepEvents = Get-WinEvent -FilterHashtable @{LogName='System'; Id=42}  -MaxEvents 20 -ErrorAction SilentlyContinue
$wakeEvents  = Get-WinEvent -FilterHashtable @{LogName='System'; Id=1}   -MaxEvents 20 -ErrorAction SilentlyContinue
Write-Item "Sleep Events (recent)" $sleepEvents.Count
Write-Item "Wake Events (recent)"  $wakeEvents.Count

$csInfo    = powercfg /a 2>&1
$csSupport = if ($csInfo -match "Standby \(S0 Low Power Idle\).*Available") { "Supported" } else { "Not supported" }
Write-Item "Modern Standby (S0)" $csSupport

$diagData.Power = @{
    Plan = $powerPlan.ElementName; SleepEvents = $sleepEvents.Count
    WakeEvents = $wakeEvents.Count; ModernStandby = $csSupport
}

# ============================================================
# SECTION 9: STARTUP HEALTH & BOOT PERFORMANCE
# ============================================================
Write-Section "9. STARTUP HEALTH & BOOT PERFORMANCE"

$bootEvent = Get-WinEvent -FilterHashtable @{LogName='Microsoft-Windows-Diagnostics-Performance/Operational'; Id=100} -MaxEvents 5 -ErrorAction SilentlyContinue
if ($bootEvent) {
    foreach ($be in $bootEvent | Select-Object -First 3) {
        $bootMs  = ([xml]$be.ToXml()).Event.EventData.Data | Where-Object { $_.Name -eq "BootDuration" } | Select-Object -ExpandProperty "#text"
        $bootSec = [math]::Round([int]$bootMs / 1000, 1)
        Write-Item "Boot Duration" "$bootSec seconds" $(if ($bootSec -gt 60) { "WARN" } elseif ($bootSec -gt 120) { "CRIT" } else { "OK" })
    }
}

$biosPost = Get-WinEvent -FilterHashtable @{LogName='Microsoft-Windows-Diagnostics-Performance/Operational'; Id=100} -MaxEvents 1 -ErrorAction SilentlyContinue
if ($biosPost) {
    $biosMs  = ([xml]$biosPost[0].ToXml()).Event.EventData.Data | Where-Object { $_.Name -eq "BIOSDuration" } | Select-Object -ExpandProperty "#text"
    $biosSec = [math]::Round([int]$biosMs / 1000, 1)
    Write-Item "BIOS POST Duration" "$biosSec seconds" $(if ($biosSec -gt 20) { "WARN" } else { "OK" })
    $diagData.Startup = @{ BIOSPostSec = $biosSec }
}

$startupItems  = Get-CimInstance Win32_StartupCommand -ErrorAction SilentlyContinue
Write-Item "Startup Programs Count" $startupItems.Count $(if ($startupItems.Count -gt 20) { "WARN" } else { "OK" })

$startupDelays = Get-WinEvent -FilterHashtable @{LogName='Microsoft-Windows-Diagnostics-Performance/Operational'; Id=101,102,103} -MaxEvents 10 -ErrorAction SilentlyContinue
Write-Item "Startup Delay Events" $startupDelays.Count $(if ($startupDelays.Count -gt 5) { "WARN" } else { "OK" })

$fastStartup = (Get-ItemProperty "HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager\Power" -ErrorAction SilentlyContinue).HiberbootEnabled
Write-Item "Fast Startup" $(if ($fastStartup -eq 1) { "Enabled" } else { "Disabled" })

$shutdownEvents = Get-WinEvent -FilterHashtable @{LogName='System'; Id=41,1074,6006,6008} -MaxEvents 10 -ErrorAction SilentlyContinue
$unexpectedShutdowns = ($shutdownEvents | Where-Object { $_.Id -eq 41 }).Count
Write-Item "Unexpected Shutdown Events (Kernel-41)" $unexpectedShutdowns $(if ($unexpectedShutdowns -gt 2) { "WARN" } else { "OK" })

$diagData.Startup.StartupProgramCount   = $startupItems.Count
$diagData.Startup.UnexpectedShutdowns   = $unexpectedShutdowns

# ============================================================
# SECTION 10: DRIVER HEALTH
# ============================================================
Write-Section "10. DRIVER HEALTH"

$drivers        = Get-WmiObject Win32_SystemDriver -ErrorAction SilentlyContinue
$runningDrivers = $drivers | Where-Object { $_.State -eq "Running" }
$stoppedDrivers = $drivers | Where-Object { $_.State -ne "Running" -and $_.StartMode -eq "Auto" }
Write-Item "Total Drivers"            $drivers.Count
Write-Item "Running Drivers"          $runningDrivers.Count
Write-Item "Auto-Start But Stopped"   $stoppedDrivers.Count $(if ($stoppedDrivers.Count -gt 5) { "WARN" } else { "OK" })

$problemDevices = Get-WmiObject Win32_PnPEntity -ErrorAction SilentlyContinue | Where-Object { $_.ConfigManagerErrorCode -ne 0 }
Write-Item "Problem Devices" $problemDevices.Count $(if ($problemDevices.Count -gt 0) { "WARN" } else { "OK" })
if ($problemDevices) {
    foreach ($pd in $problemDevices) {
        Write-Host "    >> Problem: $($pd.Name) - Error Code: $($pd.ConfigManagerErrorCode)" -ForegroundColor Yellow
    }
}

# Dell-specific drivers
$dellDrivers = $drivers | Where-Object { $_.PathName -like "*dell*" -or $_.PathName -like "*alienware*" -or $_.PathName -like "*dcim*" }
Write-Item "Dell-Specific Drivers" $dellDrivers.Count

# Dell DCIM driver status
$dellDCIMDriver = Get-WmiObject -Namespace "root\dcim\sysman" -Class "DCIM_SoftwareIdentity" -ErrorAction SilentlyContinue | Select-Object -First 5
if ($dellDCIMDriver) {
    foreach ($drv in $dellDCIMDriver) {
        Write-Item "Dell DCIM Software: $($drv.ElementName)" "v$($drv.VersionString)"
    }
}

$driverErrors = Get-WinEvent -FilterHashtable @{LogName='System'; Level=2; ProviderName='Service Control Manager'} -MaxEvents 20 -ErrorAction SilentlyContinue
Write-Item "Driver Service Errors" $driverErrors.Count $(if ($driverErrors.Count -gt 5) { "WARN" } else { "OK" })

$diagData.Drivers = @{
    Total = $drivers.Count; Running = $runningDrivers.Count
    ProblemDevices = $problemDevices.Count
    ProblemDeviceList = ($problemDevices | Select-Object -ExpandProperty Name)
    DellSpecificCount = $dellDrivers.Count
}

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
    Write-Item "Description"    $nic.InterfaceDescription
    Write-Item "IP Address"     $($nicIP -join ', ')
    Write-Item "Link Speed"     "$([math]::Round($nic.LinkSpeed / 1MB, 0)) Mbps"
    Write-Item "MAC Address"    $nic.MacAddress
    Write-Item "Driver Version" $nic.DriverVersion

    if ($nicStats) {
        Write-Item "Bytes Received"  "$([math]::Round($nicStats.ReceivedBytes / 1MB, 1)) MB"
        Write-Item "Bytes Sent"      "$([math]::Round($nicStats.SentBytes / 1MB, 1)) MB"
        Write-Item "Receive Errors"  $nicStats.ReceivedErrors   $(if ($nicStats.ReceivedErrors -gt 100) { "WARN" } else { "OK" })
        Write-Item "Transmit Errors" $nicStats.OutboundErrors    $(if ($nicStats.OutboundErrors -gt 100) { "WARN" } else { "OK" })
        $diagData.Network += @{ Name = $nic.Name; SpeedMbps = [math]::Round($nic.LinkSpeed / 1MB, 0); RecvErrors = $nicStats.ReceivedErrors; SendErrors = $nicStats.OutboundErrors }
    }
}

# Dell DCIM NIC status
$dellNIC = Get-WmiObject -Namespace "root\dcim\sysman" -Class "DCIM_NICView" -ErrorAction SilentlyContinue | Select-Object -First 3
if ($dellNIC) {
    foreach ($n in $dellNIC) {
        Write-Item "Dell DCIM NIC: $($n.ProductName)" "MAC: $($n.PermanentMACAddress) | Speed: $($n.LinkSpeed) Mbps"
    }
}

$wifiDrops = Get-WinEvent -FilterHashtable @{LogName='Microsoft-Windows-WLAN-AutoConfig/Operational'; Level=2} -MaxEvents 30 -ErrorAction SilentlyContinue
Write-Item "Wi-Fi Disconnect Events" $wifiDrops.Count $(if ($wifiDrops.Count -gt 5) { "WARN" } else { "OK" })
$diagData.WiFiDropEvents = $wifiDrops.Count

$dnsTest = Resolve-DnsName "google.com" -ErrorAction SilentlyContinue
Write-Item "DNS Resolution Test" $(if ($dnsTest) { "PASS" } else { "FAIL" }) $(if ($dnsTest) { "OK" } else { "WARN" })

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
    $commitLimit = [math]::Round($vmPerf.CommitLimit / 1GB, 1)
    $committedGB = [math]::Round($vmPerf.CommittedBytes / 1GB, 1)
    $commitPct   = [math]::Round(($committedGB / $commitLimit) * 100, 1)
    Write-Item "Commit Limit"        "$commitLimit GB"
    Write-Item "Committed Memory"    "$committedGB GB ($commitPct%)" $(if ($commitPct -gt 80) { "WARN" } else { "OK" })
    Write-Item "System Cache"        "$([math]::Round($vmPerf.CacheBytes / 1MB, 0)) MB"
    Write-Item "Free PTE Entries"    $vmPerf.FreeSystemPageTableEntries $(if ($vmPerf.FreeSystemPageTableEntries -lt 5000) { "WARN" } else { "OK" })
    Write-Item "Paged Pool"          "$([math]::Round($vmPerf.PoolPagedBytes / 1MB, 0)) MB"
    Write-Item "Non-Paged Pool"      "$([math]::Round($vmPerf.PoolNonpagedBytes / 1MB, 0)) MB"
    Write-Item "Transition Faults/s" $vmPerf.TransitionFaultsPersec
    if ($commitPct -gt 80) { Write-Host "    >> High memory pressure — system is relying heavily on page file." -ForegroundColor Yellow }
    $diagData.MemoryPressure = @{ CommitLimitGB = $commitLimit; CommittedGB = $committedGB; CommitPct = $commitPct }
}

$pageFiles = Safe-CIM "Win32_PageFileSetting"
foreach ($pf in $pageFiles) {
    Write-Item "Page File" "$($pf.Name) | Init: $($pf.InitialSize) MB | Max: $($pf.MaximumSize) MB"
}

# ============================================================
# SECTION 13: WINDOWS HEALTH & SYSTEM INTEGRITY
# ============================================================
Write-Section "13. WINDOWS HEALTH & SYSTEM INTEGRITY"

$cbsLog = "$env:windir\Logs\CBS\CBS.log"
if (Test-Path $cbsLog) {
    $cbsContent = Get-Content $cbsLog -Tail 100 -ErrorAction SilentlyContinue
    $sfcErrors  = ($cbsContent | Select-String "Cannot repair").Count
    $sfcFixed   = ($cbsContent | Select-String "successfully repaired").Count
    Write-Item "SFC Errors Found"   $sfcErrors $(if ($sfcErrors -gt 0) { "WARN" } else { "OK" })
    Write-Item "SFC Files Repaired" $sfcFixed
}

$criticalEvents = Get-WinEvent -FilterHashtable @{LogName='System'; Level=1} -MaxEvents 20  -ErrorAction SilentlyContinue
$errorEvents    = Get-WinEvent -FilterHashtable @{LogName='System'; Level=2} -MaxEvents 100 -ErrorAction SilentlyContinue
Write-Item "Critical System Events" $criticalEvents.Count $(if ($criticalEvents.Count -gt 3) { "CRIT" } else { "OK" })
Write-Item "Error System Events"    $errorEvents.Count    $(if ($errorEvents.Count -gt 20) { "WARN" } else { "OK" })

$wheaErrors = Get-WinEvent -FilterHashtable @{LogName='System'; ProviderName='Microsoft-Windows-WHEA-Logger'} -MaxEvents 20 -ErrorAction SilentlyContinue
Write-Item "WHEA Hardware Errors" $wheaErrors.Count $(if ($wheaErrors.Count -gt 0) { "CRIT" } else { "OK" })
if ($wheaErrors.Count -gt 0) { Write-Host "    >> CRITICAL: Hardware errors detected! Possible CPU/RAM/motherboard failure." -ForegroundColor Red }

# Dell-specific: SupportAssist Pre-boot assessment result
$saKey = "HKLM:\SOFTWARE\Dell\SARemediation\audit"
if (Test-Path $saKey) {
    $saResult = Get-ItemProperty $saKey -ErrorAction SilentlyContinue
    Write-Item "Dell SupportAssist Last Scan" $saResult.LastScanTime
    Write-Item "Dell SupportAssist Result"    $saResult.ScanResult
}

$diagData.WindowsHealth = @{
    CriticalEvents = $criticalEvents.Count; ErrorEvents = $errorEvents.Count
    WHEAErrors = $wheaErrors.Count; SFCErrors = $sfcErrors
}

# ============================================================
# SECTION 14: DELL-SPECIFIC HARDWARE MONITORING
# ============================================================
Write-Section "14. DELL-SPECIFIC HARDWARE FEATURES"

# Dell SupportAssist services
$dellServices = @(
    "DellSupportAssistRemedyforPCs",
    "SupportAssistAgent",
    "DellDataVaultSvc",
    "DFSSvc",
    "DellTechHub",
    "PCAMaster",
    "PCASvc"
)
foreach ($svcName in $dellServices) {
    $svc = Get-Service -Name $svcName -ErrorAction SilentlyContinue
    if ($svc) { Write-Item "Service: $svcName" $svc.Status $(if ($svc.Status -eq "Running") { "OK" } else { "INFO" }) }
}

# Dell Command | Monitor
$dcm = Get-WmiObject -Namespace "root\dcim\sysman" -Class "DCIM_ComputerSystem" -ErrorAction SilentlyContinue
if ($dcm) {
    Write-Item "Dell DCIM System Name"   $dcm.ElementName
    Write-Item "Dell DCIM Manufacturer"  $dcm.Manufacturer
    Write-Item "Dell DCIM Primary Status" $dcm.PrimaryStatus
    $diagData.DellDCIM = @{ ElementName = $dcm.ElementName; PrimaryStatus = $dcm.PrimaryStatus }
}

# Alienware Command Center (AWCC)
$awcc = Get-WmiObject -Namespace "root\WMI" -Class "AWCCWmiMethodFunction" -ErrorAction SilentlyContinue
if ($awcc) {
    Write-Item "Alienware AWCC" "Detected — Alienware Command Center active" "OK"
    $diagData.IsAlienware = $true
}

# Dell G-Series gaming features
$gSeries = Get-Service -Name "AlienFXService","AWCCService" -ErrorAction SilentlyContinue
foreach ($gs in $gSeries) { Write-Item "Gaming Service: $($gs.Name)" $gs.Status }

# Dell XPS thermal alert (common issue: thermal pad degradation)
$xpsThermalLog = Get-WinEvent -FilterHashtable @{LogName='Application'; ProviderName='Dell*'; Level=3} -MaxEvents 10 -ErrorAction SilentlyContinue
Write-Item "Dell Application Warnings" $xpsThermalLog.Count $(if ($xpsThermalLog.Count -gt 3) { "WARN" } else { "OK" })

# Dell hardware RAID / storage controller
$dellRAID = Get-WmiObject -Namespace "root\dcim\sysman" -Class "DCIM_ControllerView" -ErrorAction SilentlyContinue
if ($dellRAID) {
    Write-Item "Dell Storage Controller" "$($dellRAID.ProductName) | Status: $($dellRAID.PrimaryStatus)"
}

# Precision workstation features
$dellPrecision = Get-WmiObject -Namespace "root\dcim\sysman" -Class "DCIM_Chassis" -ErrorAction SilentlyContinue
if ($dellPrecision) {
    Write-Item "Dell Chassis Model"  $dellPrecision.Model
    Write-Item "Dell Chassis Status" $dellPrecision.PrimaryStatus
}

# Keyboard backlight (XPS/Inspiron)
$kbdLight = Get-WmiObject -Namespace "root\WMI" -Class "Dell_KeyboardBacklightColor" -ErrorAction SilentlyContinue
if ($kbdLight) { Write-Item "Dell Keyboard Backlight" "Detected" }

$diagData.DellSpecific = @{
    DCIMAvailable    = ($null -ne $dcm)
    IsAlienware      = ($null -ne $awcc)
    SupportAssistSvc = ($dellServices | ForEach-Object { (Get-Service $_ -EA SilentlyContinue)?.Status })
}

# ============================================================
# SECTION 15: CORRELATION ANALYSIS (Cross-Metric)
# ============================================================
Write-Section "15. CROSS-METRIC CORRELATION ANALYSIS"

Write-Host "  Analyzing metric combinations for early failure patterns..." -ForegroundColor Gray
$correlationFlags = @()

# Battery + thermal (Dell XPS swollen battery pattern)
if ($diagData.Battery.HealthPct -lt 75 -and $diagData.Thermals.Count -gt 0) {
    $avgTemp = ($diagData.Thermals | Measure-Object -Property TempC -Average).Average
    if ($avgTemp -gt 50) { $correlationFlags += "BATTERY_HEAT_DEGRADATION: Low battery health + high thermals = accelerated degradation (common on Dell XPS)" }
}

# Dell underpowered adapter + battery not charging
if ($diagData.ACAdapter.Watts -lt 45 -and $diagData.Battery.DischargeRate -gt 0) {
    $correlationFlags += "UNDERPOWERED_ADAPTER: Adapter wattage too low for load — battery draining while plugged in"
}

# SSD wear + high RAM usage (paging death spiral)
if ($diagData.Memory.FreeMB -lt 512000 -and $diagData.Storage[0].SMARTWear -gt 40) {
    $correlationFlags += "SSD_PRESSURE_WEAR: High RAM usage forcing SSD paging + SSD already worn = compounding failure risk"
}

# CPU throttling + old thermal paste (common on 3+ year old Dells)
if ($diagData.CPU.ThrottleEvents -gt 3 -and $diagData.SystemIdentity.BIOSAgeMonths -gt 36) {
    $correlationFlags += "THERMAL_PASTE_AGE: CPU throttling on $($diagData.SystemIdentity.BIOSAgeMonths)-month-old system = thermal paste likely degraded"
}

# WHEA errors + unexpected shutdowns
if ($diagData.WHEAErrors -gt 0 -and $diagData.Startup.UnexpectedShutdowns -gt 2) {
    $correlationFlags += "HARDWARE_INSTABILITY: WHEA errors + $($diagData.Startup.UnexpectedShutdowns) crashes = RAM or motherboard failure risk"
}

# Disk errors + high PowerOnHours
if ($diagData.DiskErrorEventCount -gt 3 -and $diagData.Storage[0].PowerOnHours -gt 15000) {
    $correlationFlags += "SSD_END_OF_LIFE: Disk errors + $($diagData.Storage[0].PowerOnHours) power-on hours = SSD approaching end of life"
}

# Wi-Fi drops + driver age (common Dell Wi-Fi Killer/Realtek issue)
if ($diagData.WiFiDropEvents -gt 5) {
    $correlationFlags += "WIFI_INSTABILITY: $($diagData.WiFiDropEvents) Wi-Fi drops — Killer/Realtek driver known issue on Dell; update drivers"
}

# Memory pressure + startup bloat
if ($diagData.MemoryPressure.CommitPct -gt 75 -and $diagData.Startup.StartupProgramCount -gt 15) {
    $correlationFlags += "MEMORY_PRESSURE: $($diagData.MemoryPressure.CommitPct)% commit + $($diagData.Startup.StartupProgramCount) startup programs = chronic pressure"
}

# Old BIOS + battery issues (Dell BIOS updates fix charge calibration)
if ($diagData.SystemIdentity.BIOSAgeMonths -gt 24 -and $diagData.Battery.HealthPct -lt 80) {
    $correlationFlags += "BIOS_BATTERY_CALIBRATION: Old BIOS + degraded battery = suboptimal Dell charge management; update BIOS"
}

# GPU TDR + thermal issues (Alienware/G-Series overheating GPU)
if ($gpuTDR.Count -gt 2 -and $diagData.Thermals.Count -gt 0) {
    $avgTemp = ($diagData.Thermals | Measure-Object -Property TempC -Average).Average
    if ($avgTemp -gt 70) { $correlationFlags += "GPU_THERMAL_CRASH: $($gpuTDR.Count) GPU crashes + high thermals = GPU thermal throttle causing TDR" }
}

if ($correlationFlags.Count -eq 0) {
    Write-Host "  [OK] No significant cross-metric correlation issues detected." -ForegroundColor Green
} else {
    Write-Host "`n  CORRELATION FLAGS DETECTED:" -ForegroundColor Red
    foreach ($flag in $correlationFlags) { Write-Host "  >> $flag" -ForegroundColor Yellow }
}
$diagData.CorrelationFlags = $correlationFlags

# ============================================================
# SECTION 16: HABIT COACHING DATA COLLECTION
# ============================================================
Write-Section "16. USAGE HABIT ANALYSIS"

$uptimeSec    = (Get-Date) - $os.LastBootUpTime
$uptimeDays   = [math]::Round($uptimeSec.TotalDays, 1)
Write-Item "System Uptime" "$uptimeDays days" $(if ($uptimeDays -gt 14) { "WARN" } else { "OK" })
if ($uptimeDays -gt 14) { Write-Host "    >> Habit tip: Restart weekly to clear memory leaks and apply updates." -ForegroundColor Yellow }

$topProcs = Get-Process | Sort-Object CPU -Descending | Select-Object -First 5
Write-Host "`n  Top 5 CPU Consuming Processes:" -ForegroundColor White
foreach ($p in $topProcs) {
    Write-Host "    $($p.Name) | CPU: $([math]::Round($p.CPU, 1))s | RAM: $([math]::Round($p.WorkingSet / 1MB, 0)) MB"
}

$browsers = Get-Process -Name "chrome","firefox","msedge","opera" -ErrorAction SilentlyContinue
$browserCount = ($browsers | Measure-Object).Count
if ($browserCount -gt 0) {
    $browserRam = ($browsers | Measure-Object -Property WorkingSet -Sum).Sum
    Write-Item "Browser RAM Usage" "$([math]::Round($browserRam / 1MB, 0)) MB across $browserCount processes"
}

$diagData.HabitData = @{
    UptimeDays = $uptimeDays; BrowserProcessCount = $browserCount
    TopProcesses = ($topProcs | Select-Object -ExpandProperty Name)
}

# ============================================================
# SECTION 17: PREDICTIVE HEALTH SCORE SUMMARY
# ============================================================
Write-Section "17. PREDICTIVE HEALTH SCORE SUMMARY"

$healthScore = 100
$deductions  = @()

if ($diagData.Battery.HealthPct -lt 60)       { $healthScore -= 25; $deductions += "Battery critical (<60%): -25" }
elseif ($diagData.Battery.HealthPct -lt 80)    { $healthScore -= 12; $deductions += "Battery degraded (<80%): -12" }
if ($diagData.Battery.CycleCounts -gt 800)     { $healthScore -= 10; $deductions += "High cycle count (>800): -10" }
if ($diagData.DiskErrorEventCount -gt 5)       { $healthScore -= 20; $deductions += "Disk errors (>5): -20" }
if ($diagData.Storage[0].SMARTWear -gt 80)     { $healthScore -= 20; $deductions += "SSD wear >80%: -20" }
if ($diagData.WHEAErrors -gt 0)                { $healthScore -= 25; $deductions += "WHEA hardware errors: -25" }
if ($diagData.MemoryPressure.CommitPct -gt 80) { $healthScore -= 10; $deductions += "High memory pressure (>80%): -10" }
if ($diagData.Startup.UnexpectedShutdowns -gt 5){ $healthScore -= 15; $deductions += "Frequent crashes (>5): -15" }
if ($diagData.CPU.ThrottleEvents -gt 5)        { $healthScore -= 8;  $deductions += "CPU throttling (>5 events): -8" }
if ($diagData.SystemIdentity.BIOSAgeMonths -gt 36){ $healthScore -= 5; $deductions += "BIOS very outdated (>3yr): -5" }
if ($diagData.Drivers.ProblemDevices -gt 3)    { $healthScore -= 10; $deductions += "Problem devices (>3): -10" }
if ($underPowerEvent.Count -gt 0)              { $healthScore -= 8;  $deductions += "Underpowered adapter alerts: -8" }
$healthScore -= ($diagData.CorrelationFlags.Count * 3)
if ($diagData.CorrelationFlags.Count -gt 0)    { $deductions += "Correlation risk flags ($($diagData.CorrelationFlags.Count)): -$($diagData.CorrelationFlags.Count * 3)" }

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

$diagData | ConvertTo-Json -Depth 10 | Out-File $jsonPath -Encoding UTF8
Write-Host "  JSON data saved: $jsonPath" -ForegroundColor Green

$reportLines = @(
    "DELL LAPTOP DIAGNOSTIC REPORT",
    "Generated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')",
    "Model: $($diagData.SystemIdentity.Model)",
    "Service Tag: $($diagData.SystemIdentity.SerialNumber)",
    "Product Line: $($diagData.SystemIdentity.ProductLine)",
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
    "- Dell DCIM Available: $($diagData.SystemIdentity.DellDCIMAvailable)",
    "",
    "CORRELATION FLAGS:",
    ($diagData.CorrelationFlags | ForEach-Object { "- $_" }) -join "`n",
    "",
    "SCORE DEDUCTIONS:",
    ($deductions | ForEach-Object { "- $_" }) -join "`n",
    "",
    "Full JSON data:    $jsonPath",
    "Battery report:    $batteryReportPath",
    "Power report:      $powerReportPath",
    "",
    "NEXT STEPS:",
    "- Visit dell.com/support and enter Service Tag: $serialNumber",
    "- Run Dell SupportAssist for hardware diagnostics",
    "- Update BIOS via Dell SupportAssist if age > 24 months"
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

if ($dellThermal) {
    foreach ($dt in $dellThermal) {
        $c = [math]::Round($dt.CurrentReading / 10.0, 1)
        if ($null -eq $maxTempC -or $c -gt $maxTempC) { $maxTempC = $c }
        $sentinelThermalZones += [ordered]@{ name = $dt.ElementName; tempC = $c }
    }
    $sentinelThermals = [ordered]@{
        maxTempC       = $maxTempC
        zoneCount      = $sentinelThermalZones.Count
        zones          = $sentinelThermalZones
        thermalSource  = "dcim"
        thermalSamples = $sentinelThermalZones.Count
    }
} else {
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