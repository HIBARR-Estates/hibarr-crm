<?php

namespace App\Support;

use App\Enums\LeadContactMethodType;
use App\Models\CalendlyMeetingLink;
use App\Models\Lead;
use App\Models\LeadContactMethod;

/**
 * Turns a configured Calendly link into the link opened for one lead or deal:
 * the person's name and email are filled in, and the booking is tagged with
 * who it is for so Calendly's confirmation can be matched back to the CRM.
 *
 * The tag rides in Calendly's UTM fields, which it hands back untouched with
 * every booking. It is signed so a booking can only land on the record the
 * link was made for, whatever someone types into the address bar.
 */
final class CalendlyLinkBuilder
{
    public const UTM_SOURCE = 'hibarr_crm';

    public const RECORD_LEAD = 'lead';

    public const RECORD_DEAL = 'deal';

    /** Calendly accepts at most this many additional guests on a booking. */
    private const MAX_GUESTS = 10;

    /**
     * @param  self::RECORD_*  $recordType
     */
    public static function build(
        CalendlyMeetingLink $link,
        string $recordType,
        int $recordId,
        ?Lead $lead,
        ?int $userId,
    ): string {
        $params = [];

        if ($lead !== null) {
            $name = trim((string) $lead->client_name);

            if ($name !== '') {
                $params['name'] = $name;
                [$first, $last] = array_pad(explode(' ', $name, 2), 2, '');
                $params['first_name'] = $first;

                if ($last !== '') {
                    $params['last_name'] = $last;
                }
            }

            $email = trim((string) $lead->client_email);

            if ($email !== '') {
                $params['email'] = $email;
            }

            $guests = self::guestEmails($lead, $email);

            if ($guests !== []) {
                $params['guests'] = implode(',', $guests);
            }
        }

        $params += [
            'utm_source' => self::UTM_SOURCE,
            'utm_medium' => $recordType,
            'utm_campaign' => (string) $recordId,
            'utm_content' => (string) $link->id,
            'utm_term' => $userId.'.'.self::signature((int) $link->company_id, $recordType, $recordId, (int) $link->id, (int) $userId),
        ];

        return self::withQuery($link->url, $params);
    }

    /**
     * Reads a booking's tracking fields back. Null when the booking did not
     * come from a link made here, or the tag was altered.
     *
     * @param  array<string, mixed>  $tracking  Calendly's `tracking` object
     * @return array{record_type: string, record_id: int, link_id: int, user_id: int|null}|null
     */
    public static function parseTracking(array $tracking, int $companyId): ?array
    {
        if (($tracking['utm_source'] ?? null) !== self::UTM_SOURCE) {
            return null;
        }

        $recordType = $tracking['utm_medium'] ?? null;

        if (! in_array($recordType, [self::RECORD_LEAD, self::RECORD_DEAL], true)) {
            return null;
        }

        $recordId = $tracking['utm_campaign'] ?? null;
        $linkId = $tracking['utm_content'] ?? null;
        $term = (string) ($tracking['utm_term'] ?? '');

        if (! ctype_digit((string) $recordId) || ! ctype_digit((string) $linkId) || ! str_contains($term, '.')) {
            return null;
        }

        [$userPart, $signature] = explode('.', $term, 2);

        if ($userPart !== '' && ! ctype_digit($userPart)) {
            return null;
        }

        $userId = $userPart === '' ? 0 : (int) $userPart;
        $expected = self::signature($companyId, $recordType, (int) $recordId, (int) $linkId, $userId);

        if (! hash_equals($expected, $signature)) {
            return null;
        }

        return [
            'record_type' => $recordType,
            'record_id' => (int) $recordId,
            'link_id' => (int) $linkId,
            'user_id' => $userId > 0 ? $userId : null,
        ];
    }

    private static function signature(int $companyId, string $recordType, int $recordId, int $linkId, int $userId): string
    {
        $payload = implode('|', [$companyId, $recordType, $recordId, $linkId, $userId]);

        return substr(hash_hmac('sha256', $payload, (string) config('app.key')), 0, 20);
    }

    /**
     * The lead's other email addresses, so the people who should be on the
     * booking are invited without being retyped.
     *
     * @return list<string>
     */
    private static function guestEmails(Lead $lead, string $primaryEmail): array
    {
        $emails = LeadContactMethod::query()
            ->where('lead_id', $lead->id)
            ->where('type', LeadContactMethodType::Email->value)
            ->pluck('identifier')
            ->map(fn ($email) => trim((string) $email))
            ->filter(fn (string $email) => $email !== '' && strcasecmp($email, $primaryEmail) !== 0)
            ->unique(fn (string $email) => strtolower($email))
            ->take(self::MAX_GUESTS)
            ->values();

        return $emails->all();
    }

    /**
     * Adds $params to $url's query, keeping what the admin already put on the
     * link (for example a `hide_gdpr_banner=1`) and letting ours win on a clash.
     *
     * @param  array<string, string>  $params
     */
    private static function withQuery(string $url, array $params): string
    {
        $fragment = '';

        if (($hash = strpos($url, '#')) !== false) {
            $fragment = substr($url, $hash);
            $url = substr($url, 0, $hash);
        }

        $existing = [];
        $base = $url;

        if (($mark = strpos($url, '?')) !== false) {
            $base = substr($url, 0, $mark);
            parse_str(substr($url, $mark + 1), $existing);
        }

        $query = http_build_query(array_merge($existing, $params), '', '&', PHP_QUERY_RFC3986);

        return $base.'?'.$query.$fragment;
    }
}
