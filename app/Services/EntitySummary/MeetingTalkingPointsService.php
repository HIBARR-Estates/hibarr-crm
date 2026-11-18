<?php

namespace App\Services\EntitySummary;

use App\Contracts\EntitySummaryAgentInterface;
use App\Exceptions\EntityAiSummaryGenerationException;
use App\Models\Deal;
use App\Models\DealFollowUp;
use App\Models\EntityAiSummary;
use Carbon\Carbon;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\RateLimiter;

/**
 * AI talking points for one meeting on a deal (the agent workspace's meeting
 * brief). Built from the deal's summary input, the lead behind it and the
 * meeting itself, plus the brief's open stage conditions and analysis
 * questions. Stored per meeting in entity_ai_summaries, and marked stale when
 * the deal or the meeting changes.
 */
class MeetingTalkingPointsService
{
    public const FEATURE_CONTEXT = 'meeting_talking_points';

    private const PROMPT_VERSION = 'v1';

    private const REGEN_MAX_ATTEMPTS = 5;

    private const REGEN_DECAY_SECONDS = 60;

    public function __construct(
        private EntitySummaryAgentInterface $agent,
        private EntitySummaryPromptLoader $promptLoader,
        private DealSummaryInputBuilder $dealInput,
        private LeadSummaryInputBuilder $leadInput,
        private EntitySummaryValidator $validator,
    ) {}

    /**
     * The stored points (even when stale), or null when none were written yet.
     *
     * @return array{points: list<string>, meta: array<string, mixed>}|null
     */
    public function getCached(Deal $deal, DealFollowUp $meeting): ?array
    {
        $record = $this->findRecord($deal, $meeting);

        return $record ? $this->present($record, $this->inputHash($deal, $meeting)) : null;
    }

    /**
     * Write the points now. Keeps the stored ones when the model fails.
     *
     * @param  array{open_questions?: list<string>, next_stage?: string|null, open_conditions?: list<string>}  $brief
     * @return array{points: list<string>, meta: array<string, mixed>}
     */
    public function generate(Deal $deal, DealFollowUp $meeting, array $brief = []): array
    {
        $rateLimitKey = 'entity-ai-summary:deal-meeting:'.$meeting->id.':user:'.(Auth::id() ?? 'guest');

        if (RateLimiter::tooManyAttempts($rateLimitKey, self::REGEN_MAX_ATTEMPTS)) {
            throw new EntityAiSummaryGenerationException(
                'Too many talking point requests. Please wait a minute and try again.',
                $this->getCached($deal, $meeting),
                429,
            );
        }

        $lock = Cache::lock('entity-ai-summary:deal-meeting:'.$meeting->id, 90);

        if (! $lock->get()) {
            throw new EntityAiSummaryGenerationException(
                'Talking points are already being written for this meeting.',
                $this->getCached($deal, $meeting),
                429,
            );
        }

        RateLimiter::hit($rateLimitKey, self::REGEN_DECAY_SECONDS);

        try {
            $hash = $this->inputHash($deal, $meeting);

            try {
                $result = $this->agent->executeStructuredAgent(
                    self::FEATURE_CONTEXT,
                    $this->promptLoader->loadMeetingTalkingPointsPrompt(),
                    $this->buildInput($deal, $meeting, $brief),
                    1024,
                );
                $points = $this->validator->normalizeMeetingTalkingPoints($result);
            } catch (\Throwable $e) {
                Log::warning('MeetingTalkingPointsService: generation failed', [
                    'deal_id' => $deal->id,
                    'meeting_id' => $meeting->id,
                    'message' => $e->getMessage(),
                ]);

                throw new EntityAiSummaryGenerationException(
                    'Talking points could not be written right now. Please try again.',
                    $this->getCached($deal, $meeting),
                    503,
                    $e,
                );
            }

            $generatedAt = now();

            $record = EntityAiSummary::updateOrCreate(
                [
                    'company_id' => $deal->company_id,
                    'entity_type' => EntityAiSummary::TYPE_DEAL_MEETING,
                    'entity_id' => $meeting->id,
                ],
                [
                    'summary_json' => [
                        'points' => $points,
                        'meta' => ['source' => 'ai', 'generated_at' => $generatedAt->toIso8601String()],
                    ],
                    'input_hash' => $hash,
                    'prompt_version' => self::PROMPT_VERSION,
                    'generated_at' => $generatedAt,
                    'generated_by' => Auth::id(),
                ],
            );

            return $this->present($record, $hash);
        } finally {
            $lock->release();
        }
    }

