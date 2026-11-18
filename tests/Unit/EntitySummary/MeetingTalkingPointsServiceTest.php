<?php

namespace Tests\Unit\EntitySummary;

use App\Contracts\EntitySummaryAgentInterface;
use App\Models\Deal;
use App\Models\DealFollowUp;
use App\Models\EntityAiSummary;
use App\Services\EntitySummary\DealSummaryInputBuilder;
use App\Services\EntitySummary\EntitySummaryPromptLoader;
use App\Services\EntitySummary\EntitySummaryValidator;
use App\Services\EntitySummary\LeadSummaryInputBuilder;
use App\Services\EntitySummary\MeetingTalkingPointsService;
use PHPUnit\Framework\TestCase;

class MeetingTalkingPointsServiceTest extends TestCase
{
    public function test_normalizes_points_from_the_model(): void
    {
        $points = (new EntitySummaryValidator())->normalizeMeetingTalkingPoints([
            'points' => [
                '- Open with the La Plage exposé he opened twice',
                '   ',
                ['text' => '2. Tie the inspection payment to the March trip'],
                42,
                'Ask about the ground floor',
                'Confirm who decides',
                'A fifth point that is dropped',
            ],
        ]);

        $this->assertSame([
            'Open with the La Plage exposé he opened twice',
            'Tie the inspection payment to the March trip',
            'Ask about the ground floor',
            'Confirm who decides',
        ], $points);
    }

    public function test_rejects_missing_or_empty_points(): void
    {
        $validator = new EntitySummaryValidator();

        foreach ([[], ['points' => 'text'], ['points' => ['', '  ']]] as $payload) {
            try {
                $validator->normalizeMeetingTalkingPoints($payload);
                $this->fail('Expected an exception for '.json_encode($payload));
            } catch (\InvalidArgumentException) {
                $this->addToAssertionCount(1);
            }
        }
    }

    public function test_get_cached_returns_null_without_stored_points(): void
    {
        $this->assertNull($this->makeService(null, 'deal-hash')->getCached($this->makeDeal(), $this->makeMeeting()));
    }

    public function test_get_cached_is_fresh_while_deal_and_meeting_are_unchanged(): void
    {
        $service = $this->makeService(null, 'deal-hash');
        $hash = $service->inputHash($this->makeDeal(), $this->makeMeeting());

        $cached = $this->makeService($this->makeRecord(['Open with the exposé'], $hash), 'deal-hash')
            ->getCached($this->makeDeal(), $this->makeMeeting());

        $this->assertSame(['Open with the exposé'], $cached['points']);
        $this->assertFalse($cached['meta']['is_stale']);
        $this->assertSame('ai', $cached['meta']['source']);
    }

    public function test_get_cached_is_stale_when_the_deal_changed(): void
    {
        $hash = $this->makeService(null, 'deal-hash')->inputHash($this->makeDeal(), $this->makeMeeting());

        $cached = $this->makeService($this->makeRecord(['Old point'], $hash), 'deal-hash-after-edit')
            ->getCached($this->makeDeal(), $this->makeMeeting());

        $this->assertTrue($cached['meta']['is_stale']);
        $this->assertSame(['Old point'], $cached['points']);
    }

    public function test_get_cached_is_stale_when_the_meeting_moved(): void
    {
        $service = $this->makeService(null, 'deal-hash');
        $hash = $service->inputHash($this->makeDeal(), $this->makeMeeting());

        $moved = $this->makeMeeting('2026-11-20 14:00:00');
        $cached = $this->makeService($this->makeRecord(['Old point'], $hash), 'deal-hash')->getCached($this->makeDeal(), $moved);

        $this->assertTrue($cached['meta']['is_stale']);
    }

    private function makeDeal(): Deal
    {
        $deal = $this->getMockBuilder(Deal::class)->disableOriginalConstructor()->onlyMethods([])->getMock();
        $deal->id = 9;
        $deal->company_id = 1;

        return $deal;
    }

    private function makeMeeting(string $at = '2026-11-18 11:00:00'): DealFollowUp
    {
        $meeting = $this->getMockBuilder(DealFollowUp::class)->disableOriginalConstructor()->onlyMethods([])->getMock();
        $meeting->id = 31;
        $meeting->deal_id = 9;
        $meeting->meeting_type_id = 2;
        $meeting->remark = 'Kick off';
        $meeting->status = 'pending';
        $meeting->setRawAttributes(array_merge($meeting->getAttributes(), ['next_follow_up_date' => $at]));

        return $meeting;
    }

    /**
     * @param  list<string>  $points
     */
    private function makeRecord(array $points, string $hash): EntityAiSummary
    {
        $record = $this->getMockBuilder(EntityAiSummary::class)->disableOriginalConstructor()->onlyMethods([])->getMock();
        $record->summary_json = ['points' => $points, 'meta' => ['source' => 'ai', 'generated_at' => '2026-11-17T10:00:00Z']];
        $record->input_hash = $hash;

        return $record;
    }

    private function makeService(?EntityAiSummary $record, string $dealHash): MeetingTalkingPointsService
    {
        $dealInput = $this->createMock(DealSummaryInputBuilder::class);
        $dealInput->method('inputHash')->willReturn($dealHash);

        return new class($this->createMock(EntitySummaryAgentInterface::class), $this->createMock(EntitySummaryPromptLoader::class), $dealInput, $this->createMock(LeadSummaryInputBuilder::class), new EntitySummaryValidator(), $record) extends MeetingTalkingPointsService {
            public function __construct(
                EntitySummaryAgentInterface $agent,
                EntitySummaryPromptLoader $promptLoader,
                DealSummaryInputBuilder $dealInput,
                LeadSummaryInputBuilder $leadInput,
                EntitySummaryValidator $validator,
                private ?EntityAiSummary $stubRecord,
            ) {
                parent::__construct($agent, $promptLoader, $dealInput, $leadInput, $validator);
            }

            protected function findRecord(Deal $deal, DealFollowUp $meeting): ?EntityAiSummary
            {
                return $this->stubRecord;
            }
        };
    }
}
