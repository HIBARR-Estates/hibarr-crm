<?php

namespace App\Support;

use App\Models\CalendlyMeetingLink;
use App\Models\Lead;

/**
 * Turns a configured Calendly link into the link opened for one lead or deal:
 * the contact's name and email are filled in, and the people who should join
 * the booking are added as its guests.
 */
final class CalendlyLinkBuilder
{
    /** Calendly accepts at most this many additional guests on a booking. */
    public const MAX_GUESTS = 10;

    /**
     * @param  list<string>  $guestEmails  Staff to add as guests on the booking
     */
    public static function build(CalendlyMeetingLink $link, ?Lead $lead, array $guestEmails = []): string
    {
        $params = [];
        $contactEmail = '';

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

            $contactEmail = trim((string) $lead->client_email);

            if ($contactEmail !== '') {
                $params['email'] = $contactEmail;
            }
        }

        $guests = self::cleanGuests($guestEmails, $contactEmail);

        if ($guests !== []) {
            $params['guests'] = implode(',', $guests);
        }

        return self::withQuery($link->url, $params);
    }

    /**
     * One entry per address, without blanks, and without the contact themself
     * (they are already the invitee).
     *
     * @param  list<string>  $emails
     * @return list<string>
     */
    private static function cleanGuests(array $emails, string $contactEmail): array
    {
        $seen = [];

        foreach ($emails as $email) {
            $email = trim($email);
            $key = strtolower($email);

            if ($email === '' || $key === strtolower($contactEmail) || isset($seen[$key])) {
                continue;
            }

            $seen[$key] = $email;
        }

        return array_slice(array_values($seen), 0, self::MAX_GUESTS);
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

        // The guests are always the ones chosen for this booking: a list saved
        // on the stored link would otherwise survive someone removing everybody.
        unset($existing['guests']);

        $query = http_build_query(array_merge($existing, $params), '', '&', PHP_QUERY_RFC3986);

        return $base.'?'.$query.$fragment;
    }
}