    /**
     * @param  array{open_questions?: list<string>, next_stage?: string|null, open_conditions?: list<string>}  $brief
     * @return array<string, mixed>
     */
    public function buildInput(Deal $deal, DealFollowUp $meeting, array $brief = []): array
    {
        $meeting->loadMissing('meetingType');
        $timezone = $this->timezone();
        $dealInput = $this->dealInput->build($deal);

        $input = [
            'now' => $dealInput['now'] ?? Carbon::now($timezone)->toDayDateTimeString(),
            'meeting' => array_filter([
                'type' => $meeting->meetingType?->name,
                'scheduled_at' => $meeting->next_follow_up_date
                    ? Carbon::parse($meeting->next_follow_up_date)->setTimezone($timezone)->format('l, F j, Y \a\t g:i A')
                    : null,
                'duration_minutes' => $meeting->duration ?: null,
                'location' => $meeting->location ?: ($meeting->meeting_link ? 'online' : null),
                'agenda' => $meeting->remark ? mb_substr(strip_tags((string) $meeting->remark), 0, 400) : null,
                'status' => $meeting->status,
            ], fn ($value) => $value !== null && $value !== ''),
            'deal' => array_diff_key($dealInput, array_flip(['now', 'viewer', 'action_taxonomy'])),
        ];

        $deal->loadMissing('contact');
        if ($deal->contact) {
            $lead = $this->leadInput->buildMeetingContext($deal->contact);
            if ($lead !== []) {
                $input['lead'] = $lead;
            }
        }

        $nextStage = trim((string) ($brief['next_stage'] ?? ''));
        if ($nextStage !== '') {
            $input['next_stage'] = [
                'name' => $nextStage,
                'open_conditions' => array_values($brief['open_conditions'] ?? []),
            ];
        }

        if (! empty($brief['open_questions'])) {
            $input['open_questions'] = array_values($brief['open_questions']);
        }

        return $input;
    }

    /** The deal summary's fingerprint plus the meeting's own fields. */
    public function inputHash(Deal $deal, DealFollowUp $meeting): string
    {
        return hash('sha256', json_encode([
            'deal' => $this->dealInput->inputHash($deal),
            'meeting' => [
                'id' => $meeting->id,
                'type' => $meeting->meeting_type_id,
                'at' => $meeting->next_follow_up_date ? Carbon::parse($meeting->next_follow_up_date)->toIso8601String() : null,
                'remark' => $meeting->remark,
                'status' => $meeting->status,
                'updated_at' => $meeting->updated_at?->toIso8601String(),
            ],
        ]));
    }

    protected function findRecord(Deal $deal, DealFollowUp $meeting): ?EntityAiSummary
    {
        return EntityAiSummary::query()
            ->where('company_id', $deal->company_id)
            ->where('entity_type', EntityAiSummary::TYPE_DEAL_MEETING)
            ->where('entity_id', $meeting->id)
            ->first();
    }

    /**
     * @return array{points: list<string>, meta: array<string, mixed>}
     */
    private function present(EntityAiSummary $record, string $currentHash): array
    {
        $stored = $record->summary_json ?? [];

        return [
            'points' => array_values(array_filter($stored['points'] ?? [], 'is_string')),
            'meta' => array_merge($stored['meta'] ?? [], [
                'is_stale' => $record->input_hash !== $currentHash,
            ]),
        ];
    }

    private function timezone(): string
    {
        $userTz = Auth::user()?->timezone;
        if (is_string($userTz) && $userTz !== '') {
            return $userTz;
        }

        $companyTz = function_exists('company') ? (company()?->timezone ?? null) : null;

        return is_string($companyTz) && $companyTz !== '' ? $companyTz : (string) config('app.timezone', 'UTC');
    }
}
