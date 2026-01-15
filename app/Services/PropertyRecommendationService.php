<?php

namespace App\Services;

use App\Models\Deal;
use App\Models\Lead;
use App\Models\Property;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Service for fetching property recommendations from the external recommendation engine.
 * 
 * This service acts as a bridge between the CRM and the property recommendation API,
 * handling all communication, caching, and data transformation.
 */
class PropertyRecommendationService
{
    /**
     * Base URL for the property recommendation API
     */
    protected string $baseUrl;

    /**
     * HTTP timeout in seconds
     */
    protected int $timeout;

    /**
     * Cache TTL in seconds (default 15 minutes)
     */
    protected int $cacheTtl;

    public function __construct()
    {
        $this->baseUrl = config('services.property_recommendation.base_url', 'https://pre.hibarr.org');
        $this->timeout = config('services.property_recommendation.timeout', 30);
        $this->cacheTtl = config('services.property_recommendation.cache_ttl', 900);
    }

    /**
     * Get property recommendations for a deal based on the contact/customer.
     *
     * @param Deal $deal The deal to get recommendations for
     * @param int $limit Maximum number of recommendations to return
     * @return array{recommendations: array, error: string|null, cached: bool}
     */
    public function getRecommendationsForDeal(Deal $deal, int $limit = 10): array
    {
        // The recommendation API uses customer_id which maps to our lead/contact ID
        $customerId = $deal->lead_id;

        if (!$customerId) {
            return [
                'recommendations' => [],
                'error' => 'Deal has no associated contact',
                'cached' => false,
            ];
        }

        return $this->getRecommendations($customerId, $limit);
    }

    /**
     * Get property recommendations for a customer/lead.
     *
     * @param int $customerId The customer/lead ID
     * @param int $limit Maximum number of recommendations
     * @return array{recommendations: array, error: string|null, cached: bool}
     */
    public function getRecommendations(int $customerId, int $limit = 10): array
    {
        $cacheKey = "property_recommendations:{$customerId}:{$limit}";

        // Check cache first
        if (Cache::has($cacheKey)) {
            $cached = Cache::get($cacheKey);
            return array_merge($cached, ['cached' => true]);
        }

        try {
            $response = Http::timeout($this->timeout)
                ->get("{$this->baseUrl}/recommendations/{$customerId}", [
                    'top_n' => $limit,
                ]);

            if (!$response->successful()) {
                Log::warning('Property recommendation API error', [
                    'customer_id' => $customerId,
                    'status' => $response->status(),
                    'body' => $response->body(),
                ]);

                return [
                    'recommendations' => [],
                    'error' => 'Failed to fetch recommendations',
                    'cached' => false,
                ];
            }

            $data = $response->json();
            $recommendations = $this->enrichRecommendations($data['recommendations'] ?? $data ?? []);

            $result = [
                'recommendations' => $recommendations,
                'error' => null,
            ];

            // Cache successful results
            Cache::put($cacheKey, $result, $this->cacheTtl);

            return array_merge($result, ['cached' => false]);

        } catch (\Exception $e) {
            Log::error('Property recommendation API exception', [
                'customer_id' => $customerId,
                'error' => $e->getMessage(),
            ]);

            return [
                'recommendations' => [],
                'error' => 'Recommendation service unavailable',
                'cached' => false,
            ];
        }
    }

    /**
     * Get compatibility score between a customer and a specific property.
     *
     * @param int $customerId
     * @param int $propertyId
     * @return array{score: float|null, factors: array, error: string|null}
     */
    public function getCompatibility(int $customerId, int $propertyId): array
    {
        $cacheKey = "property_compatibility:{$customerId}:{$propertyId}";

        if (Cache::has($cacheKey)) {
            return Cache::get($cacheKey);
        }

        try {
            $response = Http::timeout($this->timeout)
                ->get("{$this->baseUrl}/compatibility", [
                    'customer_id' => $customerId,
                    'property_id' => $propertyId,
                ]);

            if (!$response->successful()) {
                return [
                    'score' => null,
                    'factors' => [],
                    'error' => 'Failed to fetch compatibility',
                ];
            }

            $result = $response->json();
            Cache::put($cacheKey, $result, $this->cacheTtl);

            return $result;

        } catch (\Exception $e) {
            Log::error('Property compatibility API exception', [
                'customer_id' => $customerId,
                'property_id' => $propertyId,
                'error' => $e->getMessage(),
            ]);

            return [
                'score' => null,
                'factors' => [],
                'error' => 'Compatibility service unavailable',
            ];
        }
    }

