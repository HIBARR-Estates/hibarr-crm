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

        $result = $this->getRecommendations($customerId, $limit);
        $result['recommendations'] = $this->applyDealBudgetFactors(
            $deal,
            $result['recommendations'] ?? []
        );

        return $result;
    }

    /**
     * Override PRE "budget" factor labels using the deal's hibarr budget_range
     * so we never show "Well within budget" for listings outside the CRM range.
     *
     * @param  array<int, array<string, mixed>>  $recommendations
     * @return array<int, array<string, mixed>>
     */
    protected function applyDealBudgetFactors(Deal $deal, array $recommendations): array
    {
        $range = $this->resolveDealBudgetRange($deal);
        if ($range === null) {
            return $recommendations;
        }

        [$min, $max] = $range;

        return array_map(function (array $rec) use ($min, $max) {
            $price = $rec['property']['price'] ?? $rec['raw']['price'] ?? null;
            if ($price === null || !is_numeric($price)) {
                return $rec;
            }

            $price = (float) $price;
            $budgetLabel = $this->budgetMatchLabel($price, $min, $max);
            $budgetScore = $budgetLabel['score'];

            $factors = $rec['factors'] ?? [];
            if (!is_array($factors)) {
                $factors = [];
            }

            $replaced = false;
            foreach ($factors as $idx => $factor) {
                $name = strtolower((string) (is_array($factor)
                    ? ($factor['name'] ?? $factor['key'] ?? $factor['factor'] ?? '')
                    : ''));
                if (str_contains($name, 'budget') || str_contains($name, 'price')) {
                    $factors[$idx] = array_merge(
                        is_array($factor) ? $factor : [],
                        [
                            'name' => is_array($factor) ? ($factor['name'] ?? 'budget') : 'budget',
                            'score' => $budgetScore,
                            'status' => $budgetLabel['status'],
                            'detail' => $budgetLabel['detail'],
                            'positive' => $budgetScore >= 60,
                        ]
                    );
                    $replaced = true;
                }
            }

            if (!$replaced) {
                $factors[] = [
                    'name' => 'budget',
                    'score' => $budgetScore,
                    'status' => $budgetLabel['status'],
                    'detail' => $budgetLabel['detail'],
                    'positive' => $budgetScore >= 60,
                ];
            }

            $rec['factors'] = $factors;

            return $rec;
        }, $recommendations);
    }

    /**
     * @return array{0: float, 1: float}|null
     */
    protected function resolveDealBudgetRange(Deal $deal): ?array
    {
        $deal->loadMissing('hibarrFields');
        $raw = $deal->hibarrFields?->budget_range ?? null;

        if (is_string($raw) && $raw !== '') {
            $decoded = json_decode($raw, true);
            if (is_array($decoded)) {
                $raw = $decoded;
            } else {
                // Plain number or "min-max" string
                if (preg_match('/^\s*([\d.]+)\s*[-–to]+\s*([\d.]+)\s*$/i', $raw, $m)) {
                    return [(float) $m[1], (float) $m[2]];
                }
                if (is_numeric($raw)) {
                    $n = (float) $raw;
                    return [0.0, $n];
                }
            }
        }

        if (!is_array($raw)) {
            return null;
        }

        $min = $raw['min'] ?? $raw['from'] ?? $raw['low'] ?? 0;
        $max = $raw['max'] ?? $raw['to'] ?? $raw['high'] ?? null;

        if ($max === null || !is_numeric($max)) {
            return null;
        }

        return [(float) $min, (float) $max];
    }

    /**
     * @return array{score: int, status: string, detail: string}
     */
    protected function budgetMatchLabel(float $price, float $min, float $max): array
    {
        if ($max <= 0) {
            return [
                'score' => 50,
                'status' => 'Unknown',
                'detail' => 'Deal budget not configured',
            ];
        }

        if ($price >= $min && $price <= $max) {
            $span = max($max - $min, 1.0);
            $mid = ($min + $max) / 2;
            $distance = abs($price - $mid) / $span;
            if ($distance <= 0.25) {
                return [
                    'score' => 95,
                    'status' => 'Excellent',
                    'detail' => 'Well within budget',
                ];
            }

            return [
                'score' => 80,
                'status' => 'Good',
                'detail' => 'Within budget range',
            ];
        }

        if ($price < $min) {
            return [
                'score' => 70,
                'status' => 'Good',
                'detail' => 'Below budget range',
            ];
        }

        $overPct = (($price - $max) / max($max, 1)) * 100;
        if ($overPct <= 15) {
            return [
                'score' => 45,
                'status' => 'Fair',
                'detail' => 'Slightly above budget',
            ];
        }

        return [
            'score' => 15,
            'status' => 'Poor',
            'detail' => 'Above budget',
        ];
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
            
            // Fetch factors for each recommendation using the compatibility endpoint
            $recommendations = $this->enrichWithFactors($customerId, $recommendations);

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
     * Enrich recommendations with factors from the compatibility endpoint.
     * Makes parallel requests to fetch factors for each property.
     *
     * @param int $customerId The customer/lead ID
     * @param array $recommendations The recommendations to enrich
     * @return array Recommendations with factors added
     */
    protected function enrichWithFactors(int $customerId, array $recommendations): array
    {
        if (empty($recommendations)) {
            return $recommendations;
        }

        // Collect property IDs that need factors
        $propertyIds = collect($recommendations)
            ->filter(fn($rec) => !empty($rec['property_id']) && empty($rec['factors']))
            ->pluck('property_id')
            ->toArray();

        if (empty($propertyIds)) {
            return $recommendations;
        }

        // Fetch factors for each property using HTTP pool for parallel requests
        $responses = Http::pool(function ($pool) use ($customerId, $propertyIds) {
            foreach ($propertyIds as $propertyId) {
                $pool->as("prop_{$propertyId}")
                    ->timeout($this->timeout)
                    ->get("{$this->baseUrl}/compatibility", [
                        'customer_id' => $customerId,
                        'property_id' => $propertyId,
                    ]);
            }
        });

        // Map factors back to recommendations
        $factorsByProperty = [];
        foreach ($propertyIds as $propertyId) {
            $key = "prop_{$propertyId}";
            if (isset($responses[$key]) && $responses[$key]->successful()) {
                $data = $responses[$key]->json();
                $factorsByProperty[$propertyId] = $data['factors'] ?? [];
            }
        }

        // Update recommendations with factors
        return array_map(function ($rec) use ($factorsByProperty) {
            $propertyId = $rec['property_id'] ?? null;
            if ($propertyId && isset($factorsByProperty[$propertyId])) {
                $rec['factors'] = $factorsByProperty[$propertyId];
            }
            return $rec;
        }, $recommendations);
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
                $score = $this->extractScore($rec);
                return [
                    'rank' => $index + 1,
                    'property_id' => $rec['property_id'] ?? $rec['id'] ?? null,
                    'score' => $score,
                    'match_percentage' => $score !== null ? round($score) : null,
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
            $score = $this->extractScore($rec);

            return [
                'rank' => $index + 1,
                'property_id' => $propertyId,
                'score' => $score,
                'match_percentage' => $score !== null ? round($score) : null,
                'factors' => $rec['factors'] ?? $rec['matching_factors'] ?? [],
                'property' => $property ? $this->transformProperty($property) : null,
                'raw' => $rec,
            ];
        }, $recommendations, array_keys($recommendations));
    }

    /**
     * Extract the score from a recommendation record.
     * Handles different field names from the API (suitability_score, score, compatibility_score).
     *
     * @param array $rec The recommendation record
     * @return float|null The score as a percentage (0-100), or null if not available
     */
    protected function extractScore(array $rec): ?float
    {
        // suitability_score is already 0-100 from the recommendations endpoint
        if (isset($rec['suitability_score'])) {
            return (float) $rec['suitability_score'];
        }

        // score from compatibility endpoint is 0-1, convert to percentage
        if (isset($rec['score'])) {
            $score = (float) $rec['score'];
            // If score is between 0 and 1, it's a decimal percentage
            return $score <= 1 ? $score * 100 : $score;
        }

        // compatibility_score might be 0-1 or 0-100
        if (isset($rec['compatibility_score'])) {
            $score = (float) $rec['compatibility_score'];
            return $score <= 1 ? $score * 100 : $score;
        }

        // overall_score from compatibility endpoint is 0-1
        if (isset($rec['overall_score'])) {
            $score = (float) $rec['overall_score'];
            return $score <= 1 ? $score * 100 : $score;
        }

        return null;
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
