<?php

namespace App\Services\EntitySummary;

use App\Enums\PreferredContactTime;
use App\Enums\QualificationStatus;
use App\Models\Deal;
use App\Models\DealFollowUp;
use App\Models\HibarrDealFields;
use App\Models\Lead;
use App\Models\LeadNote;
use App\Models\LeadQualification;
use App\Models\LeadQualificationAnswer;
use Carbon\Carbon;
use Carbon\CarbonInterface;
use Illuminate\Support\Facades\DB;

/**
 * Builds the JSON the lead-summary agent reads (see lead-summary-agent-prompt.md,
 * "INPUT YOU WILL RECEIVE" — the two are a contract; change them together).
 *
 * The payload is designed around one question: what do we actually know about
 * this lead? So it carries substance (qualification answers, lead details,
 * notes, buying intent from linked deals) and deliberately carries NO personal
 * identifiers — no name, email, phone, date of birth, address or company. Free
 * text is passed through LeadSummaryRedactor because people type contact
 * details into notes and answers.
 */
class LeadSummaryInputBuilder
{
    private const MAX_NOTES = 10;

    private const NOTE_CHARS = 600;

    private const MAX_QUALIFICATION_CALLS = 2;

    private const MAX_ANSWERS_PER_CALL = 40;

    private const MAX_LEAD_DETAILS = 25;

