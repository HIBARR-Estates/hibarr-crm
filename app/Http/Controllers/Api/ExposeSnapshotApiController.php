<?php

namespace App\Http\Controllers\Api;

use App\Helper\Reply;
use App\Http\Controllers\Controller;
use App\Services\PdfExpose\ExposeSnapshotService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;

class ExposeSnapshotApiController extends Controller
{
    public function __construct(
        private ExposeSnapshotService $snapshots
    ) {}

    public function store(Request $request): JsonResponse
    {
        $companyId = $this->requireCompanyId($request);
        if ($companyId instanceof JsonResponse) {
            return $companyId;
        }

        try {
            $result = $this->snapshots->mint($companyId, $request->all());
            $detail = $this->snapshots->toDetailArray($result['snapshot'], $result['token']);

            return response()->json([
                'status' => 'success',
                'data' => $detail,
            ], 201);
        } catch (ValidationException $e) {
            return response()->json([
                'status' => 'fail',
                'message' => 'Validation failed',
                'errors' => $e->errors(),
            ], 422);
        } catch (\Exception $e) {
            return $this->serverError('mint', $e, $companyId);
        }
    }

    public function show(Request $request, string $token): JsonResponse
    {
        $companyId = $this->requireCompanyId($request);
        if ($companyId instanceof JsonResponse) {
            return $companyId;
        }

        try {
            $snapshot = $this->snapshots->findByToken($companyId, $token);
            if (!$snapshot) {
                return response()->json([
                    'status' => 'fail',
                    'message' => 'Expose snapshot not found',
                ], 404);
            }

            return response()->json([
                'status' => 'success',
                'data' => $this->snapshots->toDetailArray($snapshot, $token),
            ], 200);
        } catch (\Exception $e) {
            return $this->serverError('show', $e, $companyId, ['token_prefix' => substr($token, 0, 12)]);
        }
    }

    public function index(Request $request): JsonResponse
    {
        $companyId = $this->requireCompanyId($request);
        if ($companyId instanceof JsonResponse) {
            return $companyId;
        }

        try {
            $filters = [
                'page' => $request->query('page'),
                'per_page' => $request->query('per_page'),
                'lead_id' => $request->query('lead_id'),
                'agent_id' => $request->query('agent_id'),
                'entity_type' => $request->query('entity_type'),
                'entity_id' => $request->query('entity_id'),
                'unit_type_id' => $request->query('unit_type_id'),
            ];

            $includeExpose = $this->wantsExposeIncluded($request);
            $paginator = $this->snapshots->list($companyId, $filters);

            $rows = collect($paginator->items())
                ->map(fn ($snapshot) => $this->snapshots->toSummaryArray($snapshot, $includeExpose))
                ->values()
                ->all();

            return response()->json([
                'status' => 'success',
                'data' => $rows,
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
                'from' => $paginator->firstItem(),
                'to' => $paginator->lastItem(),
                'next_page_url' => $paginator->nextPageUrl(),
                'prev_page_url' => $paginator->previousPageUrl(),
            ], 200);
        } catch (\Exception $e) {
            return $this->serverError('index', $e, $companyId);
        }
    }

    /**
     * @return int|JsonResponse
     */
    private function requireCompanyId(Request $request)
    {
        $companyId = $request->header('X-COMPANY-ID');
        if (!$companyId) {
            return response()->json(Reply::error(__('messages.missingCompanyId')), 400);
        }

        return (int) $companyId;
    }

    private function wantsExposeIncluded(Request $request): bool
    {
        $include = $request->query('include', '');
        if (is_array($include)) {
            return in_array('expose', $include, true);
        }

        $parts = array_filter(array_map('trim', explode(',', (string) $include)));

        return in_array('expose', $parts, true);
    }

    /**
     * @param  array<string, mixed>  $context
     */
    private function serverError(string $action, \Exception $e, int $companyId, array $context = []): JsonResponse
    {
        $referenceId = uniqid('EXPOSE-SNAP-', true);
        Log::error("Error handling expose snapshot {$action}", array_merge([
            'reference_id' => $referenceId,
            'message' => $e->getMessage(),
            'trace' => $e->getTraceAsString(),
            'company_id' => $companyId,
        ], $context));

        return response()->json([
            'status' => 'fail',
            'message' => 'Failed to process expose snapshot. Please contact support with reference ID: ' . $referenceId,
            'reference_id' => $referenceId,
        ], 500);
    }
}
