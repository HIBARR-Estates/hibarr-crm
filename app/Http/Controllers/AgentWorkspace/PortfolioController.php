<?php

namespace App\Http\Controllers\AgentWorkspace;

use App\Http\Controllers\AccountBaseController;
use App\Models\Deal;
use App\Models\Developer;
use App\Models\DeveloperProject;
use App\Models\Property;
use App\Models\PropertyCity;
use App\Models\PropertyConstructionStatus;
use App\Models\PropertyDeedStatus;
use App\Services\AgentWorkspace\PortfolioPresenter;
use App\Services\PropertyRecommendationService;
use App\Support\DeveloperProjectVisibility;
use App\Support\PermissionGates;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Inertia\Inertia;
use Inertia\Response;

/**
 * The agent Portfolio: the same properties, projects and recommendations the
 * classic screens use, shaped for the three Portfolio views (For my deals,
 * Browse, Projects). Cards arrive deferred; the page itself is a light shell.
 */
class PortfolioController extends AccountBaseController
{
    /** Most properties one Browse request returns; "Show more" raises the limit up to the cap. */
    public const BROWSE_STEP = 24;

    public const BROWSE_CAP = 240;

    /** Most recommendations asked of the matching service for one deal. */
    public const RECOMMENDATION_LIMIT = 12;

    private const FILTER_KEYS = ['search', 'city', 'area', 'max_price', 'min_bedrooms', 'construction_status', 'deed_status', 'developer_id'];

    /** The properties list's own check: someone who cannot view properties does not get the Portfolio. */
    private function authorizeView(): void
    {
        abort_unless(in_array(user()->permission('view_products'), ['all', 'added', 'owned', 'both'], true), 403);
    }

    /** For my deals (L7-18): the agent's open deals on the left, matches for the picked one on the right. */
    public function forDeals(Request $request): Response
    {
        $this->authorizeView();

        $deals = $this->myOpenDeals()->get();
        $selected = $deals->firstWhere('id', (int) $request->query('deal')) ?? $deals->first();

        return Inertia::render('AgentWorkspace/Portfolio', [
            'view' => 'deals',
            'pageTitle' => __('pages.agent_workspace.nav.portfolio'),
            'deals' => $deals->map(fn (Deal $deal) => $this->presentDeal($deal))->values(),
            'dealId' => $selected?->id,
            'recommendations' => Inertia::defer(
                fn () => $selected ? $this->recommendationsFor($selected) : ['items' => [], 'error' => null],
                'recommendations'
            ),
        ]);
    }

    /** Browse (L7-19): every property the agent may see, narrowed by the filter row. */
    public function browse(Request $request): Response
    {
        $this->authorizeView();

        $limit = min(self::BROWSE_CAP, max(self::BROWSE_STEP, (int) $request->query('limit', self::BROWSE_STEP)));

        return Inertia::render('AgentWorkspace/Portfolio', [
            'view' => 'browse',
            'pageTitle' => __('pages.agent_workspace.nav.portfolio'),
            'filters' => $request->only(self::FILTER_KEYS),
            'limit' => $limit,
            'properties' => Inertia::defer(function () use ($request, $limit) {
                $query = $this->visibleProperties()->with(array_merge(PortfolioPresenter::PROPERTY_RELATIONS, PortfolioPresenter::photoRelation()));
                $this->applyFilters($query, $request);

                $total = (clone $query)->count();
                $items = $query->orderByDesc('created_at')->orderByDesc('id')->limit($limit)->get();

                return [
                    'items' => $items->map(fn (Property $p) => PortfolioPresenter::property($p))->values(),
                    'total' => $total,
                ];
            }, 'properties'),
            'options' => Inertia::defer(fn () => $this->filterOptions(), 'options'),
        ]);
    }

    /** Projects (L7-20): developer projects with how many units of each type are left. */
    public function projects(Request $request): Response
    {
        $this->authorizeView();

        return Inertia::render('AgentWorkspace/Portfolio', [
            'view' => 'projects',
            'pageTitle' => __('pages.agent_workspace.nav.portfolio'),
            'projects' => Inertia::defer(function () {
                $query = DeveloperProject::query()
                    ->where('company_id', user()->company_id)
                    ->with(['developer:id,name', 'location:id,name', 'unitTypes' => fn ($q) => $q->orderBy('bedrooms')->orderBy('id')]);

                DeveloperProjectVisibility::scopeVisibleProjects($query);

                return $query->orderBy('name')->limit(100)->get()
                    ->map(fn (DeveloperProject $project) => PortfolioPresenter::project($project))
                    ->values();
            }, 'projects'),
        ]);
    }

    /** The agent's own open deals: lead agent is the viewer, outcome not yet set. */
    private function myOpenDeals()
    {
        return Deal::query()
            ->whereNull('deals.outcome_status')
            ->whereHas('leadAgent', fn ($q) => $q->where('user_id', user()->id))
            ->with(['contact:id,client_name', 'hibarrFields', 'leadStage:id,name'])
            ->orderByDesc('deals.updated_at')
            ->limit(50);
    }

