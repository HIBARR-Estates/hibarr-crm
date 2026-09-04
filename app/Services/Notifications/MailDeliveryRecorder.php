<?php

namespace App\Services\Notifications;

/**
 * In-process handoff of a delivery outcome from UnsRoutingTransport back to
 * the caller that triggered the send.
 *
 * Only useful for synchronous sends (Mail::send()), where the caller can read
 * the outcome immediately after the send returns — that's how
 * DealAutomationService folds "delivered via UNS / fell back to SMTP / failed
 * with X" into the automation log row it writes for the action. Queued sends
 * are covered by the EmailDeliveryLog table instead.
 */
class MailDeliveryRecorder
{
    /** @var array<string, array<string, mixed>> keyed by correlation id */
    private array $outcomes = [];

    /**
     * @param  array<string, mixed>  $outcome
     */
    public function record(?string $correlationId, array $outcome): void
    {
        if ($correlationId === null || $correlationId === '') {
            return;
        }

        $this->outcomes[$correlationId] = $outcome;
    }

    /**
     * Read an outcome and drop it, so the recorder can't grow unbounded in a
     * long-running worker.
     *
     * @return array<string, mixed>|null
     */
    public function pull(?string $correlationId): ?array
    {
        if ($correlationId === null || ! isset($this->outcomes[$correlationId])) {
            return null;
        }

        $outcome = $this->outcomes[$correlationId];
        unset($this->outcomes[$correlationId]);

        return $outcome;
    }

    public function flush(): void
    {
        $this->outcomes = [];
    }
}
