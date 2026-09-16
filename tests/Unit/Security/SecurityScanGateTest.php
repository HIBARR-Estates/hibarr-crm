<?php

namespace Tests\Unit\Security;

use PHPUnit\Framework\TestCase;

/**
 * The advisory gate is run by hand (make security-audit), so check the pieces
 * it needs are present and consistent with each other.
 */
class SecurityScanGateTest extends TestCase
{

    private function root(): string
    {
        return dirname(__DIR__, 3);
    }

    public function test_the_makefile_exposes_the_scans(): void
    {
        $makefile = (string)file_get_contents($this->root() . '/Makefile');

        $this->assertStringContainsString('security-audit:', $makefile);
        $this->assertStringContainsString('security-audit-update:', $makefile);
        $this->assertStringContainsString('security-secrets:', $makefile);
        $this->assertStringContainsString('scripts/security-audit-gate.php', $makefile);
    }

    public function test_the_gate_script_reads_the_baseline_next_to_it(): void
    {
        $script = (string)file_get_contents($this->root() . '/scripts/security-audit-gate.php');

        $this->assertStringContainsString("security-audit-baseline.json", $script);
        $this->assertStringContainsString('composer audit --locked', $script);
        $this->assertStringContainsString('npm audit --omit=dev', $script);
    }

    public function test_the_baseline_lists_both_ecosystems(): void
    {
        $baseline = json_decode((string)file_get_contents($this->root() . '/scripts/security-audit-baseline.json'), true);

        $this->assertIsArray($baseline);
        $this->assertArrayHasKey('composer', $baseline);
        $this->assertArrayHasKey('npm', $baseline);

        foreach (['composer', 'npm'] as $ecosystem) {
            foreach ($baseline[$ecosystem] as $key => $description) {
                $this->assertIsString($key);
                $this->assertStringContainsString(':', $key, 'Baseline keys are package:advisory');
                $this->assertIsString($description);
            }
        }
    }

}
