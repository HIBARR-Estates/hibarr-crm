<?php

namespace App\Services\Notifications;

use App\Models\User;
use Symfony\Component\Mailer\Envelope;
use Symfony\Component\Mime\Address;
use Symfony\Component\Mime\Email;
use Symfony\Component\Mime\RawMessage;

class UnsEmailPayloadMapper
{
    /**
     * @return array<string, mixed>
     */
    public function map(RawMessage $message, ?Envelope $envelope = null): array
    {
        if (!$message instanceof Email) {
            throw new \InvalidArgumentException('UNS routing only supports Symfony Email messages.');
        }

        $recipient = $this->resolveRecipientAddress($message, $envelope);
        $sender = $this->resolveSenderAddress($message, $envelope);
        $subject = (string) ($message->getSubject() ?? '');
        $htmlBody = (string) ($message->getHtmlBody() ?? '');
        $textBody = (string) ($message->getTextBody() ?? '');
        $body = $htmlBody !== '' ? $htmlBody : $textBody;

        $recipientUser = $recipient !== '' ? $this->findUserByEmail($recipient) : null;
        $senderUser = $sender !== '' ? $this->findUserByEmail($sender) : null;
        $resolvedUserId = $this->resolveUserId($recipientUser, $senderUser);

        return [
            'event' => 'CRM_EMAIL',
            'userId' => $resolvedUserId,
            'channels' => ['email'],
            'priority' => 'DEFAULT',
            'idempotencyKey' => $this->buildIdempotencyKey($recipient, $subject, $body),
            'data' => [
                'fromEmail' => $sender,
                'emailAddress' => $recipient,
                'subject' => $subject,
                'body' => $body,
                'metadata' => [
                    'source' => 'crm',
                    'actor' => $senderUser?->id ? 'sender' : 'crm_system',
                ],
            ],
        ];
    }

    private function resolveRecipientAddress(Email $message, ?Envelope $envelope = null): string
    {
        $to = $message->getTo();
        if (count($to) > 0) {
            return (string) $to[0]->getAddress();
        }

        if ($envelope !== null && count($envelope->getRecipients()) > 0) {
            return (string) $envelope->getRecipients()[0]->getAddress();
        }

        return '';
    }

    private function resolveSenderAddress(Email $message, ?Envelope $envelope = null): string
    {
        $from = $message->getFrom();
        if (count($from) > 0) {
            return (string) $from[0]->getAddress();
        }

        if ($envelope !== null && $envelope->getSender() instanceof Address) {
            return (string) $envelope->getSender()->getAddress();
        }

        return (string) config('mail.from.address', '');
    }

    private function resolveUserId(?User $recipientUser, ?User $senderUser): int
    {
        if ($recipientUser !== null) {
            return (int) $recipientUser->id;
        }

        if ($senderUser !== null) {
            return (int) $senderUser->id;
        }

        $companyId = $senderUser?->company_id;
        $resolverFallbackUserId = $this->resolveCommunicationResolverFallbackUserId($companyId);
        if ($resolverFallbackUserId !== null) {
            return $resolverFallbackUserId;
        }

        return (int) config('services.notification_service.default_user_id', 1);
    }

    protected function resolveCommunicationResolverFallbackUserId(?int $companyId): ?int
    {
        if ($companyId === null) {
            return null;
        }

        $admins = User::allAdmins($companyId);
        $admin = $admins->first();

        return $admin?->id ? (int) $admin->id : null;
    }

    private function buildIdempotencyKey(string $recipient, string $subject, string $body): string
    {
        return 'crm-email-' . sha1($recipient . '|' . $subject . '|' . $body);
    }

    protected function findUserByEmail(string $email): ?User
    {
        return User::where('email', $email)->first();
    }
}
