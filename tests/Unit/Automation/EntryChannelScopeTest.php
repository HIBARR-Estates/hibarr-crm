<?php

namespace Tests\Unit\Automation;

use App\Models\DealAutomation;
use App\Models\LeadEntry;
use App\Services\DealAutomationService;
use Tests\TestCase;

/**
 * Whether a lead_entry_received automation runs for an entry, by channel uuid. In memory: no database.
 */
class EntryChannelScopeTest extends TestCase
{
    private const ROOT = '0193a1c2-0000-7000-8000-0000000000a1';

    private const GERMAN = '0193a1c2-0000-7000-8000-0000000000b2';

    private const KICKOFF = '0193a1c2-0000-7000-8000-0000000000c3';

    private const OTHER = '0193a1c2-0000-7000-8000-0000000000d4';

    private function matchesEntryScope(?array $scope, bool $includeDescendants, ?LeadEntry $entry): bool
    {
        $automation = new DealAutomation([
            'name' => 'Route webinars',
            'trigger' => DealAutomation::TRIGGER_LEAD_ENTRY_RECEIVED,
            'entry_channel_uuids' => $scope,
            'entry_channel_include_descendants' => $includeDescendants,
        ]);
        $method = new \ReflectionMethod(DealAutomationService::class, 'matchesTriggerScope');
        $method->setAccessible(true);

        return $method->invoke(app(DealAutomationService::class), $automation, $entry ? ['entry' => $entry] : []);
    }

    private function entry(): LeadEntry
    {
        return new LeadEntry([
            'channel_uuid' => self::KICKOFF,
            'channel_ancestor_uuids' => [self::ROOT, self::GERMAN],
        ]);
    }

    public function test_no_selection_means_every_channel(): void
    {
        $this->assertTrue($this->matchesEntryScope(null, true, $this->entry()));
        $this->assertTrue($this->matchesEntryScope([], true, $this->entry()));
    }

    public function test_the_entry_channel_itself_matches(): void
    {
        $this->assertTrue($this->matchesEntryScope([self::KICKOFF], false, $this->entry()));
    }

    public function test_an_ancestor_matches_only_with_descendants_on(): void
    {
        $this->assertTrue($this->matchesEntryScope([self::GERMAN], true, $this->entry()));
        $this->assertTrue($this->matchesEntryScope([self::ROOT], true, $this->entry()));
        $this->assertFalse($this->matchesEntryScope([self::GERMAN], false, $this->entry()));
    }

    public function test_an_unrelated_channel_never_matches(): void
    {
        $this->assertFalse($this->matchesEntryScope([self::OTHER], true, $this->entry()));
        $this->assertTrue($this->matchesEntryScope([self::OTHER, self::GERMAN], true, $this->entry()));
    }

    public function test_a_scoped_automation_does_not_run_without_an_entry(): void
    {
        $this->assertFalse($this->matchesEntryScope([self::GERMAN], true, null));
    }

    public function test_the_trigger_is_known_to_automation_v2_only(): void
    {
        $method = new \ReflectionClassConstant(\App\Support\AutomationV2Feature::class, 'V2_ONLY_TRIGGERS');

        $this->assertContains(DealAutomation::TRIGGER_LEAD_ENTRY_RECEIVED, $method->getValue());
    }
}
