<?php

namespace App\Http\Controllers;

use App\Exceptions\EntityAiSummaryGenerationException;
use App\Models\Deal;
use App\Models\DealFollowUp;
use App\Services\EntitySummary\MeetingTalkingPointsService;
use App\Services\PermissionService;
use App\Support\FeatureFlags;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * AI talking points for one meeting on a deal (agent workspace meeting brief).
 * Same flag and deal visibility rule as the deal's AI summary.
 */
class DealMeetingTalkingPointsController extends AccountBaseController
{
    public function __construct(
        private MeetingTalkingPointsService $talkingPoints,
    ) {
        parent::__construct();
    }

    public function show(Deal $deal, int $meeting): JsonResponse
    {
        $followUp = $this->authorizeMeeting($deal, $meeting);

        return response()->json(['talking_points' => $this->talkingPoints->getCached($deal, $followUp)]);
    }

    public function generate(Request $request, Deal $deal, int $meeting): JsonResponse
    {
        $followUp = $this->authorizeMeeting($deal, $meeting);

        $brief = $request->validate([
            'next_stage' => ['nullable', 'string', 'max:120'],
            'open_conditions' => ['nullable', 'array', 'max:12'],
            'open_conditions.*' => ['string', 'max:200'],
            'open_questions' => ['nullable', 'array', 'max:12'],
            'open_questions.*' => ['string', 'max:300'],
        ]);

        try {
            $points = $this->talkingPoints->generate($deal, $followUp, $brief);
        } catch (EntityAiSummaryGenerationException $e) {
            return response()->json([
                'message' => $e->getMessage(),
                'talking_points' => $e->existingSummary(),
            ], $e->getCode() >= 400 ? $e->getCode() : 503);
        }

        return response()->json(['talking_points' => $points]);
    }

    private function authorizeMeeting(Deal $deal, int $meeting): DealFollowUp
    {
        abort_unless(FeatureFlags::enabled('sales.ai-entity-summary'), 404);
        abort_if((int) $deal->company_id !== (int) company()->id, 404);

        $deal->loadMissing(['leadAgent', 'dealWatchers']);

        $access = PermissionService::checkAccess(user(), 'view_deals', $deal, [
            'added' => 'added_by',
            'owned' => fn ($user, $model) => $model->isVisibleToUser($user->id),
        ]);

        abort_unless($access['canAccess'], 403);

        return DealFollowUp::query()
            ->where('deal_id', $deal->id)
            ->whereKey($meeting)
            ->firstOrFail();
    }
}
