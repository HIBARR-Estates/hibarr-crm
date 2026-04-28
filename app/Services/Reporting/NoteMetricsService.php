<?php

namespace App\Services\Reporting;

use App\Models\DealNote;
use App\Models\LeadNote;
use Carbon\Carbon;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

class NoteMetricsService
{
    public function count(?array $agentIds, Carbon $start, Carbon $end): int
    {
        return $this->dealNotesCount($agentIds, $start, $end)
            + $this->leadNotesCount($agentIds, $start, $end);
    }

    public function dealNotesCount(?array $agentIds, Carbon $start, Carbon $end): int
    {
        return DealNote::when($agentIds !== null, fn ($q) =>
                $q->whereHas('deal', fn ($dq) => $dq->whereIn('agent_id', $agentIds))
            )
            ->whereBetween('created_at', [$start->startOfDay(), $end->endOfDay()])
            ->count();
    }

    public function leadNotesCount(?array $agentIds, Carbon $start, Carbon $end): int
    {
        return LeadNote::when($agentIds !== null, fn ($q) =>
                $q->whereHas('lead', function ($lq) use ($agentIds) {
                    $lq->whereHas('deals', fn ($dq) => $dq->whereIn('agent_id', $agentIds));
                })
            )
            ->whereBetween('created_at', [$start->startOfDay(), $end->endOfDay()])
            ->count();
    }

    /**
     * Fetch concatenated note bodies for the AI summary engine.
     * Caps output at $maxChars to avoid extremely large LLM payloads.
     */
    public function getBodiesForAi(?array $agentIds, Carbon $start, Carbon $end, int $maxChars = 100000): string
    {
        $startOfDay = $start->copy()->startOfDay();
        $endOfDay   = $end->copy()->endOfDay();

        $dealNotesCollection = DealNote::when($agentIds !== null, fn ($q) =>
                $q->whereHas('deal', fn ($dq) => $dq->whereIn('agent_id', $agentIds))
            )
            ->whereBetween('created_at', [$startOfDay, $endOfDay])
            ->pluck('details')
            ->filter()
            ->values();

        $leadNotesCollection = LeadNote::when($agentIds !== null, fn ($q) =>
                $q->whereHas('lead', function ($lq) use ($agentIds) {
                    $lq->whereHas('deals', fn ($dq) => $dq->whereIn('agent_id', $agentIds));
                })
            )
            ->whereBetween('created_at', [$startOfDay, $endOfDay])
            ->pluck('details')
            ->filter()
            ->values();

        \Illuminate\Support\Facades\Log::debug('AI Summary getBodiesForAi', [
            'agent_ids'        => $agentIds,
            'start'            => $startOfDay->toDateTimeString(),
            'end'              => $endOfDay->toDateTimeString(),
            'deal_notes_count' => $dealNotesCollection->count(),
            'lead_notes_count' => $leadNotesCollection->count(),
        ]);

        $parts = [];

        if ($dealNotesCollection->isNotEmpty()) {
            $parts[] = $dealNotesCollection->implode("\n---\n");
        }

        if ($leadNotesCollection->isNotEmpty()) {
            $parts[] = $leadNotesCollection->implode("\n---\n");
        }

        $combined = implode("\n---\n", $parts);

        if (mb_strlen($combined) > $maxChars) {
            $combined = mb_substr($combined, 0, $maxChars) . "\n\n[Truncated — exceeded {$maxChars} character limit]";
        }

        return $combined;
    }

    public function listDealNotes(?array $agentIds, Carbon $start, Carbon $end, int $perPage = 15): LengthAwarePaginator
    {
        return DealNote::when($agentIds !== null, fn ($q) =>
                $q->whereHas('deal', fn ($dq) => $dq->whereIn('agent_id', $agentIds))
            )
            ->whereBetween('created_at', [$start->startOfDay(), $end->endOfDay()])
            ->with([
                'deal:id,name,lead_id,agent_id',
                'deal.contact:id,client_name',
                'deal.leadAgent.user:id,name',
                'addedBy:id,name',
            ])
            ->select(['id', 'title', 'details', 'deal_id', 'added_by', 'created_at'])
            ->orderByDesc('created_at')
            ->paginate($perPage);
    }

    public function listLeadNotes(?array $agentIds, Carbon $start, Carbon $end, int $perPage = 15): LengthAwarePaginator
    {
        return LeadNote::when($agentIds !== null, fn ($q) =>
                $q->whereHas('lead', function ($lq) use ($agentIds) {
                    $lq->whereHas('deals', fn ($dq) => $dq->whereIn('agent_id', $agentIds));
                })
            )
            ->whereBetween('created_at', [$start->startOfDay(), $end->endOfDay()])
            ->with([
                'lead:id,client_name',
                'addedBy:id,name',
            ])
            ->select(['id', 'title', 'details', 'lead_id', 'added_by', 'created_at'])
            ->orderByDesc('created_at')
            ->paginate($perPage);
    }
}
