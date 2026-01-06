<?php

namespace App\Http\Controllers\Api;

use App\Helper\Reply;
use App\Http\Controllers\Controller;
use App\Models\Property;
use App\Models\Deal;
use App\Models\Product;
use Illuminate\Http\Request;
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

            // Get pagination parameters from query string only
            $page = max(1, (int) $request->query('page', 1));
            $perPage = min(
                max(1, (int) $request->query('per_page', config('api.defaultLimit', 20))),
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

            // Get paginated results
            $properties = $propertiesQuery->orderBy('properties.created_at', 'desc')
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
     * Get filters from request body (JSON) only.
     *
     * @param Request $request
     * @return array
     */
    private function getFilters(Request $request): array
    {
        $filters = [];
        $body = $request->all();
        
        // Check for filters in body
        if (isset($body['filters']) && is_array($body['filters'])) {
            $filters = $body['filters'];
        } else {
            // If filters are at root level of body
            $filters = array_intersect_key($body, array_flip([
                'status', 'city', 'property_type', 'sale_type', 'fields'
            ]));
        }

        // Remove null/empty values
        return array_filter($filters, function ($value) {
            return $value !== null && $value !== '';
        });
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
                if (isset($data['agent'])) {
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
     * Get agents for multiple products efficiently.
     * Finds agents through: Product -> Deal -> LeadAgent -> User
     *
     * @param array $productIds
     * @param int $companyId
     * @return array Map of product_id => agent_data
     */
    private function getAgentsForProducts(array $productIds, int $companyId): array
    {
        if (empty($productIds)) {
            return [];
        }

        try {
            // Initialize map with null values
            $agentsMap = array_fill_keys($productIds, null);

            // Get all deals that include any of these products, with their products and agents
            $deals = Deal::where('deals.company_id', $companyId)
                ->whereHas('products', function ($query) use ($productIds) {
                    $query->whereIn('products.id', $productIds);
                })
                ->with(['products:id', 'leadAgent.user'])
                ->orderBy('deals.updated_at', 'desc')
                ->orderBy('deals.created_at', 'desc')
                ->get();

            // For each product, find the most recent deal that includes it
            foreach ($productIds as $productId) {
                // Find deals that include this product
                $productDeals = $deals->filter(function ($deal) use ($productId) {
                    return $deal->products->contains('id', $productId);
                });

                if ($productDeals->isEmpty()) {
                    continue;
                }

                // Get the most recent deal for this product
                $deal = $productDeals->sortByDesc('updated_at')->first();

                if ($deal && $deal->leadAgent && $deal->leadAgent->user) {
                    $leadAgent = $deal->leadAgent;
                    $user = $leadAgent->user;

                    $agentsMap[$productId] = [
                        'id' => $leadAgent->id,
                        'user_id' => $user->id,
                        'name' => $user->name,
                        'email' => $user->email,
                        'status' => $leadAgent->status,
                        'created_at' => $leadAgent->created_at?->toISOString(),
                        'updated_at' => $leadAgent->updated_at?->toISOString(),
                    ];
                }
            }

            return $agentsMap;

        } catch (\Exception $e) {
            Log::warning('Error fetching agents for products', [
                'product_ids' => $productIds,
                'company_id' => $companyId,
                'error' => $e->getMessage(),
            ]);

            return array_fill_keys($productIds, null);
        }
    }
}

