<?php

namespace Tests\Unit\EntitySummary;

use App\Models\Deal;
use App\Models\EntityAiSummary;
use App\Services\EntitySummary\DealSummaryAgentService;
use App\Services\EntitySummary\DealSummaryInputBuilder;
use App\Services\EntitySummary\DealSummaryService;
use PHPUnit\Framework\TestCase;

class DealSummaryServiceTest extends TestCase
{
    public function test_get_cached_returns_null_when_missing(): void
    {
        $service = $this->makeService(null, 'hash-a');

        $this->assertNull($service->getCached($this->makeDeal()));
    }

    public function test_get_cached_marks_summary_stale_when_hash_differs(): void
    {
        $record = $this->makeRecord([
            'status_line' => 'Old summary',
            'meta' => ['source' => 'ai', 'generated_at' => '2026-07-01T00:00:00Z'],
        ], 'old-hash');

        $service = $this->makeService($record, 'new-hash');
        $cached = $service->getCached($this->makeDeal());

        $this->assertNotNull($cached);
        $this->assertTrue($cached['meta']['is_stale']);
        $this->assertSame('Old summary', $cached['status_line']);
        $this->assertSame('ai', $cached['meta']['source']);
    }

    public function test_get_cached_fresh_when_hash_matches(): void
    {
        $record = $this->makeRecord([
            'status_line' => 'Fresh summary',
            'meta' => ['source' => 'ai', 'generated_at' => '2026-07-01T00:00:00Z'],
        ], 'same-hash');

        $service = $this->makeService($record, 'same-hash');
        $cached = $service->getCached($this->makeDeal());

        $this->assertFalse($cached['meta']['is_stale']);
    }

    public function test_existing_ai_summary_is_preferable_over_heuristic(): void
    {
        $service = $this->makeService(null, 'hash');
        $method = new \ReflectionMethod(DealSummaryService::class, 'isPreferableExisting');
        $method->setAccessible(true);

        $this->assertTrue($method->invoke($service, ['meta' => ['source' => 'ai']]));
        $this->assertTrue($method->invoke($service, ['meta' => []]));
        $this->assertFalse($method->invoke($service, ['meta' => ['source' => 'heuristic']]));
    }

    private function makeDeal(): Deal
    {
        $deal = $this->getMockBuilder(Deal::class)
            ->disableOriginalConstructor()
            ->onlyMethods([])
            ->getMock();
        $deal->id = 9;
        $deal->company_id = 1;

        return $deal;
    }

    /**
     * @param  array<string, mixed>  $summary
     */
    private function makeRecord(array $summary, string $hash): EntityAiSummary
    {
        $record = $this->getMockBuilder(EntityAiSummary::class)
            ->disableOriginalConstructor()
            ->onlyMethods([])
            ->getMock();
        $record->summary_json = $summary;
        $record->input_hash = $hash;

        return $record;
    }

    private function makeService(
        ?EntityAiSummary $findRecord,
        string $currentHash,
        ?DealSummaryAgentService $agent = null,
    ): DealSummaryService {
        $inputBuilder = $this->createMock(DealSummaryInputBuilder::class);
        $inputBuilder->method('inputHash')->willReturn($currentHash);

        $agent ??= $this->createMock(DealSummaryAgentService::class);

        return new class($agent, $inputBuilder, $findRecord) extends DealSummaryService {
            public function __construct(
                DealSummaryAgentService $agentService,
                DealSummaryInputBuilder $inputBuilder,
                private ?EntityAiSummary $stubRecord,
            ) {
                parent::__construct($agentService, $inputBuilder);
            }

            protected function findRecord(Deal $deal): ?EntityAiSummary
            {
                return $this->stubRecord;
            }
        };
    }
}
