<?php

namespace App\Http\Controllers\Api;

use App\Helper\Reply;
use App\Http\Controllers\Controller;
use App\Models\Property;
use App\Models\Product;
use App\Models\ProjectLocation;
use Illuminate\Http\Request;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Log;

class PropertyApiController extends Controller
{
    /**
     * Get paginated list of all properties with associated agent details.
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

            // Build query for properties
            $propertiesQuery = Property::where('properties.company_id', $companyId);

            // Get filters from request body (JSON) or fallback to query parameters
            $filters = $this->getFilters($request);

            // Apply filters if provided
            if (isset($filters['status'])) {
                $propertiesQuery->where('properties.status', $filters['status']);
            }

            if (isset($filters['city'])) {
                $propertiesQuery->where('properties.city', $filters['city']);
            }

            if (isset($filters['property_type'])) {
                $propertiesQuery->where('properties.property_type', $filters['property_type']);
            }

            if (isset($filters['sale_type'])) {
                $propertiesQuery->where('properties.sale_type', $filters['sale_type']);
            }

            if (!empty($filters['search'])) {
                $this->applySearchFilter($propertiesQuery, (string) $filters['search']);
            }

            // locationIds: comma-separated project_location IDs → filter by developer_projects.project_location_id
            if (isset($filters['locationIds']) && $filters['locationIds'] !== '') {
                $locationIds = is_array($filters['locationIds'])
                    ? array_map('trim', $filters['locationIds'])
                    : array_map('trim', explode(',', (string) $filters['locationIds']));
                $locationIds = array_filter(array_map('intval', $locationIds));
                if (!empty($locationIds)) {
                    $propertiesQuery->join('developer_projects', 'properties.developer_project_id', '=', 'developer_projects.id')
                        ->whereIn('developer_projects.project_location_id', $locationIds)
                        ->select('properties.*');
                }
            }

            // propertyTypes: comma-separated string of values → match any
            if (!empty($filters['propertyTypes'])) {
                $types = is_array($filters['propertyTypes'])
                    ? array_map('trim', $filters['propertyTypes'])
                    : array_map('trim', explode(',', (string) $filters['propertyTypes']));
                $types = array_filter($types);
                if (!empty($types)) {
                    $propertiesQuery->whereIn('properties.property_type', $types);
                }
              
                Log::info('propertyTypes fetched successfully', [
                    'propertyTypes' => $types,
                    'company_id' => $companyId,
                ]);
            }

            // bedrooms: number (min bedrooms)
            if (isset($filters['bedrooms']) && $filters['bedrooms'] !== '') {
                $bedrooms = (int) $filters['bedrooms'];
                $propertiesQuery->whereRaw('CAST(properties.bedrooms AS UNSIGNED) >= ?', [$bedrooms]);
            }

            // bathrooms: number (min bathrooms)
            if (isset($filters['bathrooms']) && $filters['bathrooms'] !== '') {
                $bathrooms = (int) $filters['bathrooms'];
                $propertiesQuery->where('properties.bathrooms', '>=', $bathrooms);
            }

            // features: comma-separated string → property must have each value in at least one of exterior/interior/location features
            if (!empty($filters['features'])) {
                $featureList = is_array($filters['features'])
                    ? array_map('trim', $filters['features'])
                    : array_map('trim', explode(',', (string) $filters['features']));
                $featureList = array_filter($featureList);
                foreach ($featureList as $feature) {
                    $propertiesQuery->where(function ($q) use ($feature) {
                        $q->whereJsonContains('properties.exterior_features', $feature)
                            ->orWhereJsonContains('properties.interior_features', $feature)
                            ->orWhereJsonContains('properties.location_features', $feature);
                    });
                }
            }

            // fromPrice / toPrice: compare numeric amount from JSON price or legacy numeric
            if (isset($filters['fromPrice']) && $filters['fromPrice'] !== '') {
                $fromPrice = (float) $filters['fromPrice'];
                $propertiesQuery->whereRaw(
                    'CAST(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(properties.price, \'$.amount\')), properties.price) AS DECIMAL(18,2)) >= ?',
                    [$fromPrice]
                );
            }
            if (isset($filters['toPrice']) && $filters['toPrice'] !== '') {
                $toPrice = (float) $filters['toPrice'];
                $propertiesQuery->whereRaw(
                    'CAST(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(properties.price, \'$.amount\')), properties.price) AS DECIMAL(18,2)) <= ?',
                    [$toPrice]
                );
            }

            // Get paginated results with images
            $properties = $propertiesQuery->with('images')
                ->orderBy('properties.created_at', 'desc')
                ->paginate($perPage, ['*'], 'page', $page);

            // Get all product IDs from the paginated properties
            $productIds = $properties->getCollection()->pluck('product_id')->filter()->unique()->toArray();

            // Pre-fetch products and agents for all properties in one query to avoid N+1
            $productsMap = $this->getProductsMap($productIds, $companyId);
            $agentsMap = $this->getAgentsForProducts($productIds, $companyId);

            // Parse fields from request body or query parameter (optional)
            $requestedFields = null;
            if (isset($filters['fields']) && !empty($filters['fields'])) {
                // Support both array and comma-separated string
                if (is_array($filters['fields'])) {
                    $requestedFields = array_map('trim', $filters['fields']);
                } else {
                    $requestedFields = array_map('trim', explode(',', $filters['fields']));
                }
                $requestedFields = array_filter($requestedFields); // Remove empty values
            }

            // Transform properties to flatten product fields and include agent details
            $transformedProperties = $properties->getCollection()->map(function ($property) use ($productsMap, $agentsMap, $requestedFields) {
                $propertyData = $property->toArray();
                
                // Remove the nested product object if it exists
                unset($propertyData['product']);
                
                // Add images from PropertyAsset relationship
                $propertyData['images'] = $property->images->map(function ($image) {
                    return [
                        'id' => $image->id,
                        'name' => $image->name,
                        'url' => $image->url,
                        'file_path' => $image->file_path,
                        'external_url' => $image->external_url,
                        'tags' => $image->tags,
                        'order' => $image->order,
                        'formatted_size' => $image->formatted_size,
                    ];
                })->values()->toArray();
                
                // Get product data and flatten it into the main payload
                $product = $productsMap->get($property->product_id);
                if ($product) {
                    $productArray = $product->toArray();
                    
                    // Add product fields with "product_" prefix to avoid conflicts
                    foreach ($productArray as $key => $value) {
                        // Skip relationships and internal fields (but include product id separately)
                        if (!in_array($key, ['id', 'tax', 'category', 'subCategory', 'unit', 'company', 'pivot'])) {
                            $propertyData['product_' . $key] = $value;
                        }
                    }
                    
                    // Include product_id in the response
                    $propertyData['product_id'] = $product->id;
                }
                
                // Get agent details from pre-fetched map
                $agentData = $agentsMap[$property->product_id] ?? null;
                
                // Add agent data as nested sub-payload
                $propertyData['agent'] = $agentData;
                
                // Filter fields if requested
                if ($requestedFields !== null && !empty($requestedFields)) {
                    $propertyData = $this->filterFields($propertyData, $requestedFields);
                }
                
                return $propertyData;
            });

            // Build pagination response
            $response = [
                'status' => 'success',
                'data' => $transformedProperties,
                'current_page' => $properties->currentPage(),
                'last_page' => $properties->lastPage(),
                'per_page' => $properties->perPage(),
                'total' => $properties->total(),
                'from' => $properties->firstItem(),
                'to' => $properties->lastItem(),
                'next_page_url' => $properties->nextPageUrl(),
                'prev_page_url' => $properties->previousPageUrl(),
            ];

            return response()->json($response, 200);

        } catch (\Illuminate\Http\Exceptions\HttpResponseException $e) {
            return $e->getResponse();
        } catch (\Exception $e) {
            // Generate a unique reference ID for tracking
            $referenceId = uniqid('PROP-', true);

            Log::error('Error fetching properties via API', [
                'reference_id' => $referenceId,
                'message' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'company_id' => $request->header('X-COMPANY-ID'),
            ]);

            // Return generic error message to client with reference ID for support
            return response()->json([
                'status' => 'fail',
                'message' => 'Failed to fetch properties. Please contact support with reference ID: ' . $referenceId,
                'reference_id' => $referenceId
            ], 500);
        }
    }

    /**
     * Resolve property by slug first, then by ID. Try slug so numeric-only slugs work.
     */
    public function showByIdOrSlug(Request $request, string $identifier): \Illuminate\Http\JsonResponse
    {
        $companyId = $request->header('X-COMPANY-ID');
        if (!$companyId) {
            return response()->json(Reply::error(__('messages.missingCompanyId')), 400);
        }
        $companyId = (int) $companyId;

        $property = Property::where('properties.company_id', $companyId)
            ->where('properties.slug', $identifier)
            ->with('images')
            ->first();

        if ($property) {
            try {
                $data = $this->buildPropertyPayload($property, $companyId, $request);
                return response()->json(['status' => 'success', 'data' => $data], 200);
            } catch (\Illuminate\Http\Exceptions\HttpResponseException $e) {
                return $e->getResponse();
            } catch (\Exception $e) {
                $referenceId = uniqid('PROP-', true);
                Log::error('Error fetching property via API (showByIdOrSlug slug path)', [
                    'reference_id' => $referenceId,
                    'identifier' => $identifier,
                    'message' => $e->getMessage(),
                    'trace' => $e->getTraceAsString(),
                    'company_id' => $companyId,
                ]);
                return response()->json([
                    'status' => 'fail',
                    'message' => 'Failed to fetch property. Please contact support with reference ID: ' . $referenceId,
                    'reference_id' => $referenceId,
                ], 500);
            }
        }

        if (ctype_digit($identifier)) {
            return $this->show($request, (int) $identifier);
        }

        return response()->json(['status' => 'fail', 'message' => 'Property not found'], 404);
    }

