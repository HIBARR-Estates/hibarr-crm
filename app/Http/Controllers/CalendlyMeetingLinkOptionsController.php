<?php

namespace App\Http\Controllers;

use App\Models\CalendlyMeetingLink;
use App\Models\Deal;
use App\Models\Lead;
use App\Models\User;
use App\Support\CalendlyLinkBuilder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * The Calendly links the schedule-meeting modal offers for one lead or deal:
 * only those the signed-in user's roles are allowed to see, each already
 * filled in with the contact's details and with the chosen staff as guests.
 */
class CalendlyMeetingLinkOptionsController extends AccountBaseController
{
    public function __invoke(Request $request): JsonResponse
    {
        abort_403(! in_array(user()->permission('add_lead_follow_up'), ['all', 'added'], true));

        $validated = $request->validate([
            'record_type' => 'required|in:lead,deal',
            'record_id' => 'required|integer',
            // Comma-separated user ids. Absent = just the signed-in user (the
            // default); present but empty = nobody.
            'guest_ids' => 'nullable|string|max:200',
        ]);

        $recordId = (int) $validated['record_id'];
        $lead = $validated['record_type'] === 'deal'
            ? $this->leadOfDeal(Deal::findOrFail($recordId))
            : Lead::findOrFail($recordId);

        $guestEmails = $this->guestEmails($request->has('guest_ids') ? (string) ($validated['guest_ids'] ?? '') : null);

        $roleIds = DB::table('role_user')->where('user_id', user()->id)->pluck('role_id')->map(fn ($id) => (int) $id)->all();

        $links = CalendlyMeetingLink::visibleToRoles($roleIds)
            ->orderBy('sort_order')->orderBy('id')->get()
            ->map(fn (CalendlyMeetingLink $link) => [
                'id' => $link->id,
                'name' => $link->name,
                'description' => $link->description,
                'url' => CalendlyLinkBuilder::build($link, $lead, $guestEmails),
            ])->values()->all();

        return response()->json(['status' => 'success', 'data' => ['links' => $links]]);
    }

    /**
     * Email addresses of the chosen colleagues, in the order chosen.
     *
     * @param  string|null  $guestIds  null = the default of the signed-in user alone
     * @return list<string>
     */
    private function guestEmails(?string $guestIds): array
    {
        $ids = $guestIds === null
            ? [(int) user()->id]
            : array_values(array_unique(array_filter(array_map('intval', explode(',', $guestIds)))));

        if ($ids === []) {
            return [];
        }

        $emails = User::whereIn('id', $ids)->where('company_id', company()->id)->pluck('email', 'id');

        return collect($ids)->map(fn (int $id) => (string) ($emails[$id] ?? ''))->filter()->values()->all();
    }

    private function leadOfDeal(Deal $deal): ?Lead
    {
        return $deal->lead_id ? Lead::find($deal->lead_id) : null;
    }
}
