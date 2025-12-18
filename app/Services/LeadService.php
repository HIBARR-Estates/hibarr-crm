<?php

namespace App\Services;

use App\Models\Lead;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Pagination\LengthAwarePaginator;

class LeadService
{
    /**
     * Get paginated leads with optimized queries
     */
    public function getPaginatedLeads(Request $request, string $viewPermission): LengthAwarePaginator
    {
        $query = Lead::query()
            ->with([
                'leadOwner:id,name,email,image',
                'addedBy:id,name,email',
                'leadSource:id,type',
                'category:id,category_name',
                'client:id,name,email'
            ])
            ->select([
                'id', 'company_id', 'client_name', 'client_email', 
                'company_name', 'mobile', 'created_at', 'updated_at',
                'lead_owner', 'added_by', 'source_id', 'category_id', 'client_id'
            ]);

        // Apply permission-based filtering
        $this->applyPermissionScope($query, $viewPermission);
        
        // Apply filters
        $this->applyFilters($query, $request);
        
        // Apply sorting
        $this->applySorting($query, $request);
        
        return $query->paginate($request->get('per_page', 15));
    }

    /**
     * Get dropdown leads (limited for performance)
     */
    public function getDropdownLeads(int $limit = 100): \Illuminate\Support\Collection
    {
        return Lead::select('id', 'client_name', 'client_name_salutation')
            ->where('company_id', company()->id)
            ->orderBy('client_name')
            ->limit($limit)
            ->get();
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
            $sortOrder = $request->get('sort_order', 'asc');
            
            $allowedSorts = ['client_name', 'client_email', 'company_name', 'created_at'];
            
            if (in_array($sortBy, $allowedSorts)) {
                $query->orderBy($sortBy, $sortOrder);
            }
        } else {
            $query->latest();
        }
    }
}