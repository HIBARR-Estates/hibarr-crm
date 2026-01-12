<?php

namespace App\Services;

use App\Enums\Salutation;
use App\Models\ClientCategory;
use App\Models\CustomFieldCategory;
use App\Models\CustomFieldGroup;
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

    private function getLeadAgents(Request $request)
    {
        $query = LeadAgent::select('id', 'user_id')
            ->with('user:id,name,email,image,status')
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
        $query = Package::select('id', 'name', 'currency_id', 'monthly_price', 'annual_price')
            ->orderBy('sort', 'asc');

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