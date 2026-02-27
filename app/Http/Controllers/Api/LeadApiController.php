<?php

namespace App\Http\Controllers\Api;

use App\Helper\Reply;
use App\Http\Controllers\Controller;
use App\Models\Deal;
use App\Models\Lead;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class LeadApiController extends Controller
{
    /**
     * Get paginated list of leads with first_name, last_name and email.
     * Requires X-COMPANY-ID header. Supports page and per_page via query or JSON body.
     * Optional filter: lead_pipeline_id (or deal_pipeline_id) — returns only leads that have a deal in that pipeline.
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function index(Request $request)
    {
        try {
            $companyId = $request->header('X-COMPANY-ID');

            if (!$companyId) {
                return response()->json(Reply::error(__('messages.missingCompanyId')), 400);
            }

            $companyId = (int) $companyId;

            $body = $this->getRequestBody($request);
            $page = max(1, (int) ($request->query('page') ?? $body['page'] ?? 1));
            $perPage = min(
                max(1, (int) ($request->query('per_page') ?? $body['per_page'] ?? config('api.defaultLimit', 20))),
                config('api.maxLimit', 1000)
            );

            // Optional filters (from query string or JSON body)
            // lead_pipeline_id lives on the deals table; filter leads that have a deal in that pipeline
            $leadPipelineId = $request->query('lead_pipeline_id') ?? $body['lead_pipeline_id']
                ?? $request->query('deal_pipeline_id') ?? $body['deal_pipeline_id'] ?? null;

            $leadsQuery = Lead::where('leads.company_id', $companyId);

            if ($leadPipelineId !== null && $leadPipelineId !== '') {
                $leadIdsInPipeline = Deal::where('deals.company_id', $companyId)
                    ->where('deals.lead_pipeline_id', (int) $leadPipelineId)
                    ->whereNotNull('deals.lead_id')
                    ->select('deals.lead_id');
                $leadsQuery->whereIn('leads.id', $leadIdsInPipeline);
            }

            $leadsQuery->orderBy('leads.created_at', 'desc');

            $leads = $leadsQuery->paginate($perPage, ['id', 'client_name', 'client_email'], 'page', $page);

            $data = $leads->getCollection()->map(function (Lead $lead) {
                $nameParts = $this->splitName($lead->client_name ?? '');

                return [
                    'id' => $lead->id,
                    'first_name' => $nameParts['first_name'],
                    'last_name' => $nameParts['last_name'],
                    'email' => $lead->client_email ?? null,
                ];
            });

            $response = [
                'status' => 'success',
                'data' => $data,
                'current_page' => $leads->currentPage(),
                'last_page' => $leads->lastPage(),
                'per_page' => $leads->perPage(),
                'total' => $leads->total(),
                'from' => $leads->firstItem(),
                'to' => $leads->lastItem(),
                'next_page_url' => $leads->nextPageUrl(),
                'prev_page_url' => $leads->previousPageUrl(),
            ];

            return response()->json($response, 200);

        } catch (\Illuminate\Http\Exceptions\HttpResponseException $e) {
            return $e->getResponse();
        } catch (\Exception $e) {
            $referenceId = uniqid('LEAD-', true);

            Log::error('Error fetching leads via API', [
                'reference_id' => $referenceId,
                'message' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'company_id' => $request->header('X-COMPANY-ID'),
            ]);

            return response()->json([
                'status' => 'fail',
                'message' => 'Failed to fetch leads. Please contact support with reference ID: ' . $referenceId,
                'reference_id' => $referenceId,
            ], 500);
        }
    }

    /**
     * Split full name into first_name and last_name (first word vs rest).
     *
     * @param string $fullName
     * @return array{first_name: string, last_name: string}
     */
    private function splitName(string $fullName): array
    {
        $trimmed = trim($fullName);
        if ($trimmed === '') {
            return ['first_name' => '', 'last_name' => ''];
        }
        $parts = preg_split('/\s+/', $trimmed, 2, PREG_SPLIT_NO_EMPTY);

        return [
            'first_name' => $parts[0] ?? '',
            'last_name' => $parts[1] ?? '',
        ];
    }

    /**
     * Request body as array (query or JSON body for page/per_page).
     *
     * @param Request $request
     * @return array<string, mixed>
     */
    private function getRequestBody(Request $request): array
    {
        if ($request->isMethod('POST') || $request->isMethod('PUT') || $request->isMethod('PATCH')) {
            return $request->all();
        }
        $content = $request->getContent();
        if ($content === '' || $content === false) {
            return [];
        }
        $decoded = json_decode($content, true);

        return is_array($decoded) ? $decoded : [];
    }
}
