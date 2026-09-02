<?php

namespace Tests;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;

/**
 * Seed helpers for package-based commissions.
 *
 * The schema itself lives in the parent harness: MlmCommissionService reads a
 * deal's packages on every deal now, so packages are part of the minimal
 * commission schema rather than something this suite bolts on.
 */
abstract class PackageCommissionTestCase extends PerAgentCommissionOverrideTestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        // These tests assert commission arithmetic. distribute() also notifies
        // the agent on every non-system leg; that delivery stack is covered
        // elsewhere and only drags unrelated infrastructure in here.
        Notification::fake();
    }

    protected function seedPackage(
        int $companyId,
        float $value,
        ?string $commissionType = null,
        ?float $commissionValue = null,
        string $currency = 'EUR',
        string $name = 'Package'
    ): int {
        return DB::table('packages')->insertGetId([
            'company_id' => $companyId,
            'name' => $name,
            'value' => $value,
            'currency' => $currency,
            'commission_type' => $commissionType,
            'commission_value' => $commissionValue,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    protected function attachPackage(int $dealId, int $packageId): void
    {
        DB::table('deal_package')->insert([
            'deal_id' => $dealId,
            'package_id' => $packageId,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    protected function seedAgentPackageRate(
        int $companyId,
        int $agentId,
        int $packageId,
        string $commissionType,
        ?float $commissionValue = null
    ): void {
        DB::table('agent_package_commission_rates')->insert([
            'company_id' => $companyId,
            'agent_id' => $agentId,
            'package_id' => $packageId,
            'commission_type' => $commissionType,
            'commission_value' => $commissionValue,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }
}