    /** Custom-field labels that hold identifiers or contact data rather than context. */
    private const SENSITIVE_FIELD_LABEL = '/passport|national\s*id|identity|\bid\s*(number|no)\b|\btax|iban|bank|account\s*n|\bssn\b|social\s*security|address|phone|mobile|e-?mail|whatsapp|telegram|birth|\bdob\b|licen[cs]e|full\s*name|surname/i';

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
            'leadSource',
            'category',
            'lifecycleStatus',
            'marketing',
        ]);

        $nowCarbon = Carbon::now();
        $redactor = LeadSummaryRedactor::forLead($lead);

        $sections = [];

        $profile = $this->buildProfile($lead, $redactor);
        if ($profile !== []) {
            $sections['profile'] = $profile;
        }

        $initialMessage = $redactor->clean($lead->note, self::NOTE_CHARS);
        if ($initialMessage !== '') {
            $sections['initial_message'] = $initialMessage;
        }

        $calls = $this->buildQualificationCalls($lead, $nowCarbon, $redactor);
        if ($calls !== []) {
            $sections['qualification_calls'] = $calls;
        }

        $details = $this->buildLeadDetails($lead, $redactor);
        if ($details !== []) {
            $sections['lead_details'] = $details;
        }

        $notes = $this->buildNotes($lead, $nowCarbon, $redactor);
        if ($notes !== []) {
            $sections['notes'] = $notes;
        }

        $meetings = $this->buildMeetings($lead, $nowCarbon, $redactor);
        if ($meetings !== []) {
            $sections['meetings'] = $meetings;
        }

        $tasks = $this->buildTasks($lead, $nowCarbon, $redactor);
        if ($tasks !== []) {
            $sections['tasks'] = $tasks;
        }

        $marketing = $this->buildMarketingSection($lead, $nowCarbon, $redactor);
        if ($marketing !== null) {
            $sections['marketing'] = $marketing;
        }

        $deals = $this->buildDeals($lead, $redactor);
        if ($deals !== []) {
            $sections['deals'] = $deals;
        }

        $temperature = $lead->temperature;

        $leadBlock = array_filter([
            'type' => $this->resolveLeadType($lead),
            'source' => $lead->leadSource?->type ?? null,
            'category' => $lead->category?->category_name ?? null,
            'temperature' => $temperature instanceof \BackedEnum ? $temperature->value : $temperature,
            'created_at' => $lead->created_at?->toIso8601String(),
            'updated_at' => $lead->updated_at?->toIso8601String(),
            'days_since_created' => $this->daysAgo($lead->created_at, $nowCarbon),
            'days_since_updated' => $this->daysAgo($lead->updated_at, $nowCarbon),
            'owner_assigned' => (bool) $lead->lead_owner,
            'last_logged_activity_days_ago' => $this->lastLoggedActivityDaysAgo($notes, $calls, $meetings),
        ], fn ($value) => $value !== null && $value !== '');

        return [
            'now' => $nowCarbon->toIso8601String(),
            'lead' => $leadBlock,
            'qualification' => $this->buildQualification($lead),
            'sections' => $sections,
            'action_taxonomy' => $this->leadActionTaxonomy(),
        ];
    }

    public function inputHash(Lead $lead): string
    {
        $dealIds = Deal::where('lead_id', $lead->id)->select('id');
        $qualificationIds = LeadQualification::where('lead_id', $lead->id)->select('id');

        $fingerprint = [
            'id' => $lead->id,
            'updated_at' => $lead->updated_at?->toIso8601String(),
            'lifecycle' => $lead->lead_lifecycle_status_id,
            'lead_owner' => $lead->lead_owner,
            'source_id' => $lead->source_id,
            'category_id' => $lead->category_id,
            'deals_count' => Deal::where('lead_id', $lead->id)->count(),
            'deals_max_updated_at' => Deal::where('lead_id', $lead->id)->max('updated_at'),
            'hibarr_max_updated_at' => HibarrDealFields::whereIn('deal_id', $dealIds)->max('updated_at'),
            'notes_count' => LeadNote::where('lead_id', $lead->id)->count(),
            'notes_max_updated_at' => LeadNote::where('lead_id', $lead->id)->max('updated_at'),
            'tasks_count' => $lead->tasks()->count(),
            'tasks_max_updated_at' => $lead->tasks()->max('tasks.updated_at'),
            'followups_count' => DealFollowUp::where('lead_id', $lead->id)->count(),
            'followups_max_updated_at' => DealFollowUp::where('lead_id', $lead->id)->max('updated_at'),
            'qualifications_count' => LeadQualification::where('lead_id', $lead->id)->count(),
            'qualifications_max_updated_at' => LeadQualification::where('lead_id', $lead->id)->max('updated_at'),
            'answers_max_updated_at' => LeadQualificationAnswer::whereIn('lead_qualification_id', $qualificationIds)->max('updated_at'),
            'custom_fields_hash' => hash('sha256', DB::table('custom_fields_data')
                ->where('model', Lead::CUSTOM_FIELD_MODEL)
                ->where('model_id', $lead->id)
                ->orderBy('custom_field_id')
                ->pluck('value', 'custom_field_id')
                ->toJson()),
        ];

        return hash('sha256', json_encode($fingerprint));
    }

    /**
     * Lifecycle status ("Unqualified", "Nurturing", …) and what it implies.
     *
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
     * Who the lead is in context — never contact values. Contact channels are
     * reduced to a list of which exist, so the next step can pick call vs email.
     *
     * @return array<string, mixed>
     */
    private function buildProfile(Lead $lead, LeadSummaryRedactor $redactor): array
    {
        $channels = array_values(array_filter([
            $lead->client_email ? 'email' : null,
            ($lead->mobile || $lead->cell || $lead->office) ? 'phone' : null,
            $lead->client_whatsapp ? 'whatsapp' : null,
            $lead->client_telegram ? 'telegram' : null,
        ]));

        $contactTimes = collect($lead->resolvedPreferredContactTimes())
            ->map(fn (string $value) => PreferredContactTime::tryFrom($value)?->label() ?? $value)
            ->implode(', ');

        $ageRange = $lead->age_range;

        return array_filter([
            'nationality' => $lead->nationality,
            'country' => $lead->country,
            'city' => $lead->city,
            'languages' => is_array($lead->languages) ? implode(', ', $lead->languages) : $lead->languages,
            'occupation' => $redactor->clean($lead->occupation, 120),
            'age_range' => $ageRange instanceof \BackedEnum ? $ageRange->value : $ageRange,
            'preferred_contact_time' => $contactTimes,
            'reachable_via' => $channels,
        ], fn ($value) => $value !== null && $value !== '' && $value !== []);
    }

    /**
     * The most recent qualification call(s) with what was asked and answered.
     *
     * @return list<array<string, mixed>>
     */
    private function buildQualificationCalls(Lead $lead, Carbon $now, LeadSummaryRedactor $redactor): array
    {
        $calls = LeadQualification::where('lead_id', $lead->id)
            ->with(['answers' => fn ($query) => $query->orderBy('id')])
            ->orderByDesc('started_at')
            ->orderByDesc('id')
            ->limit(self::MAX_QUALIFICATION_CALLS)
            ->get();

        $result = [];

        foreach ($calls as $call) {
            $answers = $call->answers
                ->map(fn (LeadQualificationAnswer $answer) => $this->mapAnswer($answer, $redactor))
                ->filter()
                ->take(self::MAX_ANSWERS_PER_CALL)
                ->values()
                ->all();

            $outcomes = $call->outcomes ?: ($call->outcome ? [$call->outcome->value] : []);

            // An abandoned/empty shell tells the reader nothing.
            if ($answers === [] && $outcomes === [] && $call->status !== QualificationStatus::Completed) {
                continue;
            }

            $result[] = array_filter([
                'script' => $redactor->clean($call->template_name, 120),
                'status' => $call->status?->value,
                'days_ago' => $this->daysAgo($call->completed_at ?? $call->started_at, $now),
                'outcomes' => array_values($outcomes),
                'outcome_comment' => $redactor->clean($call->outcome_comment, 500),
                'answers' => $answers,
            ], fn ($value) => $value !== null && $value !== '' && $value !== []);
        }

        return $result;
    }

    /**
     * @return array{question?: string, answer: string, details?: string}|null
     */
    private function mapAnswer(LeadQualificationAnswer $answer, LeadSummaryRedactor $redactor): ?array
    {
        $labels = array_values(array_filter(
            array_map(fn ($label) => trim((string) $label), $answer->answer_labels ?? []),
            fn (string $label) => $label !== ''
        ));
        $text = trim((string) $answer->answer_text);

        // Picked option(s) are the answer and any typed text is context for it;
        // with no option snapshot (typed answer, or saved before labels existed)
        // the typed text is the answer.
        $value = $redactor->clean($labels !== [] ? implode(', ', $labels) : $text, 300);

        if ($value === '') {
            return null;
        }

        return array_filter([
            'question' => $redactor->clean($answer->question_label, 300),
            'answer' => $value,
            'details' => $labels !== [] && $text !== '' ? $redactor->clean($text, 400) : '',
        ], fn ($field) => $field !== '');
    }

    /**
     * Custom fields on the lead (where qualification answers and form fields are
     * usually mapped to — budget, property type, purpose, …).
     *
     * @return list<array{label: string, value: string}>
     */
    private function buildLeadDetails(Lead $lead, LeadSummaryRedactor $redactor): array
    {
        if (! $lead->id) {
            return [];
        }

        $rows = DB::table('custom_fields')
            ->join('custom_field_groups', 'custom_fields.custom_field_group_id', '=', 'custom_field_groups.id')
            ->join('custom_fields_data', function ($join) use ($lead) {
                $join->on('custom_fields_data.custom_field_id', '=', 'custom_fields.id')
                    ->where('custom_fields_data.model', '=', Lead::CUSTOM_FIELD_MODEL)
                    ->where('custom_fields_data.model_id', '=', $lead->id);
            })
            ->where('custom_field_groups.model', Lead::CUSTOM_FIELD_MODEL)
            ->whereNotNull('custom_fields_data.value')
            ->where('custom_fields_data.value', '!=', '')
            ->where('custom_fields.type', '!=', 'file')
            ->orderBy('custom_fields.display_order')
            ->select(['custom_fields.label', 'custom_fields_data.value'])
            ->get();

        return $rows
            ->reject(fn ($row) => preg_match(self::SENSITIVE_FIELD_LABEL, (string) $row->label) === 1)
            ->map(function ($row) use ($redactor) {
                $raw = (string) $row->value;
                $decoded = json_decode($raw, true);
                $value = is_array($decoded) ? implode(', ', array_map('strval', $decoded)) : $raw;

                return [
                    'label' => $redactor->clean((string) $row->label, 80),
                    'value' => $redactor->clean($value, 300),
                ];
            })
            ->filter(fn (array $field) => $field['label'] !== '' && $field['value'] !== '')
            ->take(self::MAX_LEAD_DETAILS)
            ->values()
            ->all();
    }

    /**
     * @return list<array{days_ago: int|null, text: string}>
     */
    private function buildNotes(Lead $lead, Carbon $now, LeadSummaryRedactor $redactor): array
    {
        return LeadNote::where('lead_id', $lead->id)
            ->orderByDesc('created_at')
            ->limit(self::MAX_NOTES)
            ->get()
            ->map(fn ($note) => [
                'days_ago' => $this->daysAgo($note->created_at, $now),
                'text' => $redactor->clean(is_string($note->details) ? $note->details : (string) ($note->details ?? ''), self::NOTE_CHARS),
            ])
            ->filter(fn (array $note) => $note['text'] !== '')
            ->values()
            ->all();
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function buildMeetings(Lead $lead, Carbon $now, LeadSummaryRedactor $redactor): array
    {
        return DealFollowUp::where('lead_id', $lead->id)
            ->orderByDesc('next_follow_up_date')
            ->limit(10)
            ->get()
            ->map(fn ($followUp) => array_filter([
                'title' => $redactor->clean($followUp->remark, 200) ?: 'Follow-up',
                'scheduled_at' => $followUp->next_follow_up_date?->toIso8601String(),
                // Negative = in the past, positive = upcoming.
                'days_from_now' => $followUp->next_follow_up_date
                    ? -1 * $this->daysAgo($followUp->next_follow_up_date, $now)
                    : null,
                'status' => $followUp->status ?? 'scheduled',
            ], fn ($value) => $value !== null))
            ->values()
            ->all();
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function buildTasks(Lead $lead, Carbon $now, LeadSummaryRedactor $redactor): array
    {
        return $lead->tasks()
            ->with(['boardColumn:id,column_name'])
            ->orderByDesc('created_at')
            ->limit(10)
            ->get()
            ->map(fn ($task) => array_filter([
                'title' => $redactor->clean($task->heading, 200),
                'status' => $task->boardColumn?->column_name ?? 'open',
                'due_at' => $task->due_date?->toIso8601String(),
                // Negative = overdue, positive = still ahead.
                'due_in_days' => $task->due_date ? -1 * $this->daysAgo($task->due_date, $now) : null,
            ], fn ($value) => $value !== null && $value !== ''))
            ->values()
            ->all();
    }

    /**
     * How the lead arrived and what they have engaged with. Tracking identifiers
     * (click ids, IP, user agent) are intentionally left out.
     *
     * @return array<string, mixed>|null
     */
    private function buildMarketingSection(Lead $lead, Carbon $now, LeadSummaryRedactor $redactor): ?array
    {
        $marketing = $lead->marketing;

        if (! $marketing) {
            return null;
        }

        $engagement = array_values(array_filter([
            $marketing->has_registered_for_the_webinar ? 'registered for webinar' : null,
            $marketing->has_attended_the_webinar ? 'attended webinar' : null,
            $marketing->registered_for_zoom_meeting ? 'registered for Zoom meeting' : null,
            $marketing->has_downloaded_the_ebook ? 'downloaded ebook' : null,
            $marketing->has_joined_the_whatsapp_group ? 'joined WhatsApp group' : null,
            $marketing->has_joined_the_facebook_group ? 'joined Facebook group' : null,
        ]));

        $section = array_filter([
            'campaign' => $redactor->clean($marketing->utm_campaign, 120),
            'channel' => $redactor->clean($marketing->utm_source, 60),
            'medium' => $redactor->clean($marketing->utm_medium, 60),
            'ad_content' => $redactor->clean($marketing->utm_content, 120),
            'search_term' => $redactor->clean($marketing->utm_term, 120),
            'engagement' => $engagement,
            'last_webinar_days_ago' => $marketing->last_webinar_date
                ? $this->daysAgo(Carbon::parse($marketing->last_webinar_date), $now)
                : null,
            'contact_score' => $marketing->contact_score,
        ], fn ($value) => $value !== null && $value !== '' && $value !== []);

        return $section === [] ? null : $section;
    }

    /**
     * Linked deals: the Deal Summary agent's own conclusion (never re-derived
     * here) plus what the buyer told us on the deal.
     *
     * @return list<array<string, mixed>>
     */
    private function buildDeals(Lead $lead, LeadSummaryRedactor $redactor): array
    {
        return Deal::where('lead_id', $lead->id)
            ->with('hibarrFields')
            ->get()
            ->map(function (Deal $deal) use ($redactor) {
                $snapshot = $this->dealSnapshotService->getOrGenerate($deal);

                // deal_name is dropped: deals are routinely named after the person.
                return array_filter([
                    'deal_id' => $snapshot['deal_id'] ?? (string) $deal->id,
                    'stage_label' => $snapshot['stage_label'] ?? null,
                    'value' => $snapshot['value'] ?? null,
                    'currency' => $snapshot['currency'] ?? null,
                    'risk_level' => $snapshot['risk_level'] ?? null,
                    'status_line' => $redactor->redact($snapshot['status_line'] ?? ''),
                    'next_step_label' => isset($snapshot['next_step_label'])
                        ? $redactor->redact($snapshot['next_step_label'])
                        : null,
                    'buying_intent' => $this->buildBuyingIntent($deal, $redactor),
                ], fn ($value) => $value !== null && $value !== '' && $value !== []);
            })
            ->values()
            ->all();
    }

    /**
     * @return array<string, mixed>
     */
    private function buildBuyingIntent(Deal $deal, LeadSummaryRedactor $redactor): array
    {
        $fields = $deal->hibarrFields;

        if (! $fields) {
            return [];
        }

        return array_filter([
            'interested_in' => $redactor->clean((string) $fields->interested_in, 200),
            'motivation' => $redactor->clean((string) $fields->motivation, 300),
            'purchase_timeline' => $redactor->clean((string) $fields->purchase_timeline, 120),
            'budget_range' => $redactor->clean((string) $fields->budget_range, 120),
            'message' => $redactor->clean((string) $fields->message, self::NOTE_CHARS),
            'strategy_meeting_booked' => $fields->strategy_meeting_booked ? true : null,
            'inspection_trip_date' => $fields->inspection_trip_date?->format('Y-m-d'),
            'downpayment_paid' => $fields->downpayment_paid ? true : null,
        ], fn ($value) => $value !== null && $value !== '');
    }

    /**
     * Days since the most recent thing a person logged against this lead.
     * Precomputed so the model never does date arithmetic.
     *
     * @param  list<array<string, mixed>>  $notes
     * @param  list<array<string, mixed>>  $calls
     * @param  list<array<string, mixed>>  $meetings
     */
    private function lastLoggedActivityDaysAgo(array $notes, array $calls, array $meetings): ?int
    {
        $candidates = array_merge(
            array_column($notes, 'days_ago'),
            array_column($calls, 'days_ago'),
            // Only meetings that already happened (days_from_now <= 0).
            array_map(
                fn (array $meeting) => -1 * $meeting['days_from_now'],
                array_filter($meetings, fn (array $meeting) => isset($meeting['days_from_now']) && $meeting['days_from_now'] <= 0)
            ),
        );

        $candidates = array_filter($candidates, fn ($days) => $days !== null);

        return $candidates === [] ? null : max(0, (int) min($candidates));
    }

    /**
     * Whole days from $at to $now (negative when $at is in the future). Integer
     * timestamp maths so it behaves the same across Carbon 2 and 3.
     */
    private function daysAgo(?CarbonInterface $at, Carbon $now): ?int
    {
        if (! $at) {
            return null;
        }

        return intdiv($now->getTimestamp() - $at->getTimestamp(), 86400);
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
