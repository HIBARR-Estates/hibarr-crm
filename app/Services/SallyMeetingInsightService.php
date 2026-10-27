<?php

namespace App\Services;

use App\Models\Deal;
use App\Models\DealFollowUp;
use App\Models\SallyMeetingInsight;
use App\Models\SallySuggestionLog;
use App\Models\User;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Collection as SupportCollection;

class SallyMeetingInsightService
{
    private static ?\HTMLPurifier $summaryPurifier = null;

    /**
     * Tags a summary must never contain. Everything else the default
     * definitions allow (the formatting tags) is kept.
     */
    private const SUMMARY_FORBIDDEN_TAGS = [
        'img', 'iframe', 'object', 'embed', 'applet', 'audio', 'video',
        'svg', 'math', 'style', 'script', 'form', 'input', 'button',
        'select', 'textarea', 'table', 'h5', 'h6', 'marquee', 'frame',
    ];

    /**
     * Bullets and suggested notes are plain text, never rich HTML. The column
     * is also read by the gRPC transformers, exports and the write API, so
     * markup is stripped on write — the same reason the summary is purified.
     */
    public static function sanitizePlainText(?string $text): ?string
    {
        if ($text === null) {
            return null;
        }

        $text = str_replace(["\r\n", "\r"], "\n", $text);
        $text = trim(html_entity_decode(strip_tags($text)));

        return $text === '' ? null : $text;
    }

    /**
     * The recording link is Sally's URL as received, but it is rendered as an
     * href, so anything that is not a plain http(s) absolute URL is dropped
     * (the card then simply shows no link) rather than stored.
     */
    public static function normalizeRecordingUrl(mixed $value): ?string
    {
        if (! is_string($value)) {
            return null;
        }

        $value = trim($value);

        if ($value === '' || mb_strlen($value) > 2048) {
            return null;
        }

        $scheme = strtolower(parse_url($value, PHP_URL_SCHEME) ?? '');

        return in_array($scheme, ['http', 'https'], true) ? $value : null;
    }

    /**
     * Validate and clean one page of Sally's suggested notes as received from
     * the write API. Text is escape-decoded and stripped of markup; ids and
     * types are validated because the whole logged/unlogged state hangs off
     * the id staying stable across re-syncs.
     *
     * @return array<int, array{id: string, type: string, text: string}>
     */
    public static function normalizeReceivedSuggestions(mixed $value): array
    {
        if (! is_array($value)) {
            throw \Illuminate\Validation\ValidationException::withMessages([
                'suggested_notes' => ['Suggested notes must be a list.'],
            ]);
        }

        $normalized = [];

        foreach (array_values($value) as $index => $item) {
            $id = is_array($item) ? ($item['id'] ?? null) : null;
            $type = is_array($item) ? ($item['type'] ?? null) : null;
            $text = is_array($item) ? ($item['text'] ?? null) : null;

            if (! is_string($id) || trim($id) === '' || mb_strlen($id) > 64) {
                throw \Illuminate\Validation\ValidationException::withMessages([
                    "suggested_notes.{$index}.id" => ['A stable suggestion id (1-64 chars) is required.'],
                ]);
            }

            if (! is_string($type) || ! in_array($type, SallyMeetingInsight::SUGGESTION_TYPES, true)) {
                throw \Illuminate\Validation\ValidationException::withMessages([
                    "suggested_notes.{$index}.type" => ['Type must be one of: '.implode(', ', SallyMeetingInsight::SUGGESTION_TYPES).'.'],
                ]);
            }

            $clean = self::sanitizePlainText(is_string($text) ? $text : null);

            if ($clean === null) {
                throw \Illuminate\Validation\ValidationException::withMessages([
                    "suggested_notes.{$index}.text" => ['Suggestion text is required.'],
                ]);
            }

            $normalized[] = ['id' => trim($id), 'type' => $type, 'text' => $clean];
        }

        if (count(collect($normalized)->pluck('id')->unique()) !== count($normalized)) {
            throw \Illuminate\Validation\ValidationException::withMessages([
                'suggested_notes' => ['Suggestion ids must be unique within a meeting.'],
            ]);
        }

        return $normalized;
    }

