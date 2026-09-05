<?php

namespace App\Services\Notifications;

use Symfony\Component\Mime\Email;

/**
 * Carries the origin of an outgoing email (which automation, which deal/lead)
 * from the code that builds the Mailable/Notification down to
 * UnsRoutingTransport, which is the only place that knows how the message was
 * actually delivered.
 *
 * A header is used rather than a request-scoped service because notifications
 * are queued — by the time the transport runs, the original request is gone,
 * but the serialized message still carries its headers.
 */
class MailDeliveryContext
{
    public const HEADER = 'X-Crm-Mail-Context';

    /**
     * Attach the context to a Symfony message. Values must be JSON-scalar.
     *
     * @param  array<string, mixed>  $context
     */
    public static function attach(Email $message, array $context): void
    {
        $message->getHeaders()->addTextHeader(
            self::HEADER,
            base64_encode((string) json_encode($context))
        );
    }

    /**
     * Read and strip the context header. Returns [] when absent or unreadable
     * so a malformed header can never break a send.
     *
     * @return array<string, mixed>
     */
    public static function extract(Email $message): array
    {
        if (! $message->getHeaders()->has(self::HEADER)) {
            return [];
        }

        $raw = $message->getHeaders()->get(self::HEADER)->getBodyAsString();
        $message->getHeaders()->remove(self::HEADER);

        if ($raw === '') {
            return [];
        }

        $decoded = json_decode((string) base64_decode($raw, true), true);

        return is_array($decoded) ? $decoded : [];
    }
}
