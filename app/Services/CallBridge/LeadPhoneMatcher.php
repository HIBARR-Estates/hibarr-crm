<?php

namespace App\Services\CallBridge;

use App\Models\Lead;

/**
 * Matches an inbound caller number to a lead's mobile.
 *
 * Lives outside the HTTP controller because it is needed in two places:
 * the live ringing lookup (TelephonySoftphoneEventController) and the
 * reconciliation of recordings that were captured before the lead existed or
 * before its number was filled in.
 *
 * sipgate delivers the caller as a national number on one leg and as a
 * full international number on another, and the CRM stores mobiles as either a
 * plain string or an antd-phone-input JSON blob. Matching therefore compares
 * the stable trailing digits rather than the whole string.
 */
class LeadPhoneMatcher
{
    /** Shortest trailing-digit window that is still specific enough to match. */
    private const MIN_SUFFIX = 6;

    private const MAX_SUFFIX = 9;

    /**
     * Reduce a stored `mobile` value to bare digits.
     *
     * Handles the JSON shape written by antd-phone-input
     * ({countryCode, areaCode, phoneNumber} or {phone}).
     */
    public function normalize(?string $mobile): string
    {
        if ($mobile === null || $mobile === '') {
            return '';
        }

        $decoded = json_decode($mobile, true);
        if (is_array($decoded)) {
            if (isset($decoded['countryCode'], $decoded['phoneNumber'])) {
                return $this->digits(implode('', [
                    $decoded['countryCode'],
                    $decoded['areaCode'] ?? '',
                    $decoded['phoneNumber'],
                ]));
            }

            if (isset($decoded['phone'])) {
                return $this->digits((string) $decoded['phone']);
            }

            return '';
        }

        return $this->digits($mobile);
    }

    /** Normalise a caller-supplied number (URI/display form) to bare digits. */
    public function normalizeIncoming(?string $number): string
    {
        return $this->digits((string) $number);
    }

    /** True when a normalised lead mobile matches the incoming number. */
    public function matches(string $incoming, ?string $leadMobile): bool
    {
        $mobile = $this->normalize($leadMobile);

        if ($mobile === '' || $incoming === '') {
            return false;
        }

        if ($mobile === $incoming) {
            return true;
        }

        $suffixLength = min(strlen($mobile), strlen($incoming), self::MAX_SUFFIX);

        // Too short to be distinctive — require an exact match instead.
        if ($suffixLength < self::MIN_SUFFIX) {
            return false;
        }

        return substr($mobile, -$suffixLength) === substr($incoming, -$suffixLength);
    }

    /**
     * Find the lead a caller number belongs to within a company.
     *
     * The SQL pre-filter on the trailing digits keeps the candidate set small;
     * {@see matches()} then makes the final decision so the JSON-encoded
     * mobiles are compared correctly.
     */
    public function findLead(int $companyId, string $incomingNumber): ?Lead
    {
        $incoming = $this->normalizeIncoming($incomingNumber);
        if ($incoming === '') {
            return null;
        }

        $suffix = strlen($incoming) >= self::MIN_SUFFIX
            ? substr($incoming, -self::MIN_SUFFIX)
            : $incoming;

        return Lead::query()
            ->where('company_id', $companyId)
            ->when($suffix !== '', function ($query) use ($suffix): void {
                // Stored mobiles are human-formatted ("+46 70 123 45 67"), so a
                // plain LIKE on the digit suffix misses them — strip the common
                // separators in SQL first. The raw LIKE alongside it catches
                // JSON blobs written by antd-phone-input, where the digits are
                // contiguous inside the JSON string.
                $query->where(function ($q) use ($suffix): void {
                    $q->whereRaw(
                        "REPLACE(REPLACE(REPLACE(REPLACE(mobile, ' ', ''), '-', ''), '(', ''), ')', '') LIKE ?",
                        ['%'.$suffix.'%']
                    )->orWhere('mobile', 'like', '%'.$suffix.'%');
                });
            })
            ->get()
            ->first(fn (Lead $lead) => $this->matches($incoming, (string) $lead->mobile));
    }

    private function digits(string $value): string
    {
        return (string) preg_replace('/[^0-9]/', '', $value);
    }
}