    /**
     * Get a single property by ID with associated agent details.
     *
     * @param Request $request
     * @param int $id
     * @return \Illuminate\Http\JsonResponse
     */
    public function show(Request $request, $id)
    {
        try {
            $companyId = $request->header('X-COMPANY-ID');
            if (!$companyId) {
                return response()->json(Reply::error(__('messages.missingCompanyId')), 400);
            }
            $companyId = (int) $companyId;
            $property = Property::where('properties.id', (int) $id)
                ->where('properties.company_id', $companyId)
                ->with('images')
                ->first();
            if (!$property) {
                return response()->json(['status' => 'fail', 'message' => 'Property not found'], 404);
            }
            $data = $this->buildPropertyPayload($property, $companyId, $request);
            return response()->json(['status' => 'success', 'data' => $data], 200);
        } catch (\Exception $e) {
            $referenceId = uniqid('PROP-', true);
            Log::error('Error fetching property via API', [
                'reference_id' => $referenceId,
                'property_id' => $id,
                'message' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'company_id' => $request->header('X-COMPANY-ID'),
            ]);
            return response()->json([
                'status' => 'fail',
                'message' => 'Failed to fetch property. Please contact support with reference ID: ' . $referenceId,
                'reference_id' => $referenceId,
            ], 500);
        }
    }

