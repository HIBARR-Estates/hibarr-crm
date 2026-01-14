<?php

namespace App\Services;

use App\Models\Lead;
use App\Models\User;
use App\Models\PipelineStage;
use App\Models\CustomFieldGroup;
use App\Models\CustomFieldCategory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;

class LeadService
{
    /**
     * Get paginated leads with optimized queries
     */
    public function getPaginatedLeads(Request $request, $dataTable = null): LengthAwarePaginator
    {
        $viewPermission = user()->permission('view_lead');
        
        $query = Lead::query()
            ->with([
                'leadOwner:id,name,email,image',
                'addedBy:id,name,email',
                'leadSource:id,type',
                'category:id,category_name',
                'client:id,name,email'
            ])
            ->select([
                'leads.id', 'leads.company_id', 'leads.client_name', 'leads.client_email', 
                'leads.company_name', 'leads.mobile', 'leads.created_at', 'leads.updated_at',
                'leads.lead_owner', 'leads.added_by', 'leads.source_id', 'leads.category_id', 'leads.client_id',
                'leads.salutation', 'leads.gender'
            ]);

        // Apply permission-based filtering
        $this->applyPermissionScope($query, $viewPermission);
        
        // Apply filters
        $this->applyFilters($query, $request);
        
        // Apply sorting
        $this->applySorting($query, $request);
        
        $leads = $query->paginate($request->get('per_page', 15));

        $leads->getCollection()->transform(function ($lead) {
            $lead->salutation_value = $lead->salutation instanceof \App\Enums\Salutation ? $lead->salutation->value : $lead->salutation;
            $lead->gender_value = $lead->gender instanceof \App\Enums\Gender ? $lead->gender->value : $lead->gender;
            return $lead->withCustomFields();
        });

        return $leads;
    }

    /**
     * Get dropdown leads (limited for performance)
     */
    public function getDropdownLeads(int $limit = 100): \Illuminate\Support\Collection
    {
        return Lead::select('id', 'client_name', 'salutation')
            ->where('company_id', company()->id)
            ->orderBy('client_name')
            ->limit($limit)
            ->get()
            ->map(function($contact) {
                $salutation = $contact->salutation;
                if ($salutation instanceof \App\Enums\Salutation) {
                    $salutation = $salutation->label();
                }
                
                $salutationDisplay = $salutation ? $salutation . ' ' : '';
                return [
                    'id' => $contact->id,
                    'client_name' => $contact->client_name,
                    'client_name_salutation' => $salutationDisplay . $contact->client_name,
                ];
            });
    }

    /**
     * Get lead stages for the UI
     */
    public function getLeadStages(): \Illuminate\Support\Collection
    {
        return PipelineStage::select('id', 'name', 'lead_pipeline_id', 'label_color')
            ->get()
            ->map(function($stage) {
                return [
                    'id' => $stage->id,
                    'name' => $stage->name,
                    'lead_pipeline_id' => $stage->lead_pipeline_id,
                    'label_color' => $stage->label_color,
                ];
            });
    }

    /**
     * Get lead custom fields and categories for forms
     */
    public function getLeadCustomFieldsData(): array
    {
        // Get custom fields
        $lead = new Lead();
        $getCustomFieldGroupsWithFields = $lead->getCustomFieldGroupsWithFields();
        $customFields = $getCustomFieldGroupsWithFields ? $getCustomFieldGroupsWithFields->fields : [];

        // Get custom field categories
        $leadCustomFieldGroup = CustomFieldGroup::where('model', Lead::CUSTOM_FIELD_MODEL)->first();
        $customFieldCategories = collect();
        if ($leadCustomFieldGroup) {
            $customFieldCategories = CustomFieldCategory::where('custom_field_group_id', $leadCustomFieldGroup->id)
                ->where('company_id', company()->id)
                ->orderBy(DB::raw('`order`'), 'asc')
                ->orderBy('id', 'asc')
                ->get();
        }

        return [
            'customFields' => $customFields,
            'customFieldCategories' => $customFieldCategories,
        ];
    }

    /**
     * Apply permission-based filtering
     */
    private function applyPermissionScope(Builder $query, string $viewPermission): void
    {
        $userId = user()->id;
        
        switch ($viewPermission) {
            case 'added':
                $query->where('added_by', $userId);
                break;
            case 'owned':
                $query->where('lead_owner', $userId);
                break;
            case 'both':
                $query->where(function($q) use ($userId) {
                    $q->where('added_by', $userId)
                      ->orWhere('lead_owner', $userId);
                });
                break;
            case 'all':
            default:
                // No additional filtering needed
                break;
        }
    }

    /**
     * Apply request filters
     */
    private function applyFilters(Builder $query, Request $request): void
    {
        if ($request->filled('search')) {
            $search = $request->get('search');
            $query->where(function($q) use ($search) {
                $q->where('client_name', 'like', '%' . $search . '%')
                  ->orWhere('client_email', 'like', '%' . $search . '%')
                  ->orWhere('company_name', 'like', '%' . $search . '%');
            });
        }

        if ($request->filled('lead_source')) {
            $query->where('source_id', $request->get('lead_source'));
        }

        if ($request->filled('lead_owner_id')) {
            $query->where('lead_owner', $request->get('lead_owner_id'));
        }

        if ($request->filled('added_by_id')) {
            $query->where('added_by', $request->get('added_by_id'));
        }

        if ($request->filled('start_date') && $request->filled('end_date')) {
            $query->whereBetween('created_at', [
                $request->get('start_date'),
                $request->get('end_date')
            ]);
        }
    }

    /**
     * Apply sorting
     */
    private function applySorting(Builder $query, Request $request): void
    {
        if ($request->filled('sort_by')) {
            $sortBy = $request->get('sort_by');
            $sortDirection = $request->get('sort_direction', 'asc');
            
            // Validate sort direction
            if (!in_array($sortDirection, ['asc', 'desc'])) {
                $sortDirection = 'asc';
            }
            
            // Map frontend sort fields to database columns
            $sortMapping = [
                'client_name' => 'leads.client_name',
                'lead_owner' => 'lead_owner_user.name',
                'created_at' => 'leads.created_at',
                'updated_at' => 'leads.updated_at',
                'company_name' => 'leads.company_name',
                'client_email' => 'leads.client_email',
            ];
            
            if (isset($sortMapping[$sortBy])) {
                // Handle lead_owner sorting which requires a join
                if ($sortBy === 'lead_owner') {
                    $query->leftJoin('users as lead_owner_user', 'leads.lead_owner', '=', 'lead_owner_user.id')
                          ->orderBy($sortMapping[$sortBy], $sortDirection);
                } else {
                    $query->orderBy($sortMapping[$sortBy], $sortDirection);
                }
            } else {
                // Default fallback
                $query->orderBy('leads.created_at', 'desc');
            }
        } else {
            // Default sorting when no sort is specified
            $query->orderBy('leads.created_at', 'desc');
        }
    }
}