    /**
     * Check if the recommendation service is healthy.
     *
     * @return array{healthy: bool, message: string}
     */
    public function healthCheck(): array
    {
        try {
            $response = Http::timeout(5)
                ->get("{$this->baseUrl}/health", ['verbose' => false]);

            return [
                'healthy' => $response->successful(),
                'message' => $response->successful() ? 'Service is healthy' : 'Service returned error',
            ];
        } catch (\Exception $e) {
            return [
                'healthy' => false,
                'message' => 'Service unreachable: ' . $e->getMessage(),
            ];
        }
    }

    /**
     * Enrich recommendations with local property data.
     * Maps external property IDs to our local Property models.
     *
     * @param array $recommendations Raw recommendations from API
     * @return array Enriched recommendations with local property data
     */
    protected function enrichRecommendations(array $recommendations): array
    {
        if (empty($recommendations)) {
            return [];
        }

        // Extract property IDs from recommendations
        $propertyIds = collect($recommendations)->pluck('property_id')->filter()->toArray();

        if (empty($propertyIds)) {
            // If no property_id field, the recommendations might be structured differently
            // Return as-is with basic structure
            return array_map(function ($rec, $index) {
                return [
                    'rank' => $index + 1,
                    'property_id' => $rec['property_id'] ?? $rec['id'] ?? null,
                    'score' => $rec['score'] ?? $rec['compatibility_score'] ?? null,
                    'match_percentage' => isset($rec['score']) ? round($rec['score'] * 100) : null,
                    'factors' => $rec['factors'] ?? $rec['matching_factors'] ?? [],
                    'property' => null, // No local property data
                    'raw' => $rec,
                ];
            }, $recommendations, array_keys($recommendations));
        }

        // Fetch local properties
        $properties = Property::with(['product', 'assets'])
            ->whereIn('id', $propertyIds)
            ->get()
            ->keyBy('id');

        // Enrich each recommendation with local property data
        return array_map(function ($rec, $index) use ($properties) {
            $propertyId = $rec['property_id'] ?? $rec['id'] ?? null;
            $property = $propertyId ? ($properties[$propertyId] ?? null) : null;

            return [
                'rank' => $index + 1,
                'property_id' => $propertyId,
                'score' => $rec['score'] ?? $rec['compatibility_score'] ?? null,
                'match_percentage' => isset($rec['score']) ? round($rec['score'] * 100) : null,
                'factors' => $rec['factors'] ?? $rec['matching_factors'] ?? [],
                'property' => $property ? $this->transformProperty($property) : null,
                'raw' => $rec,
            ];
        }, $recommendations, array_keys($recommendations));
    }

    /**
     * Transform a Property model for frontend consumption.
     *
     * @param Property $property
     * @return array
     */
    protected function transformProperty(Property $property): array
    {
        // Get primary photo
        $primaryPhoto = null;
        if ($property->photos && is_array($property->photos) && count($property->photos) > 0) {
            $primaryPhoto = $property->photos[0];
        }

        return [
            'id' => $property->id,
            'title' => $property->title ?? $property->product?->name ?? 'Property #' . $property->id,
            'property_type' => $property->property_type,
            'sale_type' => $property->sale_type,
            'price' => $property->price,
            'city' => $property->city,
            'area' => $property->area,
            'bedrooms' => $property->bedrooms,
            'bathrooms' => $property->bathrooms,
            'land_size' => $property->land_size,
            'status' => $property->status,
            'primary_photo' => $primaryPhoto,
            'photos_count' => is_array($property->photos) ? count($property->photos) : 0,
        ];
    }

    /**
     * Clear recommendation cache for a customer.
     *
     * @param int $customerId
     * @return void
     */
    public function clearCache(int $customerId): void
    {
        // Clear all cached recommendations for this customer
        Cache::forget("property_recommendations:{$customerId}:10");
        Cache::forget("property_recommendations:{$customerId}:20");
        Cache::forget("property_recommendations:{$customerId}:50");
    }
}
