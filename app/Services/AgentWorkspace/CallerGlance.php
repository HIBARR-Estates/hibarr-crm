<?php

namespace App\Services\AgentWorkspace;

use App\Models\CrmEvent;
use App\Models\Deal;
use App\Models\DealFollowUp;
use App\Models\Lead;
use App\Models\User;

/**
 * What an agent wants to know the moment a known lead rings in: where the lead
 * stands, the open deal, the next meeting and the last touch. Built from the
 * data the lead and deal pages already hold; the caller checks that the viewer
 * may open the lead before using it.
 */
class CallerGlance
{
    public function __construct(private ContactDeals $contactDeals) {}

    /**
     * @return array{
     *     status: array{label: string, color: string|null}|null,
     *     deal: array{stage: string|null, stage_color: string|null, value: float|null, currency: string|null}|null,
     *     next_meeting: array{title: string|null, at: string}|null,
     *     last_touch_at: string|null
     * }
     */
    public function forLead(Lead $lead, User $viewer): array
    {
        $status = $lead->lifecycleStatus;

        // Open deals the viewer may see come first in forLead(); the first that is still open.
        $open = collect($this->contactDeals->forLead((int) $lead->id, $viewer))->first(fn (array $deal) => $deal['outcome'] === null);
        $deal = null;
        if ($open !== null) {
            $row = Deal::query()->with('currency:id,currency_symbol')->find($open['id']);
            $deal = [
                'stage' => $open['stage'],
                'stage_color' => $open['stage_color'],
                'value' => $row?->value !== null ? (float) $row->value : null,
                'currency' => $row?->currency?->currency_symbol,
            ];
        }

        $meeting = DealFollowUp::query()
            ->where(fn ($query) => $query
                ->where('lead_id', $lead->id)
                ->orWhereHas('deal', fn ($deal) => $deal->where('lead_id', $lead->id)))
            ->where('next_follow_up_date', '>=', now())
            ->where('next_follow_up_date', '<=', now()->addDays(2))
            ->visibleToUser((int) $viewer->id)
            ->with('meetingType:id,name')
            ->orderBy('next_follow_up_date')
            ->first();

        $touch = CrmEvent::query()
            ->where('model_type', Lead::class)
            ->where('model_id', $lead->id)
            ->where('occurred_at', '<=', now())
            ->max('occurred_at');

        return [
            'status' => $status ? ['label' => $status->label, 'color' => $status->label_color] : null,
            'deal' => $deal,
            'next_meeting' => $meeting
                ? ['title' => $meeting->meetingType?->name, 'at' => $meeting->next_follow_up_date->toIso8601String()]
                : null,
            'last_touch_at' => $touch ? \Carbon\Carbon::parse($touch, config('app.timezone'))->toIso8601String() : null,
        ];
    }
}
