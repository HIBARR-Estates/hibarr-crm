<?php

namespace Tests\Unit\Http\Controllers;

use App\Http\Controllers\DealAutomationController;
use App\Models\DealAutomation;
use ReflectionMethod;
use Tests\TestCase;

/**
 * allowedTriggersFor() is what keeps a lead-subject automation from being
 * saved with a deal trigger (or vice versa) — a mismatched combination the
 * API write paths would never actually fire, since each one only emits the
 * trigger matching the subject it just wrote.
 */
class DealAutomationControllerTriggerValidationTest extends TestCase
{
    private function allowedTriggersFor(string $subjectType): array
    {
        $controller = new DealAutomationController;
        $method = new ReflectionMethod($controller, 'allowedTriggersFor');
        $method->setAccessible(true);

        return $method->invoke($controller, $subjectType);
    }

    public function test_lead_subject_excludes_deal_only_triggers(): void
    {
        $allowed = $this->allowedTriggersFor(DealAutomation::SUBJECT_LEAD);

        $this->assertContains(DealAutomation::TRIGGER_LEAD_CREATED_API, $allowed);
        $this->assertContains(DealAutomation::TRIGGER_LEAD_UPDATED_API, $allowed);
        $this->assertContains('lead_created', $allowed);
        $this->assertContains('lead_updated', $allowed);

        $this->assertNotContains(DealAutomation::TRIGGER_DEAL_CREATED_API, $allowed);
        $this->assertNotContains(DealAutomation::TRIGGER_DEAL_UPDATED_API, $allowed);
        $this->assertNotContains('deal_created', $allowed);
        $this->assertNotContains('deal_updated', $allowed);
    }

    public function test_deal_subject_excludes_lead_only_triggers(): void
    {
        $allowed = $this->allowedTriggersFor(DealAutomation::SUBJECT_DEAL);

        $this->assertContains(DealAutomation::TRIGGER_DEAL_CREATED_API, $allowed);
        $this->assertContains(DealAutomation::TRIGGER_DEAL_UPDATED_API, $allowed);
        $this->assertContains('deal_created', $allowed);
        $this->assertContains('deal_updated', $allowed);

        $this->assertNotContains(DealAutomation::TRIGGER_LEAD_CREATED_API, $allowed);
        $this->assertNotContains(DealAutomation::TRIGGER_LEAD_UPDATED_API, $allowed);
        $this->assertNotContains('lead_created', $allowed);
        $this->assertNotContains('lead_updated', $allowed);
    }

    public function test_subject_agnostic_triggers_allowed_for_both(): void
    {
        $this->assertContains('custom_field_updated', $this->allowedTriggersFor(DealAutomation::SUBJECT_LEAD));
        $this->assertContains('custom_field_updated', $this->allowedTriggersFor(DealAutomation::SUBJECT_DEAL));
        $this->assertContains(DealAutomation::TRIGGER_DATE_BASED, $this->allowedTriggersFor(DealAutomation::SUBJECT_LEAD));
        $this->assertContains(DealAutomation::TRIGGER_DATE_BASED, $this->allowedTriggersFor(DealAutomation::SUBJECT_DEAL));
    }
}
