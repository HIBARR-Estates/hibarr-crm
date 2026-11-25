<?php

namespace App\Services\FinancialAssessment;

/** Finalising needs an exchange rate that could not be fetched; nothing is ever finalised on a guess. */
class MissingRatesException extends AssessmentException
{
    /** @param list<string> $missing currencies with no rate */
    public function __construct(public readonly array $missing)
    {
        parent::__construct(
            'No exchange rate is available for '.implode(', ', $missing).'. Try again or enter a rate by hand.',
            'missing_rates',
        );
    }
}
