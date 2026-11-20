<?php

namespace App\Http\Controllers\AgentWorkspace;

use App\Http\Controllers\AccountBaseController;
use App\Models\Deal;
use App\Models\Developer;
use App\Models\DeveloperProject;
use App\Models\LeadPipeline;
use App\Models\ProjectLocation;
use App\Models\Property;
use App\Models\PropertyCity;
use App\Models\PropertyConstructionStatus;
use App\Models\PropertyDeedStatus;
use App\Services\AgentWorkspace\PortfolioPresenter;
use App\Services\PropertyRecommendationService;
use App\Support\DeveloperProjectListingQuery;
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
    /** Properties on one page of Browse (a 4-column grid, four rows). */
    public const BROWSE_PAGE_SIZE = 16;

    /** Developer projects on one page of Projects. */
    public const PROJECTS_PAGE_SIZE = 12;

    /** Deals on one page of the For my deals rail. */
    public const DEALS_PAGE_SIZE = 8;

    /**
     * Most recommendations asked of the matching service for one deal. The
     * page shows six at a time and pages through them in the browser.
     */
    public const RECOMMENDATION_LIMIT = 18;

    private const FILTER_KEYS = ['search', 'city', 'area', 'max_price', 'min_bedrooms', 'construction_status', 'deed_status', 'developer_id'];

    /** The Projects page's filters: the Projects list's own keys, so the same query runs. */
    private const PROJECT_FILTER_KEYS = [
        'search', 'developer_id', 'construction_status', 'city', 'area', 'primary_category', 'title_deed_type', 'unit_types',
        'completion_start', 'completion_end', 'min_starting_price', 'max_starting_price', 'min_bedrooms', 'max_bedrooms',
        'min_total_units', 'max_total_units',
    ];

    /** The properties list's own check: someone who cannot view properties does not get the Portfolio. */
    private function authorizeView(): void
    {
        $view = user()->permission('view_product');

        abort_unless(
            PermissionGates::canManageProperties(user())
                || in_array($view, ['all', 'added', 'owned', 'both', 4, 1], true),
            403
        );
    }

    /**
     * For my deals (L7-18): the agent's open deals on the left (one pipeline at
     * a time, paged), matches for the picked one on the right.
     */
    public function forDeals(Request $request): Response
    {
        $this->authorizeView();

        $pipelines = LeadPipeline::query()->orderBy('name')->get(['id', 'name', 'default']);
        $pipelineId = $this->dealsPipeline($request, $pipelines);

        $base = $this->myOpenDeals($pipelineId);
        $lastPage = max(1, (int) ceil((clone $base)->count() / self::DEALS_PAGE_SIZE));
        $page = min($lastPage, max(1, (int) $request->query('deals_page', 1)));

        $deals = (clone $base)
            ->with(['contact:id,client_name', 'hibarrFields', 'leadStage:id,name'])
            ->paginate(self::DEALS_PAGE_SIZE, ['deals.*'], 'deals_page', $page);

        // The deal asked for may sit on another page of the rail; the right side still follows it.
        $selected = $request->filled('deal')
            ? (clone $base)->with(['contact:id,client_name', 'hibarrFields', 'leadStage:id,name'])->whereKey((int) $request->query('deal'))->first()
            : null;
        $selected ??= $deals->getCollection()->first();

        return Inertia::render('AgentWorkspace/Portfolio', [
            'view' => 'deals',
            'pageTitle' => __('pages.agent_workspace.nav.portfolio'),
            'pipelines' => $pipelines->map(fn (LeadPipeline $pipeline) => ['id' => (int) $pipeline->id, 'name' => $pipeline->name])->values(),
            'pipelineId' => $pipelineId === null ? 'all' : (string) $pipelineId,
            'deals' => $deals->getCollection()->map(fn (Deal $deal) => $this->presentDeal($deal))->values(),
            'dealsPage' => $this->pageMeta($deals),
            'selectedDeal' => $selected ? $this->presentDeal($selected) : null,
            'dealId' => $selected?->id,
            'recommendations' => Inertia::defer(
                fn () => $selected ? $this->recommendationsFor($selected) : ['deal_id' => null, 'items' => [], 'error' => null],
                'recommendations'
            ),
        ]);
    }

    /** Browse (L7-19): every property the agent may see, sixteen to a page, narrowed by the filters. */
    public function browse(Request $request): Response
    {
        $this->authorizeView();

        return Inertia::render('AgentWorkspace/Portfolio', [
            'view' => 'browse',
            'pageTitle' => __('pages.agent_workspace.nav.portfolio'),
            'filters' => $request->only(self::FILTER_KEYS),
            'properties' => Inertia::defer(function () use ($request) {
                $query = $this->visibleProperties()->with(array_merge(PortfolioPresenter::PROPERTY_RELATIONS, PortfolioPresenter::photoRelation()));
                $this->applyFilters($query, $request);

                $total = (clone $query)->count();
                $lastPage = max(1, (int) ceil($total / self::BROWSE_PAGE_SIZE));
                $page = min($lastPage, max(1, (int) $request->query('page', 1)));
                $items = $query->orderByDesc('created_at')->orderByDesc('id')->forPage($page, self::BROWSE_PAGE_SIZE)->get();

                return [
                    'items' => $items->map(fn (Property $p) => PortfolioPresenter::property($p))->values(),
                    'total' => $total,
                ] + $this->pageNumbers($page, $lastPage, self::BROWSE_PAGE_SIZE, $total, $items->count());
            }, 'properties'),
            'options' => Inertia::defer(fn () => $this->filterOptions(), 'options'),
        ]);
    }

    /** Projects (L7-20): developer projects with how many units of each type are left, twelve to a page. */
    public function projects(Request $request): Response
    {
        $this->authorizeView();

        return Inertia::render('AgentWorkspace/Portfolio', [
            'view' => 'projects',
            'pageTitle' => __('pages.agent_workspace.nav.portfolio'),
            'filters' => $request->only(self::PROJECT_FILTER_KEYS),
            'projects' => Inertia::defer(function () use ($request) {
                $query = DeveloperProject::query()
                    ->where('company_id', user()->company_id)
                    ->with(['developer:id,name,logo_url', 'location:id,name,city,area', 'thumbnail', 'unitTypes' => fn ($q) => $q->orderBy('bedrooms')->orderBy('id')]);

                DeveloperProjectVisibility::scopeVisibleProjects($query);
                // The Projects list's own filter query, so a filter means the same here.
                DeveloperProjectListingQuery::apply($query, $request->only(self::PROJECT_FILTER_KEYS), true);

                $total = (clone $query)->count();
                $lastPage = max(1, (int) ceil($total / self::PROJECTS_PAGE_SIZE));
                $page = min($lastPage, max(1, (int) $request->query('page', 1)));
                $items = $query->reorder()->orderBy('name')->orderBy('developer_projects.id')->forPage($page, self::PROJECTS_PAGE_SIZE)->get();

                return [
                    'items' => $items->map(fn (DeveloperProject $project) => PortfolioPresenter::project($project))->values(),
                    'total' => $total,
                ] + $this->pageNumbers($page, $lastPage, self::PROJECTS_PAGE_SIZE, $total, $items->count());
            }, 'projects'),
            'options' => Inertia::defer(fn () => $this->projectFilterOptions(), 'options'),
        ]);
    }

    /**
     * The pipeline the rail lists: the one asked for, "all" for every pipeline,
     * else the company's default pipeline (what the Deals page opens on).
     */
    private function dealsPipeline(Request $request, Collection $pipelines): ?int
    {
        $asked = (string) $request->query('pipeline', '');

        if ($asked === 'all') {
            return null;
        }
        if ($asked !== '' && $pipelines->contains('id', (int) $asked)) {
            return (int) $asked;
        }

        $default = $pipelines->firstWhere('default', 1);

        return $default ? (int) $default->id : null;
    }

    /** The agent's own open deals: lead agent is the viewer, outcome not yet set. */
    private function myOpenDeals(?int $pipelineId)
    {
        return Deal::query()
            ->whereNull('deals.outcome_status')
            ->whereHas('leadAgent', fn ($q) => $q->where('user_id', user()->id))
            ->when($pipelineId !== null, fn ($q) => $q->where('deals.lead_pipeline_id', $pipelineId))
            ->orderByDesc('deals.updated_at')
            ->orderByDesc('deals.id');
    }

    /**
     * @return array{page: int, last_page: int, per_page: int, from: int, to: int}
     */
    private function pageNumbers(int $page, int $lastPage, int $perPage, int $total, int $count): array
    {
        return [
            'page' => $page,
            'last_page' => $lastPage,
            'per_page' => $perPage,
            'from' => $count === 0 ? 0 : ($page - 1) * $perPage + 1,
            'to' => $count === 0 ? 0 : ($page - 1) * $perPage + $count,
        ];
    }

    /**
     * @return array{page: int, last_page: int, per_page: int, total: int, from: int, to: int}
     */
    private function pageMeta($paginator): array
    {
        return [
            'page' => (int) $paginator->currentPage(),
            'last_page' => (int) $paginator->lastPage(),
            'per_page' => (int) $paginator->perPage(),
            'total' => (int) $paginator->total(),
            'from' => (int) ($paginator->firstItem() ?? 0),
            'to' => (int) ($paginator->lastItem() ?? 0),
        ];
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
     * @return array{deal_id: int, items: list<array<string, mixed>>, error: string|null}
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

        return ['deal_id' => (int) $deal->id, 'items' => $items, 'error' => $result['error'] ?? null];
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
            'areas' => Property::query()->whereNotNull('area')->where('area', '!=', '')->distinct()->orderBy('area')->pluck('area')
                ->map(fn (string $area) => ['name' => $area, 'label' => PortfolioPresenter::tidy($area)])
                ->values(),
            'construction_statuses' => PropertyConstructionStatus::where('company_id', $companyId)->orderBy('label')->get(['name', 'label']),
            'deed_statuses' => PropertyDeedStatus::where('company_id', $companyId)->orderBy('label')->get(['name', 'label']),
            'developers' => Developer::where('company_id', $companyId)->orderBy('name')->get(['id', 'name']),
        ];
    }

    /**
     * What the Projects filters offer: the same lists as the Projects page.
     *
     * @return array<string, Collection|array>
     */
    private function projectFilterOptions(): array
    {
        $companyId = user()->company_id;

        $developers = Developer::where('company_id', $companyId)->select('id', 'name', 'is_hidden')->orderBy('name');
        DeveloperProjectVisibility::scopeVisibleDevelopers($developers);

        return [
            'developers' => $developers->get(['id', 'name']),
            'locations' => ProjectLocation::where('company_id', $companyId)
                ->whereHas('developerProjects')
                ->select('id', 'name', 'city', 'area')
                ->orderBy('name')
                ->get(),
            'construction_statuses' => collect(DeveloperProject::CONSTRUCTION_STATUS_LABELS)
                ->map(fn ($label, $name) => ['name' => $name, 'label' => $label])
                ->values(),
        ];
    }
}
