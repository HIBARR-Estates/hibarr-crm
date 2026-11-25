<?php

namespace App\Http\Controllers;

use App\Actions\Packages\SaveAgentPackageTerms;
use App\Enums\PackageCommissionType;
use App\Models\AgentPackageCommissionRate;
use App\Models\LeadAgent;
use App\Models\LeadPipeline;
use App\Models\Package;
use App\Models\PipelineStage;
use App\Services\PackagePipelineRouterService;
use App\Services\PackageRoutingFieldCatalog;
use App\Support\FeatureFlags;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;

/**
 * Packages settings: create, edit and remove packages, set how each one pays
 * commission, and set the deal-field triggers that auto-route a deal onto it.
 *
 * A package with a commission_type configured owns the whole payout on any deal
 * it is attached to — the closing agent is paid from these settings and no
 * upline or system legs are written. A package left unconfigured keeps the
 * level-based MLM distribution.
 */
class PackageSettingsController extends AccountBaseController
{
    public function __construct(
        protected PackagePipelineRouterService $packageRouter,
        protected PackageRoutingFieldCatalog $routingFieldCatalog,
    ) {
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
        $companyId = company()->id;

        return Inertia::render('Settings/Packages/Index', [
            'pageTitle' => __('app.menu.packages'),
            'packages' => $this->packagePayload(),
            'agents' => LeadAgent::where('company_id', $companyId)
                ->with('user:id,name,email')
                ->get()
                ->map(fn (LeadAgent $agent) => [
                    'id' => $agent->id,
                    'name' => $agent->user?->name ?? 'Unknown',
                    'email' => $agent->user?->email,
                ])
                ->values(),
            'pipelines' => LeadPipeline::where('company_id', $companyId)
                ->visibleInSystem()
                ->get(['id', 'name'])
                ->values(),
            'stages' => PipelineStage::where('company_id', $companyId)
                ->orderBy('lead_pipeline_id')
                ->orderBy('priority')
                ->get(['id', 'name', 'lead_pipeline_id'])
                ->values(),
            // The field a trigger can watch and how "match" is judged — same
            // catalog and match-mode pair the Blade package form uses.
            'routingFieldItems' => $this->routingFieldCatalog->enabledFlatFieldItems($companyId),
            'matchModeOptions' => $this->routingFieldCatalog->matchModeOptions(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate($this->rules($request, creating: true));
        $this->assertValidTriggerRows($validated);

        // CompanyScope only filters reads; it never fills company_id in. Without
        // it the row is saved company-less and disappears on the next load.
        $package = Package::create(array_merge(
            $this->packageAttributes($validated),
            ['company_id' => company()->id],
        ));

        $this->syncSideEffects($package, $validated);

        return response()->json([
            'status' => 'success',
            'message' => __('messages.recordSaved'),
            'data' => $this->packageRow($package->fresh()),
        ]);
    }

    /**
     * Partial update: only the keys present are written, so the inline
     * commission editor and the full edit dialog can share one endpoint.
     */
    public function update(Request $request, Package $package): JsonResponse
    {
        $validated = $request->validate($this->rules($request, creating: false));
        $this->assertValidTriggerRows($validated);

        $package->update($this->packageAttributes($validated, $package));

        $this->syncSideEffects($package, $validated);

        return response()->json([
            'status' => 'success',
            'message' => __('messages.updateSuccess'),
            'data' => $this->packageRow($package->fresh()),
        ]);
    }

    public function destroy(Package $package): JsonResponse
    {
        // Soft delete, matching PackageController: the pipeline mapping is left
        // intact so a restored package comes back wired up.
        $package->delete();

        return response()->json([
            'status' => 'success',
            'message' => __('messages.deleteSuccess'),
        ]);
    }

    public function overrides(Package $package): JsonResponse
    {
        return response()->json([
            'status' => 'success',
            'data' => $this->overridePayload($package),
        ]);
    }

    /**
     * Sets what one agent earns on this package, as the closer and (with the
     * referral feature on) as the referrer. Both roles share the row, and a role
     * left out of the request is left as it was. A row with neither role is
     * removed.
     */
    public function upsertOverride(Request $request, Package $package, LeadAgent $agent): JsonResponse
    {
        $referralEnabled = $this->referralEnabled();

        $validated = $request->validate(SaveAgentPackageTerms::rules($request, $referralEnabled));

        $result = app(SaveAgentPackageTerms::class)->handleRequest(
            $package,
            $agent,
            $request,
            $validated,
            company()->id,
            $referralEnabled,
        );

        if ($result === SaveAgentPackageTerms::EMPTY) {
            throw ValidationException::withMessages([
                'commission_type' => __('messages.packageOverrideNeedsTerms'),
            ]);
        }

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
     * The routing triggers already on this package, plus the field picklist —
     * including any field the package still references after that field was
     * disabled for routing, so the edit dialog can flag it rather than
     * silently drop it on the next save.
     */
    public function routingTriggers(Package $package): JsonResponse
    {
        $companyId = company()->id;
        $triggers = $package->routingTriggers()->get(['field_key', 'match_mode', 'match_value']);

        return response()->json([
            'status' => 'success',
            'data' => [
                'triggers' => $triggers->values()->all(),
                'field_items' => $this->routingFieldCatalog->flatFieldItemsForPackageForm(
                    $companyId,
                    $triggers->map->only(['field_key'])->all(),
                ),
            ],
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    protected function rules(Request $request, bool $creating): array
    {
        $companyId = company()->id;
        $presence = $creating ? 'required' : 'sometimes|required';

        return [
            'name' => $presence.'|string|max:255',
            'value' => $presence.'|numeric|min:0',
            'currency' => 'sometimes|nullable|string|size:3',
            'description' => 'sometimes|nullable|string',
            'customer_type_name' => 'sometimes|nullable|string|max:255',
            'customer_type_description' => 'sometimes|nullable|string',
            'pipeline_id' => [
                'sometimes',
                'nullable',
                'integer',
                Rule::exists('lead_pipelines', 'id')->where('company_id', $companyId),
            ],
            'default_stage_id' => [
                'sometimes',
                'nullable',
                'integer',
                Rule::exists('pipeline_stages', 'id')
                    ->where('company_id', $companyId)
                    ->where('lead_pipeline_id', $request->input('pipeline_id')),
            ],
            'commission_type' => ['sometimes', 'nullable', Rule::enum(PackageCommissionType::class)],
            // No 'sometimes' here: `sometimes` skips ALL validation (including
            // `required_if`, below) when the field is absent — which would let
            // `commission_type => percentage` through with no rate at all. A
            // request that never touches either key still validates fine,
            // since `required_if`'s condition then reads a missing/null type.
            'commission_value' => $this->commissionValueRules($request),
            'routing_triggers' => 'sometimes|array',
            'routing_triggers.*.field_key' => 'nullable|string|max:100',
            'routing_triggers.*.match_mode' => 'nullable|in:exact,present',
            'routing_triggers.*.match_value' => 'nullable|string|max:500',
        ];
    }

    /**
     * Field-level rules (`in:`, `max:`) can't express "match_value is required
     * when match_mode is exact" across sibling fields, so that check runs here
     * against the same shared logic StorePackageRequest uses.
     *
     * @param  array<string, mixed>  $validated
     */
    protected function assertValidTriggerRows(array $validated): void
    {
        if (! array_key_exists('routing_triggers', $validated)) {
            return;
        }

        $errors = $this->routingFieldCatalog->validateTriggerRows(
            $validated['routing_triggers'],
            company()->id,
        );

        if ($errors !== []) {
            throw ValidationException::withMessages($errors);
        }
    }

    /**
     * @param  array<string, mixed>  $validated
     */
    protected function syncSideEffects(Package $package, array $validated): void
    {
        if (array_key_exists('pipeline_id', $validated)) {
            $this->packageRouter->syncPackagePipeline(
                $package,
                $validated['pipeline_id'] ?? null,
                $validated['default_stage_id'] ?? null,
            );
        }

        if (array_key_exists('routing_triggers', $validated)) {
            $this->packageRouter->syncPackageRoutingTriggers($package, $validated['routing_triggers']);
        }
    }

    /**
     * A value is required for Percentage and Fixed only — None has nothing to
     * enter, and a null commission_type means "no package setting at all", not
     * a value-less type. `required_if` (not `required_with`) is what makes
     * that distinction: it fires on the two types that need a number, not on
     * every non-null type.
     *
     * $typeField names the type this value belongs to: the closer's commission
     * or the referral commission, which share these rules.
     *
     * @return array<int, string>
     */
    protected function commissionValueRules(Request $request, string $typeField = 'commission_type'): array
    {
        return SaveAgentPackageTerms::valueRules($request, $typeField);
    }

    /**
     * @param  array<string, mixed>  $validated
     * @return array<string, mixed>
     */
    protected function packageAttributes(array $validated, ?Package $package = null): array
    {
        $attributes = collect($validated)
            ->only([
                'name',
                'value',
                'currency',
                'description',
                'customer_type_name',
                'customer_type_description',
                'commission_type',
            ])
            ->all();

        // A cleared or None commission type clears its value with it, so a
        // package can never carry a rate that nothing reads.
        if (array_key_exists('commission_type', $validated)) {
            $noValue = in_array($validated['commission_type'], [null, PackageCommissionType::None->value], true);
            $attributes['commission_value'] = $noValue
                ? null
                : ($validated['commission_value'] ?? null);
        } elseif (array_key_exists('commission_value', $validated)) {
            $attributes['commission_value'] = $validated['commission_value'];
        }

        return $attributes;
    }

    /** The referral terms on a package are served and accepted only with the feature on. */
    protected function referralEnabled(): bool
    {
        return FeatureFlags::enabled('crm.partner-referral-commission');
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    protected function packagePayload(): array
    {
        return Package::with('packagePipeline')
            ->withCount([
                'agentCommissionRates' => fn ($query) => $query
                    ->when(! $this->referralEnabled(), fn ($query) => $query->whereNotNull('commission_type')),
                'routingTriggers',
            ])
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
        $package->loadMissing('packagePipeline');

        return [
            'id' => $package->id,
            'name' => $package->name,
            'value' => (float) $package->value,
            'currency' => $package->currency,
            'description' => $package->description,
            'customer_type_name' => $package->customer_type_name,
            'customer_type_description' => $package->customer_type_description,
            'pipeline_id' => $package->packagePipeline?->pipeline_id,
            'default_stage_id' => $package->packagePipeline?->default_stage_id,
            'commission_type' => $package->commission_type?->value,
            'commission_value' => $package->commission_value !== null
                ? (float) $package->commission_value
                : null,
            'overrides_count' => (int) ($package->agent_commission_rates_count
                ?? $package->agentCommissionRates()
                    ->when(! $this->referralEnabled(), fn ($query) => $query->whereNotNull('commission_type'))
                    ->count()),
            'routing_triggers_count' => (int) ($package->routing_triggers_count
                ?? $package->routingTriggers()->count()),
        ];
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    protected function overridePayload(Package $package): array
    {
        return AgentPackageCommissionRate::where('package_id', $package->id)
            ->when(! $this->referralEnabled(), fn ($query) => $query->whereNotNull('commission_type'))
            ->with('agent.user:id,name,email')
            ->get()
            ->map(fn (AgentPackageCommissionRate $rate) => array_merge([
                'agent_id' => $rate->agent_id,
                'agent_name' => $rate->agent?->user?->name ?? 'Unknown',
                // Null: no closer override, the package default applies.
                'commission_type' => $rate->commission_type?->value,
                'commission_value' => $rate->commission_value !== null
                    ? (float) $rate->commission_value
                    : null,
            ], $this->referralEnabled() ? [
                'referral_commission_type' => $rate->referral_commission_type?->value,
                'referral_commission_value' => $rate->referral_commission_value !== null
                    ? (float) $rate->referral_commission_value
                    : null,
            ] : []))
            ->values()
            ->all();
    }
}
