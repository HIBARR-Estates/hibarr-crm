<?php

namespace App\Services\Notifications;

use App\Models\EmailDeliveryLog;
use App\Services\Suppression\SuppressionCheckResult;
use App\Services\Suppression\SuppressionClient;
use Illuminate\Support\Facades\Log;
use Symfony\Component\Mailer\Envelope;
use Symfony\Component\Mailer\SentMessage;
use Symfony\Component\Mailer\Transport\TransportInterface;
use Symfony\Component\Mime\Email;
use Symfony\Component\Mime\RawMessage;

class UnsRoutingTransport implements TransportInterface
{
    private readonly SuppressionClient $suppressionClient;

    public function __construct(
        private readonly UnsClient $unsClient,
        private readonly UnsEmailPayloadMapper $payloadMapper,
        private readonly TransportInterface $fallbackTransport,
        private readonly MailDeliveryRecorder $recorder,
        ?SuppressionClient $suppressionClient = null,
    ) {
        $this->suppressionClient = $suppressionClient ?? app(SuppressionClient::class);
    }

    public function send(RawMessage $message, ?Envelope $envelope = null): ?SentMessage
    {
        // Read before mapping/sending — the payload mapper strips the Plunk
        // headers, and the fallback path needs to know a template was intended.
        $context = $message instanceof Email ? MailDeliveryContext::extract($message) : [];
        $plunkTemplateId = $this->header($message, 'X-Plunk-Template-Id');
        $category = $message instanceof Email
            ? MailCategory::peek($message)
            : MailCategory::NON_TRANSACTIONAL;

        // Routing decision is snapshotted at notification dispatch time (HTTP context)
        // and carried via X-Uns-Route header so queue workers never call the flag service.
        $useUns = $message instanceof Email
            && $message->getHeaders()->has('X-Uns-Route')
            && $message->getHeaders()->get('X-Uns-Route')->getBodyAsString() === 'true';

        if ($message instanceof Email) {
            $message->getHeaders()->remove('X-Uns-Route');
        }

        if (! $useUns) {
            return $this->deliverViaFallback($message, $envelope, $context, $plunkTemplateId, false, null, null, $category);
        }

        // UNS payload mapping only forwards template/body fields — attachments
        // (e.g. meeting .ics invites) must go through the SMTP mailer instead.
        if ($message instanceof Email && count($message->getAttachments()) > 0) {
            Log::info('UNS email routing skipped: message has attachments, using SMTP fallback.');

            return $this->deliverViaFallback(
                $message, $envelope, $context, $plunkTemplateId, false, null,
                'Message has attachments, which UNS cannot forward.', $category
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
                'user_id' => $payload['userId'] ?? null,
                'correlation_id' => $context['correlation_id'] ?? null,
            ]);
        } catch (\Throwable $exception) {
            $unsResult = ['error' => $exception->getMessage()];
            $fallbackReason = 'UNS request threw: '.$exception->getMessage();

            Log::warning('UNS email routing failed: falling back to SMTP.', [
                'error' => $exception->getMessage(),
            ]);
        }

