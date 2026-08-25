<?php

namespace App\Http\Controllers\Api;

use App\Helper\Reply;
use App\Http\Controllers\Controller;
use App\Models\DeveloperProject;
use App\Support\DeveloperProjectListingQuery;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class DeveloperProjectApiController extends Controller
{
    /**
     * Get paginated list of developer projects for the company.
     *
     * Hidden projects (is_hidden=true) are included; each item exposes is_hidden
     * so consumers can filter client-side.
     *
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
            // Projects never paginate below 15 per page, regardless of request.
            $perPage = min(
                max(15, (int) ($request->query('per_page') ?? $body['per_page'] ?? config('api.defaultLimit', 20))),
                config('api.maxLimit', 1000)
            );

            $projectsQuery = DeveloperProject::where('company_id', $companyId)
                ->with(['location', 'assets', 'thumbnail'])
                ->withCount('properties');

            $filters = $this->getFilters($request);

            $listingFilters = array_intersect_key($filters, array_flip([
                'search', 'sort',
                'developer_id', 'construction_status', 'primary_category',
                'payment_plan_duration', 'price_min', 'price_max',
                'city', 'area', 'location_id',
            ]));

            // Use location_id mode only when that filter is set and city is not
            $filtersModalEnabled = empty($listingFilters['location_id']) || !empty($listingFilters['city']);

            DeveloperProjectListingQuery::apply($projectsQuery, $listingFilters, $filtersModalEnabled);

            $projects = $projectsQuery->paginate($perPage, ['*'], 'page', $page);

            $requestedFields = $this->parseRequestedFields($filters);

            $transformed = $projects->getCollection()->map(function (DeveloperProject $project) use ($requestedFields) {
                return $this->buildProjectPayload($project, $requestedFields, false);
            });

            return response()->json([
                'status' => 'success',
                'data' => $transformed,
                'current_page' => $projects->currentPage(),
                'last_page' => $projects->lastPage(),
                'per_page' => $projects->perPage(),
                'total' => $projects->total(),
                'from' => $projects->firstItem(),
                'to' => $projects->lastItem(),
                'next_page_url' => $projects->nextPageUrl(),
                'prev_page_url' => $projects->previousPageUrl(),
            ], 200);
        } catch (\Illuminate\Http\Exceptions\HttpResponseException $e) {
            return $e->getResponse();
        } catch (\Exception $e) {
            $referenceId = uniqid('DPROJ-', true);

            Log::error('Error fetching developer projects via API', [
                'reference_id' => $referenceId,
                'message' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'company_id' => $request->header('X-COMPANY-ID'),
            ]);

            return response()->json([
                'status' => 'fail',
                'message' => 'Failed to fetch developer projects. Please contact support with reference ID: ' . $referenceId,
                'reference_id' => $referenceId,
            ], 500);
        }
    }

    /**
     * Resolve project by slug first, then by numeric ID.
     */
    public function showByIdOrSlug(Request $request, string $identifier): \Illuminate\Http\JsonResponse
    {
        $companyId = $request->header('X-COMPANY-ID');
        if (!$companyId) {
            return response()->json(Reply::error(__('messages.missingCompanyId')), 400);
        }
        $companyId = (int) $companyId;

        $project = DeveloperProject::where('company_id', $companyId)
            ->where('slug', $identifier)
            ->with(['location', 'assets', 'unitTypes.assets'])
            ->first();

        if ($project) {
            try {
                $data = $this->buildProjectPayload($project, $this->parseRequestedFields($this->getFilters($request)), true);

                return response()->json(['status' => 'success', 'data' => $data], 200);
            } catch (\Illuminate\Http\Exceptions\HttpResponseException $e) {
                return $e->getResponse();
            } catch (\Exception $e) {
                $referenceId = uniqid('DPROJ-', true);
                Log::error('Error fetching developer project via API (showByIdOrSlug slug path)', [
                    'reference_id' => $referenceId,
                    'identifier' => $identifier,
                    'message' => $e->getMessage(),
                    'trace' => $e->getTraceAsString(),
                    'company_id' => $companyId,
                ]);

                return response()->json([
                    'status' => 'fail',
                    'message' => 'Failed to fetch developer project. Please contact support with reference ID: ' . $referenceId,
                    'reference_id' => $referenceId,
                ], 500);
            }
        }

        if (ctype_digit($identifier)) {
            return $this->show($request, (int) $identifier);
        }

        return response()->json(['status' => 'fail', 'message' => 'Developer project not found'], 404);
    }

    /**
     * Get a single developer project by ID.
     *
     * @return \Illuminate\Http\JsonResponse
     */
    public function show(Request $request, int $id)
    {
        try {
            $companyId = $request->header('X-COMPANY-ID');
            if (!$companyId) {
                return response()->json(Reply::error(__('messages.missingCompanyId')), 400);
            }
            $companyId = (int) $companyId;

            $project = DeveloperProject::where('id', $id)
                ->where('company_id', $companyId)
                ->with(['location', 'assets', 'unitTypes.assets'])
                ->first();

            if (!$project) {
                return response()->json(['status' => 'fail', 'message' => 'Developer project not found'], 404);
            }

            $data = $this->buildProjectPayload(
                $project,
                $this->parseRequestedFields($this->getFilters($request)),
                true
            );

            return response()->json(['status' => 'success', 'data' => $data], 200);
        } catch (\Exception $e) {
            $referenceId = uniqid('DPROJ-', true);
            Log::error('Error fetching developer project via API', [
                'reference_id' => $referenceId,
                'developer_project_id' => $id,
                'message' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'company_id' => $request->header('X-COMPANY-ID'),
            ]);

            return response()->json([
                'status' => 'fail',
                'message' => 'Failed to fetch developer project. Please contact support with reference ID: ' . $referenceId,
                'reference_id' => $referenceId,
            ], 500);
        }
    }

    /**
     * @param  array<string, mixed>|null  $requestedFields
     * @return array<string, mixed>
     */
    private function buildProjectPayload(DeveloperProject $project, ?array $requestedFields, bool $includeUnitTypes): array
    {
        $projectData = $project->toArray();

        // Ensure is_hidden is always present for consumers that filter client-side
        $projectData['is_hidden'] = (bool) $project->is_hidden;

        // Keep nested location shape; overlay authoritative project pins (with location fallback).
        $projectData['location'] = $project->locationForApi();

        $projectData['assets'] = $project->relationLoaded('assets')
            ? $project->assets->map(fn ($asset) => $this->mapAsset($asset))->values()->toArray()
            : [];

        if ($includeUnitTypes && $project->relationLoaded('unitTypes')) {
            $projectData['unit_type_details'] = $project->unitTypes
                ->sortBy('order')
                ->values()
                ->map(function ($unitType) {
                    $data = $unitType->toArray();
                    if ($unitType->relationLoaded('assets')) {
                        $data['assets'] = $unitType->assets
                            ->map(fn ($asset) => $this->mapAsset($asset))
                            ->values()
                            ->toArray();
                    }

                    return $data;
                })
                ->toArray();
        }

        if ($requestedFields !== null && $requestedFields !== []) {
            $projectData = $this->filterFields($projectData, $requestedFields);
        }

        return $projectData;
    }

    /**
     * @param  \App\Models\DeveloperProjectAsset|\App\Models\DeveloperProjectUnitTypeAsset  $asset
     * @return array<string, mixed>
     */
    private function mapAsset($asset): array
    {
        return [
            'id' => $asset->id,
            'name' => $asset->name,
            'url' => $asset->url ?? null,
            'file_path' => $asset->file_path ?? null,
            'external_url' => $asset->external_url ?? null,
            'tags' => $asset->tags ?? null,
            'order' => $asset->order ?? null,
            'formatted_size' => $asset->formatted_size ?? null,
        ];
    }

    /**
     * @param  array<string, mixed>  $filters
     * @return list<string>|null
     */
    private function parseRequestedFields(array $filters): ?array
    {
        if (empty($filters['fields'])) {
            return null;
        }

        $requestedFields = is_array($filters['fields'])
            ? array_map('trim', $filters['fields'])
            : array_map('trim', explode(',', $filters['fields']));

        return array_values(array_filter($requestedFields));
    }

    /**
     * @return array<string, mixed>
     */
    private function getFilters(Request $request): array
    {
        $allowed = [
            'fields', 'search', 'sort',
            'developer_id', 'construction_status', 'primary_category',
            'payment_plan_duration', 'price_min', 'price_max',
            'city', 'area', 'location_id',
        ];
        $filters = [];

        $query = $request->query();
        $filters = array_intersect_key($query, array_flip($allowed));

        $body = $this->getRequestBody($request);
        if (!empty($body)) {
            if (isset($body['filters']) && is_array($body['filters'])) {
                $filters = array_merge($filters, array_intersect_key($body['filters'], array_flip($allowed)));
            } else {
                $filters = array_merge($filters, array_intersect_key($body, array_flip($allowed)));
            }
        }

        return array_filter($filters, function ($value) {
            return $value !== null && $value !== '';
        });
    }

    /**
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
        if (json_last_error() !== JSON_ERROR_NONE) {
            Log::warning('Developer Project API: malformed JSON in request body', [
                'error' => json_last_error_msg(),
                'json_error' => json_last_error(),
            ]);
            throw new \Illuminate\Http\Exceptions\HttpResponseException(
                response()->json([
                    'status' => 'fail',
                    'message' => 'Invalid JSON in request body: ' . json_last_error_msg(),
                ], 400)
            );
        }

        return is_array($decoded) ? $decoded : [];
    }

    /**
     * @param  array<string, mixed>  $data
     * @param  list<string>  $requestedFields
     * @return array<string, mixed>
     */
    private function filterFields(array $data, array $requestedFields): array
    {
        $filtered = [];

        foreach ($requestedFields as $field) {
            if (array_key_exists($field, $data)) {
                $filtered[$field] = $data[$field];
            }
        }

        return $filtered;
    }
}
