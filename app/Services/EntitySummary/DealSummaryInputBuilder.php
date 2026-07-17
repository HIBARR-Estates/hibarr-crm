<?php

namespace App\Services\EntitySummary;

use App\Models\Deal;
use App\Models\DealFile;
use App\Models\DealFollowUp;
use App\Models\DealHistory;
use App\Models\DealNote;
use App\Models\PipelineStage;
use Carbon\Carbon;
use Illuminate\Support\Str;

class DealSummaryInputBuilder
{
    /**
     * @return array<string, mixed>
     */
    public function build(Deal $deal): array
    {
        $deal->loadMissing([
            'leadStage',
            'currency',
            'leadAgent.user',
            'pipeline',
            'category',
            'contact',
            'packages',
            'products',
        ]);

        $now = Carbon::now()->toIso8601String();
        $currentStage = $deal->leadStage;
        $stageLabel = $currentStage?->name ?? 'Unknown';
        $currentStageKey = $currentStage?->slug
            ?? ($currentStage ? Str::slug($currentStage->name ?? 'unknown') : 'unknown');

        $payload = [
            'now' => $now,
            'pipeline' => $this->buildPipeline($deal, $currentStageKey),
            'deal' => [
                'name' => $deal->name,
                'value' => (float) ($deal->value ?? 0),
                'currency' => $deal->currency?->currency_code ?? 'USD',
                'category' => $deal->category?->category_name,
                'package' => $deal->packages->first()?->name,
                'close_date' => $deal->close_date
                    ? Carbon::parse($deal->close_date)->toIso8601String()
                    : null,
                'created_at' => $deal->created_at?->toIso8601String(),
                'updated_at' => $deal->updated_at?->toIso8601String(),
                'owner' => $deal->leadAgent?->user?->name,
                'lead_contact' => $deal->contact?->client_name,
            ],
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
        }

        $products = $deal->products;
        if ($products->isNotEmpty()) {
            $sections['properties'] = $products->map(fn ($product) => [
                'type' => $product->name,
                'price' => (float) ($product->price ?? 0),
                'status' => 'Available',
            ])->values()->all();
        }

        $files = DealFile::where('deal_id', $deal->id)
            ->orderByDesc('created_at')
            ->limit(10)
            ->get();

        if ($files->isNotEmpty()) {
            $sections['documents'] = $files->map(fn ($file) => [
                'type' => $file->filename,
                'status' => 'received',
                'requested_at' => $file->created_at?->toIso8601String(),
            ])->values()->all();
        }

        $histories = DealHistory::where('deal_id', $deal->id)
            ->with('user:id,name')
            ->orderByDesc('created_at')
            ->limit(15)
            ->get();

        if ($histories->isNotEmpty()) {
            $sections['activity'] = $histories->map(function ($history) {
                $eventType = (string) ($history->event_type ?? 'update');
                $isSystem = in_array($eventType, ['follow-up-created', 'follow_up_created', 'system'], true);

                return [
                    'type' => $isSystem ? 'system' : 'agent',
                    'label' => $this->formatHistoryLabel($eventType),
                    'actor' => $history->user?->name ?? 'System',
                    'timestamp' => $history->created_at?->toIso8601String(),
                ];
            })->values()->all();
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
            'close_date' => $deal->close_date,
            'notes_count' => DealNote::where('deal_id', $deal->id)->count(),
            'tasks_count' => $deal->tasks()->count(),
            'followups_count' => DealFollowUp::where('deal_id', $deal->id)->count(),
            'files_count' => DealFile::where('deal_id', $deal->id)->count(),
            'history_count' => DealHistory::where('deal_id', $deal->id)->count(),
        ];

        return hash('sha256', json_encode($fingerprint));
    }

    /**
     * @return array<string, mixed>
     */
    private function buildPipeline(Deal $deal, string $currentStageKey): array
    {
        $stages = PipelineStage::query()
            ->where('lead_pipeline_id', $deal->lead_pipeline_id)
            ->orderBy('priority')
            ->get();

        return [
            'name' => $deal->pipeline?->name ?? 'Pipeline',
            'stages' => $stages->map(fn ($stage, $index) => [
                'key' => $stage->slug ?? Str::slug($stage->name ?? "stage-{$stage->id}"),
                'label' => $stage->name ?? 'Stage',
                'order' => $stage->priority ?? ($index + 1),
                'meaning' => $this->stageMeaning($stage->name ?? 'this stage'),
            ])->values()->all(),
            'current_stage_key' => $currentStageKey,
        ];
    }

    private function stageMeaning(string $stageLabel): string
    {
        return "At the {$stageLabel} stage, progress is expected from direct agent engagement and documented follow-up activity.";
    }

    private function formatHistoryLabel(string $eventType): string
    {
        return Str::title(str_replace(['_', '-'], ' ', $eventType));
    }

    /**
     * @return list<array{key: string, label: string}>
     */
    private function dealActionTaxonomy(): array
    {
        return [
            ['key' => 'CREATE_TASK', 'label' => 'Create task'],
            ['key' => 'SCHEDULE_CALL', 'label' => 'Schedule call'],
            ['key' => 'REQUEST_DOCUMENTS', 'label' => 'Request documents'],
            ['key' => 'SEND_FOLLOWUP_EMAIL', 'label' => 'Send follow-up email'],
            ['key' => 'ADVANCE_STAGE', 'label' => 'Move to next stage'],
            ['key' => 'ESCALATE_TO_MANAGER', 'label' => 'Escalate to manager'],
            ['key' => 'REVIEW_STALE_DEAL', 'label' => 'Review stale deal'],
            ['key' => 'NO_ACTION_NEEDED', 'label' => 'No action needed'],
        ];
    }
}
