<?php

namespace Tests\Unit\Services;

use App\Services\DealAgentAssignmentService;
use PHPUnit\Framework\TestCase;

class DealAgentAssignmentServiceTest extends TestCase
{
    /**
     * @param  array<int, array<int|string, int>>  $userMap  userId => [categoryId|'*' => agentId]
     * @param  array<int, int>  $explicitMap  agentId => agentId (present means valid)
     */
    private function makeService(array $userMap = [], array $explicitMap = []): DealAgentAssignmentService
    {
        return new class($userMap, $explicitMap) extends DealAgentAssignmentService {
            /** @param array<int, array<int|string, int>> $userMap */
            public function __construct(
                private array $userMap,
                private array $explicitMap
            ) {
            }

            public function findLeadAgentIdForUser(int $userId, ?int $categoryId = null): ?int
            {
                $entries = $this->userMap[$userId] ?? [];

                if ($categoryId !== null && isset($entries[$categoryId])) {
                    return $entries[$categoryId];
                }

                return $entries['*'] ?? null;
            }

            protected function findExplicitAgentId(int $explicitAgentId): ?int
            {
                return $this->explicitMap[$explicitAgentId] ?? null;
            }
        };
    }

    public function test_explicit_agent_wins_over_owner_and_creator(): void
    {
        $service = $this->makeService(
            [
                10 => ['*' => 100],
                20 => ['*' => 200],
            ],
            [300 => 300]
        );

        $this->assertSame(300, $service->resolveAgentId(300, 10, 20));
    }

    public function test_lead_owner_is_used_when_no_explicit_agent(): void
    {
        $service = $this->makeService([
            11 => ['*' => 111],
            21 => ['*' => 211],
        ]);

        $this->assertSame(111, $service->resolveAgentId(null, 11, 21));
    }

    public function test_creator_is_used_when_lead_has_no_owner(): void
    {
        $service = $this->makeService([
            22 => ['*' => 222],
        ]);

        $this->assertSame(222, $service->resolveAgentId(null, null, 22));
    }

    public function test_falls_back_to_creator_when_owner_has_no_lead_agent(): void
    {
        $service = $this->makeService([
            23 => ['*' => 223],
        ]);

        $this->assertSame(223, $service->resolveAgentId(null, 12, 23));
    }

    public function test_returns_null_when_no_agents_exist(): void
    {
        $service = $this->makeService();

        $this->assertNull($service->resolveAgentId(null, 13, 24));
    }

    public function test_prefers_category_matched_agent_via_mapping(): void
    {
        $service = $this->makeService([
            15 => [
                '*' => 150,
                7 => 151,
            ],
        ]);

        $this->assertSame(151, $service->findLeadAgentIdForUser(15, 7));
        $this->assertSame(150, $service->findLeadAgentIdForUser(15, 99));
    }

    public function test_invalid_explicit_agent_falls_through_to_owner(): void
    {
        $service = $this->makeService(
            [17 => ['*' => 170]],
            []
        );

        $this->assertSame(170, $service->resolveAgentId(99999, 17, null));
    }

    public function test_store_path_assigns_lead_owner_when_request_omits_agent(): void
    {
        $service = $this->makeService([
            1 => [9 => 55, '*' => 55],
            2 => ['*' => 66],
        ]);

        // Same arguments DealController::store passes when agent_id is empty.
        $this->assertSame(55, $service->resolveAgentId(null, 1, 2, 9));
    }
}
