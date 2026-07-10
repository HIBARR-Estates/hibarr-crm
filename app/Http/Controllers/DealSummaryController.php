<?php

namespace App\Http\Controllers;

use App\Models\Deal;
use App\Services\EntitySummary\DealSummaryService;
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

        return response()->json([
            'summary' => $this->dealSummaryService->getCached($deal),
        ]);
    }

    public function regenerate(Deal $deal): JsonResponse
    {
        $this->assertFeatureEnabled();
        $this->assertCanViewDeal($deal);

        return response()->json([
            'summary' => $this->dealSummaryService->regenerate($deal),
        ]);
    }

    private function assertFeatureEnabled(): void
    {
        abort_unless(FeatureFlags::enabled('sales.ai-entity-summary'), 404);
    }

    private function assertCanViewDeal(Deal $deal): void
    {
        abort_if((int) $deal->company_id !== (int) company()->id, 404);

        $permission = user()->permission('view_deals');

        abort_unless(in_array($permission, ['all', 'added'], true), 403);

        if ($permission === 'added' && (int) $deal->added_by !== (int) user()->id) {
            abort(403);
        }
    }
}
