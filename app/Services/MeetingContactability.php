<?php

namespace App\Services;

use App\Enums\LeadContactMethodType;
use App\Models\Lead;

/**
 * Whether the person a meeting is with can actually be reached the way the
 * meeting is set up to run.
 *
 * An online meeting is sent to an email address; a phone meeting needs a
 * number to call; an in-person meeting still has to be confirmed with the
 * person, by either. A lead with none of those cannot be met at all. The
 * schedule dialog shows this as the user chooses the method, and the store
 * endpoint checks it again, so a meeting is never created for a person nobody
 * can get hold of.
 */
final class MeetingContactability
{
    /** The meeting is sent to an email address. */
    public const NEEDS_EMAIL = 'email';

    /** The meeting is a call, so it needs a number. */
    public const NEEDS_PHONE = 'phone';

    /** In person or something else: any way to reach them will do. */
    public const NEEDS_ANY = 'any';

    /** Locations whose invite and link are delivered by email. */
    private const ONLINE_LOCATIONS = ['zoom', 'zoho', 'zoho_meet', 'google_meet', 'meet', 'teams'];

    /** Fewer digits than this is not a number anyone can dial. */
    private const MIN_PHONE_DIGITS = 5;

    /**
     * Every distinct email and phone number on the lead: the main fields plus
     * the extra contact methods.
     *
     * @return array{emails: list<string>, phones: list<string>}
     */
    public static function forLead(?Lead $lead): array
    {
        if ($lead === null) {
            return ['emails' => [], 'phones' => []];
        }

        $emails = [];
        $phones = [];

        self::addEmail($emails, $lead->client_email);
        self::addPhone($phones, $lead->mobile_with_phonecode ?? $lead->mobile);
        self::addPhone($phones, $lead->cell);
        self::addPhone($phones, $lead->office_phone_formatted ?? $lead->office);
        self::addPhone($phones, $lead->client_whatsapp);

        foreach ($lead->contactMethods as $method) {
            $type = $method->type instanceof LeadContactMethodType ? $method->type->value : (string) $method->type;

            if ($type === LeadContactMethodType::Email->value) {
                self::addEmail($emails, $method->identifier);
            } elseif ($type === LeadContactMethodType::Phone->value) {
                self::addPhone($phones, $method->identifier);
            }
        }

        return ['emails' => array_values($emails), 'phones' => array_values($phones)];
    }

    /** What a meeting held at $location needs from the person. */
    public static function requirement(?string $location): string
    {
        $location = strtolower(trim((string) $location));

        if (in_array($location, self::ONLINE_LOCATIONS, true)) {
            return self::NEEDS_EMAIL;
        }

        return $location === 'phone' ? self::NEEDS_PHONE : self::NEEDS_ANY;
    }

    /**
     * What is missing for a meeting at $location, or null when the person can
     * be reached the way it needs.
     *
     * @param  array{emails: list<string>, phones: list<string>}  $contact
     * @return self::NEEDS_*|null
     */
    public static function shortfall(?string $location, array $contact): ?string
    {
        $hasEmail = $contact['emails'] !== [];
        $hasPhone = $contact['phones'] !== [];

        return match (self::requirement($location)) {
            self::NEEDS_EMAIL => $hasEmail ? null : self::NEEDS_EMAIL,
            self::NEEDS_PHONE => $hasPhone ? null : self::NEEDS_PHONE,
            default => $hasEmail || $hasPhone ? null : self::NEEDS_ANY,
        };
    }

    /**
     * @param  array<string, string>  $emails
     */
    private static function addEmail(array &$emails, mixed $value): void
    {
        $email = trim((string) $value);

        if ($email !== '' && str_contains($email, '@')) {
            $emails[strtolower($email)] ??= $email;
        }
    }

    /**
     * @param  array<string, string>  $phones
     */
    private static function addPhone(array &$phones, mixed $value): void
    {
        $phone = trim((string) $value);
        $digits = preg_replace('/\D+/', '', $phone) ?? '';

        if (strlen($digits) >= self::MIN_PHONE_DIGITS) {
            $phones[$digits] ??= $phone;
        }
    }
}
