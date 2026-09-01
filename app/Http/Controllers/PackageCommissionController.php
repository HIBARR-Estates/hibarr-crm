<?php

namespace App\Http\Controllers;

use App\Enums\PackageCommissionType;
use App\Models\AgentPackageCommissionRate;
use App\Models\LeadAgent;
use App\Models\Package;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;

/**
 * Commission settings for packages.
 *
 * A package with a commission_type configured owns the whole payout on any deal
 * it is attached to: the closing agent is paid from these settings and no upline
 * or system legs are written. A package left unconfigured keeps the level-based
 * MLM distribution.
 */
class PackageCommissionController extends AccountBaseController
{
    public function __construct()
    {
        parent::__construct();
        $this->pageTitle = 'app.menu.packages';
        $this->activeSettingMenu = 'packages';

        $this->middleware(function ($request, $next) {
            abort_403(user()->permission('manage_company_setting') !== 'all');

            return $next($request);
        });
    }

    public function index()
    {
        return Inertia::render('Settings/PackageCommissions/Index', [
            'pageTitle' => __('app.menu.packages'),
            'packages' => $this->packagePayload(),
            'agents' => LeadAgent::where('company_id', company()->id)
                ->with('user:id,name,email')
                ->get()
                ->map(fn (LeadAgent $agent) => [
                    'id' => $agent->id,
                    'name' => $agent->user?->name ?? 'Unknown',
                    'email' => $agent->user?->email,
                ])
                ->values(),
        ]);
    }

    public function updatePackage(Request $request, Package $package): JsonResponse
    {
        $validated = $request->validate([
            'commission_type' => ['nullable', Rule::enum(PackageCommissionType::class)],
            'commission_value' => array_merge(
                ['nullable', 'required_with:commission_type', 'numeric', 'min:0'],
                // Only a percentage is bounded at 100 — a flat fee is money, and
                // capping it at 100 would quietly reject a EUR 250 package fee.
                $request->input('commission_type') === PackageCommissionType::Percentage->value
                    ? ['max:100']
                    : []
            ),
        ]);

        $package->update([
            'commission_type' => $validated['commission_type'] ?? null,
            'commission_value' => ($validated['commission_type'] ?? null) === null
                ? null
                : $validated['commission_value'],
        ]);

        return response()->json([
            'status' => 'success',
            'message' => __('messages.updateSuccess'),
            'data' => $this->packageRow($package->fresh()),
        ]);
    }

    public function overrides(Package $package): JsonResponse
    {
        return response()->json([
            'status' => 'success',
            'data' => $this->overridePayload($package),
        ]);
    }

    public function upsertOverride(Request $request, Package $package, LeadAgent $agent): JsonResponse
    {
        $validated = $request->validate([
            'commission_type' => ['required', Rule::enum(PackageCommissionType::class)],
            'commission_value' => array_merge(
                ['required', 'numeric', 'min:0'],
                $request->input('commission_type') === PackageCommissionType::Percentage->value
                    ? ['max:100']
                    : []
            ),
        ]);

        AgentPackageCommissionRate::updateOrCreate(
            ['agent_id' => $agent->id, 'package_id' => $package->id],
            [
                // CompanyScope only filters reads; it never fills this in.
                'company_id' => company()->id,
                'commission_type' => $validated['commission_type'],
                'commission_value' => $validated['commission_value'],
            ]
        );

        return response()->json([
            'status' => 'success',
            'message' => __('messages.updateSuccess'),
            'data' => $this->overridePayload($package),
        ]);
    }

    public function destroyOverride(Package $package, LeadAgent $agent): JsonResponse
    {
        AgentPackageCommissionRate::where('agent_id', $agent->id)
            ->where('package_id', $package->id)
            ->delete();

        return response()->json([
            'status' => 'success',
            'message' => __('messages.deleteSuccess'),
            'data' => $this->overridePayload($package),
        ]);
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    protected function packagePayload(): array
    {
        return Package::withCount('agentCommissionRates')
            ->orderBy('name')
            ->get()
            ->map(fn (Package $package) => $this->packageRow($package))
            ->values()
            ->all();
    }

    /**
     * @return array<string, mixed>
     */
    protected function packageRow(Package $package): array
    {
        return [
            'id' => $package->id,
            'name' => $package->name,
            'value' => (float) $package->value,
            'currency' => $package->currency,
            'commission_type' => $package->commission_type?->value,
            'commission_value' => $package->commission_value !== null
                ? (float) $package->commission_value
                : null,
            'overrides_count' => (int) ($package->agent_commission_rates_count
                ?? $package->agentCommissionRates()->count()),
        ];
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    protected function overridePayload(Package $package): array
    {
        return AgentPackageCommissionRate::where('package_id', $package->id)
            ->with('agent.user:id,name,email')
            ->get()
            ->map(fn (AgentPackageCommissionRate $rate) => [
                'agent_id' => $rate->agent_id,
                'agent_name' => $rate->agent?->user?->name ?? 'Unknown',
                'commission_type' => $rate->commission_type->value,
                'commission_value' => (float) $rate->commission_value,
            ])
            ->values()
            ->all();
    }
}
