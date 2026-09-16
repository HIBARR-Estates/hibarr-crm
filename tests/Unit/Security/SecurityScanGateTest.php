<?php

namespace Tests\Unit\Security;

use PHPUnit\Framework\TestCase;
use Symfony\Component\Yaml\Yaml;

/**
 * The CI gate is only useful while it is wired up, so check the pieces are
 * present and consistent with each other.
 */
class SecurityScanGateTest extends TestCase
{

    private function root(): string
    {
        return dirname(__DIR__, 3);
    }

    public function test_the_workflow_runs_both_scans_on_pull_requests(): void
    {
        $workflow = Yaml::parseFile($this->root() . '/.github/workflows/security-scan.yml');

        // "on" is parsed as the boolean true by the YAML 1.1 spec.
        $triggers = $workflow['on'] ?? $workflow[true];

        $this->assertArrayHasKey('pull_request', $triggers);
        $this->assertContains('develop', $triggers['pull_request']['branches']);
        $this->assertArrayHasKey('dependencies', $workflow['jobs']);
        $this->assertArrayHasKey('secrets', $workflow['jobs']);

        $commands = implode("\n", array_column($workflow['jobs']['dependencies']['steps'], 'run'));

        $this->assertStringContainsString('security-audit-gate.php composer', $commands);
        $this->assertStringContainsString('security-audit-gate.php npm', $commands);
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
