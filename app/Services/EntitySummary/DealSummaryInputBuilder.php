<?php

namespace App\Services\EntitySummary;

use App\Models\Deal;
use App\Models\DealFollowUp;
use App\Models\DealNote;
use Carbon\Carbon;

class DealSummaryInputBuilder
{
    /**
     * @return array<string, mixed>
     */
    public function build(Deal $deal): array
    {
        $deal->loadMissing(['leadStage', 'currency', 'leadAgent.user']);

        $now = Carbon::now()->toIso8601String();
        $stageLabel = $deal->leadStage?->name ?? 'Unknown';

        $payload = [
            'now' => $now,
            'deal' => [
                'deal_id' => (string) $deal->id,
                'deal_name' => $deal->name,
                'value' => (float) ($deal->value ?? 0),
                'currency' => $deal->currency?->currency_code ?? 'USD',
                'stage_label' => $stageLabel,
                'created_at' => $deal->created_at?->toIso8601String(),
                'updated_at' => $deal->updated_at?->toIso8601String(),
                'owner' => $deal->leadAgent?->user?->name,
            ],
            'stage' => [
                'label' => $stageLabel,
                'meaning' => $this->stageMeaning($stageLabel),
            ],
            'sections' => [],
            'action_taxonomy' => $this->dealActionTaxonomy(),
        ];

        $sections = [];

        $notes = DealNote::where('deal_id', $deal->id)
            ->with('addedBy:id,name')
            ->orderByDesc('created_at')
            ->limit(10)
            ->get();

        if ($notes->isNotEmpty()) {
            $sections['notes'] = $notes->map(fn ($note) => [
                'author' => $note->addedBy?->name,
                'created_at' => $note->created_at?->toIso8601String(),
                'excerpt' => mb_substr(strip_tags((string) $note->details), 0, 200),
            ])->values()->all();
        }

        $tasks = $deal->tasks()
            ->with(['users:id,name', 'boardColumn:id,column_name'])
            ->orderByDesc('created_at')
            ->limit(10)
            ->get();

        if ($tasks->isNotEmpty()) {
            $sections['tasks'] = $tasks->map(fn ($task) => [
                'title' => $task->heading,
                'status' => $task->boardColumn?->column_name ?? 'open',
                'due_at' => $task->due_date?->toIso8601String(),
                'assignee' => $task->users->first()?->name,
            ])->values()->all();
        }

        $followUps = DealFollowUp::where('deal_id', $deal->id)
            ->orderByDesc('next_follow_up_date')
            ->limit(10)
            ->get();

        if ($followUps->isNotEmpty()) {
            $sections['meetings'] = $followUps->map(fn ($f) => [
                'title' => $f->remark ?? 'Follow-up',
                'scheduled_at' => $f->next_follow_up_date?->toIso8601String(),
                'status' => $f->status ?? 'scheduled',
            ])->values()->all();

            $sections['follow_ups'] = $followUps->map(fn ($f) => [
                'next_follow_up_date' => $f->next_follow_up_date?->toIso8601String(),
                'remark' => $f->remark,
            ])->values()->all();
        }

        if ($sections !== []) {
            $payload['sections'] = $sections;
        }

        return $payload;
    }

    public function inputHash(Deal $deal): string
    {
        $deal->loadMissing(['leadStage']);

        $fingerprint = [
            'id' => $deal->id,
            'stage' => $deal->pipeline_stage_id,
            'value' => $deal->value,
            'updated_at' => $deal->updated_at?->toIso8601String(),
            'notes_count' => DealNote::where('deal_id', $deal->id)->count(),
            'tasks_count' => $deal->tasks()->count(),
            'followups_count' => DealFollowUp::where('deal_id', $deal->id)->count(),
        ];

        return hash('sha256', json_encode($fingerprint));
    }

    private function stageMeaning(string $stageLabel): string
    {
        return "At the {$stageLabel} stage, progress is expected from direct agent engagement and documented follow-up activity.";
    }

    /**
     * @return list<array{key: string, label: string}>
     */
    private function dealActionTaxonomy(): array
    {
        return [
            ['key' => 'SCHEDULE_CALL', 'label' => 'Schedule call'],
            ['key' => 'SEND_FOLLOWUP_EMAIL', 'label' => 'Send follow-up email'],
            ['key' => 'REQUEST_DOCUMENTS', 'label' => 'Request documents'],
            ['key' => 'ESCALATE_TO_MANAGER', 'label' => 'Escalate to manager'],
            ['key' => 'NO_ACTION_NEEDED', 'label' => 'No action needed'],
        ];
    }
}