    /**
     * Get a single property by slug with associated agent details.
     * Same response shape as show($id).
     */
    public function showBySlug(Request $request, $slug)
    {
        try {
            $companyId = $request->header('X-COMPANY-ID');
            if (!$companyId) {
                return response()->json(Reply::error(__('messages.missingCompanyId')), 400);
            }
            $companyId = (int) $companyId;
            $property = Property::where('properties.slug', $slug)
                ->where('properties.company_id', $companyId)
                ->with('images')
                ->first();
            if (!$property) {
                return response()->json(['status' => 'fail', 'message' => 'Property not found'], 404);
            }
            $data = $this->buildPropertyPayload($property, $companyId, $request);
            return response()->json(['status' => 'success', 'data' => $data], 200);
        } catch (\Exception $e) {
            $referenceId = uniqid('PROP-', true);
            Log::error('Error fetching property via API (by slug)', [
                'reference_id' => $referenceId,
                'property_slug' => $slug ?? null,
                'message' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'company_id' => $request->header('X-COMPANY-ID'),
            ]);
            return response()->json([
                'status' => 'fail',
                'message' => 'Failed to fetch property. Please contact support with reference ID: ' . $referenceId,
                'reference_id' => $referenceId,
            ], 500);
        }
    }

    /**
     * Build the single-property API payload: products/agents lookup, images mapping,
     * product flattening, agent attachment, and optional field filtering.
     *
     * @param Property $property Resolved property (with images loaded).
     * @param int $companyId From X-COMPANY-ID header.
     * @param Request $request For getFilters / filterFields.
     * @return array The 'data' payload (not the full response).
     */
    private function buildPropertyPayload(Property $property, int $companyId, Request $request): array
    {
        $productIds = $property->product_id ? [$property->product_id] : [];
        $productsMap = $this->getProductsMap($productIds, $companyId);
        $agentsMap = $this->getAgentsForProducts($productIds, $companyId);

        $filters = $this->getFilters($request);
        $requestedFields = null;
        if (!empty($filters['fields'])) {
            $requestedFields = is_array($filters['fields'])
                ? array_map('trim', $filters['fields'])
                : array_map('trim', explode(',', $filters['fields']));
            $requestedFields = array_filter($requestedFields);
        }

        $propertyData = $property->toArray();
        unset($propertyData['product']);
        $propertyData['images'] = $property->images->map(function ($image) {
            return [
                'id' => $image->id,
                'name' => $image->name,
                'url' => $image->url,
                'file_path' => $image->file_path,
                'external_url' => $image->external_url,
                'tags' => $image->tags,
                'order' => $image->order,
                'formatted_size' => $image->formatted_size,
            ];
        })->values()->toArray();

        $product = $productsMap->get($property->product_id);
        if ($product) {
            $productArray = $product->toArray();
            foreach ($productArray as $key => $value) {
                if (!in_array($key, ['id', 'tax', 'category', 'subCategory', 'unit', 'company', 'pivot'])) {
                    $propertyData['product_' . $key] = $value;
                }
            }
            $propertyData['product_id'] = $product->id;
        }
        $propertyData['agent'] = $agentsMap[$property->product_id] ?? null;

        if ($requestedFields !== null && $requestedFields !== []) {
            $propertyData = $this->filterFields($propertyData, $requestedFields);
        }
        return $propertyData;
    }

