<?php

namespace App\Events;

use App\Models\FinancialAssessment;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class FinancialAssessmentVerified
{
    use Dispatchable, SerializesModels;

    public function __construct(public readonly FinancialAssessment $assessment) {}
}
