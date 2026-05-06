# ============================================================
#  sentinel-collect.ps1  --  Sentinel Hardware Collector v1
#  Schema version: 1 (Integrated CLI Diagnostic Extensions)
#
#  Collects hardware details, security metrics, processes,
#  and errors, then automatically uploads to the Sentinel Cloud.
# ============================================================

$SENTINEL_API_URL      = "https://sentinel-api-zaue.onrender.com"
$SENTINEL_FRONTEND_URL = "https://sentinel-site-rosy.vercel.app"

$ErrorActionPreference = 'SilentlyContinue'
$ProgressPreference    = 'SilentlyContinue'

Write-Host ""
Write-Host "  [+] Initializing Sentinel Diagnostics..." -ForegroundColor Cyan

Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;

public class NvmeSmart {
    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern IntPtr CreateFile(string lpFileName, uint dwDesiredAccess, uint dwShareMode, IntPtr lpSecurityAttributes, uint dwCreationDisposition, uint dwFlagsAndAttributes, IntPtr hTemplateFile);
    
    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern bool DeviceIoControl(IntPtr hDevice, uint dwIoControlCode, IntPtr lpInBuffer, uint nInBufferSize, IntPtr lpOutBuffer, uint nOutBufferSize, out uint lpBytesReturned, IntPtr lpOverlapped);
    
    [DllImport("kernel32.dll")]
    public static extern bool CloseHandle(IntPtr hObject);

    public class SmartData {
        public int PercentageUsed;
        public int AvailableSpare;
        public int AvailableSpareThreshold;
        public int CriticalWarning;
    }

    public static SmartData GetSmartInfo(int physicalDriveNumber) {
        IntPtr hDevice = CreateFile("\\\\.\\" + "PhysicalDrive" + physicalDriveNumber, 0, 3, IntPtr.Zero, 3, 0, IntPtr.Zero);
        if (hDevice == new IntPtr(-1)) return null;
        
        try {
            int bufferSize = 1024;
            IntPtr buffer = Marshal.AllocHGlobal(bufferSize);
            for(int i=0; i<bufferSize; i++) Marshal.WriteByte(buffer, i, 0);
            
            Marshal.WriteInt32(buffer, 0, 49);
            Marshal.WriteInt32(buffer, 4, 0); 
            Marshal.WriteInt32(buffer, 12, 3);
            Marshal.WriteInt32(buffer, 16, 2);
            Marshal.WriteInt32(buffer, 20, 2);
            Marshal.WriteInt32(buffer, 24, 0);
            Marshal.WriteInt32(buffer, 28, 40);
            Marshal.WriteInt32(buffer, 32, 512);
            
            uint bytesReturned;
            bool success = DeviceIoControl(hDevice, 0x2D1400, buffer, 52, buffer, (uint)bufferSize, out bytesReturned, IntPtr.Zero);
            
            if (success) {
                IntPtr logPagePtr = new IntPtr(buffer.ToInt64() + 40);
                SmartData data = new SmartData();
                data.CriticalWarning = Marshal.ReadByte(logPagePtr, 0);
                data.AvailableSpare = Marshal.ReadByte(logPagePtr, 3);
                data.AvailableSpareThreshold = Marshal.ReadByte(logPagePtr, 4);
                data.PercentageUsed = Marshal.ReadByte(logPagePtr, 5);
                Marshal.FreeHGlobal(buffer);
                return data;
            }
            Marshal.FreeHGlobal(buffer);
            return null;
        } finally {
            CloseHandle(hDevice);
        }
    }
}
"@

Write-Host "  [+] Gathering System Telemetry..." -ForegroundColor Yellow

# -- System -----------------------------------------------------------------------
$cs   = Get-CimInstance Win32_ComputerSystem
$os   = Get-CimInstance Win32_OperatingSystem
$bios = Get-CimInstance Win32_BIOS
$uptime = (Get-Date) - $os.LastBootUpTime

$system = [ordered]@{
    hostname     = $env:COMPUTERNAME
    model        = "$($cs.Manufacturer) $($cs.Model)".Trim()
    manufacturer = $cs.Manufacturer
    os           = $os.Caption
    osVersion    = $os.Version
    osBuild      = $os.BuildNumber
    biosVersion  = $bios.SMBIOSBIOSVersion
    uptime       = ("{0}d {1}h {2}m" -f $uptime.Days, $uptime.Hours, $uptime.Minutes)
}

