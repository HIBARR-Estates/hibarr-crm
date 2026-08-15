<?php

namespace App\Services\EntitySummary;

use App\Models\Deal;
use App\Models\DealFollowUp;
use App\Models\Lead;
use App\Models\LeadNote;
use Carbon\Carbon;

class LeadSummaryInputBuilder
{
    public function __construct(
        private DealSummarySnapshotService $dealSnapshotService,
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function build(Lead $lead): array
    {
        $lead->loadMissing([
            'leadOwner',
            'addedBy',
            'leadSource',
            'category',
            'lifecycleStatus',
            'marketing',
        ]);

        $now = Carbon::now()->toIso8601String();
        $leadName = trim(implode(' ', array_filter([
            $lead->salutation ? ucfirst((string) $lead->salutation) : null,
            $lead->client_name,
        ])));

        $payload = [
            'now' => $now,
            'lead' => [
                'name' => $leadName ?: "Lead #{$lead->id}",
                'type' => $this->resolveLeadType($lead),
                'source' => $lead->leadSource?->type ?? null,
                'category' => $lead->category?->category_name ?? null,
                'created_at' => $lead->created_at?->toIso8601String(),
                'updated_at' => $lead->updated_at?->toIso8601String(),
                'owner' => $lead->leadOwner?->name,
                'added_by' => $lead->addedBy?->name,
            ],
            'qualification' => $this->buildQualification($lead),
            'sections' => [],
            'action_taxonomy' => $this->leadActionTaxonomy(),
        ];

        $sections = [];

        $preferredContactTimes = $lead->resolvedPreferredContactTimes();
        if ($lead->client_email || $lead->mobile || $lead->cell || $lead->office || $preferredContactTimes !== []) {
            $sections['contact'] = [
                'email' => $lead->client_email ?: null,
                'mobile' => $lead->mobile ?: $lead->cell,
                'office_phone' => $lead->office,
                'preferred_contact_time' => collect($preferredContactTimes)
                    ->map(fn (string $value) => \App\Enums\PreferredContactTime::tryFrom($value)?->label() ?? $value)
                    ->implode(', '),
            ];
        }

        $personal = array_filter([
            'gender' => $lead->gender?->value ?? $lead->gender_value,
            'languages' => is_array($lead->languages) ? implode(', ', $lead->languages) : $lead->languages,
            'date_of_birth' => $lead->date_of_birth?->format('Y-m-d') ?? $lead->date_of_birth,
            'nationality' => $lead->nationality,
            'occupation' => $lead->occupation,
            'company' => $lead->company_name,
        ], fn ($v) => $v !== null && $v !== '');

        if ($personal !== []) {
            $sections['personal_details'] = $personal;
        }

        $deals = Deal::where('lead_id', $lead->id)->get();
        if ($deals->isNotEmpty()) {
            $sections['deals'] = $deals
                ->map(fn (Deal $deal) => $this->dealSnapshotService->getOrGenerate($deal))
                ->values()
                ->all();
        }

        $marketing = $this->buildMarketingSection($lead);
        if ($marketing !== null) {
            $sections['marketing'] = $marketing;
        }

        $followUps = DealFollowUp::where('lead_id', $lead->id)
            ->orderByDesc('next_follow_up_date')
            ->limit(10)
            ->get();

        if ($followUps->isNotEmpty()) {
            $sections['meetings'] = $followUps->map(fn ($f) => [
                'title' => $f->remark ?? 'Meeting',
                'scheduled_at' => $f->next_follow_up_date?->toIso8601String(),
                'status' => $f->status ?? 'scheduled',
            ])->values()->all();
        }

        $tasks = $lead->tasks()
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

        $notes = LeadNote::where('lead_id', $lead->id)
            ->with('addedBy:id,name')
            ->orderByDesc('created_at')
            ->limit(10)
            ->get();

        if ($notes->isNotEmpty()) {
            $sections['notes'] = $notes->map(function ($note) {
                $details = is_string($note->details) ? $note->details : (string) ($note->details ?? '');
                // Cap BEFORE strip_tags — unbounded note HTML OOMs during sanitize.
                if ($details !== '' && strlen($details) > 5000) {
                    $details = substr($details, 0, 5000);
                }

                return [
                    'author' => $note->addedBy?->name,
                    'created_at' => $note->created_at?->toIso8601String(),
                    'excerpt' => mb_substr(strip_tags($details), 0, 200),
                ];
            })->values()->all();
        }

        if ($sections !== []) {
            $payload['sections'] = $sections;
        }

        return $payload;
    }

    public function inputHash(Lead $lead): string
    {
        $fingerprint = [
            'id' => $lead->id,
            'updated_at' => $lead->updated_at?->toIso8601String(),
            'lifecycle' => $lead->lead_lifecycle_status_id,
            'lead_owner' => $lead->lead_owner,
            'source_id' => $lead->source_id,
            'category_id' => $lead->category_id,
            'deals_count' => Deal::where('lead_id', $lead->id)->count(),
            'deals_max_updated_at' => Deal::where('lead_id', $lead->id)->max('updated_at'),
            'notes_count' => LeadNote::where('lead_id', $lead->id)->count(),
            'notes_max_updated_at' => LeadNote::where('lead_id', $lead->id)->max('updated_at'),
            'tasks_count' => $lead->tasks()->count(),
            'tasks_max_updated_at' => $lead->tasks()->max('tasks.updated_at'),
            'followups_count' => DealFollowUp::where('lead_id', $lead->id)->count(),
            'followups_max_updated_at' => DealFollowUp::where('lead_id', $lead->id)->max('updated_at'),
        ];

        return hash('sha256', json_encode($fingerprint));
    }

    /**
     * @return array{status: string, meaning: string}|null
     */
    private function buildQualification(Lead $lead): ?array
    {
        $status = $lead->lifecycleStatus;

        if (! $status) {
            return null;
        }

        return [
            'status' => $status->label,
            'meaning' => $status->description ?? "Status: {$status->label}.",
        ];
    }

    /**
     * @return array<string, mixed>|null
     */
    private function buildMarketingSection(Lead $lead): ?array
    {
        $marketing = $lead->marketing;

        if (! $marketing) {
            return null;
        }

        $campaigns = [];

        if ($marketing->utm_campaign || $marketing->utm_source) {
            $campaigns[] = [
                'name' => $marketing->utm_campaign ?? 'Campaign',
                'channel' => $marketing->utm_source ?? $marketing->utm_medium ?? 'Unknown',
                'converted_at' => $lead->created_at?->toIso8601String(),
            ];
        }

        if ($campaigns === []) {
            return null;
        }

        $lastEngagement = $lead->created_at?->toIso8601String();

        if ($marketing->last_webinar_date) {
            $lastEngagement = Carbon::parse($marketing->last_webinar_date)->toIso8601String();
        }

        return [
            'campaigns' => $campaigns,
            'last_engagement_at' => $lastEngagement,
        ];
    }

    private function resolveLeadType(Lead $lead): string
    {
        $category = strtolower((string) ($lead->category?->category_name ?? ''));

        if (str_contains($category, 'seller')) {
            return 'seller';
        }

        if (str_contains($category, 'partner')) {
            return 'partner';
        }

        if (str_contains($category, 'agent')) {
            return 'agent';
        }

        return 'buyer';
    }

    /**
     * @return list<array{key: string, label: string}>
     */
    private function leadActionTaxonomy(): array
    {
        return [
            ['key' => 'CONTACT_LEAD', 'label' => 'Contact lead'],
            ['key' => 'SCHEDULE_CALL', 'label' => 'Schedule call'],
            ['key' => 'SEND_FOLLOWUP_EMAIL', 'label' => 'Send follow-up email'],
            ['key' => 'QUALIFY_LEAD', 'label' => 'Move qualification forward'],
            ['key' => 'REQUEST_MISSING_INFO', 'label' => 'Request missing information'],
            ['key' => 'OPEN_DEAL', 'label' => 'Open linked deal'],
            ['key' => 'REVIEW_DEALS', 'label' => 'Review at-risk deals'],
            ['key' => 'ESCALATE_TO_MANAGER', 'label' => 'Escalate to manager'],
            ['key' => 'NO_ACTION_NEEDED', 'label' => 'No action needed'],
        ];
    }
}
