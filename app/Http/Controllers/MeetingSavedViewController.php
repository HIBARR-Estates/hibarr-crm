<?php

namespace App\Http\Controllers;

use App\Models\MeetingSavedView;
use App\Support\FeatureFlags;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Create / rename / delete saved filter views on the Meetings index.
 *
 * Same contract as the task and lead saved-view controllers — the frontend
 * hook picks the route group by entity name and is otherwise identical, so
 * anything that diverges here is a bug rather than a variation.
 */
class MeetingSavedViewController extends AccountBaseController
{
    public function __construct()
    {
        parent::__construct();

        $this->middleware(function ($request, $next) {
            abort_403(! in_array('leads', $this->user->modules));

            // Saved views exist only as part of the redesigned meetings page.
            abort_403(! FeatureFlags::enabled('crm.meetings-page-redesign'));

            return $next($request);
        });
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validated($request);

        $view = MeetingSavedView::create([
            'company_id' => company()->id,
            'user_id' => user()->id,
            'name' => $data['name'],
            'filters' => MeetingSavedView::sanitizeFilters($data['filters'] ?? []),
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
        $view = MeetingSavedView::findOrFail($id);

        abort_403(! $view->isEditableBy((int) user()->id));

        $data = $this->validated($request, partial: true);

        if (array_key_exists('name', $data)) {
            $view->name = $data['name'];
        }
        if (array_key_exists('filters', $data)) {
            $view->filters = MeetingSavedView::sanitizeFilters($data['filters']);
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
        $view = MeetingSavedView::findOrFail($id);

        abort_403(! $view->isEditableBy((int) user()->id));

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
                Rule::in([
                    MeetingSavedView::VISIBILITY_PRIVATE,
                    MeetingSavedView::VISIBILITY_TEAM,
                ]),
            ],
            'pinned' => ['sometimes', 'boolean'],
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function present(MeetingSavedView $view): array
    {
        $view->loadMissing('owner:id,name');

        return [
            'id' => $view->id,
            'name' => $view->name,
            'filters' => $view->filters,
            'visibility' => $view->visibility,
            'pinned' => $view->pinned,
            'is_owner' => (int) $view->user_id === (int) user()->id,
            'owner_name' => $view->owner?->name,
            'updated_at' => $view->updated_at?->toIso8601String(),
        ];
    }
}