# -- CPU --------------------------------------------------------------------------
$proc    = Get-CimInstance Win32_Processor | Select-Object -First 1
$loadAvg = (Get-CimInstance Win32_Processor | Select-Object -ExpandProperty LoadPercentage | Measure-Object -Average).Average

$cpuTemp = $null
try {
    $cpuTempSensor = Get-CimInstance -Namespace "root/OpenHardwareMonitor" -ClassName Sensor -ErrorAction SilentlyContinue |
                     Where-Object { $_.SensorType -eq "Temperature" -and $_.Name -match "CPU" } |
                     Select-Object -First 1
    if ($cpuTempSensor) { $cpuTemp = [math]::Round($cpuTempSensor.Value, 1) }
} catch {}

$cpu = [ordered]@{
    name        = $proc.Name.Trim()
    cores       = [int]($proc.NumberOfCores)
    threads     = [int]($proc.NumberOfLogicalProcessors)
    avgLoadPct  = [math]::Round($loadAvg, 1)
    maxClockMhz = [int]($proc.MaxClockSpeed)
    tempC       = $cpuTemp
}

# -- RAM --------------------------------------------------------------------------
$memOS = Get-CimInstance Win32_OperatingSystem
$dimms = Get-CimInstance Win32_PhysicalMemory -ErrorAction SilentlyContinue
$dimmSlots = @()
foreach ($d in $dimms) {
    $dimmSlots += [ordered]@{
        slot   = $d.DeviceLocator
        sizeGb = [math]::Round($d.Capacity / 1GB, 0)
        speed  = $d.Speed
    }
}

$memory = [ordered]@{
    totalGB   = [math]::Round($memOS.TotalVisibleMemorySize / 1MB, 1)
    usedPct   = [math]::Round((($memOS.TotalVisibleMemorySize - $memOS.FreePhysicalMemory) / $memOS.TotalVisibleMemorySize) * 100, 1)
    dimmSlots = $dimmSlots
}

# -- GPU --------------------------------------------------------------------------
$gpusList = @()
$gpus = Get-CimInstance Win32_VideoController -ErrorAction SilentlyContinue
foreach ($g in $gpus) {
    $vram = if ($g.AdapterRAM -gt 0) { [math]::Round($g.AdapterRAM/1GB, 1) } else { $null }
    $gpuTemp = $null
    try {
        $gpuTempSensor = Get-CimInstance -Namespace "root/OpenHardwareMonitor" -ClassName Sensor -ErrorAction SilentlyContinue |
                         Where-Object { $_.SensorType -eq "Temperature" -and $_.Name -match "GPU" } |
                         Select-Object -First 1
        if ($gpuTempSensor) { $gpuTemp = [math]::Round($gpuTempSensor.Value, 1) }
    } catch { }
    $gpusList += [ordered]@{
        name          = $g.Caption
        vramGb        = $vram
        driverVersion = $g.DriverVersion
        driverDate    = $g.DriverDate
        status        = $g.Status
        tempC         = $gpuTemp
    }
}

# -- Battery -----------------------------------------------------------------------
$battery = $null
$battWmi    = Get-CimInstance Win32_Battery
$battFull   = Get-CimInstance -Namespace root\wmi -ClassName BatteryFullChargedCapacity  -ErrorAction SilentlyContinue
$battDesign = Get-CimInstance -Namespace root\wmi -ClassName BatteryStaticData           -ErrorAction SilentlyContinue
$battCycles = Get-CimInstance -Namespace root\wmi -ClassName BatteryCycleCount           -ErrorAction SilentlyContinue
$battStatus = Get-CimInstance -Namespace root\wmi -ClassName BatteryStatus               -ErrorAction SilentlyContinue

if ($battWmi) {
    $designCapRaw = if ($battDesign -and $battDesign.DesignedCapacity -gt 0) {
                        [int]($battDesign.DesignedCapacity)
                    } elseif ($battWmi.DesignCapacity -gt 0) {
                        [int]($battWmi.DesignCapacity)
                    } else { 0 }

    $fullCap    = if ($battFull -and $battFull.FullChargedCapacity -gt 0) {
                      [int]($battFull.FullChargedCapacity)
                  } elseif ($battWmi.FullChargeCapacity -gt 0) {
                      [int]($battWmi.FullChargeCapacity)
                  } else { 0 }

    $designCap  = $designCapRaw
    $cycles     = if ($battCycles) { [int]($battCycles.CycleCount) } else { $null }

    $health = $null
    if ($designCap -gt 0 -and $fullCap -gt 0) {
        $health = [math]::Round([math]::Min(($fullCap / $designCap) * 100, 100), 1)
    } elseif ($fullCap -gt 0 -and $designCap -eq 0) {
        $designCap = $fullCap
        $health = 100.0
    }

    $discharge  = if ($battStatus) { [int]($battStatus.DischargeRate) } else { $null }

    $battery = [ordered]@{
        designCapacity      = $designCap
        fullChargeCapacity  = $fullCap
        cycleCount          = $cycles
        health              = $health
        status              = [int]($battWmi.BatteryStatus)
        dischargeRateMw     = $discharge
        estimatedRuntimeMin = if ($battWmi.EstimatedRunTime) { [int]($battWmi.EstimatedRunTime) } else { $null }
    }
}

