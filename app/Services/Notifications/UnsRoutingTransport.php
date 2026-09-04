<?php

namespace App\Services\Notifications;

use App\Models\EmailDeliveryLog;
use Illuminate\Support\Facades\Log;
use Symfony\Component\Mailer\Envelope;
use Symfony\Component\Mailer\SentMessage;
use Symfony\Component\Mailer\Transport\TransportInterface;
use Symfony\Component\Mime\Email;
use Symfony\Component\Mime\RawMessage;

class UnsRoutingTransport implements TransportInterface
{
    public function __construct(
        private readonly UnsClient $unsClient,
        private readonly UnsEmailPayloadMapper $payloadMapper,
        private readonly TransportInterface $fallbackTransport,
        private readonly MailDeliveryRecorder $recorder,
    ) {}

    public function send(RawMessage $message, ?Envelope $envelope = null): ?SentMessage
    {
        // Read before mapping/sending — the payload mapper strips the Plunk
        // headers, and the fallback path needs to know a template was intended.
        $context = $message instanceof Email ? MailDeliveryContext::extract($message) : [];
        $plunkTemplateId = $this->header($message, 'X-Plunk-Template-Id');

        // Routing decision is snapshotted at notification dispatch time (HTTP context)
        // and carried via X-Uns-Route header so queue workers never call the flag service.
        $useUns = $message instanceof Email
            && $message->getHeaders()->has('X-Uns-Route')
            && $message->getHeaders()->get('X-Uns-Route')->getBodyAsString() === 'true';

        if ($message instanceof Email) {
            $message->getHeaders()->remove('X-Uns-Route');
        }

        if (! $useUns) {
            return $this->deliverViaFallback($message, $envelope, $context, $plunkTemplateId, false, null, null);
        }

        // UNS payload mapping only forwards template/body fields — attachments
        // (e.g. meeting .ics invites) must go through the SMTP mailer instead.
        if ($message instanceof Email && count($message->getAttachments()) > 0) {
            Log::info('UNS email routing skipped: message has attachments, using SMTP fallback.');

            return $this->deliverViaFallback(
                $message, $envelope, $context, $plunkTemplateId, false, null,
                'Message has attachments, which UNS cannot forward.'
            );
        }

        $unsResult = null;
        $fallbackReason = null;

        try {
            $payload = $this->payloadMapper->map($message, $envelope);
            $sent = $this->unsClient->send($payload);
            $unsResult = $this->unsClient->lastResult();

            if ($sent) {
                $this->record($message, $envelope, $context, $plunkTemplateId, [
                    'system' => EmailDeliveryLog::SYSTEM_UNS,
                    'uns_attempted' => true,
                    'status' => EmailDeliveryLog::STATUS_SENT,
                    'response_status' => $unsResult['status'] ?? null,
                    'response_body' => $this->truncate($unsResult['body'] ?? null),
                ]);

                return new SentMessage($message, $envelope ?? Envelope::create($message));
            }

            $fallbackReason = 'UNS did not accept the message.';

            Log::warning('UNS email routing failed: falling back to SMTP.', [
                'event' => $payload['event'] ?? null,
                'recipient' => $payload['data']['emailAddress'] ?? null,
                'user_id' => $payload['userId'] ?? null,
            ]);
        } catch (\Throwable $exception) {
            $unsResult = ['error' => $exception->getMessage()];
            $fallbackReason = 'UNS request threw: '.$exception->getMessage();

            Log::warning('UNS email routing failed: falling back to SMTP.', [
                'error' => $exception->getMessage(),
            ]);
        }

        return $this->deliverViaFallback($message, $envelope, $context, $plunkTemplateId, true, $unsResult, $fallbackReason);
    }

    /**
     * Hand the message to the PHP (SMTP) mailer and log the outcome. Any
     * transport exception is rethrown unchanged so callers keep seeing SMTP
     * failures exactly as they did before delivery logging existed.
     *
     * @param  array<string, mixed>  $context
     * @param  array<string, mixed>|null  $unsResult
     */
    private function deliverViaFallback(
        RawMessage $message,
        ?Envelope $envelope,
        array $context,
        ?string $plunkTemplateId,
        bool $unsAttempted,
        ?array $unsResult,
        ?string $fallbackReason,
    ): ?SentMessage {
        try {
            $sentMessage = $this->fallbackTransport->send($message, $envelope);
        } catch (\Throwable $exception) {
            $this->record($message, $envelope, $context, $plunkTemplateId, [
                'system' => EmailDeliveryLog::SYSTEM_SMTP,
                'uns_attempted' => $unsAttempted,
                'status' => EmailDeliveryLog::STATUS_FAILED,
                'response_status' => $unsResult['status'] ?? null,
                'response_body' => $this->truncate($unsResult['body'] ?? null),
                'error' => $exception->getMessage(),
                'fallback_reason' => $fallbackReason,
            ]);

            throw $exception;
        }

        $this->record($message, $envelope, $context, $plunkTemplateId, [
            'system' => EmailDeliveryLog::SYSTEM_SMTP,
            'uns_attempted' => $unsAttempted,
            'status' => EmailDeliveryLog::STATUS_SENT,
            'response_status' => $unsResult['status'] ?? null,
            'response_body' => $this->truncate($unsResult['body'] ?? null),
            'error' => $unsResult['error'] ?? null,
            'fallback_reason' => $fallbackReason,
        ]);

        return $sentMessage;
    }

    /**
     * Persist the delivery outcome and hand it to the in-process recorder for
     * synchronous callers. Never throws — a logging problem must not turn a
     * delivered email into a failed one.
     *
     * @param  array<string, mixed>  $context
     * @param  array<string, mixed>  $outcome
     */
    private function record(
        RawMessage $message,
        ?Envelope $envelope,
        array $context,
        ?string $plunkTemplateId,
        array $outcome,
    ): void {
        $recipient = $this->resolveRecipient($message, $envelope);
        $subject = $message instanceof Email ? (string) ($message->getSubject() ?? '') : '';
        $correlationId = isset($context['correlation_id']) ? (string) $context['correlation_id'] : null;

        $outcome = $outcome + [
            'recipient' => $recipient,
            'subject' => $subject,
            'plunk_template_id' => $plunkTemplateId,
            'context' => $context,
            'correlation_id' => $correlationId,
        ];

        $this->recorder->record($correlationId, $outcome);

        try {
            EmailDeliveryLog::create($outcome + [
                'company_id' => $context['company_id'] ?? null,
                'sent_at' => now(),
            ]);
        } catch (\Throwable $exception) {
            Log::error('Failed to write email delivery log.', [
                'recipient' => $recipient,
                'error' => $exception->getMessage(),
            ]);
        }
    }

    private function resolveRecipient(RawMessage $message, ?Envelope $envelope): ?string
    {
        $addresses = $envelope?->getRecipients()
            ?? ($message instanceof Email ? $message->getTo() : []);

        $first = $addresses[0] ?? null;

        return $first?->getAddress();
    }

    private function header(RawMessage $message, string $name): ?string
    {
        if (! $message instanceof Email || ! $message->getHeaders()->has($name)) {
            return null;
        }

        $value = $message->getHeaders()->get($name)->getBodyAsString();

        return $value !== '' ? $value : null;
    }

    /** Keep a pathological provider response from bloating the log row. */
    private function truncate(?string $value, int $limit = 4000): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }

        return mb_strlen($value) > $limit ? mb_substr($value, 0, $limit).'…' : $value;
    }

    public function __toString(): string
    {
        return 'uns-routing';
    }
}
