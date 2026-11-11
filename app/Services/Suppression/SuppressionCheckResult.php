<?php

namespace App\Services\Suppression;

use App\Models\EmailDeliveryLog;

/**
 * Outcome of one ask against OL's global suppression list.
 *
 * OL returns both the raw list membership (`wouldBlock`) and the effective
 * decision under the `communications.global-suppression` flag (`blocked`).
 * Keeping them separate is what lets the CRM honour the flag without holding
 * a flag of its own: while the flag is off nothing is withheld, but the
 * would-have-blocked outcome is still recorded.
 */
final class SuppressionCheckResult
{
    public function __construct(
        public readonly bool $blocked,
        public readonly bool $wouldBlock,
        public readonly bool $unavailable,
        public readonly string $scope,
        public readonly ?string $reason = null,
    ) {}

    public static function allowed(string $scope): self
    {
        return new self(
            blocked: false,
            wouldBlock: false,
            unavailable: false,
            scope: $scope,
        );
    }

    /**
     * The fallback policy for an unreachable check (SUP-D11): hold
     * non-transactional, deliver transactional.
     */
    public static function unavailable(string $scope): self
    {
        return new self(
            blocked: $scope !== SuppressionClient::SCOPE_TRANSACTIONAL,
            wouldBlock: false,
            unavailable: true,
            scope: $scope,
            reason: 'unavailable',
        );
    }

    /**
     * Value stored on the delivery log: a real withhold, a log-only
     * observation, or the outage fallback.
     */
    public function outcome(): ?string
    {
        if ($this->blocked) {
            return $this->unavailable
                ? EmailDeliveryLog::SUPPRESSION_UNAVAILABLE
                : EmailDeliveryLog::SUPPRESSION_BLOCKED;
        }

        if ($this->wouldBlock) {
            return EmailDeliveryLog::SUPPRESSION_WOULD_HAVE_BLOCKED;
        }

        return null;
    }
}
