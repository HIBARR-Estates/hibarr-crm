<?php

namespace Tests\Unit\Support;

use App\Models\DealAutomation;
use App\Support\AutomationV2Feature;
use Tests\Concerns\SetsFeatureFlags;
use Tests\TestCase;

class AutomationV2FeatureTest extends TestCase
{
    use SetsFeatureFlags;

    public function test_supports_legacy_deal_automation_when_flag_off(): void
    {
        $this->setFeatureFlag(AutomationV2Feature::FLAG, false);

        $automation = new DealAutomation([
            'subject_type' => DealAutomation::SUBJECT_DEAL,
            'trigger' => 'deal_updated',
            'wait_duration_value' => null,
        ]);
        $automation->setRelation('actions', collect([
            (object) ['action_type' => 'stage_transition'],
        ]));

        $this->assertTrue(AutomationV2Feature::supportsAutomation($automation));
    }

    public function test_rejects_lead_automation_when_flag_off(): void
    {
        $this->setFeatureFlag(AutomationV2Feature::FLAG, false);

        $automation = new DealAutomation([
            'subject_type' => DealAutomation::SUBJECT_LEAD,
            'trigger' => 'lead_created',
        ]);
        $automation->setRelation('actions', collect([
            (object) ['action_type' => 'set_field_value'],
        ]));

        $this->assertFalse(AutomationV2Feature::supportsAutomation($automation));
    }

    public function test_rejects_v2_action_types_when_flag_off(): void
    {
        $this->setFeatureFlag(AutomationV2Feature::FLAG, false);

        $this->assertFalse(AutomationV2Feature::supportsActionType('send_email'));
        $this->assertTrue(AutomationV2Feature::supportsActionType('lock_deal'));
    }

    public function test_allows_all_action_types_when_flag_on(): void
    {
        $this->setFeatureFlag(AutomationV2Feature::FLAG, true);

        $this->assertTrue(AutomationV2Feature::supportsActionType('send_email'));
        $this->assertFalse(AutomationV2Feature::usesLegacyDealPipelineScope());
    }

    public function test_deactivate_if_unsupported_is_no_op_when_flag_on(): void
    {
        $this->setFeatureFlag(AutomationV2Feature::FLAG, true);

        $automation = new DealAutomation([
            'subject_type' => DealAutomation::SUBJECT_LEAD,
            'active' => true,
        ]);

        AutomationV2Feature::deactivateIfUnsupported($automation);

        $this->assertTrue($automation->active);
    }
}