    /**
     * Get all property types as a flat list. Requires X-COMPANY-ID header.
     */
    public function getPropertyTypes(Request $request)
    {
        $companyId = $request->header('X-COMPANY-ID');
        if (!$companyId) {
            return response()->json(Reply::error(__('messages.missingCompanyId')), 400);
        }

        try {
            $types = Property::getAllPropertyTypes();
            return response()->json([
                'status' => 'success',
                'data' => $types,
            ], 200);
        } catch (\Throwable $e) {
            $referenceId = uniqid('PROP-TYPES-', true);
            Log::error('Error in getPropertyTypes', [
                'reference_id' => $referenceId,
                'message' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'company_id' => $request->header('X-COMPANY-ID'),
            ]);
            return response()->json([
                'status' => 'fail',
                'message' => 'Failed to fetch property types. Please contact support with reference ID: ' . $referenceId,
                'reference_id' => $referenceId,
            ], 500);
        }
    }

    /**
     * Get all features (exterior, interior, location) as one flat list. Requires X-COMPANY-ID header.
     */
    public function getFeatures(Request $request)
    {
        $companyId = $request->header('X-COMPANY-ID');
        if (!$companyId) {
            return response()->json(Reply::error(__('messages.missingCompanyId')), 400);
        }

        try {
            $flat = Property::getAllFeatures();
            return response()->json([
                'status' => 'success',
                'data' => $flat,
            ], 200);
        } catch (\Throwable $e) {
            $referenceId = uniqid('PROP-FEATURES-', true);
            Log::error('Error in getFeatures', [
                'reference_id' => $referenceId,
                'message' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'company_id' => $request->header('X-COMPANY-ID'),
            ]);
            return response()->json([
                'status' => 'fail',
                'message' => 'Failed to fetch features. Please contact support with reference ID: ' . $referenceId,
                'reference_id' => $referenceId,
            ], 500);
        }
    }

