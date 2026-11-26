<?php

namespace App\Services\CallBridge;

use App\Models\Lead;
use App\Models\LeadContactMethod;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;

/**
 * Matches a caller's number to leads.
 *
 * Lives outside the HTTP controller because it is needed in two places:
 * the live ringing lookup (TelephonySoftphoneEventController) and the
 * reconciliation of recordings that were captured before the lead existed or
 * before its number was filled in.
 *
 * A lead's number can sit in any of its phone fields (mobile, cell, office,
 * WhatsApp) or in its extra contact methods, so all of them are searched.
 * sipgate delivers the caller as a national number on one leg and as a full
 * international number on another, and the CRM stores numbers as free text
 * ("+90 (533) 877-30.01") or as an antd-phone-input JSON blob. Matching
 * therefore compares the stable trailing digits rather than the whole string.
 */
class LeadPhoneMatcher
{
    /** Lead columns that may hold a phone number. */
    public const PHONE_COLUMNS = ['mobile', 'cell', 'office', 'client_whatsapp'];

    /** Shortest trailing-digit window that is still specific enough to match. */
    private const MIN_SUFFIX = 6;

    private const MAX_SUFFIX = 9;

    /**
     * Reduce a stored phone value to bare digits.
     *
     * Handles the JSON shapes written by antd-phone-input
     * ({countryCode, areaCode, phoneNumber} with any part missing, or {phone}).
     */
    public function normalize(?string $value): string
    {
        if ($value === null || $value === '') {
            return '';
        }

        $decoded = json_decode($value, true);
        if (is_array($decoded)) {
            if (isset($decoded['phone']) && is_scalar($decoded['phone'])) {
                return $this->digits((string) $decoded['phone']);
            }

            $parts = array_map(
                fn ($part) => is_scalar($part) ? (string) $part : '',
                [$decoded['countryCode'] ?? '', $decoded['areaCode'] ?? '', $decoded['phoneNumber'] ?? ''],
            );

            return $this->digits(implode('', $parts));
        }

        return $this->digits($value);
    }

    /** Normalise a caller-supplied number (URI/display form) to bare digits. */
    public function normalizeIncoming(?string $number): string
    {
        return $this->digits((string) $number);
    }

    /** True when a stored phone value matches the incoming number. */
    public function matches(string $incoming, ?string $storedPhone): bool
    {
        $stored = $this->normalize($storedPhone);

        if ($stored === '' || $incoming === '') {
            return false;
        }

        if ($stored === $incoming) {
            return true;
        }

        $suffixLength = min(strlen($stored), strlen($incoming), self::MAX_SUFFIX);

        // Too short to be distinctive — require an exact match instead.
        if ($suffixLength < self::MIN_SUFFIX) {
            return false;
        }

        return substr($stored, -$suffixLength) === substr($incoming, -$suffixLength);
    }

    /** True when any of the lead's phone fields or phone contact methods match. */
    public function leadMatches(string $incoming, Lead $lead): bool
    {
        foreach (self::PHONE_COLUMNS as $column) {
            if ($this->matches($incoming, (string) $lead->getAttribute($column))) {
                return true;
            }
        }

        foreach ($lead->contactMethods as $method) {
            if ($this->isPhoneMethod($method)
                && ($this->matches($incoming, $method->normalized) || $this->matches($incoming, $method->identifier))) {
                return true;
            }
        }

        return false;
    }

    /**
     * Find all leads a caller number matches within a company.
     *
     * The SQL pre-filter keeps the candidate set small: it looks for the last
     * six digits in order with anything between them, so separators of any
     * kind (spaces, dots, slashes, JSON) cannot hide a number.
     * {@see leadMatches()} then makes the exact decision.
     *
     * @return Collection<int, Lead>
     */
    public function findLeads(int $companyId, string $incomingNumber): Collection
    {
        $incoming = $this->normalizeIncoming($incomingNumber);
        if ($incoming === '') {
            return collect();
        }

        $suffix = strlen($incoming) >= self::MIN_SUFFIX
            ? substr($incoming, -self::MIN_SUFFIX)
            : $incoming;
        $pattern = '%'.implode('%', str_split($suffix)).'%';

        return Lead::query()
            ->where('company_id', $companyId)
            ->where(function (Builder $query) use ($pattern): void {
                foreach (self::PHONE_COLUMNS as $column) {
                    $query->orWhere($column, 'like', $pattern);
                }
                $query->orWhereHas('contactMethods', function (Builder $methods) use ($pattern): void {
                    $methods->where(fn (Builder $m) => $m
                        ->where('normalized', 'like', $pattern)
                        ->orWhere('identifier', 'like', $pattern));
                });
            })
            ->with('contactMethods')
            ->get()
            ->filter(fn (Lead $lead) => $this->leadMatches($incoming, $lead))
            ->values();
    }

    /**
     * Find the single lead a caller number uniquely belongs to within a company.
     *
     * Returns null when zero leads match or when multiple leads share the number.
     */
    public function findLead(int $companyId, string $incomingNumber): ?Lead
    {
        $matches = $this->findLeads($companyId, $incomingNumber);

        return $matches->count() === 1 ? $matches->first() : null;
    }

    private function isPhoneMethod(LeadContactMethod $method): bool
    {
        $type = $method->type;

        return ($type instanceof \BackedEnum ? $type->value : (string) $type) === 'phone';
    }

    private function digits(string $value): string
    {
        return (string) preg_replace('/[^0-9]/', '', $value);
    }
}
