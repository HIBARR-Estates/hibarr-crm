<?php

namespace App\Services;

use App\Models\Deal;
use App\Models\User;
use App\Services\PermissionService;
use Illuminate\Http\Request;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;

class DealService
{
    public function getPaginatedDeals(Request $request): LengthAwarePaginator
    {
        // Get deals with pagination using relationships
        $dealsQuery = Deal::with([
            'leadAgent.user:id,name,email,image',
            'category:id,category_name',
            'contact:id,client_name,client_email,mobile,company_name',
            'pipeline:id,name',
            'leadStage:id,name,label_color,slug',
            'currency:id,currency_symbol,currency_code',
            'products:id,name',
            'tasks' => function($q) {
                $q->with(['deals', 'leads', 'properties']);
            }
        ])
        ->select(
            'deals.id',
            'deals.name',
            'deals.lead_id',
            'deals.lead_pipeline_id',
            'deals.agent_id',
            'deals.added_by',
            'deals.next_follow_up',
            'deals.value',
            'deals.pipeline_stage_id',
            'deals.created_at',
            'deals.close_date',
            'deals.updated_at',
            'deals.currency_id',
            'deals.category_id'
        );
        
        // Apply filters from request
        if ($request->filled('search')) {
            $searchTerm = $request->search;
            $dealsQuery->where(function($query) use ($searchTerm) {
                $query->where('deals.name', 'like', '%' . $searchTerm . '%')
                      ->orWhereHas('contact', function($q) use ($searchTerm) {
                          $q->where('client_name', 'like', '%' . $searchTerm . '%')
                            ->orWhere('client_email', 'like', '%' . $searchTerm . '%')
                            ->orWhere('company_name', 'like', '%' . $searchTerm . '%');
                      });
            });
        }

        if ($request->filled('lead_pipeline_id') && $request->lead_pipeline_id !== 'all') {
            $dealsQuery->where('deals.lead_pipeline_id', $request->lead_pipeline_id);
        }

        if ($request->filled('pipeline_stage_id') && $request->pipeline_stage_id !== 'all') {
            $dealsQuery->where('deals.pipeline_stage_id', $request->pipeline_stage_id);
        }

        if ($request->filled('category_id') && $request->category_id !== 'all') {
            $dealsQuery->where('deals.category_id', $request->category_id);
        }

        if ($request->filled('start_date') && $request->filled('end_date')) {
            $dealsQuery->whereBetween('deals.created_at', [
                $request->start_date . ' 00:00:00',
                $request->end_date . ' 23:59:59'
            ]);
        }

        if ($request->agent_status == 'unassigned') {
            $dealsQuery->whereNull('deals.agent_id');
        } elseif ($request->filled('agent_id') && $request->agent_id != 'all') {
            $dealsQuery->whereHas('leadAgent', function ($q) use ($request) {
                $q->where('user_id', $request->agent_id);
            });
        } elseif ($request->agent_status == 'active') {
            $dealsQuery->whereHas('leadAgent.user', function ($q) {
                $q->where('status', 'active');
            });
        } elseif ($request->agent_status == 'inactive') {
            $dealsQuery->whereHas('leadAgent.user', function ($q) {
                $q->where('status', '!=', 'active');
            });
        }

        // Apply permission-based filtering
        $dealRules = [
            'added' => 'deals.added_by',
            'owned' => function($q, $user) {
                $q->where(function($query) use ($user) {
                    $query->whereHas('leadAgent', function($q) use ($user) {
                        $q->where('user_id', $user->id);
                    })->orWhereHas('dealWatchers', function($q) use ($user) {
                        $q->where('users.id', $user->id);
                    });
                });
            }
        ];
        PermissionService::applyScope($dealsQuery, user(), 'view_deals', $dealRules);
        
        // Apply sorting if specified
        if ($request->filled('sort_by')) {
            $sortBy = $request->sort_by;
            $sortDirection = $request->get('sort_direction', 'asc');
            
            // Validate sort direction
            if (!in_array($sortDirection, ['asc', 'desc'])) {
                $sortDirection = 'asc';
            }
            
            // Map frontend sort fields to database columns
            $sortMapping = [
                'name' => 'deals.name',
                'value' => 'deals.value',
                'next_follow_up_date' => 'deals.next_follow_up',
                'created_at' => 'deals.created_at',
                'updated_at' => 'deals.updated_at',
            ];
            
            if (isset($sortMapping[$sortBy])) {
                $dealsQuery->orderBy($sortMapping[$sortBy], $sortDirection);
            } else {
                // Default fallback
                $dealsQuery->orderBy('deals.created_at', 'desc');
            }
        } else {
            // Default sorting when no sort is specified
            $dealsQuery->orderBy('deals.created_at', 'desc');
        }
        
        $paginatedDeals = $dealsQuery->paginate($request->get('per_page', 15));

        // Transform deals to include custom fields data efficiently
        $this->attachCustomFields($paginatedDeals);

        return $paginatedDeals;
    }

