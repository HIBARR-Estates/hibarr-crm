<?php

namespace App\Http\Controllers;

use App\Models\LeadSavedView;
use App\Support\FeatureFlags;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class LeadSavedViewController extends AccountBaseController
{
    public function __construct()
    {
        parent::__construct();

        $this->middleware(function ($request, $next) {
            if (! in_array('leads', user_modules())) {
                abort(403);
            }

            // Saved views exist only as part of the v2 filter UI.
            if (! FeatureFlags::enabled('crm.leads-filter-v2')) {
                abort(403);
            }

            return $next($request);
        });
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validated($request);

        $view = LeadSavedView::create([
            'company_id' => company()->id,
            'user_id' => user()->id,
            'name' => $data['name'],
            'filters' => LeadSavedView::sanitizeFilters($data['filters'] ?? []),
            'visibility' => $data['visibility'],
            'pinned' => $data['pinned'] ?? true,
        ]);

        return response()->json([
            'status' => 'success',
            'data' => ['view' => $this->present($view)],
        ]);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $view = LeadSavedView::findOrFail($id);
        $userId = (int) user()->id;

        // A private view of someone else's is not a view this user can see, so
        // it answers like one that does not exist.
        abort_unless($view->isManageableBy($userId, LeadSavedView::viewerIsAdmin()), 403);

        $data = $this->validated($request, partial: true);

        abort_if(
            array_key_exists('visibility', $data) && ! $view->canSetVisibility($userId, $data['visibility']),
            403
        );

        if (array_key_exists('name', $data)) {
            $view->name = $data['name'];
        }
        if (array_key_exists('filters', $data)) {
            $view->filters = LeadSavedView::sanitizeFilters($data['filters']);
        }
        if (array_key_exists('visibility', $data)) {
            $view->visibility = $data['visibility'];
        }
        if (array_key_exists('pinned', $data)) {
            $view->pinned = $data['pinned'];
        }

        $view->save();

        return response()->json([
            'status' => 'success',
            'data' => ['view' => $this->present($view)],
        ]);
    }

    public function destroy(int $id): JsonResponse
    {
        $view = LeadSavedView::findOrFail($id);

        abort_unless($view->isManageableBy((int) user()->id, LeadSavedView::viewerIsAdmin()), 403);

        $view->delete();

        return response()->json(['status' => 'success']);
    }

    /**
     * @return array<string, mixed>
     */
    private function validated(Request $request, bool $partial = false): array
    {
        $required = $partial ? 'sometimes' : 'required';

        return $request->validate([
            'name' => [$required, 'string', 'max:120'],
            'filters' => [$partial ? 'sometimes' : 'required', 'array'],
            'visibility' => [
                $required,
                Rule::in([LeadSavedView::VISIBILITY_PRIVATE, LeadSavedView::VISIBILITY_TEAM]),
            ],
            'pinned' => ['sometimes', 'boolean'],
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function present(LeadSavedView $view): array
    {
        return $view->presentFor((int) user()->id, LeadSavedView::viewerIsAdmin());
    }
}
