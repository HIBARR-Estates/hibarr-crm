<?php

namespace App\Services;

use App\Models\Deal;
use App\Models\DealFollowUp;
use App\Models\SallyMeetingInsight;
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
     * @return Collection<int, SallyMeetingInsight>
     */
    public function forDeal(int $dealId): Collection
    {
        return SallyMeetingInsight::query()
            ->with(['meetingFollowUp'])
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
            ->with(['meetingFollowUp'])
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

        return trim($clean);
    }

    private static function summaryPurifier(): \HTMLPurifier
    {
        return self::$summaryPurifier ??= new \HTMLPurifier(self::summaryConfig(true));
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
        // The editor's toolbar can set colour, background and alignment.
        $config->set('CSS.AllowedProperties', 'color,background-color,background,font-weight,font-style,text-align,text-decoration');

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
