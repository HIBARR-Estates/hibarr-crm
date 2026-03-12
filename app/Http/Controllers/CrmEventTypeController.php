<?php

namespace App\Http\Controllers;

use App\Models\CrmEventType;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

/**
 * REST API controller for listing available CRM event types.
 *
 * Allows external consumers to discover valid event type slugs and their
 * associated categories and business rules.
 */
class CrmEventTypeController extends Controller
{
    /**
     * List all active event types, optionally filtered by category.
     *
     * GET /api/crm-event-types
     *
     * Query params:
     *   - category_slug: Filter by category slug.
     *   - model_type: Filter by model type.
     */
    public function index(Request $request): JsonResponse
    {
        // Resolve company from header (external API consumers) or authenticated user (frontend)
        $companyId = $request->hasHeader('X-COMPANY-ID') && $request->header('X-COMPANY-ID') !== ''
            ? (int) $request->header('X-COMPANY-ID')
            : (int) (Auth::user()?->company_id ?? 0);

        $query = CrmEventType::withoutGlobalScopes()
            ->where(function ($q) use ($companyId) {
                $q->where('company_id', $companyId)->orWhereNull('company_id');
            })
            ->active()
            ->with(['category', 'businessRule']);

        // Filter by category slug
        if ($request->filled('category_slug')) {
            $query->whereHas('category', fn ($q) => $q->where('slug', $request->input('category_slug')));
        }

        // Filter by model type
        if ($request->filled('model_type')) {
            $query->where('model_type', $request->input('model_type'));
        }

        $eventTypes = $query->orderBy('category_id')->orderBy('name')->get();

        return response()->json([
            'status' => 'success',
            'data' => $eventTypes->map(fn ($type) => [
                'slug' => $type->slug,
                'name' => $type->name,
                'description' => $type->description,
                'model_type' => $type->model_type,
                'is_system' => $type->is_system,
                'sync_processing' => $type->sync_processing,
                'category' => $type->category ? [
                    'slug' => $type->category->slug,
                    'name' => $type->category->name,
                ] : null,
                'metadata_schema' => $type->metadata_schema,
                'business_rule' => $type->businessRule ? [
                    'slug' => $type->businessRule->slug,
                    'name' => $type->businessRule->name,
                ] : null,
            ]),
        ]);
    }
}
