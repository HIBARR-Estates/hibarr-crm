<?php

namespace App\Services\Notifications;

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
    ) {
    }

    public function send(RawMessage $message, ?Envelope $envelope = null): ?SentMessage
    {
        // Routing decision is snapshotted at notification dispatch time (HTTP context)
        // and carried via X-Uns-Route header so queue workers never call the flag service.
        $useUns = $message instanceof Email
            && $message->getHeaders()->has('X-Uns-Route')
            && $message->getHeaders()->get('X-Uns-Route')->getBodyAsString() === 'true';

        if ($message instanceof Email) {
            $message->getHeaders()->remove('X-Uns-Route');
        }

        if (!$useUns) {
            return $this->fallbackTransport->send($message, $envelope);
        }

        // UNS payload mapping only forwards template/body fields — attachments
        // (e.g. meeting .ics invites) must go through the SMTP mailer instead.
        if ($message instanceof Email && count($message->getAttachments()) > 0) {
            Log::info('UNS email routing skipped: message has attachments, using SMTP fallback.');

            return $this->fallbackTransport->send($message, $envelope);
        }

        try {
            $payload = $this->payloadMapper->map($message, $envelope);
            $sent = $this->unsClient->send($payload);

            if (!$sent) {
                Log::error('UNS email routing failed: unable to dispatch notification.', [
                    'event' => $payload['event'] ?? null,
                    'recipient' => $payload['data']['emailAddress'] ?? null,
                    'user_id' => $payload['userId'] ?? null,
                ]);

                throw new \RuntimeException('UNS email routing failed: unable to dispatch notification.');
            }

            return new SentMessage($message, $envelope ?? Envelope::create($message));
        } catch (\RuntimeException $exception) {
            throw $exception;
        } catch (\Throwable $exception) {
            Log::error('UNS email routing failed with exception.', [
                'error' => $exception->getMessage(),
            ]);

            throw new \RuntimeException(
                'UNS email routing failed: '.$exception->getMessage(),
                0,
                $exception
            );
        }
    }

    public function __toString(): string
    {
        return 'uns-routing';
    }
}
