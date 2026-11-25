<?php

namespace App\Services\FinancialAssessment;

use App\Enums\FinancialKindRole;
use App\Enums\FinancialLineCertainty;
use App\Enums\FinancialLineFrequency;
use Carbon\CarbonInterface;

/**
 * One assessment line as the calculator sees it: plain values only, so the
 * calculation can be run and tested without a database.
 */
final class AssessmentLineInput
{
    public function __construct(
        public readonly string $typeKey,
        public readonly string $kindKey,
        public readonly FinancialKindRole $role,
        public readonly float $amount,
        public readonly string $currency,
        public readonly FinancialLineFrequency $frequency,
        public readonly FinancialLineCertainty $certainty,
        public readonly ?CarbonInterface $availableFrom = null,
    ) {}
}
