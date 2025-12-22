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

            // Get pagination parameters
            $page = max(1, (int) $request->get('page', 1));
            $perPage = min(
                max(1, (int) $request->get('per_page', config('api.defaultLimit', 20))),
                config('api.maxLimit', 1000)
            );

            // Build query for properties
            $propertiesQuery = Property::where('properties.company_id', $companyId);

            // Apply any filters if needed (e.g., status, city, property_type)
            if ($request->filled('status')) {
                $propertiesQuery->where('properties.status', $request->status);
            }

            if ($request->filled('city')) {
                $propertiesQuery->where('properties.city', $request->city);
            }

            if ($request->filled('property_type')) {
                $propertiesQuery->where('properties.property_type', $request->property_type);
            }

            if ($request->filled('sale_type')) {
                $propertiesQuery->where('properties.sale_type', $request->sale_type);
            }

            // Get paginated results
            $properties = $propertiesQuery->orderBy('properties.created_at', 'desc')
                ->paginate($perPage, ['*'], 'page', $page);

            // Get all product IDs from the paginated properties
            $productIds = $properties->getCollection()->pluck('product_id')->filter()->unique()->toArray();

            // Pre-fetch products and agents for all properties in one query to avoid N+1
            $productsMap = $this->getProductsMap($productIds, $companyId);
            $agentsMap = $this->getAgentsForProducts($productIds, $companyId);

            // Transform properties to flatten product fields and include agent details
            $transformedProperties = $properties->getCollection()->map(function ($property) use ($productsMap, $agentsMap) {
                $propertyData = $property->toArray();
                
                // Remove the nested product object if it exists
                unset($propertyData['product']);
                
                // Get product data and flatten it into the main payload
                $product = $productsMap->get($property->product_id);
                if ($product) {
                    $productArray = $product->toArray();
                    
                    // Add product fields with "product_" prefix to avoid conflicts
                    foreach ($productArray as $key => $value) {
                        // Skip relationships, internal fields, and product_id (already exists as property's product_id)
                        if (!in_array($key, ['id', 'tax', 'category', 'subCategory', 'unit', 'company', 'pivot'])) {
                            $propertyData['product_' . $key] = $value;
                        }
                    }
                }
                
                // Remove product_id from property data since it's redundant (product info is already included)
                unset($propertyData['product_id']);
                
                // Get agent details from pre-fetched map
                $agentData = $agentsMap[$property->product_id] ?? null;
                
                // Add agent data as nested sub-payload
                $propertyData['agent'] = $agentData;
                
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
            Log::error('Error fetching properties via API', [
                'message' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'company_id' => $request->header('X-COMPANY-ID'),
            ]);

            return response()->json(Reply::error('Failed to fetch properties: ' . $e->getMessage()), 500);
        }
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

