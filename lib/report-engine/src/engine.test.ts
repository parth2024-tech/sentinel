import { describe, it, expect } from 'vitest';
import { expectedBatteryHealth, expectedMemoryPenalty, generateReport, combinedScore, ALGORITHM_VERSION } from './engine';
import { validatePlausibility } from './plausibilityGuard';
import type { SentinelReport } from './schema';

describe('Scoring Engine Algorithms', () => {
  
  describe('expectedBatteryHealth (Degradation Curve)', () => {
    it('should return 100 at 0 cycles', () => {
      expect(expectedBatteryHealth(0)).toBe(100);
    });

    it('should interpolate correctly between anchors', () => {
      // Anchor 0 is [0, 100], Anchor 1 is [100, 97]
      // 50 cycles should be 98.5
      expect(expectedBatteryHealth(50)).toBe(98.5);
    });

    it('should return exact anchor values', () => {
      expect(expectedBatteryHealth(300)).toBe(85);
      expect(expectedBatteryHealth(700)).toBe(65);
    });

    it('should cap at the maximum degraded baseline for cycles > 1000', () => {
      expect(expectedBatteryHealth(1200)).toBe(50); // Anchor 1000 is 50
      expect(expectedBatteryHealth(5000)).toBe(50);
    });
  });

  describe('combinedScore', () => {
    it('should weight hardware at 70% and habits at 30%', () => {
      expect(combinedScore(100, 100)).toBe(100);
      expect(combinedScore(80, 50)).toBe(71); // (80 * 0.7) + (50 * 0.3) = 56 + 15 = 71
      expect(combinedScore(0, 100)).toBe(30);
    });
  });

  describe('expectedMemoryPenalty (Progression & Swap)', () => {
    it('should return 0 penalty for usage <= 70%', () => {
      expect(expectedMemoryPenalty(0)).toBe(0);
      expect(expectedMemoryPenalty(70)).toBe(0);
    });

    it('should return exact anchor values', () => {
      expect(expectedMemoryPenalty(85)).toBe(15);
      expect(expectedMemoryPenalty(95)).toBe(30);
      expect(expectedMemoryPenalty(100)).toBe(50);
    });

    it('should interpolate correctly between anchors', () => {
      // Between 70% (0) and 85% (15) -> 77.5% should be 7.5
      expect(expectedMemoryPenalty(77.5)).toBe(7.5);
      // Between 85% (15) and 95% (30) -> 90% should be 22.5
      expect(expectedMemoryPenalty(90)).toBe(22.5);
      // Between 95% (30) and 100% (50) -> 97.5% should be 40
      expect(expectedMemoryPenalty(97.5)).toBe(40);
    });

    it('should apply page faults swap multiplier correctly in generateReport', () => {
      const reportBase: SentinelReport = {
        sentinelSchema: 1,
        system: { manufacturer: 'TestCorp', model: 'TestBook Pro', hostname: 'test-pc', os: 'Windows 11' },
        generatedAt: new Date().toISOString(),
        battery: { health: 100, cycleCount: 10 },
        thermals: { maxTempC: 45, throttleEvents30min: 0, thermalSource: 'wmi' },
        storage: [{ model: 'SSD', healthPct: 100, wearLevelPct: 100, freeSpacePct: 50 }],
        memory: { totalGB: 16, usedPct: 95, pageFaultsPerSec: 250 },
        cpu: { avgLoadPct: 15 }
      };

      // usedPct = 95 -> base penalty = 30
      // pageFaultsPerSec = 250 -> 250 / 500 = 0.5 -> 0.5 * 0.20 = 0.10 additional penalty
      // total penalty = 30 * 1.10 = 33 -> score = 100 - 33 = 67
      const result = generateReport(reportBase);
      const memComp = result.components.find(c => c.name === 'Memory');
      expect(memComp).toBeDefined();
      expect(memComp!.score).toBe(67);
      expect(memComp!.detail).toContain('250 pg/s');
    });

    it('should not multiply penalty when pageFaultsPerSec is absent', () => {
      const reportBase: SentinelReport = {
        sentinelSchema: 1,
        system: { manufacturer: 'TestCorp', model: 'TestBook Pro', hostname: 'test-pc', os: 'Windows 11' },
        generatedAt: new Date().toISOString(),
        battery: { health: 100, cycleCount: 10 },
        thermals: { maxTempC: 45, throttleEvents30min: 0, thermalSource: 'wmi' },
        storage: [{ model: 'SSD', healthPct: 100, wearLevelPct: 100, freeSpacePct: 50 }],
        memory: { totalGB: 16, usedPct: 95 },
        cpu: { avgLoadPct: 15 }
      };

      // usedPct = 95 -> base penalty = 30 -> score = 70
      const result = generateReport(reportBase);
      const memComp = result.components.find(c => c.name === 'Memory');
      expect(memComp).toBeDefined();
      expect(memComp!.score).toBe(70);
      expect(memComp!.detail).not.toContain('pg/s');
    });
  });

  describe('generateReport Component Scoring & Findings', () => {
    // Base healthy report template
    const createBaseReport = (): SentinelReport => ({
      sentinelSchema: 1,
      system: { manufacturer: 'TestCorp', model: 'TestBook Pro', hostname: 'test-pc', os: 'Windows 11' },
      generatedAt: new Date().toISOString(),
      battery: { health: 100, cycleCount: 10, fullChargeCapacity: 50000, designCapacity: 50000 },
      thermals: { maxTempC: 45, throttleEvents30min: 0, thermalSource: 'wmi' },
      storage: [{ model: 'Test SSD', healthPct: 100, wearLevelPct: 100, freeSpacePct: 50, reallocatedSectors: 0, type: 'NVMe', dataSource: 'wmi' }],
      memory: { totalGB: 16, usedPct: 40 },
      cpu: { name: 'Test CPU', avgLoadPct: 15, throttleEvents30min: 0 }
    });

    it('should generate an A-grade report with a perfect score for a healthy system', () => {
      const report = createBaseReport();
      const result = generateReport(report);
      
      expect(result.overall).toBe(100);
      expect(result.grade).toBe('A');
      expect(result.gradeLabel).toBe('Excellent');
      expect(result.algoVersion).toBe(ALGORITHM_VERSION);
      
      // Ensure all 5 components were scored
      expect(result.components).toHaveLength(5);
      result.components.forEach(c => {
        expect(c.score).toBe(100);
        expect(c.status).toBe('healthy');
      });
    });

    it('should penalise thermal score for extreme temperatures and throttling', () => {
      const report = createBaseReport();
      report.thermals = { maxTempC: 96, throttleEvents30min: 25, thermalSource: 'wmi' }; // Base score 10, penalty 20 -> cap 0
      
      const result = generateReport(report);
      const thermalComponent = result.components.find(c => c.name === 'Thermals');
      
      expect(thermalComponent).toBeDefined();
      expect(thermalComponent!.score).toBe(0);
      expect(thermalComponent!.status).toBe('critical');

      // Should trigger a critical finding for temps > 90
      const criticalTempFinding = result.findings.find(f => f.title === 'Critical peak temperature recorded');
      expect(criticalTempFinding).toBeDefined();
      expect(criticalTempFinding!.urgency).toBe('critical');
    });

    it('should penalise battery score severely for wear beyond expected curves', () => {
      const report = createBaseReport();
      // At 100 cycles, expected is 97. Actual is 50.
      // Gap is 47. Penalty is Math.min(20, 47 - 10) = 20.
      // Score = 50 - 20 = 30.
      report.battery = { health: 50, cycleCount: 100 };
      
      const result = generateReport(report);
      const batteryComponent = result.components.find(c => c.name === 'Battery');
      
      expect(batteryComponent).toBeDefined();
      expect(batteryComponent!.score).toBe(30);
      
      const wearFinding = result.findings.find(f => f.title === 'Battery capacity critically low');
      expect(wearFinding).toBeDefined();
    });

    it('should flag ACPI static thermal suspect data and exclude it from scoring', () => {
      const report = createBaseReport();
      report.thermals = { maxTempC: 55, throttleEvents30min: 0, thermalSource: 'acpi_static_suspect' };
      
      const result = generateReport(report);
      
      // The thermal component should be stripped from the results
      const thermalComponent = result.components.find(c => c.name === 'Thermals');
      expect(thermalComponent).toBeUndefined();
      
      // Data quality warning should be populated
      expect(result.dataQuality.structuredWarnings).toHaveLength(1);
      expect(result.dataQuality.structuredWarnings[0].type).toBe('acpi_static');
    });

    it('should penalise storage score for reallocated sectors and low free space', () => {
      const report = createBaseReport();
      report.storage = [{ 
        model: 'Failing SSD', 
        healthPct: 90, 
        wearLevelPct: 90, // Base 90
        freeSpacePct: 4,  // < 5% penalty = 20
        reallocatedSectors: 5, // penalty = Math.min(40, 5*5 = 25)
        type: 'NVMe', 
        dataSource: 'wmi' 
      }];
      
      // Expected score: 90 - 20 - 25 = 45
      const result = generateReport(report);
      const storageComponent = result.components.find(c => c.name === 'Storage');
      
      expect(storageComponent).toBeDefined();
      expect(storageComponent!.score).toBe(45);
      
      const sectorFinding = result.findings.find(f => f.title.includes('reallocated sector'));
      expect(sectorFinding).toBeDefined();
      expect(sectorFinding!.urgency).toBe('critical');
    });

    it('should trigger B2B Pro correlation findings when thermal + battery issues coincide', () => {
      const report = createBaseReport();
      // Combine high heat with degraded battery
      report.thermals = { maxTempC: 85, throttleEvents30min: 0, thermalSource: 'wmi' };
      report.battery = { health: 70, cycleCount: 300 };
      
      const result = generateReport(report);
      
      const correlationFinding = result.findings.find(f => f.title.includes('Correlated finding: sustained heat is accelerating battery degradation'));
      expect(correlationFinding).toBeDefined();
      expect(correlationFinding!.pro).toBe(true);
    });

    it('should penalise battery score for high temperature and voltage drops', () => {
      const report = createBaseReport();
      report.battery = {
        health: 100,
        cycleCount: 10,
        batteryTempC: 55, // 55 - 45 = 10 -> penalty 10 * 1.5 = 15
        batteryVoltageV: 9.2 // < 9.5 -> penalty 5
      };

      const result = generateReport(report);
      const batteryComponent = result.components.find(c => c.name === 'Battery');
      expect(batteryComponent).toBeDefined();
      expect(batteryComponent!.score).toBe(80); // 100 - 15 - 5

      const tempFinding = result.findings.find(f => f.title.includes('High battery temperature'));
      expect(tempFinding).toBeDefined();
    });

    it('should penalise storage score for NVMe warning flags and media errors', () => {
      const report = createBaseReport();
      report.storage = [{
        model: 'NVMe Drive',
        healthPct: 100,
        wearLevelPct: 100,
        freeSpacePct: 50,
        mediaErrors: 2, // penalty = 10
        criticalWarningFlags: 4, // bit 2 set -> penalty = 40
        dataSource: 'nvme_smart_ioctl'
      }];

      const result = generateReport(report);
      const storageComponent = result.components.find(c => c.name === 'Storage');
      expect(storageComponent).toBeDefined();
      expect(storageComponent!.score).toBe(50); // 100 - 10 - 40

      const mediaFinding = result.findings.find(f => f.title.includes('NVMe media errors'));
      expect(mediaFinding).toBeDefined();
      const warningFinding = result.findings.find(f => f.title.includes('NVMe controller critical warnings'));
      expect(warningFinding).toBeDefined();
    });

    it('should penalise CPU score for core temperature delta and report throttle reason', () => {
      const report = createBaseReport();
      report.thermals = { maxTempC: 80, zones: [], thermalSource: 'wmi' };
      report.cpu = {
        name: 'Core i7',
        avgLoadPct: 30,
        throttleEvents30min: 5,
        coreTempDeltaC: 20, // delta 20 - 15 = 5 penalty (since maxTempC 80 > 65)
        throttleReason: 'Power Limit'
      };

      const result = generateReport(report);
      const cpuComponent = result.components.find(c => c.name === 'CPU');
      expect(cpuComponent).toBeDefined();
      expect(cpuComponent!.score).toBe(85); // 100 - 10 (throttle events) - 5 (delta)

      expect(cpuComponent!.detail).toContain('(Power Limit)');
      const deltaFinding = result.findings.find(f => f.title.includes('High CPU core temperature delta'));
      expect(deltaFinding).toBeDefined();
    });

    it('should penalise memory score for elevated DPC latency and OEM service bloat', () => {
      const report = createBaseReport();
      report.memory = {
        totalGB: 16,
        usedPct: 40,
        dpcTimePct: 2.5, // 2.5 - 1.0 = 1.5 -> penalty 15
      };
      report.runningOemServicesCount = 8; // 8 - 3 = 5 penalty

      const result = generateReport(report);
      const memoryComponent = result.components.find(c => c.name === 'Memory');
      expect(memoryComponent).toBeDefined();
      expect(memoryComponent!.score).toBe(80); // 100 - 15 - 5

      const dpcFinding = result.findings.find(f => f.title.includes('Elevated DPC/ISR execution time'));
      expect(dpcFinding).toBeDefined();
      const bloatFinding = result.findings.find(f => f.title.includes('OEM background services running'));
      expect(bloatFinding).toBeDefined();
    });

    it('should generate findings for security TPM, Secure Boot, and LSA configurations', () => {
      const report = createBaseReport();
      report.security = {
        antivirusEnabled: true,
        realTimeProtection: true,
        tpmActive: false,
        secureBootEnabled: false,
        lsaProtectionEnabled: false
      };

      const result = generateReport(report);
      
      const tpmFinding = result.findings.find(f => f.title.includes('TPM 2.0 disabled'));
      expect(tpmFinding).toBeDefined();
      const sbFinding = result.findings.find(f => f.title.includes('Secure Boot is disabled'));
      expect(sbFinding).toBeDefined();
      const lsaFinding = result.findings.find(f => f.title.includes('LSA Protection is disabled'));
      expect(lsaFinding).toBeDefined();
    });

  });

  describe('PlausibilityGuard', () => {
    it('should pass healthy report with sane physical bounds', () => {
      const report: SentinelReport = {
        sentinelSchema: 1,
        system: { manufacturer: 'TestCorp', model: 'TestBook Pro', hostname: 'test-pc', os: 'Windows 11' },
        generatedAt: new Date().toISOString(),
        battery: { health: 95, cycleCount: 120, batteryTempC: 35, batteryVoltageV: 12.1 },
        thermals: { maxTempC: 50, zones: [{ name: 'CPU', tempC: 45 }], throttleEvents30min: 0 },
        storage: [{ model: 'Test SSD', healthPct: 98, wearLevelPct: 98, freeSpacePct: 40, reallocatedSectors: 0 }],
        memory: { totalGB: 16, usedPct: 60 },
        cpu: { cores: 8, threads: 16, avgLoadPct: 30 }
      };

      const result = validatePlausibility(report);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should catch battery health or temperature outside sane physical bounds', () => {
      const report: SentinelReport = {
        sentinelSchema: 1,
        system: { manufacturer: 'TestCorp', model: 'TestBook Pro', hostname: 'test-pc' },
        generatedAt: new Date().toISOString(),
        battery: { health: 150, batteryTempC: 110, batteryVoltageV: 35, cycleCount: -1 }
      };

      const result = validatePlausibility(report);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('battery.health must be between 0 and 100 (got 150)');
      expect(result.errors).toContain('battery.batteryTempC must be between -20 and 100 (got 110)');
      expect(result.errors).toContain('battery.batteryVoltageV must be between 0 and 30 (got 35)');
      expect(result.errors).toContain('battery.cycleCount cannot be negative (got -1)');
    });

    it('should catch thermals and storage properties outside physical bounds', () => {
      const report: SentinelReport = {
        sentinelSchema: 1,
        system: { manufacturer: 'TestCorp', model: 'TestBook Pro', hostname: 'test-pc' },
        generatedAt: new Date().toISOString(),
        thermals: { maxTempC: 150, throttleEvents30min: -5, zones: [{ name: 'GPU', tempC: -50 }] },
        storage: [{ healthPct: -10, wearLevelPct: 110, freeSpacePct: 150, reallocatedSectors: -5 }]
      };

      const result = validatePlausibility(report);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('thermals.maxTempC must be between -20 and 125 (got 150)');
      expect(result.errors).toContain('thermals.throttleEvents30min cannot be negative (got -5)');
      expect(result.errors).toContain('thermals.zones[0].tempC must be between -20 and 125 (got -50)');
      expect(result.errors).toContain('storage[0].healthPct must be between 0 and 100 (got -10)');
      expect(result.errors).toContain('storage[0].wearLevelPct must be between 0 and 100 (got 110)');
      expect(result.errors).toContain('storage[0].freeSpacePct must be between 0 and 100 (got 150)');
      expect(result.errors).toContain('storage[0].reallocatedSectors cannot be negative (got -5)');
    });
  });
});