    public function getLocation(Request $request)
    {
        $companyId = $request->header('X-COMPANY-ID');
        if (!$companyId) {
            return response()->json(Reply::error(__('messages.missingCompanyId')), 400);
        }
        $companyId = (int) $companyId;

        try {
            $query = ProjectLocation::where('company_id', $companyId)
                ->orderBy('name');

            // Search by name or address street
            if ($request->filled('search')) {
                $search = $request->input('search');
                $query->where(function ($q) use ($search) {
                    $q->where('name', 'like', "%{$search}%")
                      ->orWhere('city', 'like', "%{$search}%")
                      ->orWhere('area', 'like', "%{$search}%")
                      ->orWhereRaw("JSON_UNQUOTE(JSON_EXTRACT(address, '$.street')) LIKE ?", ["%{$search}%"]);
                });
            }

            $locations = $query->get()
                ->map(function (ProjectLocation $location) {
                    // Normalise address: always return an object with consistent keys
                    $rawAddress = $location->address;
                    $address = null;

                    if (is_array($rawAddress) && !empty(array_filter($rawAddress))) {
                        $address = [
                            'street'     => $rawAddress['street'] ?? null,
                            'state'      => $rawAddress['state'] ?? null,
                            'country'    => $rawAddress['country'] ?? null,
                            'postalCode' => $rawAddress['postalCode'] ?? null,
                        ];
                    } elseif (is_string($rawAddress) && $rawAddress !== '') {
                        // Legacy: bare string stored in the column — treat as street
                        $address = [
                            'street'     => $rawAddress,
                            'state'      => null,
                            'country'    => null,
                            'postalCode' => null,
                        ];
                    }

                    return [
                        'id'          => $location->id,
                        'name'        => $location->name ?? null,
                        'city'        => $location->city ?? null,
                        'area'        => $location->area ?? null,
                        'address'     => $address,
                        'map_url'     => $location->map_url ?? null,
                        'latitude'    => $location->latitude ?? null,
                        'longitude'   => $location->longitude ?? null,
                    ];
                })
                ->values()
                ->toArray();

            return response()->json([
                'status' => 'success',
                'data' => $locations,
            ], 200);
        } catch (\Throwable $e) {
            $referenceId = uniqid('LOC-', true);
            Log::error('Error in getLocation (ProjectLocation)', [
                'reference_id' => $referenceId,
                'message' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'company_id' => $companyId,
                'context' => 'getLocation',
            ]);
            return response()->json([
                'status' => 'fail',
                'message' => 'Failed to fetch locations. Please contact support with reference ID: ' . $referenceId,
                'reference_id' => $referenceId,
            ], 500);
        }
    }