# -- Thermals ---------------------------------------------------------------------
function Get-ThermalData {
    # 1. Performance Counter
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
            if ($static) {
                return @{ source = "acpi_static_suspect"; zones = $zList }
            } else {
                return @{ source = "performance_counter"; zones = $zList }
            }
        }
    }

    # 2. MSAcpi_ThermalZoneTemp
    $temps1 = Get-CimInstance -Namespace root\wmi -ClassName MSAcpi_ThermalZoneTemp -ErrorAction SilentlyContinue
    if ($temps1) {
        Start-Sleep -Seconds 1
        $temps2 = Get-CimInstance -Namespace root\wmi -ClassName MSAcpi_ThermalZoneTemp -ErrorAction SilentlyContinue
        
        $static = $true
        $zList = @()
        for ($i = 0; $i -lt $temps1.Count; $i++) {
            $t1 = $temps1[$i].CurrentTemperature
            $t2 = if ($temps2) { $temps2[$i].CurrentTemperature } else { $t1 }
            if ($t1 -ne $t2) { $static = $false }
            if ($t1 -lt 2950 -or $t1 -gt 3030) { $static = $false }
            $c = [math]::Round(($t1 / 10.0) - 273.15, 1)
            $zList += [ordered]@{ name = $temps1[$i].InstanceName; tempC = $c }
        }
        if ($zList.Count -gt 0) {
            if ($static) {
                return @{ source = "acpi_static_suspect"; zones = $zList }
            } else {
                return @{ source = "acpi_wmi"; zones = $zList }
            }
        }
    }

    # 3. OpenHardwareMonitor
    try {
        $ohm = Get-CimInstance -Namespace root\OpenHardwareMonitor -ClassName Sensor -Filter "SensorType='Temperature'" -ErrorAction Stop
        if ($ohm) {
            $zList = @()
            foreach ($s in $ohm) {
                if ($s.Name -match "CPU Package|CPU Core") {
                    $zList += [ordered]@{ name = $s.Name; tempC = [math]::Round($s.Value, 1) }
                }
            }
            if ($zList.Count -eq 0) {
                foreach ($s in $ohm) { $zList += [ordered]@{ name = $s.Name; tempC = [math]::Round($s.Value, 1) } }
            }
            return @{ source = "ohm"; zones = $zList }
        }
    } catch {}

    return @{ source = "unavailable"; zones = @() }
}

$thermalData = Get-ThermalData
$thermalZones = $thermalData.zones
$maxTemp = $null
if ($thermalZones.Count -gt 0 -and $thermalData.source -ne "unavailable" -and $thermalData.source -ne "acpi_static_suspect") {
    foreach ($z in $thermalZones) {
        if ($null -eq $maxTemp -or $z.tempC -gt $maxTemp) { $maxTemp = $z.tempC }
    }
}

$thermals = [ordered]@{
    maxTempC       = $maxTemp
    zoneCount      = $thermalZones.Count
    zones          = $thermalZones
    thermalSource  = $thermalData.source
    thermalSamples = $thermalZones.Count
}

