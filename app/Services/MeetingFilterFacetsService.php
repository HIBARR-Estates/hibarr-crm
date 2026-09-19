<?php

namespace App\Services;

use App\Models\DealFollowUp;
use Illuminate\Support\Facades\DB;

/**
 * Option counts shown beside each choice in the Meetings filter modal
 * ("Zoom 412"). One GROUP BY per dimension, always inside the caller's
 * meeting-visibility scope.
 *
 * ponytail: counts describe the whole visible set, not the currently-drafted
 * filter combination — recomputing per toggle would mean a round trip per
 * keystroke. Same trade-off, and same note, as LeadFilterFacetsService.
 */
class MeetingFilterFacetsService
{
    /**
     * @return array<string, mixed>
     */
    public function facets(int $userId): array
    {
        return [
            'total' => $this->scoped($userId)->count(),
            'meeting_type_id' => $this->countBy($userId, 'meeting_type_id'),
            'status' => $this->countBy($userId, 'status'),
            'location' => $this->countBy($userId, 'location'),
            'attendance' => $this->countBy($userId, 'attendance_outcome'),
            'host_id' => $this->countHosts($userId),
            'record_type' => $this->countRecordTypes($userId),
        ];
    }

    private function scoped(int $userId)
    {
        return MeetingVisibilityService::scopeVisibleToUser(
            DealFollowUp::query(),
            $userId
        );
    }

    /**
     * Counts keyed by column value, e.g. ['zoom' => 412, 'phone' => 88].
     *
     * @return array<string, int>
     */
    private function countBy(int $userId, string $column): array
    {
        return $this->scoped($userId)
            ->whereNotNull($column)
            ->groupBy($column)
            ->pluck(DB::raw('count(*) as aggregate'), $column)
            ->mapWithKeys(fn ($count, $value) => [(string) $value => (int) $count])
            ->all();
    }

    /**
     * The host filter matches the named host or, where none is set, whoever
     * booked the meeting — so the counts have to be grouped the same way or
     * they would not match the list the filter produces.
     *
     * @return array<string, int>
     */
    private function countHosts(int $userId): array
    {
        return $this->scoped($userId)
            ->selectRaw('COALESCE(host_id, added_by) as person_id, count(*) as aggregate')
            ->whereRaw('COALESCE(host_id, added_by) IS NOT NULL')
            ->groupBy('person_id')
            ->pluck('aggregate', 'person_id')
            ->mapWithKeys(fn ($count, $value) => [(string) $value => (int) $count])
            ->all();
    }

    /**
     * @return array<string, int>
     */
    private function countRecordTypes(int $userId): array
    {
        // Each scoped() call already returns its own fresh builder — nothing
        // shared to protect with a clone.
        $deals = $this->scoped($userId)->whereNotNull('deal_id')->count();
        $leads = $this->scoped($userId)
            ->whereNull('deal_id')
            ->whereNotNull('lead_id')
            ->count();

        return ['deal' => $deals, 'lead' => $leads];
    }
}