    /**
     * Get filters from query params and/or request body.
     * @param Request $request
     * @return array
     */
    private function getFilters(Request $request): array
    {
        $allowed = [
            'status', 'city', 'property_type', 'sale_type', 'fields',
            'locationIds', 'propertyTypes', 'bedrooms', 'bathrooms', 'features', 'fromPrice', 'toPrice',
            'search',
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

        // Remove null/empty values
        return array_filter($filters, function ($value) {
            return $value !== null && $value !== '';
        });
    }

    /**
     * Request body as array. For GET, Laravel does not parse body into all() — we read and decode JSON manually.
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
        if (json_last_error() !== JSON_ERROR_NONE) {
            Log::warning('Property API: malformed JSON in request body', [
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
     * Filter array to include only requested fields.
     *
     * @param array $data
     * @param array $requestedFields
     * @return array
     */
    private function filterFields(array $data, array $requestedFields): array
    {
        $filtered = [];
        
        foreach ($requestedFields as $field) {
            // Handle nested agent field
            if ($field === 'agent') {
                if (array_key_exists('agent', $data)) {
                    $filtered['agent'] = $data['agent'];
                }
                continue;
            }
            
            // Check if field exists in data
            if (array_key_exists($field, $data)) {
                $filtered[$field] = $data[$field];
            }
        }
        
        return $filtered;
    }

    /**
     * Get products map for efficient loading.
     *
     * @param array $productIds
     * @param int $companyId
     * @return \Illuminate\Support\Collection Map of product_id => Product model
     */
    private function getProductsMap(array $productIds, int $companyId)
    {
        if (empty($productIds)) {
            return collect();
        }

        try {
            $products = Product::where('company_id', $companyId)
                ->whereIn('id', $productIds)
                ->get();

            return $products->keyBy('id');
        } catch (\Exception $e) {
            Log::warning('Error fetching products', [
                'product_ids' => $productIds,
                'company_id' => $companyId,
                'error' => $e->getMessage(),
            ]);

            return collect();
        }
    }

    /**
     * Get agent (added_by user) for each product.
     * Agent is the User who added the product (product.added_by).
     *
     * @param array $productIds
     * @param int $companyId
     * @return array Map of product_id => agent_data (user id, name, email) or null
     */
    private function getAgentsForProducts(array $productIds, int $companyId): array
    {
        if (empty($productIds)) {
            return [];
        }

        try {
            $agentsMap = array_fill_keys($productIds, null);

            $products = Product::where('company_id', $companyId)
                ->whereIn('id', $productIds)
                ->with('addedBy:id,name,email')
                ->get();

            foreach ($products as $product) {
                $user = $product->addedBy;
                if ($user) {
                    $agentsMap[$product->id] = [
                        'id' => $user->id,
                        'name' => $user->name,
                        'email' => $user->email,
                    ];
                }
            }

            return $agentsMap;

        } catch (\Exception $e) {
            Log::warning('Error fetching agents (added_by) for products', [
                'product_ids' => $productIds,
                'company_id' => $companyId,
                'error' => $e->getMessage(),
            ]);

            return array_fill_keys($productIds, null);
        }
    }

    private function applySearchFilter(Builder $query, string $search): void
    {
        $search = trim($search);

        if ($search === '') {
            return;
        }

        $like = '%' . str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $search) . '%';

        $query->where(function (Builder $propertyQuery) use ($like) {
            $propertyQuery
                ->where('properties.title', 'like', $like)
                ->orWhere('properties.description', 'like', $like)
                ->orWhere('properties.city', 'like', $like)
                ->orWhere('properties.area', 'like', $like)
                ->orWhere('properties.status', 'like', $like)
                ->orWhere('properties.property_type', 'like', $like)
                ->orWhere('properties.sale_type', 'like', $like)
                ->orWhere('properties.primary_category', 'like', $like)
                ->orWhere('properties.block_name', 'like', $like)
                ->orWhere('properties.unit_number', 'like', $like)
                ->orWhere('properties.slug', 'like', $like)
                ->orWhere('properties.general_notes', 'like', $like)
                ->orWhere('properties.swap_notes', 'like', $like)
                ->orWhereRaw(
                    "CASE
                        WHEN JSON_VALID(properties.address) THEN COALESCE(JSON_UNQUOTE(JSON_EXTRACT(properties.address, '$.street')), CAST(properties.address AS CHAR))
                        ELSE CAST(properties.address AS CHAR)
                    END LIKE ?",
                    [$like]
                )
                ->orWhereRaw(
                    "CASE
                        WHEN JSON_VALID(properties.distances) THEN COALESCE(JSON_UNQUOTE(JSON_EXTRACT(properties.distances, '$.military_base')), CAST(properties.distances AS CHAR))
                        ELSE CAST(properties.distances AS CHAR)
                    END LIKE ?",
                    [$like]
                )
                ->orWhereHas('product', function (Builder $productQuery) use ($like) {
                    $productQuery
                        ->where('products.name', 'like', $like)
                        ->orWhere('products.description', 'like', $like);
                })
                ->orWhereHas('developerProject', function (Builder $projectQuery) use ($like) {
                    $projectQuery
                        ->where('developer_projects.name', 'like', $like)
                        ->orWhere('developer_projects.description', 'like', $like);
                })
                ->orWhereHas('projectLocation', function (Builder $locationQuery) use ($like) {
                    $locationQuery
                        ->where('project_locations.name', 'like', $like)
                        ->orWhere('project_locations.city', 'like', $like)
                        ->orWhere('project_locations.area', 'like', $like)
                        ->orWhereRaw(
                            "CASE
                                WHEN JSON_VALID(project_locations.address) THEN COALESCE(JSON_UNQUOTE(JSON_EXTRACT(project_locations.address, '$.street')), CAST(project_locations.address AS CHAR))
                                ELSE CAST(project_locations.address AS CHAR)
                            END LIKE ?",
                            [$like]
                        );
                });
        });
    }
}