    /**
     * @return array<string, mixed>
     */
    private function presentDeal(Deal $deal): array
    {
        $fields = $deal->hibarrFields;

        return [
            'id' => (int) $deal->id,
            'lead_id' => $deal->lead_id ? (int) $deal->lead_id : null,
            'name' => $deal->name,
            'person' => $deal->contact?->client_name,
            'stage' => $deal->leadStage?->name,
            'interested_in' => $fields?->interested_in,
            'budget_range' => $fields?->budget_range,
            'purchase_timeline' => $fields?->purchase_timeline,
        ];
    }

    /**
     * The matching service's picks for one deal, with the property cards
     * the Portfolio shows. The service is an outside call, so this only ever
     * runs deferred.
     *
     * @return array{items: list<array<string, mixed>>, error: string|null}
     */
    private function recommendationsFor(Deal $deal): array
    {
        $result = app(PropertyRecommendationService::class)->getRecommendationsForDeal($deal, self::RECOMMENDATION_LIMIT);
        $recommendations = collect($result['recommendations'] ?? []);

        $ids = $recommendations->pluck('property_id')->filter()->map(fn ($id) => (int) $id)->all();
        $properties = $ids === []
            ? collect()
            : $this->visibleProperties()
                ->with(array_merge(PortfolioPresenter::PROPERTY_RELATIONS, PortfolioPresenter::photoRelation()))
                ->whereIn('properties.id', $ids)
                ->get()
                ->keyBy('id');

        $items = $recommendations
            ->map(function (array $rec) use ($properties) {
                $property = $properties->get((int) ($rec['property_id'] ?? 0));
                if (! $property) {
                    return null;
                }

                return PortfolioPresenter::property($property) + [
                    'match' => isset($rec['match_percentage']) ? (int) $rec['match_percentage'] : null,
                    'factors' => $this->presentFactors($rec['factors'] ?? []),
                ];
            })
            ->filter()
            ->values()
            ->all();

        return ['items' => $items, 'error' => $result['error'] ?? null];
    }

    /**
     * @param  mixed  $factors
     * @return list<array{label: string, positive: bool}>
     */
    private function presentFactors($factors): array
    {
        return collect(is_array($factors) ? $factors : [])
            ->filter(fn ($factor) => is_array($factor))
            ->map(function (array $factor) {
                $label = $factor['detail'] ?? $factor['status'] ?? $factor['name'] ?? null;

                return $label ? ['label' => (string) $label, 'positive' => (bool) ($factor['positive'] ?? true)] : null;
            })
            ->filter()
            ->take(3)
            ->values()
            ->all();
    }

    /** Published properties, plus the viewer's own drafts (everything for those who manage properties). */
    private function visibleProperties()
    {
        $query = Property::query();

        if (! PermissionGates::canManageProperties(user())) {
            $userId = user()->id;
            $query->where(fn ($q) => $q
                ->where('is_published', true)
                ->orWhere('added_by', $userId)
                ->orWhere('responsible_agent_id', $userId));
        }

        return $query;
    }

    private function applyFilters($query, Request $request): void
    {
        foreach (['city', 'construction_status'] as $column) {
            if ($values = $this->listParam($request, $column)) {
                $query->whereIn($column, $values);
            }
        }

        if ($areas = $this->listParam($request, 'area')) {
            $query->whereIn('area', $areas);
        }
        if ($request->filled('deed_status')) {
            $query->where('deed_status', $request->query('deed_status'));
        }
        if ($request->filled('developer_id')) {
            $query->whereHas('developerProject', fn ($q) => $q->where('developer_id', (int) $request->query('developer_id')));
        }
        if (is_numeric($request->query('max_price'))) {
            // Prices are stored as {"amount":…,"currency":…} (older rows as a bare number); compare the amount.
            $query->whereRaw(
                'CAST(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(properties.price, \'$.amount\')), properties.price) AS DECIMAL(18,2)) <= ?',
                [(float) $request->query('max_price')]
            );
        }
        if (is_numeric($request->query('min_bedrooms'))) {
            $query->where('bedrooms', '>=', (int) $request->query('min_bedrooms'));
        }
        if ($request->filled('search')) {
            $term = '%'.addcslashes((string) $request->query('search'), '%_\\').'%';
            $query->where(fn ($q) => $q
                ->where('title', 'like', $term)
                ->orWhere('area', 'like', $term)
                ->orWhere('city', 'like', $term));
        }
    }

    /**
     * @return list<string>
     */
    private function listParam(Request $request, string $key): array
    {
        $raw = $request->query($key);
        $values = is_array($raw) ? $raw : explode(',', (string) $raw);

        return array_values(array_filter(array_map('trim', $values), fn ($v) => $v !== ''));
    }

    /**
     * What the filter row offers.
     *
     * @return array<string, Collection|array>
     */
    private function filterOptions(): array
    {
        $companyId = user()->company_id;

        return [
            'cities' => PropertyCity::where('company_id', $companyId)->orderBy('label')->get(['name', 'label']),
            'areas' => Property::query()->whereNotNull('area')->where('area', '!=', '')->distinct()->orderBy('area')->pluck('area'),
            'construction_statuses' => PropertyConstructionStatus::where('company_id', $companyId)->orderBy('label')->get(['name', 'label']),
            'deed_statuses' => PropertyDeedStatus::where('company_id', $companyId)->orderBy('label')->get(['name', 'label']),
            'developers' => Developer::where('company_id', $companyId)->orderBy('name')->get(['id', 'name']),
        ];
    }
}
