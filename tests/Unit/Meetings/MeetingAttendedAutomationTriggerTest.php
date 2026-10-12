<?php

namespace Tests\Unit\Meetings;

use App\Enums\MeetingAttendanceOutcome;
use App\Models\Deal;
use App\Models\DealAutomation;
use App\Models\DealFollowUp;
use App\Models\Lead;
use App\Services\DealActivityEventService;
use App\Services\DealAutomationService;
use App\Services\MeetingAttendanceConfirmationService;
use App\Support\AutomationV2Feature;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Mockery;
use Mockery\MockInterface;
use ReflectionMethod;
use Tests\Concerns\SetsFeatureFlags;
use Tests\TestCase;

/**
 * The single meeting_attended trigger feeds the Meta "Contact"
 * conversion, so the rules that matter are: fire only on the move *into*
 * Attended (never for other outcomes, never again for an already-attended
 * meeting), run it for the deal or the lead depending on what the meeting is attached to,
 * and never let a failing automation escape into the outcome-logging flow.
 *
 * The dispatch step is exercised directly: confirm()/update() wrap it in
 * note/timeline writes that need the full CRM schema and are covered elsewhere.
 */
class MeetingAttendedAutomationTriggerTest extends TestCase
{
    use SetsFeatureFlags;

    private MockInterface $automations;

    protected function setUp(): void
    {
        parent::setUp();

        Config::set('database.default', 'sqlite');
        Config::set('database.connections.sqlite.database', ':memory:');
        DB::purge('sqlite');
        DB::reconnect('sqlite');

        $this->automations = Mockery::mock(DealAutomationService::class);
        $this->app->instance(DealAutomationService::class, $this->automations);
    }

    public function test_attended_deal_meeting_fires_the_deal_trigger(): void
    {
        $deal = new Deal;
        $deal->id = 7;

        $this->automations->shouldReceive('process')->once()->with($deal, 'meeting_attended', ['meeting_type_id' => null]);
        $this->automations->shouldNotReceive('processLead');

        $this->dispatch($this->followUp(deal: $deal), MeetingAttendanceOutcome::Attended, null);
    }

    public function test_attended_lead_only_meeting_fires_the_same_trigger_for_the_lead(): void
    {
        $lead = new Lead;
        $lead->id = 9;

        $this->automations->shouldReceive('processLead')->once()->with($lead, 'meeting_attended', ['meeting_type_id' => null]);
        $this->automations->shouldNotReceive('process');

        $this->dispatch($this->followUp(lead: $lead), MeetingAttendanceOutcome::Attended, null);
    }

    public function test_deal_meeting_does_not_also_fire_the_lead_trigger(): void
    {
        $deal = new Deal;
        $deal->id = 7;
        $lead = new Lead;
        $lead->id = 9;

        $this->automations->shouldReceive('process')->once()->with($deal, 'meeting_attended', ['meeting_type_id' => null]);
        $this->automations->shouldNotReceive('processLead');

        $this->dispatch($this->followUp(deal: $deal, lead: $lead), MeetingAttendanceOutcome::Attended, null);
    }

    public function test_changing_from_another_outcome_to_attended_fires(): void
    {
        $deal = new Deal;
        $deal->id = 7;

        $this->automations->shouldReceive('process')->once()->with($deal, 'meeting_attended', ['meeting_type_id' => null]);

        $this->dispatch($this->followUp(deal: $deal), MeetingAttendanceOutcome::Attended, 'no_show');
    }

    public function test_re_saving_an_already_attended_meeting_does_not_fire_again(): void
    {
        $deal = new Deal;
        $deal->id = 7;

        $this->automations->shouldNotReceive('process');
        $this->automations->shouldNotReceive('processLead');

        $this->dispatch($this->followUp(deal: $deal), MeetingAttendanceOutcome::Attended, 'attended');
    }

    /**
     * @dataProvider nonAttendedOutcomes
     */
    public function test_other_outcomes_never_fire(MeetingAttendanceOutcome $outcome): void
    {
        $deal = new Deal;
        $deal->id = 7;

        $this->automations->shouldNotReceive('process');
        $this->automations->shouldNotReceive('processLead');

        $this->dispatch($this->followUp(deal: $deal), $outcome, null);
    }

    /** @return array<string, array{MeetingAttendanceOutcome}> */
    public static function nonAttendedOutcomes(): array
    {
        return [
            'no show' => [MeetingAttendanceOutcome::NoShow],
            'rescheduled' => [MeetingAttendanceOutcome::Rescheduled],
            'cancelled' => [MeetingAttendanceOutcome::Cancelled],
            'partial' => [MeetingAttendanceOutcome::Partial],
        ];
    }

