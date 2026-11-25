<?php

namespace App\Services\FinancialAssessment;

use RuntimeException;

/**
 * A financial assessment operation that cannot be done. The message is safe to
 * show to the user; `reason` is a stable machine code (also used as the API's skip reason).
 */
class AssessmentException extends RuntimeException
{
    public function __construct(string $message, public readonly string $reason = 'invalid')
    {
        parent::__construct($message);
    }

    public static function notADraft(): self
    {
        return new self('Only a draft assessment can be changed. Start an update to make changes.', 'assessment_locked');
    }

    public static function notFinal(): self
    {
        return new self('Only the current final assessment can be verified.', 'not_final');
    }

    public static function emptyAssessment(): self
    {
        return new self('Add at least one line before finalising.', 'empty_assessment');
    }

    public static function unknownType(string $key): self
    {
        return new self("There is no active line type \"{$key}\".", 'not_available');
    }

    public static function invalidAmount(): self
    {
        return new self('The amount must be a number of zero or more.', 'invalid_value');
    }

    public static function invalidCurrency(string $currency): self
    {
        return new self("\"{$currency}\" is not a currency or an enabled crypto asset.", 'invalid_value');
    }

    public static function overrideNeedsReason(): self
    {
        return new self('A reason is required when overriding "available now".', 'override_reason_required');
    }
}
