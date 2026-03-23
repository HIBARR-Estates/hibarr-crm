<?php

namespace App\Http\Controllers;

use App\Enums\CrmEventDirection;
use App\Enums\CrmEventGenerationType;
use App\Enums\CrmEventSource;
use App\Enums\CrmEventStatus;
use App\Models\CrmEvent;
use App\Models\CrmEventCategory;
use Illuminate\Http\Request;
use Inertia\Inertia;

class CrmEventAdminController extends AccountBaseController
{
    public function __construct()
    {
        parent::__construct();
    }

    /**
     * Display the CRM Events admin page with filterable, paginated table.
     *
     * GET /account/crm-events
     */
    public function index(Request $request)
    {
        $companyId = user()->company_id;

        $query = CrmEvent::withoutGlobalScopes()
            ->where('company_id', $companyId)
            ->with(['eventType.category', 'user']);

        // Search by event type name or user name
        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->whereHas('eventType', fn ($et) => $et->where('name', 'like', "%{$search}%"))
                  ->orWhereHas('user', fn ($u) => $u->where('name', 'like', "%{$search}%"))
                  ->orWhere('uuid', 'like', "%{$search}%");
            });
        }

        // Category filter
        if ($request->filled('category_slug')) {
            $query->whereHas('eventType.category', fn ($q) => $q->where('slug', $request->category_slug));
        }

        // Generation type filter
        if ($request->filled('generation_type')) {
            $query->where('generation_type', $request->generation_type);
        }

        // Status filter
        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        // Direction filter
        if ($request->filled('direction')) {
            $query->where('direction', $request->direction);
        }

        // Source filter
        if ($request->filled('source')) {
            $query->where('source', $request->source);
        }

        // Date range
        if ($request->filled('date_from')) {
            $query->where('occurred_at', '>=', $request->date_from);
        }
        if ($request->filled('date_to')) {
            $query->where('occurred_at', '<=', $request->date_to);
        }

        // Sorting
        $sortBy = $request->input('sort_by', 'occurred_at');
        $sortDirection = $request->input('sort_direction', 'desc');
        $allowedSorts = ['occurred_at', 'created_at', 'generation_type', 'status', 'source'];
        if (in_array($sortBy, $allowedSorts)) {
            $query->orderBy($sortBy, $sortDirection === 'asc' ? 'asc' : 'desc');
        } else {
            $query->orderBy('occurred_at', 'desc');
        }

        $perPage = min((int) ($request->input('per_page', 25)), 100);
        $events = $query->paginate($perPage)->through(function (CrmEvent $event) {
            return [
                'uuid' => $event->uuid,
                'event_type' => $event->eventType ? [
                    'slug' => $event->eventType->slug,
                    'name' => $event->eventType->name,
                    'category' => $event->eventType->category ? [
                        'slug' => $event->eventType->category->slug,
                        'name' => $event->eventType->category->name,
                    ] : null,
                ] : null,
                'generation_type' => $event->generation_type?->value,
                'status' => $event->status?->value ?? 'completed',
                'direction' => $event->direction?->value,
                'user' => $event->user ? [
                    'id' => $event->user->id,
                    'name' => $event->user->name,
                ] : null,
                'model_type' => $event->model_type ? class_basename($event->model_type) : null,
                'model_id' => $event->model_id,
                'source' => $event->source?->value,
                'metadata' => $event->metadata,
                'occurred_at' => $event->occurred_at?->toIso8601String(),
            ];
        });

        // Fetch categories for filter dropdown
        $categories = CrmEventCategory::withoutGlobalScopes()
            ->where(function ($q) use ($companyId) {
                $q->where('company_id', $companyId)->orWhereNull('company_id');
            })
            ->where('is_active', true)
            ->select('slug', 'name')
            ->orderBy('name')
            ->get();

        return Inertia::render('CrmEvents/Index', [
            'pageTitle' => 'CRM Events',
            'events' => $events,
            'categories' => $categories,
            'filters' => $request->only([
                'search',
                'category_slug',
                'generation_type',
                'status',
                'direction',
                'source',
                'date_from',
                'date_to',
                'sort_by',
                'sort_direction',
                'per_page',
            ]),
            'filterOptions' => [
                'generation_types' => collect(CrmEventGenerationType::cases())->map(fn ($c) => [
                    'value' => $c->value,
                    'label' => $c->label(),
                ]),
                'statuses' => collect(CrmEventStatus::cases())->map(fn ($c) => [
                    'value' => $c->value,
                    'label' => $c->label(),
                ]),
                'directions' => collect(CrmEventDirection::cases())->map(fn ($c) => [
                    'value' => $c->value,
                    'label' => $c->label(),
                ]),
                'sources' => collect(CrmEventSource::cases())->map(fn ($c) => [
                    'value' => $c->value,
                    'label' => $c->label(),
                ]),
            ],
        ]);
    }
}
