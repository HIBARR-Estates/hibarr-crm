<?php

namespace App\Services;

use App\Enums\Salutation;
use App\Enums\AgeRange;
use App\Enums\LeadTemperature;
use App\Models\ClientCategory;
use App\Models\CustomFieldCategory;
use App\Models\CustomFieldGroup;
use App\Models\Deal;
use App\Models\DeveloperProject;
use App\Models\LanguageSetting;
use App\Models\Lead;
use App\Models\LeadAgent;
use App\Models\LeadCategory;
use App\Models\LeadPipeline;
use App\Models\LeadSource;
use App\Models\Package;
use App\Models\PipelineStage;
use App\Models\Product;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;

class FormDataService
{
    private const CACHE_TTL = 1800; // 30 minutes

    /**
     * Get data based on type with pagination and filters
     */
    public function getData(string $type, Request $request)
    {
        switch ($type) {
            case 'salutations':
                return $this->getSalutations();
            case 'genders':
                return $this->getGenders();
            case 'age-ranges':
                return $this->getAgeRanges();
            case 'temperatures':
                return $this->getTemperatures();
            case 'categories':
                return $this->getCategories($request);
            case 'sources':
                return $this->getSources($request);
            case 'employees':
                return $this->getEmployees($request);
            case 'lead-pipelines':
                return $this->getLeadPipelines($request);
            case 'lead-stages':
                return $this->getLeadStages($request);
            case 'products':
                return $this->getProducts($request);
            case 'countries':
                return $this->getCountries($request);
            case 'currencies':
                return $this->getCurrencies($request);
            case 'lead-agents':
                return $this->getLeadAgents($request);
            case 'client-categories':
                return $this->getClientCategories($request);
            case 'languages':
                return $this->getLanguages($request);
            case 'leads':
                return $this->getLeads($request);
            case 'packages':
                return $this->getPackages($request);
            case 'deal-custom-fields':
                return $this->getDealCustomFields();
            case 'deal-custom-field-categories':
                return $this->getDealCustomFieldCategories();
            case 'deal-pipeline-custom-field-category-map':
                return $this->getDealPipelineCustomFieldCategoryMap();
            case 'lead-custom-fields':
                return $this->getLeadCustomFields();
            case 'lead-custom-field-categories':
                return $this->getLeadCustomFieldCategories();
            case 'developer_projects':
            case 'developer-projects':
                return $this->getDeveloperProjects($request);
            case 'lead-utm-sources':
                return $this->getDistinctMarketingValues('utm_source');
            case 'lead-utm-mediums':
                return $this->getDistinctMarketingValues('utm_medium');
            case 'lead-utm-campaigns':
                return $this->getDistinctMarketingValues('utm_campaign');
            case 'lead-utm-contents':
                return $this->getDistinctMarketingValues('utm_content');
            case 'lead-utm-terms':
                return $this->getDistinctMarketingValues('utm_term');
            case 'lead-utm-audiences':
                return $this->getDistinctMarketingValues('utm_audience');
            default:
                return collect();
        }
    }

    private function getSalutations(): Collection
    {
        return Cache::remember('salutations', self::CACHE_TTL, function () {
            return collect(Salutation::cases())->map(function($salutation) {
                return [
                    'value' => $salutation->value,
                    'label' => $salutation->label(),
                ];
            });
        });
    }

    private function getGenders(): Collection
    {
        return Cache::remember('genders', self::CACHE_TTL, function () {
            return collect([
                ['value' => 'male', 'label' => 'Male'],
                ['value' => 'female', 'label' => 'Female'],
            ]);
        });
    }

    private function getAgeRanges(): Collection
    {
        return Cache::remember('age_ranges', self::CACHE_TTL, function () {
            return collect(AgeRange::cases())->map(function (AgeRange $ageRange) {
                return [
                    'value' => $ageRange->value,
                    'label' => $ageRange->label(),
                ];
            });
        });
    }

    private function getTemperatures(): Collection
    {
        return Cache::remember('lead_temperatures', self::CACHE_TTL, function () {
            return collect(LeadTemperature::cases())->map(function (LeadTemperature $temperature) {
                return [
                    'value' => $temperature->value,
                    'label' => $temperature->label(),
                ];
            });
        });
    }

