<?php

namespace App\Services\EntitySummary;

use App\Models\Deal;
use App\Models\DealFile;
use App\Models\DealFollowUp;
use App\Models\DealHistory;
use App\Models\DealNote;
use App\Models\LeadFlightItinerary;
use App\Models\PipelineStage;
use Carbon\Carbon;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class DealSummaryInputBuilder
{
    private const DATE_FORMAT = 'l, F j, Y';

    private const DATETIME_FORMAT = 'l, F j, Y \a\t g:i A';

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
            'hibarrFields',
        ]);

        $timezone = $this->resolveViewerTimezone();
        $now = Carbon::now($timezone);
        $viewer = Auth::user();
        $ownerUser = $deal->leadAgent?->user;
        $ownerName = $ownerUser?->name;

        $currentStage = $deal->leadStage;
        $currentStageKey = $currentStage?->slug
            ?? ($currentStage ? Str::slug($currentStage->name ?? 'unknown') : 'unknown');

        $currencyCode = $deal->currency?->currency_code;
        // Never invent a currency — omit/null when the deal has none set.

        $payload = [
            'now' => $this->formatDateTime($now, $timezone),
            'viewer' => [
                'name' => $viewer?->name,
                'timezone' => $timezone,
                'is_deal_owner' => $viewer !== null
                    && $ownerUser !== null
                    && (int) $viewer->id === (int) $ownerUser->id,
            ],
            'pipeline' => $this->buildPipeline($deal, $currentStageKey),
            'deal' => [
                'name' => $deal->name,
                // Displayed worth only — same number the UI shows. No manual/calculated split.
                'value' => (float) ($deal->value ?? 0),
                'currency' => $currencyCode ?: null,
                'category' => $deal->category?->category_name,
                'packages' => $deal->packages->map(fn ($package) => [
                    'name' => $package->name,
                    'value' => (float) ($package->value ?? 0),
                ])->values()->all(),
                'close_date' => $deal->close_date
                    ? $this->formatDate(Carbon::parse($deal->close_date), $timezone)
                    : null,
                'created_at' => $this->formatDateTime($deal->created_at, $timezone),
                'updated_at' => $this->formatDateTime($deal->updated_at, $timezone),
                'owner' => $ownerName,
                'lead_contact' => $deal->contact?->client_name,
            ],
            'action_taxonomy' => $this->dealActionTaxonomy(),
        ];

        $sections = [];

        $customFields = $this->buildCustomFields($deal);
        if ($customFields !== []) {
            $sections['custom_fields'] = $customFields;
        }

        $hibarrFields = $this->buildHibarrFields($deal, $timezone);
        if ($hibarrFields !== []) {
            $sections['hibarr_fields'] = $hibarrFields;
        }

        $notes = DealNote::where('deal_id', $deal->id)
            ->with('addedBy:id,name')
            ->orderByDesc('created_at')
            ->limit(10)
            ->get();

        if ($notes->isNotEmpty()) {
            $sections['notes'] = $notes->map(fn ($note) => [
                'author' => $note->addedBy?->name,
                'created_at' => $this->formatDateTime($note->created_at, $timezone),
                'excerpt' => mb_substr(strip_tags((string) $note->details), 0, 200),
            ])->values()->all();
        }

        $tasks = $deal->tasks()
            ->with(['users:id,name', 'boardColumn:id,column_name,slug'])
            ->orderByDesc('created_at')
            ->limit(20)
            ->get();

        if ($tasks->isNotEmpty()) {
            $nowCarbon = Carbon::now($timezone);
            $mappedTasks = $tasks->map(function ($task) use ($nowCarbon, $timezone) {
                $slug = $task->boardColumn?->slug;
                $isCompleted = $slug === 'done';
                $dueAt = $task->due_date;

                return [
                    'title' => $task->heading,
                    'status' => $task->boardColumn?->column_name ?? 'open',
                    'due_at' => $this->formatDateTime($dueAt, $timezone),
                    'assignee' => $task->users->first()?->name,
                    'is_open' => ! $isCompleted,
                    'is_completed' => $isCompleted,
                    'is_overdue' => ! $isCompleted && $dueAt !== null && $dueAt->lt($nowCarbon),
                    'completed_at' => $isCompleted
                        ? $this->formatDateTime($task->updated_at, $timezone)
                        : null,
                    'completed_at_raw' => $isCompleted ? $task->updated_at : null,
                ];
            })->values();

            $sections['tasks'] = $mappedTasks->map(fn ($task) => [
                'title' => $task['title'],
                'status' => $task['status'],
                'due_at' => $task['due_at'],
                'assignee' => $task['assignee'],
                'is_open' => $task['is_open'],
                'is_completed' => $task['is_completed'],
            ])->all();

            $recentCutoff = $nowCarbon->copy()->subDays(14);
            $sections['task_rollup'] = [
                'open_count' => $mappedTasks->where('is_open', true)->count(),
                'completed_count' => $mappedTasks->where('is_completed', true)->count(),
                'recently_completed_count' => $mappedTasks
                    ->filter(fn ($task) => $task['is_completed']
                        && $task['completed_at_raw']
                        && Carbon::parse($task['completed_at_raw'])->gte($recentCutoff))
                    ->count(),
                'overdue_open_count' => $mappedTasks->where('is_overdue', true)->count(),
            ];
        }

        $followUps = DealFollowUp::where('deal_id', $deal->id)
            ->orderByDesc('next_follow_up_date')
            ->limit(10)
            ->get();

        if ($followUps->isNotEmpty()) {
            $sections['meetings'] = $followUps->map(fn ($f) => [
                'title' => $f->remark ?? 'Follow-up',
                'scheduled_at' => $this->formatDateTime($f->next_follow_up_date, $timezone),
                'status' => $f->status ?? 'scheduled',
            ])->values()->all();
        }

        $products = $deal->products;
        if ($products->isNotEmpty()) {
            $sections['properties'] = $products->map(fn ($product) => [
                'type' => $product->name,
                'price' => (float) ($product->price ?? 0),
                'status' => 'linked',
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
                'ready' => true,
                'requested_at' => $this->formatDateTime($file->created_at, $timezone),
            ])->values()->all();
        }

        $itineraries = LeadFlightItinerary::where('deal_id', $deal->id)
            ->orderByDesc('flight_date')
            ->limit(10)
            ->get();

        if ($itineraries->isNotEmpty()) {
            $sections['itineraries'] = $itineraries->map(fn ($item) => [
                'direction' => $item->direction,
                'airport_name' => $item->airport_name,
                'flight_number' => $item->flight_number,
                'flight_date' => $this->formatDateTime($item->flight_date, $timezone),
                'status' => $item->status,
                'ticket_ready' => ! empty($item->ticket_image_url),
            ])->values()->all();
        }

        $histories = DealHistory::where('deal_id', $deal->id)
            ->with('user:id,name')
            ->orderByDesc('created_at')
            ->limit(15)
            ->get();

        if ($histories->isNotEmpty()) {
            $sections['activity'] = $histories->map(function ($history) use ($timezone) {
                $eventType = (string) ($history->event_type ?? 'update');
                $isSystem = in_array($eventType, ['follow-up-created', 'follow_up_created', 'system'], true);

                return [
                    'type' => $isSystem ? 'system' : 'agent',
                    'label' => $this->formatHistoryLabel($eventType),
                    'actor' => $history->user?->name ?? 'System',
                    'timestamp' => $this->formatDateTime($history->created_at, $timezone),
                ];
            })->values()->all();
        }

        if ($sections !== []) {
            $payload['sections'] = $sections;
        }

        return $payload;
    }

    /**
     * Stable fingerprint of deal state used for cache invalidation.
     * Excludes wall-clock "now" so identical CRM state keeps the same hash.
     */
    public function inputHash(Deal $deal): string
    {
        $deal->loadMissing(['packages', 'products', 'hibarrFields']);

        $hibarrUpdatedAt = $deal->hibarrFields?->updated_at?->toIso8601String();

        $customFieldsHash = hash('sha256', DB::table('custom_fields_data')
            ->where('model', Deal::CUSTOM_FIELD_MODEL)
            ->where('model_id', $deal->id)
            ->orderBy('custom_field_id')
            ->pluck('value', 'custom_field_id')
            ->toJson());

        $itineraryFingerprint = LeadFlightItinerary::where('deal_id', $deal->id)
            ->orderBy('id')
            ->get(['id', 'status', 'flight_date', 'ticket_image_url'])
            ->toJson();

        $fingerprint = [
            'id' => $deal->id,
            'deal_updated_at' => $deal->updated_at?->toIso8601String(),
            'stage' => $deal->pipeline_stage_id,
            'value' => $deal->value,
            'close_date' => $deal->close_date
                ? Carbon::parse($deal->close_date)->format('Y-m-d')
                : null,
            'agent_id' => $deal->agent_id,
            'category_id' => $deal->category_id,
            'lead_id' => $deal->lead_id,
            'package_ids' => $deal->packages->pluck('id')->sort()->values()->all(),
            'product_ids' => $deal->products->pluck('id')->sort()->values()->all(),
            'notes_count' => DealNote::where('deal_id', $deal->id)->count(),
            'notes_max_updated_at' => DealNote::where('deal_id', $deal->id)->max('updated_at'),
            'tasks_count' => $deal->tasks()->count(),
            'tasks_max_updated_at' => $deal->tasks()->max('tasks.updated_at'),
            'followups_count' => DealFollowUp::where('deal_id', $deal->id)->count(),
            'followups_max_updated_at' => DealFollowUp::where('deal_id', $deal->id)->max('updated_at'),
            'files_count' => DealFile::where('deal_id', $deal->id)->count(),
            'files_max_id' => DealFile::where('deal_id', $deal->id)->max('id'),
            'history_count' => DealHistory::where('deal_id', $deal->id)->count(),
            'history_max_id' => DealHistory::where('deal_id', $deal->id)->max('id'),
            'hibarr_updated_at' => $hibarrUpdatedAt,
            'custom_fields_hash' => $customFieldsHash,
            'itineraries_hash' => hash('sha256', $itineraryFingerprint),
            // Invalidate when the generating user's timezone changes so dates reformat.
            'viewer_timezone' => $this->resolveViewerTimezone(),
        ];

        return hash('sha256', json_encode($fingerprint));
    }

    private function resolveViewerTimezone(): string
    {
        $userTz = Auth::user()?->timezone;
        if (is_string($userTz) && $userTz !== '') {
            return $userTz;
        }

        if (function_exists('company')) {
            $companyTz = company()?->timezone ?? null;
            if (is_string($companyTz) && $companyTz !== '') {
                return $companyTz;
            }
        }

        return (string) config('app.timezone', 'UTC');
    }

    private function formatDateTime(mixed $value, string $timezone): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }

        return Carbon::parse($value)->timezone($timezone)->format(self::DATETIME_FORMAT);
    }

    private function formatDate(mixed $value, string $timezone): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }

        return Carbon::parse($value)->timezone($timezone)->format(self::DATE_FORMAT);
    }

    /**
     * @return list<array{label: string, name: string, type: string, value: string}>
     */
    private function buildCustomFields(Deal $deal): array
    {
        if (! $deal->id) {
            return [];
        }

        $rows = DB::table('custom_fields')
            ->join('custom_field_groups', 'custom_fields.custom_field_group_id', '=', 'custom_field_groups.id')
            ->join('custom_fields_data', function ($join) use ($deal) {
                $join->on('custom_fields_data.custom_field_id', '=', 'custom_fields.id')
                    ->where('custom_fields_data.model', '=', Deal::CUSTOM_FIELD_MODEL)
                    ->where('custom_fields_data.model_id', '=', $deal->id);
            })
            ->where('custom_field_groups.model', Deal::CUSTOM_FIELD_MODEL)
            ->whereNotNull('custom_fields_data.value')
            ->where('custom_fields_data.value', '!=', '')
            ->orderBy('custom_fields.display_order')
            ->select([
                'custom_fields.label',
                'custom_fields.name',
                'custom_fields.type',
                'custom_fields_data.value',
            ])
            ->get();

        return $rows->map(fn ($row) => [
            'label' => (string) $row->label,
            'name' => (string) $row->name,
            'type' => (string) $row->type,
            'value' => is_string($row->value) ? $row->value : json_encode($row->value),
        ])->values()->all();
    }

    /**
     * @return array<string, mixed>
     */
    private function buildHibarrFields(Deal $deal, string $timezone): array
    {
        $hibarr = $deal->hibarrFields;
        if (! $hibarr) {
            return [];
        }

        $fields = array_filter([
            'interested_in' => $hibarr->interested_in,
            'motivation' => $hibarr->motivation,
            'purchase_timeline' => $hibarr->purchase_timeline,
            'budget_range' => $hibarr->budget_range,
            'message' => $hibarr->message,
            'strategy_meeting_booked' => $hibarr->strategy_meeting_booked,
            'downpayment_paid' => $hibarr->downpayment_paid,
            'inspection_trip_date' => $hibarr->inspection_trip_date
                ? $this->formatDate(Carbon::parse($hibarr->inspection_trip_date), $timezone)
                : null,
            'deposit_confirmation' => $hibarr->deposit_confirmation ? 'present' : null,
            'reservation_agreement' => $hibarr->reservation_agreement ? 'present' : null,
            'sales_contract' => $hibarr->sales_contract ? 'present' : null,
        ], fn ($value) => $value !== null && $value !== '');

        return $fields;
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
