<?php

namespace App\Services\Partner;

use App\Models\AgentPackageCommissionRate;
use App\Models\LeadAgent;
use App\Models\Package;

/**
 * Everything one agent has been given on packages, for a screen that shows and
 * edits it from the agent's side: one row per package, each holding what they
 * earn as the closer and as the referrer, plus the packages still open to add.
 *
 * It reads the same rows the package settings screen edits, so the two views
 * always agree.
 */
class AgentPackageTerms
{
    /**
     * @return array{rows: array<int, array<string, mixed>>, packages: array<int, array<string, mixed>>}
     */
    public function forAgent(LeadAgent $agent): array
    {
        $rows = AgentPackageCommissionRate::query()
            ->where('agent_id', $agent->id)
            ->with('package:id,name,value,currency,commission_type,commission_value')
            ->get()
            ->filter(fn (AgentPackageCommissionRate $row) => $row->package !== null)
            ->sortBy(fn (AgentPackageCommissionRate $row) => mb_strtolower($row->package->name))
            ->map(fn (AgentPackageCommissionRate $row) => [
                'package_id' => $row->package_id,
                'package_name' => $row->package->name,
                'package_value' => (float) $row->package->value,
                'package_currency' => $row->package->currency,
                // What the closer earns on this package when the agent has no override.
                'package_default' => [
                    'type' => $row->package->commission_type?->value,
                    'value' => $row->package->commission_value !== null ? (float) $row->package->commission_value : null,
                ],
                'commission_type' => $row->commission_type?->value,
                'commission_value' => $row->commission_value !== null ? (float) $row->commission_value : null,
                'referral_commission_type' => $row->referral_commission_type?->value,
                'referral_commission_value' => $row->referral_commission_value !== null ? (float) $row->referral_commission_value : null,
            ])
            ->values()
            ->all();

        $packages = Package::query()
            ->orderBy('name')
            ->get(['id', 'name', 'value', 'currency'])
            ->map(fn (Package $package) => [
                'id' => $package->id,
                'name' => $package->name,
                'value' => (float) $package->value,
                'currency' => $package->currency,
            ])
            ->values()
            ->all();

        return ['rows' => $rows, 'packages' => $packages];
    }
}
