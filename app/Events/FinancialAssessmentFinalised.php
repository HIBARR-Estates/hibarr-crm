<?php

namespace App\Events;

use App\Models\FinancialAssessment;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/** A lead's assessment became its current final one (automations and the timeline listen to this). */
class FinancialAssessmentFinalised
{
    use Dispatchable, SerializesModels;

    public function __construct(
        public readonly FinancialAssessment $assessment,
        public readonly ?FinancialAssessment $superseded = null,
    ) {}
}
