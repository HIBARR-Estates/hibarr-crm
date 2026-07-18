<?php

namespace App\Services;

use App\Models\Lead;
use App\Models\User;
use App\Models\PipelineStage;
use App\Models\CustomFieldGroup;
use App\Models\CustomFieldCategory;
use App\Services\LeadCoreFieldsService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;

class LeadService
{
    public function __construct(
        private readonly LeadCoreFieldsService $coreFieldsService,
    ) {
    }
    /**
     * Get paginated leads with optimized queries
     */
    public function getPaginatedLeads(Request $request, $dataTable = null): LengthAwarePaginator
    {
        $viewPermission = user()->permission('view_lead');
        
        // Q2: eager-load only relations the Leads Index actually consumes.
        // - leadOwner: lead owner column (image_url, name)
        // - addedBy: edit-from-Index modal reads lead.added_by.id
        // - leadSource / category: table columns
        // The lifecycle column uses the lead_lifecycle_status_id scalar + the
        // leadLifecycleStatuses page prop (not the lifecycleStatus relation).
        // Custom field values are fetched on edit open (M4/S3), not per row.
        $query = Lead::query()
            ->with([
                'leadOwner:id,name,email,image',
                'addedBy:id,name,email',
                'leadSource:id,type',
                'category:id,category_name',
            ])
            ->select([
                'leads.id', 'leads.company_id', 'leads.client_name', 'leads.client_email', 
                'leads.company_name', 'leads.mobile', 'leads.created_at', 'leads.updated_at',
                'leads.lead_owner', 'leads.added_by', 'leads.source_id', 'leads.category_id', 'leads.client_id',
                'leads.lead_lifecycle_status_id',
                'leads.salutation', 'leads.gender', 'leads.address', 'leads.city', 'leads.state', 
                'leads.country', 'leads.postal_code', 'leads.website', 'leads.cell', 'leads.office',
                'leads.languages', 'leads.date_of_birth', 'leads.age', 'leads.age_range', 'leads.nationality', 'leads.occupation',
            ]);

        // Apply permission-based filtering
        $this->applyPermissionScope($query, $viewPermission);
        
        // Apply filters
        $this->applyFilters($query, $request);
        
        // Apply sorting
        $this->applySorting($query, $request);
        
        $leads = $query->paginate($request->get('per_page', 15));

        // S3: do not call withCustomFields() / mergeOntoLead here — SaveLeadModal
        // fetches custom field values on edit open (M4). Keep enum scalar helpers
        // the Index / edit modal still read from the row.
        $leads->getCollection()->transform(function ($lead) {
            $lead->salutation_value = $lead->salutation instanceof \App\Enums\Salutation ? $lead->salutation->value : $lead->salutation;
            $lead->gender_value = $lead->gender instanceof \App\Enums\Gender ? $lead->gender->value : $lead->gender;

            return $lead;
        });

        return $leads;
    }

    /**
     * Get dropdown leads (limited for performance)
     */
    public function getDropdownLeads(int $limit = 100): \Illuminate\Support\Collection
    {
        return Lead::select('id', 'client_name', 'salutation', 'lead_owner')
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
                    'lead_owner' => $contact->lead_owner,
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
            'customFields' => $this->coreFieldsService
                ->filterPromotedFieldDefinitions($customFields)
                ->all(),
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

        if ($request->filled('category_id')) {
            $query->where('category_id', $request->get('category_id'));
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

        if ($request->filled('lifecycle_status_id')) {
            $query->where('lead_lifecycle_status_id', $request->get('lifecycle_status_id'));
        }

        if ($this->coreFieldsService->useCoreFields() && $request->filled('language')) {
            $languageCode = $request->get('language');
            $query->where(function ($q) use ($languageCode) {
                $q->whereJsonContains('languages', $languageCode);
            });
        }

        if ($request->filled('qualification_segment_key')) {
            $segmentKey = $request->get('qualification_segment_key');
            $answerValues = array_filter((array) $request->get('qualification_answer_values', []));

            $query->whereExists(function ($sub) use ($segmentKey, $answerValues) {
                $sub->select(DB::raw(1))
                    ->from('lead_qualification_answers as lqa')
                    ->join('lead_qualifications as lq', 'lq.id', '=', 'lqa.lead_qualification_id')
                    ->whereColumn('lq.lead_id', 'leads.id')
                    ->where('lqa.segment_key', $segmentKey)
                    ->whereRaw('lq.id = (
                        SELECT lq2.id FROM lead_qualifications lq2
                        WHERE lq2.lead_id = leads.id
                        ORDER BY lq2.started_at DESC, lq2.id DESC
                        LIMIT 1
                    )');

                foreach ($answerValues as $value) {
                    $sub->whereJsonContains('lqa.answer_values', $value);
                }
            });
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
                'category' => 'lead_category.category_name',
                'lead_owner' => 'lead_owner_user.name',
                'created_at' => 'leads.created_at',
                'updated_at' => 'leads.updated_at',
                'company_name' => 'leads.company_name',
                'client_email' => 'leads.client_email',
                'source_id' => 'lead_sources.sort_order',
            ];
            
            if (isset($sortMapping[$sortBy])) {
                if ($sortBy === 'lead_owner') {
                    $query->leftJoin('users as lead_owner_user', 'leads.lead_owner', '=', 'lead_owner_user.id')
                          ->orderBy($sortMapping[$sortBy], $sortDirection);
                } elseif ($sortBy === 'category') {
                    $query->leftJoin('lead_category', 'leads.category_id', '=', 'lead_category.id')
                          ->orderBy($sortMapping[$sortBy], $sortDirection);
                } elseif ($sortBy === 'source_id') {
                    $query->leftJoin('lead_sources', 'leads.source_id', '=', 'lead_sources.id')
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