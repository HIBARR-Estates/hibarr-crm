<?php

namespace App\Http\Controllers;

use App\Models\CalendlyMeetingLink;
use App\Models\Deal;
use App\Models\Lead;
use App\Support\CalendlyLinkBuilder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * The Calendly links the schedule-meeting modal offers for one lead or deal:
 * only those the signed-in user's roles are allowed to see, each already
 * filled in with that person's details.
 */
class CalendlyMeetingLinkOptionsController extends AccountBaseController
{
    public function __invoke(Request $request): JsonResponse
    {
        abort_403(! in_array(user()->permission('add_lead_follow_up'), ['all', 'added'], true));

        $validated = $request->validate([
            'record_type' => 'required|in:lead,deal',
            'record_id' => 'required|integer',
        ]);

        $recordId = (int) $validated['record_id'];
        $lead = $validated['record_type'] === CalendlyLinkBuilder::RECORD_DEAL
            ? $this->leadOfDeal(Deal::findOrFail($recordId))
            : Lead::findOrFail($recordId);

        $roleIds = DB::table('role_user')->where('user_id', user()->id)->pluck('role_id')->map(fn ($id) => (int) $id)->all();

        $links = CalendlyMeetingLink::visibleToRoles($roleIds)
            ->orderBy('sort_order')->orderBy('id')->get()
            ->map(fn (CalendlyMeetingLink $link) => [
                'id' => $link->id,
                'name' => $link->name,
                'description' => $link->description,
                'url' => CalendlyLinkBuilder::build($link, $validated['record_type'], $recordId, $lead, (int) user()->id),
            ])->values()->all();

        return response()->json(['status' => 'success', 'data' => ['links' => $links]]);
    }

    private function leadOfDeal(Deal $deal): ?Lead
    {
        return $deal->lead_id ? Lead::find($deal->lead_id) : null;
    }
}
