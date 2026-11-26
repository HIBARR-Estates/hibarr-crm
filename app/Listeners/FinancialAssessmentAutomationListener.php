<?php

namespace App\Listeners;

use App\Events\FinancialAssessmentFinalised;
use App\Events\FinancialAssessmentVerified;
use App\Services\FinancialAssessment\FinancialAutomationTrigger;

/**
 * Starts the "financial assessment finalised / verified" automation triggers.
 * Both events are dispatched after the assessment's own transaction committed,
 * so an automation never reacts to a change that could still roll back.
 */
class FinancialAssessmentAutomationListener
{
    public function __construct(private readonly FinancialAutomationTrigger $trigger) {}

    public function handleFinalised(FinancialAssessmentFinalised $event): void
    {
        $this->trigger->finalised((int) $event->assessment->lead_id);
    }

    public function handleVerified(FinancialAssessmentVerified $event): void
    {
        $this->trigger->verified((int) $event->assessment->lead_id);
    }
}