    /**
     * Merge a freshly received suggestion list into the stored working copy,
     * applying the re-sync rules: agent-edited and logged suggestions are
     * never touched, untouched ones are refreshed, new ones are appended.
     * Sally's original copy (as received) follows the working copy for
     * everything an agent has not touched.
     *
     * @param  array<int, array{id: string, type: string, text: string}>  $incoming
     * @return array{working: array<int, array<string, mixed>>, original: array<int, array{id: string, type: string, text: string}>}
     */
    public function mergeReceivedSuggestions(SallyMeetingInsight $insight, array $incoming): array
    {
        $working = array_values($insight->suggested_notes ?? []);
        $original = array_values($insight->original_suggested_notes ?? []);

        $workingIndex = [];
        foreach ($working as $i => $item) {
            $workingIndex[(string) ($item['id'] ?? '')] = $i;
        }
        $originalIndex = [];
        foreach ($original as $i => $item) {
            $originalIndex[(string) ($item['id'] ?? '')] = $i;
        }
        $loggedIds = $insight->suggestionLogs->pluck('suggestion_id')->all();

        foreach ($incoming as $received) {
            $id = $received['id'];
            $workingItem = isset($workingIndex[$id]) ? $working[$workingIndex[$id]] : null;
            $originalItem = isset($originalIndex[$id]) ? $original[$originalIndex[$id]] : null;

            if ($workingItem === null) {
                // New suggestion: append to both the working copy and Sally's
                // original. Logged state cannot pre-exist for an unseen id.
                $working[] = [
                    'id' => $id,
                    'type' => $received['type'],
                    'text' => $received['text'],
                    'edited' => false,
                ];
                $workingIndex[$id] = count($working) - 1;

                $original[] = [
                    'id' => $id,
                    'type' => $received['type'],
                    'text' => $received['text'],
                ];
                $originalIndex[$id] = count($original) - 1;

                continue;
            }

            if (in_array($id, $loggedIds, true)) {
                // Logged suggestions are frozen: a re-sync must never
                // un-log one or rewrite the text that was logged.
                continue;
            }

            if (($workingItem['edited'] ?? false) === true) {
                // The agent rewrote this one; Sally's newer text loses.
                continue;
            }

            $working[$workingIndex[$id]] = [
                'id' => $id,
                'type' => $received['type'],
                'text' => $received['text'],
                'edited' => false,
            ];

            if ($originalItem !== null) {
                $original[$originalIndex[$id]] = [
                    'id' => $id,
                    'type' => $received['type'],
                    'text' => $received['text'],
                ];
            }
        }

        return ['working' => $working, 'original' => $original];
    }

    /**
     * Agent edit of the summary and/or the bullet points from the PATCH
     * routes. Marks the edited fields so a later OL re-sync leaves them
     * alone (see CrmWriteService::upsertSallyMeetingInsight).
     *
     * @param  array<int, string>|null  $bulletPoints
     */
    public function applyAgentContentEdit(SallyMeetingInsight $insight, ?string $summary, ?array $bulletPoints): void
    {
        if ($summary !== null) {
            $clean = self::sanitizeSummary($summary);
            $insight->summary = $clean === '' ? null : $clean;
            $insight->summary_edited_at = now();
        }

        if ($bulletPoints !== null) {
            $insight->bullet_points = array_values(array_filter(
                array_map(fn ($point) => self::sanitizePlainText(is_string($point) ? $point : null), $bulletPoints),
                fn ($point) => $point !== null,
            ));
            $insight->bullet_points_edited_at = now();
        }

        $insight->save();
    }