        return $this->deliverViaFallback($message, $envelope, $context, $plunkTemplateId, true, $unsResult, $fallbackReason, $category);
    }

    /**
     * Hand the message to the PHP (SMTP) mailer and log the outcome. Any
     * transport exception is rethrown unchanged so callers keep seeing SMTP
     * failures exactly as they did before delivery logging existed.
     *
     * Every fallback send is checked against OL's global suppression list
     * first (SUP-D11): a blocked recipient is withheld and reported as a
     * normal send, while an unreachable check holds non-transactional mail
     * and lets transactional mail through with an alert.
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
        string $category = MailCategory::NON_TRANSACTIONAL,
    ): ?SentMessage {
        $suppression = $this->checkSuppression($message, $envelope, $category);

        // The category is CRM-internal bookkeeping; never leak it as a header.
        if ($message instanceof Email && $message->getHeaders()->has(MailCategory::HEADER)) {
            $message->getHeaders()->remove(MailCategory::HEADER);
        }

        if ($suppression['blocked']) {
            $this->record($message, $envelope, $context, $plunkTemplateId, [
                'system' => EmailDeliveryLog::SYSTEM_SUPPRESSION,
                'uns_attempted' => $unsAttempted,
                'status' => EmailDeliveryLog::STATUS_BLOCKED,
                'response_status' => $unsResult['status'] ?? null,
                'response_body' => $this->truncate($unsResult['body'] ?? null),
                'fallback_reason' => $fallbackReason,
                'suppression_status' => $suppression['outcome'],
                'suppression_reason' => $suppression['reason'],
                'suppression_scope' => $suppression['scope'],
            ]);

            // Callers treat a withheld message as a normal, non-throwing send.
            return new SentMessage($message, $envelope ?? Envelope::create($message));
        }

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
                'suppression_status' => $suppression['outcome'],
                'suppression_reason' => $suppression['reason'],
                'suppression_scope' => $suppression['scope'],
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
            'suppression_status' => $suppression['outcome'],
            'suppression_reason' => $suppression['reason'],
            'suppression_scope' => $suppression['scope'],
        ]);

        return $sentMessage;
    }

    /**
     * Check every recipient of the message against OL, using the scope implied
     * by the message's declared category.
     *
     * @return array{blocked: bool, outcome: ?string, reason: ?string, scope: string}
     */
    private function checkSuppression(RawMessage $message, ?Envelope $envelope, string $category): array
    {
        $scope = MailCategory::scope($category);
        $emails = $this->recipientAddresses($message, $envelope);

        if ($emails === []) {
            return ['blocked' => false, 'outcome' => null, 'reason' => null, 'scope' => $scope];
        }

        try {
            $results = $this->suppressionClient->checkBatch(
                array_map(
                    fn (string $email): array => ['email' => $email, 'scope' => $scope],
                    $emails
                )
            );
        } catch (\Throwable $exception) {
            // The client is designed not to throw, but a send must never be
            // turned into a failure by the gate itself: apply the outage rule.
            Log::critical('Suppression check threw during fallback send.', [
                'error' => $exception->getMessage(),
                'scope' => $scope,
                'recipients' => count($emails),
            ]);

            $results = array_map(
                fn (): SuppressionCheckResult => SuppressionCheckResult::unavailable($scope),
                $emails
            );
        }

        $blocked = false;
        $unavailable = false;
        $wouldBlock = false;
        $reason = null;

        foreach ($results as $result) {
            $blocked = $blocked || $result->blocked;
            $unavailable = $unavailable || $result->unavailable;
            $wouldBlock = $wouldBlock || $result->wouldBlock;

            if ($reason === null && $result->reason !== null) {
                $reason = $result->reason;
            }
        }

        $outcome = match (true) {
            $blocked && $unavailable && ! $wouldBlock => EmailDeliveryLog::SUPPRESSION_UNAVAILABLE,
            $blocked => EmailDeliveryLog::SUPPRESSION_BLOCKED,
            $unavailable => EmailDeliveryLog::SUPPRESSION_UNAVAILABLE,
            $wouldBlock => EmailDeliveryLog::SUPPRESSION_WOULD_HAVE_BLOCKED,
            default => null,
        };

        return [
            'blocked' => $blocked,
            'outcome' => $outcome,
            'reason' => $reason,
            'scope' => $scope,
        ];
    }

    /**
     * Every address the message will actually reach. The envelope is
     * authoritative when present (BCC recipients only live there).
     *
     * @return array<int, string>
     */
    private function recipientAddresses(RawMessage $message, ?Envelope $envelope): array
    {
        $addresses = $envelope?->getRecipients() ?? [];

        if ($addresses === []) {
            $addresses = $message instanceof Email ? $message->getTo() : [];
        }

        $emails = [];

        foreach ($addresses as $address) {
            $email = trim((string) $address->getAddress());
            if ($email !== '') {
                $emails[$email] = $email;
            }
        }

        return array_values($emails);
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
        // `subject` is a varchar column — a long one would fail the insert and
        // cost us the delivery record entirely, so trim it the same way an
        // oversized provider response body is trimmed.
        $subject = $message instanceof Email ? $this->truncate((string) ($message->getSubject() ?? ''), 250) : null;
        $correlationId = isset($context['correlation_id']) ? (string) $context['correlation_id'] : null;

        $outcome = $outcome + [
            'recipient' => $recipient,
            'subject' => $subject,
            'plunk_template_id' => $plunkTemplateId,
            'context' => $context,
            'correlation_id' => $correlationId,
        ];

        $this->recorder->record($correlationId, $outcome);

        $logOutcome = $outcome;

        // `suppression_reason` is a 191-character column. Cap only the DB
        // copy: the in-process recorder keeps the original outcome.
        if (isset($logOutcome['suppression_reason']) && is_string($logOutcome['suppression_reason'])) {
            $logOutcome['suppression_reason'] = mb_substr($logOutcome['suppression_reason'], 0, 191);
        }

        try {
            EmailDeliveryLog::create($logOutcome + [
                'company_id' => $context['company_id'] ?? null,
                'sent_at' => now(),
            ]);
        } catch (\Throwable $exception) {
            // Correlation id rather than the recipient address — this line goes
            // to the shared application log, which has no business holding an
            // end user's email address.
            Log::error('Failed to write email delivery log.', [
                'correlation_id' => $correlationId,
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
