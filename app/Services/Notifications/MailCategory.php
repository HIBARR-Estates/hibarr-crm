<?php

namespace App\Services\Notifications;

use Symfony\Component\Mime\Email;

/**
 * The suppression category a CRM email declares when it is handed to the
 * sending service. Release 1 has two categories only, mirroring OL's scopes:
 * `transactional` and `non_transactional`.
 *
 * The header travels on the Symfony message so it survives queueing and is
 * available both to the UNS payload mapper and to the SMTP fallback's
 * suppression check. An email with no header is treated as non-transactional
 * (and therefore checked against the stricter scope) — the same default OL
 * applies to an untagged send.
 */
final class MailCategory
{
    public const HEADER = 'X-Crm-Mail-Category';

    public const TRANSACTIONAL = 'transactional';

    public const NON_TRANSACTIONAL = 'non_transactional';

    public const SUPPRESSION_SCOPE_TRANSACTIONAL = 'transactional';

    public const SUPPRESSION_SCOPE_NON_TRANSACTIONAL = 'non_transactional';

    public static function resolve(?string $category): string
    {
        return trim((string) $category) === self::TRANSACTIONAL
            ? self::TRANSACTIONAL
            : self::NON_TRANSACTIONAL;
    }

    public static function scope(?string $category): string
    {
        return self::resolve($category) === self::TRANSACTIONAL
            ? self::SUPPRESSION_SCOPE_TRANSACTIONAL
            : self::SUPPRESSION_SCOPE_NON_TRANSACTIONAL;
    }

    public static function attach(Email $message, string $category): void
    {
        $message->getHeaders()->addTextHeader(self::HEADER, self::resolve($category));
    }

    /**
     * Read the category without consuming the header. Used by the transport
     * to decide the fallback check before the UNS mapper strips the header.
     */
    public static function peek(Email $message): string
    {
        if (! $message->getHeaders()->has(self::HEADER)) {
            return self::NON_TRANSACTIONAL;
        }

        $value = $message->getHeaders()->get(self::HEADER)->getBodyAsString();

        return self::resolve($value);
    }

    /**
     * Read and strip the category header. Defaults to non-transactional when
     * it is absent so an untagged send is never mistaken for transactional.
     */
    public static function fromMessage(Email $message): string
    {
        $category = self::peek($message);

        if ($message->getHeaders()->has(self::HEADER)) {
            $message->getHeaders()->remove(self::HEADER);
        }

        return $category;
    }
}