# -- Storage ----------------------------------------------------------------------
$storageList = @()
$physDisks   = Get-PhysicalDisk -ErrorAction SilentlyContinue
foreach ($disk in $physDisks) {
    $reliability = $disk | Get-StorageReliabilityCounter -ErrorAction SilentlyContinue
    $volumes     = Get-Disk | Where-Object { $_.SerialNumber -eq $disk.SerialNumber -or $_.FriendlyName -eq $disk.FriendlyName } |
                   Get-Partition | Get-Volume -ErrorAction SilentlyContinue | Where-Object { $_.DriveLetter }
    $vol         = $volumes | Sort-Object SizeRemaining | Select-Object -First 1
    $freeSpacePct = if ($vol -and $vol.Size -gt 0) { [math]::Round(($vol.SizeRemaining / $vol.Size) * 100, 1) } else { $null }

    $dataSource = "unavailable"
    $wearLevelPct = $null
    $healthPct = $null
    $poh = $null

    if ($reliability) {
        $poh = [int]($reliability.PowerOnHours)
        $wear = [int]($reliability.Wear)
        if ($disk.BusType -eq 17 -and ($wear -eq 0 -or $null -eq $reliability.Wear)) {
            $smart = [NvmeSmart]::GetSmartInfo($disk.DeviceId)
            if ($smart) {
                $wearLevelPct = if ($smart.PercentageUsed -gt 100) { 0 } else { 100 - $smart.PercentageUsed }
                $dataSource = "nvme_smart_ioctl"
            } else {
                $dataSource = "reliability_counter"
                $wearLevelPct = $wear
            }
        } else {
            $dataSource = "reliability_counter"
            $wearLevelPct = $wear
        }
    }

    $storageList += [ordered]@{
        model              = $disk.FriendlyName
        type               = $disk.MediaType
        healthPct          = $healthPct
        reallocatedSectors = if ($reliability) { [int]($reliability.ReadErrorsUncorrected) } else { $null }
        wearLevelPct       = $wearLevelPct
        freeSpacePct       = $freeSpacePct
        totalGB            = [math]::Round($disk.Size / 1GB, 0)
        powerOnHours       = $poh
        dataSource         = $dataSource
    }
}

# -- Network ----------------------------------------------------------------------
$adaptersList = @()
$adapters = Get-NetAdapter -ErrorAction SilentlyContinue | Where-Object { $_.Status -eq "Up" }
foreach ($a in $adapters) {
    $ip = (Get-NetIPAddress -InterfaceIndex $a.InterfaceIndex -AddressFamily IPv4 -ErrorAction SilentlyContinue).IPAddress
    $adaptersList += [ordered]@{
        name  = $a.Name
        ip    = $ip
        speed = [math]::Round($a.LinkSpeed/1MB, 0)
        desc  = $a.InterfaceDescription
    }
}
$ping = Test-Connection -ComputerName "8.8.8.8" -Count 2 -Quiet -ErrorAction SilentlyContinue
$network = [ordered]@{
    adapters    = $adaptersList
    connected   = [bool]$ping
}

# -- Updates ----------------------------------------------------------------------
$lastUpdate = $null
try {
    $wu = Get-HotFix -ErrorAction SilentlyContinue | Sort-Object InstalledOn -Descending | Select-Object -First 1
    if ($wu) {
        $lastUpdate = [ordered]@{
            hotFixId    = $wu.HotFixID
            installedOn = $wu.InstalledOn.ToString('o')
        }
    }
} catch {}

# -- Processes ---------------------------------------------------------------------
$cpuHogs = @()
$ramHogs = @()
try {
    $procs = Get-Process -ErrorAction SilentlyContinue
    $cpuHogs = $procs | Sort-Object CPU -Descending | Select-Object -First 5 | ForEach-Object {
        [ordered]@{
            name  = $_.ProcessName
            cpuS  = [math]::Round($_.CPU, 1)
            ramMb = [math]::Round($_.WorkingSet64/1MB, 1)
        }
    }
    $ramHogs = $procs | Sort-Object WorkingSet64 -Descending | Select-Object -First 5 | ForEach-Object {
        [ordered]@{
            name  = $_.ProcessName
            ramMb = [math]::Round($_.WorkingSet64/1MB, 1)
            cpuS  = [math]::Round($_.CPU, 1)
        }
    }
} catch {}

$topProcesses = [ordered]@{
    cpuHogs = $cpuHogs
    ramHogs = $ramHogs
}

# -- Startup ----------------------------------------------------------------------
$startupList = @()
try {
    $startups = Get-CimInstance Win32_StartupCommand -ErrorAction SilentlyContinue
    foreach ($s in $startups) {
        $startupList += [ordered]@{
            name    = $s.Name
            command = $s.Command
        }
    }
} catch {}

$startup = [ordered]@{
    lastBootTime = $os.LastBootUpTime.ToString('o')
}

