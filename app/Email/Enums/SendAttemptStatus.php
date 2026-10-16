<?php

namespace App\Email\Enums;

/**
 * Where an outbound message stands, as the CRM knows it. "Sent" means the
 * provider accepted it — there is deliberately no "delivered".
 */
enum SendAttemptStatus: string
{
    case Sending = 'sending';
    case Sent = 'sent';
    case Failed = 'failed';
    /** Outcome unknown (timeout, dropped connection): reconcile before assuming either way. */
    case Checking = 'checking';
    case WaitingQuota = 'waiting_quota';

    public function isRetryable(): bool
    {
        return in_array($this, [self::Failed, self::Checking, self::WaitingQuota], true);
    }
}