    private function attachCustomFields(LengthAwarePaginator $paginatedDeals)
    {
        // Get all deal IDs
        $dealIds = $paginatedDeals->pluck('id')->toArray();
        
        if (empty($dealIds)) {
            return;
        }

        // Fetch all custom fields data for these deals in one query
        // Assuming 'deals' is the model name in custom_fields_data
        // We need to check what getModelName() returns for Deal model. Usually it's the class name or a string defined in model.
        // Looking at CustomFieldsTrait, getModelName() uses ReflectionClass->getName().
        // So it is 'App\Models\Deal'.
        
        $modelName = 'App\Models\Deal';
        
        $customFieldsData = DB::table('custom_fields_data')
            ->where('model', $modelName)
            ->whereIn('model_id', $dealIds)
            ->get();
            
        // Fetch custom field definitions to map names
        // We can cache this or fetch once
        $customFields = DB::table('custom_fields')
            ->join('custom_field_groups', 'custom_fields.custom_field_group_id', '=', 'custom_field_groups.id')
            ->where('custom_field_groups.model', $modelName)
            ->select('custom_fields.id', 'custom_fields.name', 'custom_fields.type')
            ->get();
            
        $fieldsById = $customFields->keyBy('id');
        
        // Group data by model_id
        $dataByModelId = $customFieldsData->groupBy('model_id');
        
        // Attach to deals
        $paginatedDeals->getCollection()->transform(function ($deal) use ($dataByModelId, $fieldsById) {
            $dealData = $dataByModelId->get($deal->id, collect());
            
            $customFieldsDataMap = [];
            $remappedData = [];
            
            foreach ($dealData as $data) {
                $key = 'field_' . $data->custom_field_id;
                $customFieldsDataMap[$key] = $data->value;
                
                // Remap for frontend
                if ($field = $fieldsById->get($data->custom_field_id)) {
                    $newKey = $field->name . '_' . $field->id;
                    $remappedData[$newKey] = $data->value;
                }
            }
            
            // We need to set this on the object so toArray() includes it, 
            // or we can just return the array if we are transforming for response.
            // The controller expects an array or object that has custom_fields_data.
            // Since we are returning a Paginator, we should modify the models inside it.
            
            // However, Eloquent models don't easily allow dynamic property injection that survives toArray() unless we use setAttribute or similar.
            // But custom_fields_data is not a column.
            // We can use the 'custom_fields_data' attribute if we define an accessor or just set it as a public property if it was dynamic.
            // But the controller was doing: $dealArray['custom_fields_data'] = ...
            
            // Let's try to set it as a relation or attribute.
            // The cleanest way for the controller refactor is to return the paginator with models, 
            // and let the controller or the service transform it to array.
            // But the controller returns Inertia render with 'deals' => [ 'data' => ... ]
            
            // Let's modify the collection to be arrays with the data.
            $dealArray = $deal->toArray();
            $dealArray['custom_fields_data'] = array_merge($customFieldsDataMap, $remappedData);
            
            return $dealArray;
        });
    }
}