# -- Security ---------------------------------------------------------------------
$avEnabled = $null
$rtpEnabled = $null
$lastFullScan = $null
$avSignature = $null
try {
    $defender = Get-MpComputerStatus -ErrorAction SilentlyContinue
    if ($defender) {
        $avEnabled = $defender.AntivirusEnabled
        $rtpEnabled = $defender.RealTimeProtectionEnabled
        $lastFullScan = if ($defender.FullScanEndTime) { $defender.FullScanEndTime.ToString('o') } else { $null }
        $avSignature = if ($defender.AntivirusSignatureLastUpdated) { $defender.AntivirusSignatureLastUpdated.ToString('o') } else { $null }
    }
} catch {}

$fwActive = ""
try {
    $fw = Get-NetFirewallProfile -ErrorAction SilentlyContinue | Where-Object { $_.Enabled -eq $true }
    if ($fw) { $fwActive = ($fw.Name -join ", ") }
} catch {}

$security = [ordered]@{
    antivirusEnabled       = $avEnabled
    realTimeProtection     = $rtpEnabled
    lastFullScan           = $lastFullScan
    antivirusSignatureDate = $avSignature
    firewallProfilesActive = $fwActive
}

# -- Recent Errors -----------------------------------------------------------------
$recentErrorsList = @()
try {
    $since  = (Get-Date).AddHours(-24)
    $errors = Get-EventLog -LogName System -EntryType Error -After $since -Newest 10 -ErrorAction SilentlyContinue
    if ($errors) {
        foreach ($e in $errors) {
            $msg = $e.Message
            if ($msg.Length -gt 150) { $msg = $msg.Substring(0, 150) }
            $recentErrorsList += [ordered]@{
                time   = $e.TimeGenerated.ToString('o')
                source = $e.Source
                error  = $msg
            }
        }
    }
} catch {}

# -- Assemble JSON -----------------------------------------------------------------
$output = [ordered]@{
    sentinelSchema = 1
    generatedAt    = (Get-Date -Format 'o')
    system         = $system
    battery        = $battery
    thermals       = $thermals
    storage        = $storageList
    memory         = $memory
    cpu            = $cpu
    startup        = $startup
    gpus           = $gpusList
    network        = $network
    updates        = $lastUpdate
    topProcesses   = $topProcesses
    startupList    = $startupList
    security       = $security
    recentErrors   = $recentErrorsList
}

# -- Direct Upload Only (No JSON printed to Terminal) ------------------------------
Write-Host "  [+] Diagnostics complete." -ForegroundColor Green
Write-Host "  [~] Sending data securely to Sentinel cloud..." -ForegroundColor Cyan

$rawJsonString = $output | ConvertTo-Json -Depth 10 -Compress
$body = '{"rawJson":' + $rawJsonString + '}'

$maxRetries = 4
$retryCount = 0
$success = $false

while (-not $success -and $retryCount -lt $maxRetries) {
    try {
        $response = Invoke-RestMethod -Method POST `
            -Uri "$SENTINEL_API_URL/api/reports" `
            -ContentType "application/json" `
            -Body $body `
            -ErrorAction Stop
        
        $reportId = $response.id
        $claimToken = $response.claimToken
        
        Write-Host "  [OK] Telemetry uploaded successfully." -ForegroundColor Green
        Write-Host "  [+] Opening diagnostic dashboard in your default browser..." -ForegroundColor Green
        Write-Host ""
        
        $url = "$SENTINEL_FRONTEND_URL/r/$reportId`?claim=$claimToken"
        Start-Process $url
        $success = $true
    } catch {
        $errMsg = $_
        $statusCode = 0
        try {
            $errBody = $_.Exception.Response
            if ($errBody) {
                $statusCode = [int]$errBody.StatusCode
                $reader = New-Object System.IO.StreamReader($errBody.GetResponseStream())
                $serverMsg = $reader.ReadToEnd()
                $reader.Close()
                $errMsg = "$_ -- Server said: $serverMsg"
            }
        } catch {}
        
        $retryCount++
        
        if ($statusCode -in @(422, 502, 503, 504) -or $statusCode -eq 0) {
            if ($retryCount -ge $maxRetries) {
                Write-Host "  [!] Upload failed after $maxRetries attempts: $errMsg" -ForegroundColor Red
                Write-Host ""
            } else {
                $backoff = [math]::Pow(2, $retryCount)
                Write-Host "  [!] Upload temporary error (Code $statusCode). Retrying in $backoff seconds..." -ForegroundColor Yellow
                Start-Sleep -Seconds $backoff
            }
        } else {
            Write-Host "  [!] Upload failed: $errMsg" -ForegroundColor Red
            Write-Host ""
            break
        }
    }
}