    /**
     * Agent edit of one suggested note's working text (before logging).
     *
     * @throws \Illuminate\Validation\ValidationException when the suggestion
     *         was already logged — its text is what the CRM note carries.
     */
    public function updateSuggestionText(SallyMeetingInsight $insight, string $suggestionId, string $text): void
    {
        $items = array_values($insight->suggested_notes ?? []);
        $index = null;

        foreach ($items as $i => $item) {
            if ((string) ($item['id'] ?? '') === $suggestionId) {
                $index = $i;
                break;
            }
        }

        if ($index === null) {
            throw new \Illuminate\Database\Eloquent\ModelNotFoundException;
        }

        if ($insight->suggestionLogs()->where('suggestion_id', $suggestionId)->exists()) {
            throw \Illuminate\Validation\ValidationException::withMessages([
                'suggestion' => ['This suggestion was already logged as a note.'],
            ]);
        }

        $clean = self::sanitizePlainText($text);

        if ($clean === null) {
            throw \Illuminate\Validation\ValidationException::withMessages([
                'text' => ['Suggestion text is required.'],
            ]);
        }

        $items[$index]['text'] = $clean;
        $items[$index]['edited'] = true;
        $insight->suggested_notes = $items;
        $insight->save();
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function serializeMany(Collection|SupportCollection $insights): array
    {
        return $insights
            ->map(fn (SallyMeetingInsight $insight) => $this->serialize($insight))
            ->values()
            ->all();
    }

    /**
     * @return array<string, mixed>
     */
    public function serialize(SallyMeetingInsight $insight): array
    {
        $followUp = $insight->relationLoaded('meetingFollowUp')
            ? $insight->meetingFollowUp
            : null;

        $payload = [
            'summary' => $insight->summary,
            'transcript' => $insight->transcript,
            'transcript_segments' => $insight->transcript_segments ?? [],
            'bullet_points' => $insight->bullet_points ?? [],
        ];

        return [
            'id' => $insight->id,
            'meeting_id' => $insight->meeting_follow_up_id,
            'lead_id' => $insight->lead_id,
            'deal_id' => $insight->deal_id,
            'summary' => $insight->summary,
            'transcript' => $insight->transcript,
            'transcript_segments' => $insight->transcript_segments ?? [],
            'bullet_points' => $insight->bullet_points ?? [],
            'recording_url' => $insight->recording_url,
            'suggested_notes' => $this->serializeSuggestions($insight),
            // Sally's versions as received, for engineering exports that
            // compare her output against what agents edited or logged.
            // Agents never see these in the UI — the card shows working copy.
            'original_summary' => $insight->original_summary,
            'original_bullet_points' => $insight->original_bullet_points ?? [],
            'original_suggested_notes' => $insight->original_suggested_notes ?? [],
            'summary_edited_at' => $insight->summary_edited_at?->toIso8601String(),
            'bullet_points_edited_at' => $insight->bullet_points_edited_at?->toIso8601String(),
            'payload' => $payload,
            'created_at' => $insight->created_at?->toIso8601String(),
            'updated_at' => $insight->updated_at?->toIso8601String(),
            'meeting' => $followUp ? [
                'id' => $followUp->id,
                'remark' => $followUp->remark,
                'next_follow_up_date' => $followUp->next_follow_up_date?->toIso8601String(),
                'location' => $followUp->location,
                'timezone' => $followUp->timezone,
            ] : null,
        ];
    }

    /**
     * The agent's working copy of Sally's suggested notes with each item's
     * logging status joined from sally_suggestion_logs. The log rows must be
     * eager-loaded (`suggestionLogs`) when serializing many insights.
     *
     * @return array<int, array<string, mixed>>
     */
    public function serializeSuggestions(SallyMeetingInsight $insight): array
    {
        $logs = $insight->relationLoaded('suggestionLogs')
            ? $insight->suggestionLogs
            : $insight->suggestionLogs()->get();
        $logsById = $logs->keyBy('suggestion_id');

        return array_values(array_map(
            function (array $item) use ($logsById) {
                $id = (string) ($item['id'] ?? '');
                $log = $logsById->get($id);

                return [
                    'id' => $id,
                    'type' => $item['type'] ?? null,
                    'text' => $item['text'] ?? '',
                    'edited' => (bool) ($item['edited'] ?? false),
                    'logged' => $log !== null,
                    'logged_mode' => $log?->logged_mode,
                    'logged_at' => $log?->logged_at?->toIso8601String(),
                    'logged_by' => $log?->logged_by,
                    'logged_note_id' => $log?->note_id,
                ];
            },
            $insight->suggested_notes ?? [],
        ));
    }

    /**
     * @return Collection<int, SallyMeetingInsight>
     */
    public function forDeal(int $dealId): Collection
    {
        return SallyMeetingInsight::query()
            ->with(['meetingFollowUp', 'suggestionLogs'])
            ->where('deal_id', $dealId)
            ->orderByDesc('updated_at')
            ->get();
    }

    /**
     * Insights for a lead, including the ones that belong to one of the lead's
     * deals. Meetings created from the Deals workspace only carry `deal_id`, so
     * filtering on `lead_id` alone hides those summaries from the lead page.
     *
     * @return Collection<int, SallyMeetingInsight>
     */
    public function forLead(int $leadId): Collection
    {
        $dealIds = Deal::query()
            ->where('lead_id', $leadId)
            ->pluck('id')
            ->all();

        return SallyMeetingInsight::query()
            ->with(['meetingFollowUp', 'suggestionLogs'])
            ->where(function ($query) use ($leadId, $dealIds) {
                $query->where('lead_id', $leadId);

                if ($dealIds !== []) {
                    $query->orWhereIn('deal_id', $dealIds);
                }
            })
            ->orderByRaw('deal_id IS NULL, deal_id')
            ->orderByDesc('updated_at')
            ->get();
    }

    /**
     * Drop insights whose deal the requesting user may not view. Lead-level
     * insights (no deal) stay visible to anyone who can see the lead.
     *
     * @param  Collection<int, SallyMeetingInsight>  $insights
     * @return Collection<int, SallyMeetingInsight>
     */
    public function visibleDealsOnly(Collection $insights, User $user): Collection
    {
        $dealIds = $insights->pluck('deal_id')->filter()->unique()->values();

        if ($dealIds->isEmpty()) {
            return $insights;
        }

        $deals = Deal::query()->whereIn('id', $dealIds)->get()->keyBy('id');
        $dealRules = [
            'added' => 'added_by',
            'owned' => fn ($user, $deal) => $deal->isVisibleToUser($user->id),
        ];

        return $insights
            ->filter(function (SallyMeetingInsight $insight) use ($deals, $user, $dealRules) {
                if (! $insight->deal_id) {
                    return true;
                }

                $deal = $deals->get($insight->deal_id);

                if (! $deal) {
                    return false;
                }

                return PermissionService::checkAccess($user, 'view_deals', $deal, $dealRules)['canAccess'];
            })
            ->values();
    }

    /**
     * The summary is rich text edited in the browser, so it is stored as a
     * sanitized HTML fragment. Re-sanitizing on write (not only on render)
     * keeps stored rows safe for every other consumer — the gRPC transformer,
     * exports, and the CRM write API all read this column.
     */
    public static function sanitizeSummary(string $html): string
    {
        if (trim($html) === '') {
            return '';
        }

        try {
            $clean = self::summaryPurifier()->purify($html);
        } catch (\ErrorException) {
            // HTMLPurifier warns when it can't write its definition cache.
            self::$summaryPurifier = new \HTMLPurifier(self::summaryConfig(false));
            $clean = self::$summaryPurifier->purify($html);
        }

        // HTMLPurifier normalizes newlines to the OS default (CRLF on
        // Windows), which would make stored summaries differ between
        // machines. Store LF everywhere.
        $clean = str_replace(["\r\n", "\r"], "\n", $clean);

        return trim($clean);
    }

    private static function summaryPurifier(): \HTMLPurifier
    {
        return self::$summaryPurifier ??= new \HTMLPurifier(self::summaryConfig(true));
    }

    /**
     * A suggestion logged as a note becomes the note's rich-text body. The
     * notes tab renders details through the sanitizing HTML renderer, so the
     * plain suggestion text is escaped and wrapped into paragraphs.
     */
    public static function suggestionTextToEditorHtml(string $text): string
    {
        $paragraphs = array_values(array_filter(
            explode("\n", str_replace(["\r\n", "\r"], "\n", $text)),
            fn (string $line) => trim($line) !== '',
        ));

        return collect($paragraphs)
            ->map(fn (string $line) => '<p>'.e(trim($line)).'</p>')
            ->implode('');
    }

    private static function summaryConfig(bool $useCache): \HTMLPurifier_Config
    {
        $config = \HTMLPurifier_Config::createDefault();
        $cachePath = storage_path('framework/cache/htmlpurifier');

        if ($useCache && (is_dir($cachePath) || @mkdir($cachePath, 0755, true)) && is_writable($cachePath)) {
            $config->set('Cache.SerializerPath', $cachePath);
        } else {
            $config->set('Cache.DefinitionImpl', null);
        }

        $config->set('HTML.DefinitionID', 'sally-summary');
        $config->set('HTML.DefinitionRev', 1);
        $config->set('URI.AllowedSchemes', ['http' => true, 'https' => true, 'mailto' => true]);
        $config->set('Attr.AllowedFrameTargets', ['_blank']);
        $config->set('HTML.SafeIframe', false);
        $config->set('AutoFormat.RemoveEmpty', false);

        // Formatting only. HTML.Allowed is avoided deliberately: it strips the
        // elements AND resets the attribute definitions, which would leave
        // anchors without href. Forbidding the tags the summary must not
        // contain keeps the default (complete) attribute sets intact.
        $config->set('HTML.ForbiddenElements', implode(',', self::SUMMARY_FORBIDDEN_TAGS));
        // The editor's toolbar can set colour and alignment. `background` is
        // deliberately excluded: it carries url(...), which would let a
        // prompt-injected summary make the browser fetch a remote URL.
        $config->set('CSS.AllowedProperties', 'color,background-color,font-weight,font-style,text-align,text-decoration');

        return $config;
    }

    public function meetingBelongsToCompany(int $companyId, int $meetingFollowUpId): ?DealFollowUp
    {
        $followUp = DealFollowUp::query()->with(['deal', 'lead'])->find($meetingFollowUpId);

        if ($followUp === null) {
            return null;
        }

        // A follow-up can point at a deal and a lead at once, and those two can
        // sit in different companies. Every attached entity has to match.
        $matched = false;

        if ($followUp->deal_id) {
            if ((int) $followUp->deal?->company_id !== $companyId) {
                return null;
            }

            $matched = true;
        }

        if ($followUp->lead_id) {
            if ((int) $followUp->lead?->company_id !== $companyId) {
                return null;
            }

            $matched = true;
        }

        return $matched ? $followUp : null;
    }
}