    /**
     * Distinct, non-empty values already present in lead_marketing for a given
     * UTM column, scoped to the current company — used to populate UTM filter
     * dropdowns from real data instead of a fixed/free-text list.
     */
    private function getDistinctMarketingValues(string $column): Collection
    {
        $cacheKey = 'lead_marketing_distinct_' . $column . '_' . company()->id;

        return Cache::remember($cacheKey, self::CACHE_TTL, function () use ($column) {
            return \DB::table('lead_marketing')
                ->join('leads', 'leads.id', '=', 'lead_marketing.lead_id')
                ->where('leads.company_id', company()->id)
                ->whereNull('leads.deleted_at')
                ->whereNotNull('lead_marketing.' . $column)
                ->where('lead_marketing.' . $column, '!=', '')
                ->groupBy('lead_marketing.' . $column)
                ->orderByRaw('count(*) desc')
                ->select(
                    'lead_marketing.' . $column . ' as value',
                    \DB::raw('count(distinct leads.id) as count')
                )
                ->get()
                ->map(fn ($row) => [
                    'value' => $row->value,
                    'label' => $row->value,
                    'count' => (int) $row->count,
                ])
                ->values();
        });
    }

    private function getCategories(Request $request)
    {
        $query = LeadCategory::select('id', 'category_name')
            ->where('company_id', company()->id);

        if ($request->filled('search')) {
            $query->where('category_name', 'like', '%' . $request->get('search') . '%');
        }

        return $this->paginateIfRequested($query, $request);
    }

    private function getSources(Request $request)
    {
        $query = LeadSource::select('id', 'type')
            ->where('company_id', company()->id);

        if ($request->filled('search')) {
            $query->where('type', 'like', '%' . $request->get('search') . '%');
        }

        return $this->paginateIfRequested($query, $request);
    }

    private function getEmployees(Request $request)
    {
        $query = User::select('id', 'name', 'email', 'image')
            ->with('employeeDetail:user_id,designation_id')
            ->whereHas('roles', fn($q) => $q->where('name', 'employee'))
            ->where('status', 'active')
            ->where('company_id', company()->id);

        if ($request->filled('search')) {
            $query->where('name', 'like', '%' . $request->get('search') . '%');
        }

        return $this->paginateIfRequested($query, $request);
    }

    private function getLeadPipelines(Request $request)
    {
        $query = LeadPipeline::select('id', 'name', 'default')
            ->where('company_id', company()->id)
            ->orderBy('default', 'DESC');

        if ($request->filled('search')) {
            $query->where('name', 'like', '%' . $request->get('search') . '%');
        }

        return $this->paginateIfRequested($query, $request);
    }

    private function getLeadStages(Request $request)
    {
        $query = PipelineStage::select('id', 'name', 'lead_pipeline_id', 'label_color');

        if ($request->filled('pipeline_id')) {
            $query->where('lead_pipeline_id', $request->get('pipeline_id'));
        }

        if ($request->filled('search')) {
            $query->where('name', 'like', '%' . $request->get('search') . '%');
        }

        return $this->paginateIfRequested($query, $request);
    }

    private function getProducts(Request $request)
    {
        $query = Product::select('id', 'name', 'price')
            ->where('company_id', company()->id);

        if ($request->filled('search')) {
            $query->where('name', 'like', '%' . $request->get('search') . '%');
        }

        return $this->paginateIfRequested($query, $request);
    }

    private function getCountries(Request $request)
    {
        return Cache::remember('countries_' . $request->get('search', ''), self::CACHE_TTL, function () use ($request) {
            $countries = countries();
            
            if ($request->filled('search')) {
                $search = strtolower($request->get('search'));
                $countries = $countries->filter(function($country) use ($search) {
                    return str_contains(strtolower($country['nicename']), $search) ||
                           str_contains(strtolower($country['iso']), $search);
                });
            }

            if( $request->filled('paginate') && $request->get('paginate')){
                return $this->manualPaginate($countries, $request);
            }
            
            return $countries;
        });
    }

    private function getCurrencies(Request $request)
    {
        try {
            $company = function_exists('company') ? company() : null;

            if (!$company) {
                return collect();
            }

            $cacheKey = 'company_currencies_' . $company->id . '_' . $request->get('search', '');

            return Cache::remember($cacheKey, self::CACHE_TTL, function () use ($company, $request) {
                $currencies = $company->currencies()->get()->map(function ($currency) {
                    return [
                        'id' => $currency->id,
                        'company_id' => $currency->company_id,
                        'currency_name' => $currency->currency_name,
                        'currency_symbol' => $currency->currency_symbol,
                        'currency_code' => $currency->currency_code,
                        'exchange_rate' => $currency->exchange_rate,
                        'is_cryptocurrency' => $currency->is_cryptocurrency,
                        'usd_price' => $currency->usd_price,
                    ];
                });

                if ($request->filled('search')) {
                    $search = strtolower($request->get('search'));
                    $currencies = $currencies->filter(function ($currency) use ($search) {
                        return str_contains(strtolower((string) ($currency['currency_name'] ?? '')), $search)
                            || str_contains(strtolower((string) ($currency['currency_code'] ?? '')), $search);
                    })->values();
                }

                if ($request->filled('paginate') && $request->get('paginate')) {
                    return $this->manualPaginate($currencies, $request);
                }

                return $currencies->values();
            });
        } catch (\Exception $e) {
            return collect();
        }
    }

