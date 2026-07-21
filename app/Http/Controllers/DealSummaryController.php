<?php

namespace App\Http\Controllers;

use App\Exceptions\EntityAiSummaryGenerationException;
use App\Models\Deal;
use App\Services\EntitySummary\DealSummaryService;
use App\Services\PermissionService;
use App\Support\FeatureFlags;
use Illuminate\Http\JsonResponse;

class DealSummaryController extends AccountBaseController
{
    public function __construct(
        private DealSummaryService $dealSummaryService,
    ) {
        parent::__construct();
    }

    public function show(Deal $deal): JsonResponse
    {
        $this->assertFeatureEnabled();
        $this->assertCanViewDeal($deal);

        $summary = $this->dealSummaryService->getCached($deal);

        return response()->json([
            'summary' => $summary,
            'is_stale' => (bool) ($summary['meta']['is_stale'] ?? false),
        ]);
    }

    public function regenerate(Deal $deal): JsonResponse
    {
        $this->assertFeatureEnabled();
        $this->assertCanViewDeal($deal);

        try {
            $summary = $this->dealSummaryService->regenerate($deal);
        } catch (EntityAiSummaryGenerationException $e) {
            return response()->json([
                'message' => $e->getMessage(),
                'summary' => $e->existingSummary(),
                'is_stale' => (bool) (($e->existingSummary()['meta']['is_stale'] ?? false)),
            ], $e->getCode() >= 400 ? $e->getCode() : 503);
        }

        return response()->json([
            'summary' => $summary,
            'is_stale' => false,
        ]);
    }

    private function assertFeatureEnabled(): void
    {
        abort_unless(FeatureFlags::enabled('sales.ai-entity-summary'), 404);
    }

    private function assertCanViewDeal(Deal $deal): void
    {
        abort_if((int) $deal->company_id !== (int) company()->id, 404);

        $deal->loadMissing(['leadAgent', 'dealWatchers']);

        $dealRules = [
            'added' => 'added_by',
            'owned' => function ($user, $model) {
                $isAgent = $model->leadAgent && (int) $model->leadAgent->user_id === (int) $user->id;
                $isWatcher = $model->dealWatchers->contains('id', $user->id);

                return $isAgent || $isWatcher;
            },
        ];

        $access = PermissionService::checkAccess(user(), 'view_deals', $deal, $dealRules);

        abort_unless($access['canAccess'], 403);
    }
}
