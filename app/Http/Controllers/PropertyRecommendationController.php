<?php

namespace App\Http\Controllers;

use App\Helper\Reply;
use App\Models\Deal;
use App\Services\PermissionService;
use App\Services\PropertyRecommendationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Controller for property recommendation API endpoints.
 * 
 * Provides endpoints to fetch property recommendations for deals
 * and check compatibility between customers and properties.
 */
class PropertyRecommendationController extends AccountBaseController
{
    protected PropertyRecommendationService $recommendationService;

    public function __construct(PropertyRecommendationService $recommendationService)
    {
        parent::__construct();
        $this->recommendationService = $recommendationService;
        $this->pageTitle = 'Property Recommendations';

        $this->middleware(function ($request, $next) {
            abort_403(!in_array('leads', $this->user->modules));
            return $next($request);
        });
    }

    /**
     * Check if user can view a deal.
     *
     * @param Deal $deal
     * @return bool
     */
    protected function canViewDeal(Deal $deal): bool
    {
        $dealRules = [
            'added' => 'added_by',
            'owned' => fn ($user, $deal) => $deal->isVisibleToUser($user->id),
        ];

        $access = PermissionService::checkAccess(user(), 'view_deals', $deal, $dealRules);
        return $access['canAccess'];
    }

    /**
     * Get property recommendations for a specific deal.
     *
     * @param Request $request
     * @param int $dealId
     * @return JsonResponse
     */
    public function getRecommendations(Request $request, int $dealId): JsonResponse
    {
        $deal = Deal::with('contact')->findOrFail($dealId);

        // Authorization check
        if (!$this->canViewDeal($deal)) {
            return response()->json([
                'status' => 'error',
                'message' => 'You do not have permission to view this deal',
            ], 403);
        }

        $limit = (int) $request->get('limit', 10);
        $limit = min(max($limit, 1), 50); // Clamp between 1 and 50

        $result = $this->recommendationService->getRecommendationsForDeal($deal, $limit);

        return response()->json([
            'status' => 'success',
            'deal_id' => $deal->id,
            'contact' => $deal->contact ? [
                'id' => $deal->contact->id,
                'name' => $deal->contact->client_name,
                'email' => $deal->contact->client_email,
            ] : null,
            'recommendations' => $result['recommendations'],
            'cached' => $result['cached'],
            'error' => $result['error'],
        ]);
    }

    /**
     * Get compatibility score between a deal's contact and a property.
     *
     * @param Request $request
     * @param int $dealId
     * @param int $propertyId
     * @return JsonResponse
     */
    public function getCompatibility(Request $request, int $dealId, int $propertyId): JsonResponse
    {
        $deal = Deal::findOrFail($dealId);

        // Authorization check
        if (!$this->canViewDeal($deal)) {
            return response()->json([
                'status' => 'error',
                'message' => 'You do not have permission to view this deal',
            ], 403);
        }

        if (!$deal->lead_id) {
            return response()->json([
                'status' => 'error',
                'message' => 'Deal has no associated contact',
            ], 400);
        }

        $result = $this->recommendationService->getCompatibility($deal->lead_id, $propertyId);

        return response()->json([
            'status' => $result['error'] ? 'error' : 'success',
            'deal_id' => $deal->id,
            'property_id' => $propertyId,
            'score' => $result['score'],
            'match_percentage' => $result['score'] ? round($result['score'] * 100) : null,
            'factors' => $result['factors'],
            'error' => $result['error'],
        ]);
    }

    /**
     * Refresh recommendations for a deal (clears cache).
     *
     * @param Request $request
     * @param int $dealId
     * @return JsonResponse
     */
    public function refreshRecommendations(Request $request, int $dealId): JsonResponse
    {
        $deal = Deal::findOrFail($dealId);

        // Authorization check
        if (!$this->canViewDeal($deal)) {
            return response()->json([
                'status' => 'error',
                'message' => 'You do not have permission to view this deal',
            ], 403);
        }

        if ($deal->lead_id) {
            $this->recommendationService->clearCache($deal->lead_id);
        }

        // Fetch fresh recommendations
        $limit = (int) $request->get('limit', 10);
        $result = $this->recommendationService->getRecommendationsForDeal($deal, $limit);

        return response()->json([
            'status' => 'success',
            'message' => 'Recommendations refreshed',
            'recommendations' => $result['recommendations'],
            'cached' => false,
            'error' => $result['error'],
        ]);
    }

    /**
     * Health check for the recommendation service.
     *
     * @return JsonResponse
     */
    public function healthCheck(): JsonResponse
    {
        $health = $this->recommendationService->healthCheck();

        return response()->json([
            'status' => $health['healthy'] ? 'success' : 'error',
            'healthy' => $health['healthy'],
            'message' => $health['message'],
        ], $health['healthy'] ? 200 : 503);
    }
}