    private function getLeadAgents(Request $request)
    {
        $query = LeadAgent::select('id', 'user_id', 'lead_category_id', 'status')
            ->with([
                'user:id,name,email,image,status',
                'user.employeeDetail:id,user_id,designation_id',
                'user.employeeDetail.designation:id,name',
            ])
            ->where('status', 'enabled')
            ->whereHas('user', fn($q) => $q->where('status', 'active'));

        if ($request->filled('search')) {
            $query->whereHas('user', fn($q) => 
                $q->where('name', 'like', '%' . $request->get('search') . '%')
            );
        }

        return $this->paginateIfRequested($query, $request);
    }

    private function getClientCategories(Request $request)
    {
        $query = ClientCategory::select('id', 'category_name')
            ->where('company_id', company()->id);

        if ($request->filled('search')) {
            $query->where('category_name', 'like', '%' . $request->get('search') . '%');
        }

        return $this->paginateIfRequested($query, $request);
    }

    private function getLanguages(Request $request)
    {
        $query = LanguageSetting::select('id', 'language_name', 'language_code')
            ->where('status', 'enabled');

        if ($request->filled('search')) {
            $query->where('language_name', 'like', '%' . $request->get('search') . '%');
        }

        return $this->paginateIfRequested($query, $request);
    }

    private function getLeads(Request $request)
    {
        $leadService = app(LeadService::class);
        
        if ($request->filled('paginate')) {
            return $leadService->getPaginatedLeads($request, user()->permission('view_lead'));
        }
        
        return $leadService->getDropdownLeads($request->get('limit', 100));
    }

    /**
     * Helper to paginate if requested
     */

    private function getPackages(Request $request) {
        $query = Package::select('id', 'name', 'value')
            ->orderBy('id', 'asc');

        if ($request->filled('search')) {
            $query->where('name', 'like', '%' . $request->get('search') . '%');
        }

        return $this->paginateIfRequested($query, $request);
    }

    private function getDealCustomFields(): Collection
    {
        $deal = new Deal();
        $group = $deal->getCustomFieldGroupsWithFields();

        return $group && $group->fields ? $group->fields->values() : collect();
    }

    private function getDealCustomFieldCategories(): Collection
    {
        $group = CustomFieldGroup::where('model', Deal::CUSTOM_FIELD_MODEL)->first();

        if (!$group) {
            return collect();
        }

        return CustomFieldCategory::where('custom_field_group_id', $group->id)
            ->where('company_id', company()->id)
            ->orderBy(\DB::raw('`order`'), 'asc')
            ->orderBy('id', 'asc')
            ->get();
    }

    /**
     * Lead custom field definitions (promoted core fields filtered out),
     * matching what Leads Index / SaveLeadModal receive as `customFields`.
     */
    private function getLeadCustomFields(): Collection
    {
        $data = app(LeadService::class)->getLeadCustomFieldsData();

        // values(): filterPromotedFieldDefinitions can leave gaps in keys,
        // which would JSON-serialize as an object instead of an array.
        return collect($data['customFields'] ?? [])->values();
    }

    private function getLeadCustomFieldCategories(): Collection
    {
        $data = app(LeadService::class)->getLeadCustomFieldsData();

        return collect($data['customFieldCategories'] ?? [])->values();
    }

    private function getDealPipelineCustomFieldCategoryMap(): array
    {
        return LeadPipeline::query()
            ->with('customFieldCategories:id')
            ->get()
            ->mapWithKeys(function (LeadPipeline $pipeline) {
                return [
                    (string) $pipeline->id => $pipeline->customFieldCategories->pluck('id')->values()->all(),
                ];
            })
            ->toArray();
    }

    private function getDeveloperProjects(Request $request)
    {
        $query = DeveloperProject::select('id', 'name', 'developer_id', 'project_location_id', 'availability_link')
            ->with(['developer:id,name'])
            ->where('company_id', company()->id);

        if ($request->filled('search')) {
            $query->where('name', 'like', '%' . $request->get('search') . '%');
        }

        return $this->paginateIfRequested($query, $request);
    }

    private function paginateIfRequested($query, Request $request)
    {
        if ($request->filled('paginate') && $request->get('paginate')) {
            return $query->paginate($request->get('per_page', 15));
        }
        
        return $query->get();
    }

    /**
     * Manual pagination for collections
     */
    private function manualPaginate(Collection $collection, Request $request): LengthAwarePaginator
    {
        $perPage = $request->get('per_page', 15);
        $page = $request->get('page', 1);
        $offset = ($page - 1) * $perPage;
        
        return new LengthAwarePaginator(
            $collection->slice($offset, $perPage)->values(),
            $collection->count(),
            $perPage,
            $page,
            [
                'path' => $request->url(),
                'pageName' => 'page',
            ]
        );
    }
}