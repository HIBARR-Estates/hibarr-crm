<?php

namespace App\Http\Controllers;

use App\Models\Lead;
use App\Services\CallLog\CallLogService;
use App\Services\PermissionService;
use App\Support\CallAccess;
use App\Support\FeatureFlags;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * The call log: the company-wide Calls page (call managers: admins and
 * manage_calls holders) and a lead's Calls tab (anyone who can view the lead).
 *
 * Rows are the `call_*` events on the CRM timeline (see CallLogService), so a
 * call made from the CRM appears in both without a second source of truth.
 */
class TelephonyCallLogController extends AccountBaseController
{
    public function __construct(private readonly CallLogService $calls)
    {
        parent::__construct();
    }

    /** The Calls page shell; rows load from index() in the background. */
    public function page(): Response
    {
        abort_unless(FeatureFlags::enabled('crm.softphone'), 404);
        abort_403(! CallAccess::canManageCalls(user()));

        return Inertia::render('Calls/Index', [
            'pageTitle' => __('app.menu.calls'),
            'agents' => \App\Models\User::query()
                ->where('company_id', (int) company()->id)
                ->where('status', 'active')
                ->orderBy('name')
                ->get(['id', 'name'])
                ->map(fn ($u) => ['id' => (int) $u->id, 'name' => $u->name])
                ->values(),
            'summary' => Inertia::defer(fn () => $this->calls->summary(
                (int) company()->id,
                null,
                now()->startOfDay()->toDateTimeString(),
            )),
        ]);
    }

    /** Company-wide call log (JSON), for the Calls page and Call Bridge > Calls. */
    public function index(Request $request): JsonResponse
    {
        abort_unless(FeatureFlags::enabled('crm.softphone'), 404);
        abort_403(! CallAccess::canManageCalls(user()));

        $validated = $this->validateFilters($request);

        $paginator = $this->calls->paginate(
            user(),
            (int) company()->id,
            $validated,
            null,
            (int) ($validated['per_page'] ?? 25),
            (int) ($validated['page'] ?? 1),
        );

        return $this->paginated($paginator);
    }

    /** One lead's calls, including the calls on its deals the viewer can see. */
    public function lead(Request $request, int $lead): JsonResponse
    {
        abort_unless(FeatureFlags::enabled('crm.softphone'), 404);

        $model = Lead::findOrFail($lead);
        abort_if((int) $model->company_id !== (int) company()->id, 404);
        $access = PermissionService::checkAccess(user(), 'view_lead', $model, [
            'added' => 'added_by',
            'owned' => 'lead_owner',
        ]);
        abort_unless($access['canAccess'], 403);

        $validated = $this->validateFilters($request);
        $scope = $this->calls->leadScope($model, user());
        $companyId = (int) company()->id;

        $paginator = $this->calls->paginate(
            user(),
            $companyId,
            $validated,
            ['lead_ids' => $scope['lead_ids'], 'deal_ids' => $scope['deal_ids']],
            (int) ($validated['per_page'] ?? 50),
            (int) ($validated['page'] ?? 1),
        );

        $response = $this->paginated($paginator);
        $payload = $response->getData(true);
        $payload['summary'] = $this->calls->summary(
            $companyId,
            ['lead_ids' => $scope['lead_ids'], 'deal_ids' => $scope['deal_ids']],
        );

        return response()->json($payload);
    }

    /** @return array<string, mixed> */
    private function validateFilters(Request $request): array
    {
        return $request->validate([
            'outcome' => 'nullable|string|in:' . implode(',', CallLogService::OUTCOMES),
            'direction' => 'nullable|string|in:inbound,outbound',
            'user_id' => 'nullable|integer|min:1',
            'search' => 'nullable|string|max:50',
            'from' => 'nullable|date',
            'to' => 'nullable|date',
            'has_recording' => 'nullable|boolean',
            'unlinked' => 'nullable|boolean',
            'page' => 'nullable|integer|min:1',
            'per_page' => 'nullable|integer|min:1|max:100',
        ]);
    }

    private function paginated(\Illuminate\Pagination\LengthAwarePaginator $paginator): JsonResponse
    {
        return response()->json([
            'status' => 'success',
            'data' => $paginator->getCollection()->values(),
            'meta' => [
                'page' => $paginator->currentPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
                'last_page' => $paginator->lastPage(),
            ],
        ]);
    }
}