    public function test_a_failing_automation_does_not_escape_into_outcome_logging(): void
    {
        $deal = new Deal;
        $deal->id = 7;

        $this->automations->shouldReceive('process')->once()->andThrow(new \RuntimeException('meta is down'));

        $this->dispatch($this->followUp(deal: $deal), MeetingAttendanceOutcome::Attended, null);

        $this->addToAssertionCount(1); // reaching here without an exception is the assertion
    }

    public function test_new_triggers_are_v2_only(): void
    {
        $this->setFeatureFlag(AutomationV2Feature::FLAG, false);

        foreach ([DealAutomation::SUBJECT_DEAL, DealAutomation::SUBJECT_LEAD] as $subject) {
            $automation = new DealAutomation(['trigger' => DealAutomation::TRIGGER_MEETING_ATTENDED, 'subject_type' => $subject]);

            $this->assertFalse(
                AutomationV2Feature::supportsAutomation($automation),
                'meeting_attended drives v2-only actions (meta_conversion) and must not run on the legacy engine.'
            );
        }

        $this->setFeatureFlag(AutomationV2Feature::FLAG, true);

        $this->assertTrue(AutomationV2Feature::supportsAutomation(
            new DealAutomation(['trigger' => DealAutomation::TRIGGER_MEETING_ATTENDED, 'subject_type' => DealAutomation::SUBJECT_DEAL])
        ));
    }

    public function test_dispatch_passes_the_meetings_type_so_automations_can_scope_to_it(): void
    {
        $deal = new Deal;
        $deal->id = 7;

        $followUp = $this->followUp(deal: $deal);
        $followUp->meeting_type_id = 4;

        $this->automations->shouldReceive('process')->once()->with($deal, 'meeting_attended', ['meeting_type_id' => 4]);

        $this->dispatch($followUp, MeetingAttendanceOutcome::Attended, null);
    }

    public function test_meeting_type_scope_only_matches_selected_types(): void
    {
        $scoped = new DealAutomation([
            'trigger' => DealAutomation::TRIGGER_MEETING_ATTENDED,
            'meeting_type_ids' => [2, 3],
        ]);

        $this->assertTrue($this->matchesScope($scoped, ['meeting_type_id' => 3]));
        $this->assertFalse($this->matchesScope($scoped, ['meeting_type_id' => 9]));
        $this->assertFalse($this->matchesScope($scoped, ['meeting_type_id' => null]), 'A meeting with no type never matches a scoped automation.');
    }

    public function test_unscoped_automations_match_every_meeting_type(): void
    {
        $this->assertTrue($this->matchesScope(
            new DealAutomation(['trigger' => DealAutomation::TRIGGER_MEETING_ATTENDED, 'meeting_type_ids' => []]),
            ['meeting_type_id' => 9]
        ));
        $this->assertTrue($this->matchesScope(
            new DealAutomation(['trigger' => DealAutomation::TRIGGER_MEETING_ATTENDED, 'meeting_type_ids' => null]),
            ['meeting_type_id' => null]
        ));
        // The scope only applies to the meeting_attended trigger.
        $this->assertTrue($this->matchesScope(
            new DealAutomation(['trigger' => 'deal_updated', 'meeting_type_ids' => [2]]),
            ['meeting_type_id' => 9]
        ));
    }

    /** @param array<string, mixed> $context */
    private function matchesScope(DealAutomation $automation, array $context): bool
    {
        $service = (new \ReflectionClass(\App\Services\DealAutomationService::class))->newInstanceWithoutConstructor();
        $method = new \ReflectionMethod($service, 'matchesTriggerScope');
        $method->setAccessible(true);

        return $method->invoke($service, $automation, $context);
    }

    private function followUp(?Deal $deal = null, ?Lead $lead = null): DealFollowUp
    {
        $followUp = new DealFollowUp;
        $followUp->id = 1;
        $followUp->setRelation('deal', $deal);
        $followUp->setRelation('lead', $lead);

        return $followUp;
    }

    private function dispatch(DealFollowUp $followUp, MeetingAttendanceOutcome $outcome, ?string $previousOutcome): void
    {
        $service = new MeetingAttendanceConfirmationService(Mockery::mock(DealActivityEventService::class));

        $method = new ReflectionMethod($service, 'dispatchMeetingAttendedAutomations');
        $method->setAccessible(true);
        $method->invoke($service, $followUp, $outcome, $previousOutcome);
    }
}
